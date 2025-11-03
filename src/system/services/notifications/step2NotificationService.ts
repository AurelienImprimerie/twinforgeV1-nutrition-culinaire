/**
 * Step 2 Notification Service
 * Gère les notifications contextuelles du coach pendant la Step 2 (Activation)
 */

import { trainingCoachNotificationService } from './trainingCoachNotificationService';
import { getStep2CoachMessage, type Step2NotificationId } from '../../../config/step2CoachMessages';
import type { TrainingNotificationContext } from '../../../domain/trainingCoachNotification';
import logger from '../../../lib/utils/logger';

class Step2NotificationService {
  private sessionId: string | null = null;
  private userId: string | null = null;
  private initializationPromise: Promise<void> | null = null;
  private pendingNotifications: Array<() => void> = [];

  async initialize(sessionId?: string, userId?: string): Promise<void> {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = (async () => {
      this.sessionId = sessionId || null;
      this.userId = userId || null;

      // CRITICAL: Initialize base trainingCoachNotificationService first
      if (sessionId) {
        try {
          logger.info('STEP2_NOTIFICATION_SERVICE', 'Initializing base trainingCoachNotificationService');
          await trainingCoachNotificationService.initialize(sessionId);
          logger.info('STEP2_NOTIFICATION_SERVICE', 'Base service initialized successfully');
        } catch (error) {
          logger.error('STEP2_NOTIFICATION_SERVICE', 'Failed to initialize base service', {
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          throw error;
        }
      }

      logger.info('STEP2_NOTIFICATION_SERVICE', 'Service initialized', { sessionId, userId });

      // Process pending notifications
      if (this.pendingNotifications.length > 0) {
        logger.info('STEP2_NOTIFICATION_SERVICE', 'Processing pending notifications', {
          count: this.pendingNotifications.length
        });
        this.pendingNotifications.forEach(fn => fn());
        this.pendingNotifications = [];
      }
    })();

    return this.initializationPromise;
  }

  private async ensureInitialized(): Promise<boolean> {
    if (this.initializationPromise) {
      await this.initializationPromise;
    }
    return this.userId !== null && trainingCoachNotificationService.isInitialized();
  }

  cleanup() {
    this.initializationPromise = null;
    this.sessionId = null;
    this.userId = null;
    this.pendingNotifications = [];
    logger.info('STEP2_NOTIFICATION_SERVICE', 'Service cleaned up');
  }

  private async showNotification(
    id: Step2NotificationId,
    context?: TrainingNotificationContext,
    delayMs: number = 0
  ) {
    const notificationFn = async () => {
      const isInitialized = await this.ensureInitialized();

      if (!isInitialized || !this.userId) {
        logger.warn('STEP2_NOTIFICATION_SERVICE', 'Service not initialized or no userId', {
          id,
          isInitialized,
          hasUserId: !!this.userId,
          baseServiceInitialized: trainingCoachNotificationService.isInitialized()
        });
        return;
      }

      const message = getStep2CoachMessage(id, context);
      const notificationId = id as any;

      const enrichedContext = {
        ...context,
        userId: this.userId,
        sessionId: this.sessionId
      };

      if (delayMs > 0) {
        trainingCoachNotificationService.queueNotification(
          notificationId,
          delayMs,
          enrichedContext,
          message
        );
      } else {
        trainingCoachNotificationService.showNotification(
          notificationId,
          enrichedContext,
          message
        );
      }

      logger.debug('STEP2_NOTIFICATION_SERVICE', 'Notification shown', { id, delayMs, userId: this.userId });
    };

    // If not initialized yet, queue the notification
    if (!this.initializationPromise) {
      logger.debug('STEP2_NOTIFICATION_SERVICE', 'Queueing notification (service not initialized)', { id });
      this.pendingNotifications.push(notificationFn);
      return;
    }

    // Otherwise execute immediately
    await notificationFn();
  }

  onGenerationStart() {
    this.showNotification('step2-generation-start');
  }

  onGenerationAnalyzing() {
    this.showNotification('step2-generation-analyzing', undefined, 2000);
  }

  onGenerationSelecting() {
    this.showNotification('step2-generation-selecting', undefined, 4000);
  }

  onGenerationCalculating() {
    this.showNotification('step2-generation-calculating', undefined, 6000);
  }

  onGenerationComplete() {
    this.showNotification('step2-generation-complete');
  }

  onWelcomeIntro() {
    this.showNotification('step2-welcome-intro', undefined, 1000);
  }

  onWelcomeHelp() {
    this.showNotification('step2-welcome-help', undefined, 3500);
  }

  onSetsIncreased(exerciseName: string, newSets: number) {
    this.showNotification('step2-sets-increased', {
      exerciseName,
      sets: newSets
    });
  }

  onSetsDecreased(exerciseName: string, newSets: number) {
    this.showNotification('step2-sets-decreased', {
      exerciseName,
      sets: newSets
    });
  }

  onRepsIncreased(exerciseName: string, newReps: number) {
    this.showNotification('step2-reps-increased', {
      exerciseName,
      reps: newReps
    });
  }

  onRepsDecreased(exerciseName: string, newReps: number) {
    this.showNotification('step2-reps-decreased', {
      exerciseName,
      reps: newReps
    });
  }

  onLoadIncreased(exerciseName: string, oldLoad: number, newLoad: number) {
    this.showNotification('step2-load-increased', {
      exerciseName,
      oldLoad,
      newLoad,
      loadAdjustment: newLoad - oldLoad
    });
  }

  onLoadDecreased(exerciseName: string, oldLoad: number, newLoad: number) {
    this.showNotification('step2-load-decreased', {
      exerciseName,
      oldLoad,
      newLoad,
      loadAdjustment: oldLoad - newLoad
    });
  }

  onAlternativeSelected(exerciseName: string, substitutionName: string) {
    this.showNotification('step2-alternative-selected', {
      exerciseName,
      substitutionName
    });
  }

  onExerciseRegenerating(exerciseName: string) {
    this.showNotification('step2-exercise-regenerating', {
      exerciseName
    });
  }

  onExerciseRegenerated(oldExerciseName: string, newExerciseName: string) {
    this.showNotification('step2-exercise-regenerated', {
      exerciseName: oldExerciseName,
      newExerciseName
    });
  }

  onExerciseError(exerciseName: string) {
    this.showNotification('step2-exercise-error', {
      exerciseName
    });
  }

  triggerGenerationSequence() {
    this.onGenerationStart();
    this.onGenerationAnalyzing();
    this.onGenerationSelecting();
    this.onGenerationCalculating();
    this.onGenerationComplete();
  }

  onDraftSaved(customName?: string) {
    this.showNotification('step2-draft-saved', {
      customName: customName || 'Training'
    });
  }

  onRegenerationStarted() {
    this.showNotification('step2-regeneration-started');
  }

  onRegenerationComplete() {
    this.showNotification('step2-regeneration-complete', undefined, 500);
  }

  onEnduranceIntensityIncreased(sessionName: string, changesSummary: string) {
    this.showNotification('step2-endurance-intensity-increased', {
      exerciseName: sessionName,
      substitutionName: changesSummary
    });
  }

  onEnduranceIntensityDecreased(sessionName: string, changesSummary: string) {
    this.showNotification('step2-endurance-intensity-decreased', {
      exerciseName: sessionName,
      substitutionName: changesSummary
    });
  }

  onEnduranceAdjustmentLimit(sessionName: string) {
    this.showNotification('step2-endurance-adjustment-limit', {
      exerciseName: sessionName
    });
  }
}

export const step2NotificationService = new Step2NotificationService();
