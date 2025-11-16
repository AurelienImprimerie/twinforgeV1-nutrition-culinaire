/**
 * Proactive Suggestion Engine
 * Manages timing and display logic for proactive user suggestions
 * Provides context-aware recommendations at optimal moments
 */

import type {
  ProactiveSuggestion,
  MissingDataReport,
  AppContext,
  ForgeType,
} from '../types';
import { supabase } from '../../supabase/client';
import logger from '../../../lib/utils/logger';

interface SuggestionTiming {
  timing: 'now' | 'after-training' | 'morning' | 'evening' | 'weekly';
  timeWindow?: { start: number; end: number };
  dayOfWeek?: number;
  cooldownHours: number;
}

interface SuggestionHistory {
  suggestionId: string;
  shownAt: Date;
  dismissedAt?: Date;
  completedAt?: Date;
}

export class ProactiveSuggestionEngine {
  private userId: string;

  private readonly TIMING_RULES: Record<string, SuggestionTiming> = {
    'now': {
      timing: 'now',
      cooldownHours: 1,
    },
    'morning': {
      timing: 'morning',
      timeWindow: { start: 6, end: 10 },
      cooldownHours: 24,
    },
    'evening': {
      timing: 'evening',
      timeWindow: { start: 18, end: 22 },
      cooldownHours: 24,
    },
    'after-training': {
      timing: 'after-training',
      cooldownHours: 4,
    },
    'weekly': {
      timing: 'weekly',
      timeWindow: { start: 9, end: 12 },
      dayOfWeek: 0,
      cooldownHours: 7 * 24,
    },
  };

  private readonly DISMISSAL_COOLDOWN_DAYS = 7;
  private readonly COMPLETION_COOLDOWN_DAYS = 30;

  constructor(userId: string) {
    this.userId = userId;
  }

  /**
   * Get active suggestions based on missing data and current context
   */
  async getActiveSuggestions(
    missingDataReport: MissingDataReport,
    appContext: AppContext,
    sessionContext: { lastSessionDate: string | null }
  ): Promise<ProactiveSuggestion[]> {
    try {
      const { suggestions } = missingDataReport;

      if (suggestions.length === 0) {
        logger.debug('PROACTIVE_SUGGESTIONS', 'No suggestions from missing data report');
        return [];
      }

      const history = await this.getSuggestionHistory();
      const activeSuggestions: ProactiveSuggestion[] = [];

      for (const suggestion of suggestions) {
        const shouldShow = await this.shouldShowSuggestion(
          suggestion,
          appContext,
          sessionContext,
          history
        );

        if (shouldShow) {
          activeSuggestions.push(suggestion);
        }
      }

      return activeSuggestions.sort((a, b) => b.priority - a.priority);
    } catch (error) {
      logger.error('PROACTIVE_SUGGESTIONS', 'Error getting active suggestions', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }

  /**
   * Check if a suggestion should be shown based on timing rules and history
   */
  private async shouldShowSuggestion(
    suggestion: ProactiveSuggestion,
    appContext: AppContext,
    sessionContext: { lastSessionDate: string | null },
    history: SuggestionHistory[]
  ): Promise<boolean> {
    const suggestionHistory = history.find(
      (h) => h.suggestionId === suggestion.id
    );

    if (suggestionHistory) {
      if (suggestionHistory.dismissedAt) {
        const daysSinceDismissal = this.getDaysSince(suggestionHistory.dismissedAt);
        if (daysSinceDismissal < this.DISMISSAL_COOLDOWN_DAYS) {
          return false;
        }
      }

      if (suggestionHistory.completedAt) {
        const daysSinceCompletion = this.getDaysSince(suggestionHistory.completedAt);
        if (daysSinceCompletion < this.COMPLETION_COOLDOWN_DAYS) {
          return false;
        }
      }

      const hoursSinceShown = this.getHoursSince(suggestionHistory.shownAt);
      const timingRule = this.TIMING_RULES[suggestion.timing];
      if (timingRule && hoursSinceShown < timingRule.cooldownHours) {
        return false;
      }
    }

    return this.matchesTimingRules(suggestion, appContext);
  }

  /**
   * Check if current time matches suggestion timing rules
   */
  private matchesTimingRules(
    suggestion: ProactiveSuggestion,
    appContext: AppContext
  ): boolean {
    const timingRule = this.TIMING_RULES[suggestion.timing];
    if (!timingRule) {
      return true;
    }

    if (suggestion.timing === 'now') {
      return true;
    }

    if (suggestion.timing === 'after-training') {
      return appContext.activityState === 'post-training';
    }

    const now = new Date();
    const currentHour = now.getHours();
    const currentDay = now.getDay();

    if (suggestion.timing === 'morning' || suggestion.timing === 'evening') {
      const { start, end } = timingRule.timeWindow!;
      return currentHour >= start && currentHour <= end;
    }

    if (suggestion.timing === 'weekly') {
      const { start, end } = timingRule.timeWindow!;
      const isCorrectDay = currentDay === timingRule.dayOfWeek;
      const isCorrectTime = currentHour >= start && currentHour <= end;
      return isCorrectDay && isCorrectTime;
    }

    return false;
  }

  /**
   * Get suggestion history for user
   */
  private async getSuggestionHistory(): Promise<SuggestionHistory[]> {
    try {
      const { data, error } = await supabase
        .from('proactive_suggestions')
        .select('*')
        .eq('user_id', this.userId)
        .order('shown_at', { ascending: false });

      if (error) {
        // Only log error if it's not a table-not-found error (404)
        // This can happen during initial setup
        if (!error.message?.includes('PGRST') && !error.message?.includes('404')) {
          logger.error('PROACTIVE_SUGGESTIONS', 'Error fetching suggestion history', {
            error: error.message || 'Unknown error',
          });
        } else {
          logger.debug('PROACTIVE_SUGGESTIONS', 'Suggestions table not yet available');
        }
        return [];
      }

      return (data || []).map((row) => ({
        suggestionId: row.suggestion_id,
        shownAt: new Date(row.shown_at),
        dismissedAt: row.dismissed_at ? new Date(row.dismissed_at) : undefined,
        completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      }));
    } catch (error) {
      logger.debug('PROACTIVE_SUGGESTIONS', 'Could not fetch suggestion history', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }

  /**
   * Record that a suggestion was shown to the user
   */
  async recordShown(suggestion: ProactiveSuggestion): Promise<void> {
    try {
      const { error } = await supabase.from('proactive_suggestions').insert({
        user_id: this.userId,
        suggestion_id: suggestion.id,
        forge: suggestion.forge,
        message: suggestion.message,
        action: suggestion.action,
        priority: suggestion.priority,
        timing: suggestion.timing,
        shown_at: new Date().toISOString(),
      });

      if (error) throw error;

      logger.info('PROACTIVE_SUGGESTIONS', 'Suggestion shown recorded', {
        suggestionId: suggestion.id,
        forge: suggestion.forge,
      });
    } catch (error) {
      logger.error('PROACTIVE_SUGGESTIONS', 'Error recording shown suggestion', {
        error: error instanceof Error ? error.message : 'Unknown error',
        suggestionId: suggestion.id,
      });
    }
  }

  /**
   * Record that a suggestion was dismissed by the user
   */
  async recordDismissed(suggestionId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('proactive_suggestions')
        .update({ dismissed_at: new Date().toISOString() })
        .eq('user_id', this.userId)
        .eq('suggestion_id', suggestionId)
        .is('dismissed_at', null)
        .order('shown_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      logger.info('PROACTIVE_SUGGESTIONS', 'Suggestion dismissed', {
        suggestionId,
      });
    } catch (error) {
      logger.error('PROACTIVE_SUGGESTIONS', 'Error recording dismissed suggestion', {
        error: error instanceof Error ? error.message : 'Unknown error',
        suggestionId,
      });
    }
  }

  /**
   * Record that a suggestion action was completed by the user
   */
  async recordCompleted(suggestionId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('proactive_suggestions')
        .update({ completed_at: new Date().toISOString() })
        .eq('user_id', this.userId)
        .eq('suggestion_id', suggestionId)
        .is('completed_at', null)
        .order('shown_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      logger.info('PROACTIVE_SUGGESTIONS', 'Suggestion completed', {
        suggestionId,
      });
    } catch (error) {
      logger.error('PROACTIVE_SUGGESTIONS', 'Error recording completed suggestion', {
        error: error instanceof Error ? error.message : 'Unknown error',
        suggestionId,
      });
    }
  }

  private getDaysSince(date: Date): number {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    return diffMs / (1000 * 60 * 60 * 24);
  }

  private getHoursSince(date: Date): number {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    return diffMs / (1000 * 60 * 60);
  }
}
