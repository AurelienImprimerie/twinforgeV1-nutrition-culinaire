/**
 * Step 2 Notification Adapter
 * Adapts the old step2NotificationService API to use the new TrainingNotificationService
 */

import { trainingNotificationService, generateNotificationMessage } from '../core';
import type { TrainingNotificationContext } from '../core';
import logger from '../../../../lib/utils/logger';

class Step2NotificationAdapter {
  /**
   * Initialize (proxied to new service)
   */
  async initialize(sessionId?: string, userId?: string): Promise<void> {
    const sid = sessionId || `step2-${Date.now()}`;
    await trainingNotificationService.initialize(sid, 'step2');
    logger.info('STEP2_ADAPTER', 'Initialized via adapter', { sessionId: sid, userId });
  }

  /**
   * Show notification
   */
  private showNotification(id: string, context?: TrainingNotificationContext, delayMs: number = 0): void {
    const message = generateNotificationMessage(id, context);

    if (delayMs > 0) {
      trainingNotificationService.queue(id, message, delayMs, context);
    } else {
      trainingNotificationService.show(id, message, context);
    }
  }

  /**
   * Generation sequence notifications
   */
  onGenerationStart(): void {
    this.showNotification('step2-generation-start');
  }

  onGenerationAnalyzing(): void {
    this.showNotification('step2-generation-analyzing', undefined, 2000);
  }

  onGenerationSelecting(): void {
    this.showNotification('step2-generation-selecting', undefined, 4000);
  }

  onGenerationCalculating(): void {
    this.showNotification('step2-generation-calculating', undefined, 6000);
  }

  onGenerationComplete(): void {
    this.showNotification('step2-generation-complete', undefined, 8000);
  }

  triggerGenerationSequence(): void {
    this.onGenerationStart();
    this.onGenerationAnalyzing();
    this.onGenerationSelecting();
    this.onGenerationCalculating();
    this.onGenerationComplete();
  }

  /**
   * Welcome notifications
   */
  onWelcomeIntro(): void {
    this.showNotification('step2-welcome-intro', undefined, 1000);
  }

  onWelcomeHelp(): void {
    this.showNotification('step2-welcome-help', undefined, 3500);
  }

  /**
   * Adjustment notifications
   */
  onSetsIncreased(exerciseName: string, newSets: number): void {
    this.showNotification('step2-sets-increased', { exerciseName, sets: newSets });
  }

  onSetsDecreased(exerciseName: string, newSets: number): void {
    this.showNotification('step2-sets-decreased', { exerciseName, sets: newSets });
  }

  onRepsIncreased(exerciseName: string, newReps: number): void {
    this.showNotification('step2-reps-increased', { exerciseName, reps: newReps });
  }

  onRepsDecreased(exerciseName: string, newReps: number): void {
    this.showNotification('step2-reps-decreased', { exerciseName, reps: newReps });
  }

  onLoadIncreased(exerciseName: string, oldLoad: number, newLoad: number): void {
    this.showNotification('step2-load-increased', {
      exerciseName,
      oldLoad,
      newLoad,
      loadAdjustment: newLoad - oldLoad
    });
  }

  onLoadDecreased(exerciseName: string, oldLoad: number, newLoad: number): void {
    this.showNotification('step2-load-decreased', {
      exerciseName,
      oldLoad,
      newLoad,
      loadAdjustment: oldLoad - newLoad
    });
  }

  /**
   * Exercise modification notifications
   */
  onAlternativeSelected(exerciseName: string, substitutionName: string): void {
    this.showNotification('step2-alternative-selected', {
      exerciseName,
      substitutionName
    });
  }

  onExerciseRegenerating(exerciseName: string): void {
    this.showNotification('step2-exercise-regenerating', { exerciseName });
  }

  onExerciseRegenerated(oldExerciseName: string, newExerciseName: string): void {
    this.showNotification('step2-exercise-regenerated', {
      exerciseName: oldExerciseName,
      newExerciseName
    });
  }

  onExerciseError(exerciseName: string): void {
    this.showNotification('step2-exercise-error', { exerciseName });
  }

  /**
   * Draft saved notification
   */
  onDraftSaved(customName?: string): void {
    this.showNotification('step2-draft-saved', {
      customName: customName || 'Training'
    });
  }

  /**
   * Regeneration notifications
   */
  onRegenerationStarted(): void {
    this.showNotification('step2-regeneration-started');
  }

  onRegenerationComplete(): void {
    this.showNotification('step2-regeneration-complete', undefined, 500);
  }

  /**
   * Endurance adjustment notifications
   */
  onEnduranceIntensityIncreased(sessionName: string, changesSummary: string): void {
    this.showNotification('step2-endurance-intensity-increased', {
      exerciseName: sessionName,
      substitutionName: changesSummary
    });
  }

  onEnduranceIntensityDecreased(sessionName: string, changesSummary: string): void {
    this.showNotification('step2-endurance-intensity-decreased', {
      exerciseName: sessionName,
      substitutionName: changesSummary
    });
  }

  onEnduranceAdjustmentLimit(sessionName: string): void {
    this.showNotification('step2-endurance-adjustment-limit', {
      exerciseName: sessionName
    });
  }

  /**
   * Cleanup
   */
  cleanup(): void {
    trainingNotificationService.cleanup();
    logger.info('STEP2_ADAPTER', 'Cleaned up via adapter');
  }
}

// Export singleton instance (maintains backward compatibility)
export const step2NotificationService = new Step2NotificationAdapter();
