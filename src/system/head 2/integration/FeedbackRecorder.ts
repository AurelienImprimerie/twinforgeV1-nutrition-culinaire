/**
 * FeedbackRecorder - Record Training Feedbacks
 * Saves key moments from realtime conversations to database
 */

import { supabase } from '../../supabase/client';
import logger from '../../../lib/utils/logger';
import type { TrainingFeedbackRecord, FeedbackCategory, FeedbackContext } from '../types';

export class FeedbackRecorder {
  constructor() {
    // Use shared Supabase client
  }

  /**
   * Record a feedback from training session
   */
  async record(
    userId: string,
    sessionId: string,
    message: string,
    category: FeedbackCategory,
    context: FeedbackContext,
    isKeyMoment: boolean = false
  ): Promise<void> {
    try {
      const record: Omit<TrainingFeedbackRecord, 'id'> = {
        sessionId,
        userId,
        exerciseName: context.exerciseName,
        setNumber: context.setNumber,
        category,
        isKeyMoment,
        message,
        context,
        timestamp: Date.now()
      };

      const { error } = await supabase
        .from('training_feedbacks')
        .insert({
          session_id: record.sessionId,
          user_id: record.userId,
          exercise_name: record.exerciseName,
          set_number: record.setNumber,
          category: record.category,
          is_key_moment: record.isKeyMoment,
          message: record.message,
          context_metadata: record.context,
          created_at: new Date(record.timestamp).toISOString()
        });

      if (error) {
        logger.error('FEEDBACK_RECORDER', 'Failed to record feedback', {
          error: error.message,
          sessionId
        });
        return;
      }

      logger.info('FEEDBACK_RECORDER', 'Feedback recorded', {
        sessionId,
        category,
        isKeyMoment,
        exerciseName: context.exerciseName
      });
    } catch (error) {
      logger.error('FEEDBACK_RECORDER', 'Exception recording feedback', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Detect if message is a key moment
   */
  isKeyMoment(message: string, category: FeedbackCategory): boolean {
    // Key moment detection logic
    const keywordsByCategory: Record<FeedbackCategory, string[]> = {
      progression: ['record', 'pr', 'nouveau', 'meilleur', 'progression'],
      pain: ['douleur', 'mal', 'blessure', 'inconfort'],
      difficulty: ['dur', 'difficile', 'impossible', 'lourd', 'fatigue'],
      technique: ['forme', 'technique', 'comment', 'corriger', 'position'],
      question: ['?', 'comment', 'pourquoi', 'quand'],
      motivation: [],
      general: []
    };

    const keywords = keywordsByCategory[category];
    const messageLower = message.toLowerCase();

    return keywords.some(keyword => messageLower.includes(keyword));
  }

  /**
   * Categorize message automatically
   */
  categorizeMessage(message: string): FeedbackCategory {
    const messageLower = message.toLowerCase();

    if (messageLower.includes('?')) return 'question';
    if (messageLower.match(/douleur|mal|blessure/)) return 'pain';
    if (messageLower.match(/dur|difficile|lourd|fatigue/)) return 'difficulty';
    if (messageLower.match(/forme|technique|comment|position/)) return 'technique';
    if (messageLower.match(/record|pr|nouveau|meilleur|progression/)) return 'progression';
    if (messageLower.match(/allez|courage|force|bien|super/)) return 'motivation';

    return 'general';
  }
}
