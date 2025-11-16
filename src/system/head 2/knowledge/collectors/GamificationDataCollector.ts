/**
 * GamificationDataCollector - Collect gamification and XP data
 * Aggregates user level, XP, streaks, and recent achievements
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import logger from '../../../../lib/utils/logger';
import { gamificationPredictionService, type UniversalLevelPrediction } from '../../../../services/dashboard/coeur';

export interface GamificationKnowledge {
  currentLevel: number;
  currentXp: number;
  xpToNextLevel: number;
  totalXpEarned: number;
  levelUpCount: number;
  currentStreakDays: number;
  longestStreakDays: number;
  lastActivityDate: string | null;
  lastLevelUpAt: string | null;

  currentLevelInfo: {
    name: string;
    description: string | null;
    color: string;
    isMajorMilestone: boolean;
  } | null;

  nextLevelInfo: {
    name: string;
    xpRequired: number;
  } | null;

  levelPrediction: UniversalLevelPrediction | null;

  recentXpEvents: Array<{
    eventType: string;
    eventCategory: string;
    finalXp: number;
    multiplier: number;
    eventDate: string;
  }>;

  xpStats: {
    last7Days: number;
    last30Days: number;
    averagePerDay: number;
    topCategory: string | null;
  };

  weightHistory: Array<{
    weight: number;
    delta: number | null;
    isMilestone: boolean;
    date: string;
  }>;

  hasData: boolean;
}

export class GamificationDataCollector {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  async collect(userId: string): Promise<GamificationKnowledge> {
    try {
      logger.info('GAMIFICATION_DATA_COLLECTOR', 'Starting gamification data collection', { userId });

      const [progressResult, levelResult, nextLevelResult, eventsResult, statsResult, weightResult, predictionResult] =
        await Promise.allSettled([
          this.getUserProgress(userId),
          this.getCurrentLevelInfo(userId),
          this.getNextLevelInfo(userId),
          this.getRecentXpEvents(userId),
          this.getXpStats(userId),
          this.getWeightHistory(userId),
          this.getLevelPrediction(userId)
        ]);

      const progress = progressResult.status === 'fulfilled' ? progressResult.value : null;
      const levelInfo = levelResult.status === 'fulfilled' ? levelResult.value : null;
      const nextLevelInfo = nextLevelResult.status === 'fulfilled' ? nextLevelResult.value : null;
      const recentEvents = eventsResult.status === 'fulfilled' ? eventsResult.value : [];
      const xpStats = statsResult.status === 'fulfilled' ? statsResult.value : this.getDefaultXpStats();
      const weightHistory = weightResult.status === 'fulfilled' ? weightResult.value : [];
      const levelPrediction = predictionResult.status === 'fulfilled' ? predictionResult.value : null;

      const hasData = progress !== null;

      logger.info('GAMIFICATION_DATA_COLLECTOR', 'Gamification data collected', {
        userId,
        hasProgress: !!progress,
        currentLevel: progress?.current_level,
        currentXp: progress?.current_xp,
        streakDays: progress?.current_streak_days,
        recentEventsCount: recentEvents.length,
        hasPrediction: !!levelPrediction,
        hasData
      });

      return {
        currentLevel: progress?.current_level || 1,
        currentXp: progress?.current_xp || 0,
        xpToNextLevel: progress?.xp_to_next_level || 100,
        totalXpEarned: progress?.total_xp_earned || 0,
        levelUpCount: progress?.level_up_count || 0,
        currentStreakDays: progress?.current_streak_days || 0,
        longestStreakDays: progress?.longest_streak_days || 0,
        lastActivityDate: progress?.last_activity_date || null,
        lastLevelUpAt: progress?.last_level_up_at || null,
        currentLevelInfo: levelInfo,
        nextLevelInfo: nextLevelInfo,
        levelPrediction: levelPrediction,
        recentXpEvents: recentEvents,
        xpStats,
        weightHistory,
        hasData
      };
    } catch (error) {
      logger.error('GAMIFICATION_DATA_COLLECTOR', 'Failed to collect gamification data', {
        userId,
        error: error instanceof Error ? error.message : String(error)
      });

      return this.getDefaultGamificationKnowledge();
    }
  }

  private async getUserProgress(userId: string) {
    const { data, error } = await this.supabase
      .from('user_gamification_progress')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  private async getCurrentLevelInfo(userId: string) {
    const progress = await this.getUserProgress(userId);
    if (!progress) return null;

    const { data, error } = await this.supabase
      .from('level_milestones')
      .select('milestone_name, milestone_description, badge_color, is_major_milestone')
      .eq('level', progress.current_level)
      .maybeSingle();

    if (error || !data) return null;

    return {
      name: data.milestone_name,
      description: data.milestone_description,
      color: data.badge_color,
      isMajorMilestone: data.is_major_milestone
    };
  }

  private async getNextLevelInfo(userId: string) {
    const progress = await this.getUserProgress(userId);
    if (!progress) return null;

    const nextLevel = progress.current_level + 1;

    const { data, error } = await this.supabase
      .from('level_milestones')
      .select('milestone_name, xp_required')
      .eq('level', nextLevel)
      .maybeSingle();

    if (error || !data) return null;

    return {
      name: data.milestone_name,
      xpRequired: data.xp_required
    };
  }

  private async getLevelPrediction(userId: string) {
    try {
      const prediction = await gamificationPredictionService.predictLevel(userId);
      return prediction;
    } catch (error) {
      logger.warn('GAMIFICATION_DATA_COLLECTOR', 'Failed to get level prediction', { userId, error });
      return null;
    }
  }

  private async getRecentXpEvents(userId: string, limit: number = 10) {
    const { data, error } = await this.supabase
      .from('xp_events_log')
      .select('event_type, event_category, final_xp, multiplier, event_date')
      .eq('user_id', userId)
      .order('event_date', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return (data || []).map(event => ({
      eventType: event.event_type,
      eventCategory: event.event_category,
      finalXp: event.final_xp,
      multiplier: parseFloat(event.multiplier),
      eventDate: event.event_date
    }));
  }

  private async getXpStats(userId: string) {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const { data: events, error } = await this.supabase
      .from('xp_events_log')
      .select('final_xp, event_category, event_date')
      .eq('user_id', userId)
      .gte('event_date', thirtyDaysAgo.toISOString());

    if (error) throw error;

    const last7DaysXp = (events || [])
      .filter(e => new Date(e.event_date) >= sevenDaysAgo)
      .reduce((sum, e) => sum + e.final_xp, 0);

    const last30DaysXp = (events || [])
      .reduce((sum, e) => sum + e.final_xp, 0);

    const averagePerDay = Math.round(last30DaysXp / 30);

    const categoryTotals = (events || []).reduce((acc, e) => {
      acc[e.event_category] = (acc[e.event_category] || 0) + e.final_xp;
      return acc;
    }, {} as Record<string, number>);

    const topCategory = Object.entries(categoryTotals)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    return {
      last7Days: last7DaysXp,
      last30Days: last30DaysXp,
      averagePerDay,
      topCategory
    };
  }

  private async getWeightHistory(userId: string, limit: number = 5) {
    const { data, error } = await this.supabase
      .from('weight_updates_history')
      .select('new_weight, weight_delta, is_milestone, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return (data || []).map(update => ({
      weight: update.new_weight,
      delta: update.weight_delta,
      isMilestone: update.is_milestone,
      date: update.created_at
    }));
  }

  private getDefaultXpStats() {
    return {
      last7Days: 0,
      last30Days: 0,
      averagePerDay: 0,
      topCategory: null
    };
  }

  private getDefaultGamificationKnowledge(): GamificationKnowledge {
    return {
      currentLevel: 1,
      currentXp: 0,
      xpToNextLevel: 100,
      totalXpEarned: 0,
      levelUpCount: 0,
      currentStreakDays: 0,
      longestStreakDays: 0,
      lastActivityDate: null,
      lastLevelUpAt: null,
      currentLevelInfo: null,
      nextLevelInfo: null,
      levelPrediction: null,
      recentXpEvents: [],
      xpStats: this.getDefaultXpStats(),
      weightHistory: [],
      hasData: false
    };
  }
}
