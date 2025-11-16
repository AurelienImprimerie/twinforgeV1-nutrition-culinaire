import logger from '../../../../lib/utils/logger';
import type { UserKnowledgeBase } from '../../knowledge/UserKnowledgeBase';
import type { SessionAwarenessService } from '../../awareness/SessionAwarenessService';
import type { MissingDataDetector } from '../../utils/MissingDataDetector';
import type { ProactiveSuggestionEngine } from '../../integration/ProactiveSuggestionEngine';
import type { ProactiveSuggestion } from '../../types';

export async function getProactiveSuggestions(
  knowledgeBase: UserKnowledgeBase | null,
  awarenessService: SessionAwarenessService | null,
  missingDataDetector: MissingDataDetector | null,
  suggestionEngine: ProactiveSuggestionEngine | null
): Promise<ProactiveSuggestion[]> {
  if (!knowledgeBase || !awarenessService || !missingDataDetector || !suggestionEngine) {
    logger.warn('BRAIN_CORE', 'Cannot get suggestions - brain not fully initialized');
    return [];
  }

  try {
    const knowledge = await knowledgeBase.getUserKnowledge();
    const appContext = awarenessService.getAppContext();
    const sessionContext = {
      lastSessionDate: knowledge.training.lastSessionDate
    };

    const rawProfile = knowledgeBase.getRawProfile();
    missingDataDetector.setRawProfile(rawProfile);

    const missingDataReport = missingDataDetector.analyze(knowledge, appContext);

    const suggestions = await suggestionEngine.getActiveSuggestions(
      missingDataReport,
      appContext,
      sessionContext
    );

    logger.debug('BRAIN_CORE', 'Generated proactive suggestions', {
      count: suggestions.length,
      hasRawProfile: !!rawProfile
    });

    return suggestions;
  } catch (error) {
    logger.error('BRAIN_CORE', 'Error getting proactive suggestions', {
      error: error instanceof Error ? error.message : String(error)
    });
    return [];
  }
}

export async function recordSuggestionShown(
  suggestionEngine: ProactiveSuggestionEngine | null,
  suggestion: ProactiveSuggestion
): Promise<void> {
  if (!suggestionEngine) {
    logger.warn('BRAIN_CORE', 'Cannot record suggestion - engine not initialized');
    return;
  }

  await suggestionEngine.recordShown(suggestion);
}

export async function dismissSuggestion(
  suggestionEngine: ProactiveSuggestionEngine | null,
  suggestionId: string
): Promise<void> {
  if (!suggestionEngine) {
    logger.warn('BRAIN_CORE', 'Cannot dismiss suggestion - engine not initialized');
    return;
  }

  await suggestionEngine.recordDismissed(suggestionId);
}

export async function completeSuggestion(
  suggestionEngine: ProactiveSuggestionEngine | null,
  suggestionId: string
): Promise<void> {
  if (!suggestionEngine) {
    logger.warn('BRAIN_CORE', 'Cannot complete suggestion - engine not initialized');
    return;
  }

  await suggestionEngine.recordCompleted(suggestionId);
}
