/**
 * RealtimeIntegration - Connects Head System to Voice Realtime
 * Provides context-aware voice coaching during training
 */

import logger from '../../../lib/utils/logger';
import { brainCore } from '../core/BrainCore';
import { UnifiedPromptBuilder } from './UnifiedPromptBuilder';
import { FeedbackRecorder } from './FeedbackRecorder';
import type { ChatMode } from '../../store/globalChatStore';
import type { RealtimeConfig } from '../../services/openai-realtime/types';
import type { FeedbackCategory, FeedbackContext } from '../types';

export class RealtimeIntegration {
  private promptBuilder: UnifiedPromptBuilder;
  private feedbackRecorder: FeedbackRecorder;

  constructor() {
    this.promptBuilder = new UnifiedPromptBuilder();
    this.feedbackRecorder = new FeedbackRecorder();
  }

  /**
   * Build context-aware system prompt for realtime voice
   */
  async buildRealtimeSystemPrompt(
    basePrompt: string,
    mode: ChatMode
  ): Promise<string> {
    try {
      // Get current brain context
      const context = await brainCore.getContext();
      const userId = brainCore.getCurrentUserId();

      logger.info('REALTIME_INTEGRATION', 'Building realtime system prompt', {
        mode,
        sessionActive: context.session.isActive,
        userId
      });

      // Build enriched prompt
      const enrichedPrompt = this.promptBuilder.buildSystemPrompt(
        context,
        basePrompt
      );

      logger.debug('REALTIME_INTEGRATION', 'System prompt built', {
        originalLength: basePrompt.length,
        enrichedLength: enrichedPrompt.length,
        addedLength: enrichedPrompt.length - basePrompt.length,
        responseStyle: context.session.isActive ? 'ultra-short' : 'normal'
      });

      return enrichedPrompt;
    } catch (error) {
      logger.error('REALTIME_INTEGRATION', 'Failed to build realtime prompt', {
        error: error instanceof Error ? error.message : String(error)
      });

      // Return base prompt on error
      return basePrompt;
    }
  }

  /**
   * Set user context for voice conversation persistence
   */
  async setUserContextForVoice(realtimeService: any): Promise<void> {
    try {
      const userId = brainCore.getCurrentUserId();
      if (!userId) {
        logger.warn('REALTIME_INTEGRATION', 'Cannot set voice context: no user ID');
        return;
      }

      const context = await brainCore.getContext();
      const sessionId = context.session.isActive ? context.session.sessionId : undefined;
      const appContext = {
        currentRoute: context.app.currentRoute,
        activityState: context.app.activityState,
        sessionType: context.session.isActive ? context.session.sessionType : undefined,
        exerciseName: context.session.currentExercise,
      };

      realtimeService.setUserContext(userId, sessionId, appContext);

      logger.debug('REALTIME_INTEGRATION', 'Voice context set for conversation persistence', {
        userId,
        sessionId,
        activityState: context.app.activityState
      });
    } catch (error) {
      logger.error('REALTIME_INTEGRATION', 'Failed to set voice context', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Record feedback from voice conversation
   */
  async recordVoiceFeedback(
    sessionId: string,
    message: string,
    context: FeedbackContext
  ): Promise<void> {
    try {
      const userId = brainCore.getCurrentUserId();

      if (!userId) {
        logger.warn('REALTIME_INTEGRATION', 'Cannot record feedback: no user ID');
        return;
      }

      // Auto-categorize message
      const category = this.feedbackRecorder.categorizeMessage(message);

      // Check if this is a key moment
      const isKeyMoment = this.feedbackRecorder.isKeyMoment(message, category);

      // Record only if it's a key moment
      if (isKeyMoment) {
        await this.feedbackRecorder.record(
          userId,
          sessionId,
          message,
          category,
          context,
          true
        );

        logger.info('REALTIME_INTEGRATION', 'Key moment recorded', {
          sessionId,
          category,
          exerciseName: context.exerciseName
        });
      } else {
        logger.debug('REALTIME_INTEGRATION', 'Message not a key moment, skipping', {
          category,
          messagePreview: message.substring(0, 50)
        });
      }
    } catch (error) {
      logger.error('REALTIME_INTEGRATION', 'Failed to record feedback', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Update training session context in brain
   */
  updateTrainingContext(context: {
    sessionId: string;
    currentExerciseIndex: number;
    totalExercises: number;
    currentExercise?: {
      name: string;
      load?: number;
      reps: string;
      sets: number;
    };
    currentSet: number;
    totalSets: number;
    isResting: boolean;
    restTimeRemaining: number;
    discipline: string;
  }): void {
    try {
      brainCore.updateSessionAwareness({
        isActive: true,
        sessionType: 'training',
        trainingSession: {
          ...context,
          sessionTimeElapsed: 0,
          currentExercise: context.currentExercise ? {
            name: context.currentExercise.name,
            load: context.currentExercise.load,
            reps: context.currentExercise.reps,
            sets: context.currentExercise.sets,
            rest: 0
          } : undefined
        },
        timestamp: Date.now()
      });

      logger.debug('REALTIME_INTEGRATION', 'Training context updated', {
        sessionId: context.sessionId,
        exercise: context.currentExercise?.name,
        set: `${context.currentSet}/${context.totalSets}`,
        isResting: context.isResting
      });
    } catch (error) {
      logger.error('REALTIME_INTEGRATION', 'Failed to update training context', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Clear training session from brain
   */
  clearTrainingContext(): void {
    try {
      brainCore.updateSessionAwareness({
        isActive: false,
        sessionType: null,
        trainingSession: undefined,
        timestamp: Date.now()
      });

      logger.info('REALTIME_INTEGRATION', 'Training context cleared');
    } catch (error) {
      logger.error('REALTIME_INTEGRATION', 'Failed to clear training context', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Check if brain is ready
   */
  isBrainReady(): boolean {
    return brainCore.isInitialized();
  }

  /**
   * Get brain health status
   */
  getBrainHealth() {
    return brainCore.getHealthStatus();
  }
}

// Export singleton
export const realtimeIntegration = new RealtimeIntegration();
