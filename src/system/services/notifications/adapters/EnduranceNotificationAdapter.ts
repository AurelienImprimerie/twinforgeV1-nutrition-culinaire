/**
 * Endurance Notification Adapter
 * Adapts the old EnduranceCoachNotificationService API to use the new TrainingNotificationService
 */

import { trainingNotificationService, generateNotificationMessage } from '../core';
import type { TrainingNotificationContext } from '../core';
import logger from '../../../../lib/utils/logger';

export class EnduranceCoachNotificationAdapter {
  private sessionId: string | null = null;
  private analysisInProgress: boolean = false;

  /**
   * Initialize
   */
  initialize(sessionId: string): void {
    this.sessionId = sessionId;
    this.analysisInProgress = false;
    trainingNotificationService.initialize(sessionId, 'step3');
    logger.info('ENDURANCE_ADAPTER', 'Initialized via adapter', { sessionId });
  }

  /**
   * Show notification helper
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
   * Analysis status
   */
  setAnalysisInProgress(inProgress: boolean): void {
    this.analysisInProgress = inProgress;
  }

  /**
   * Analysis notifications
   */
  onAnalysisStarted(): void {
    if (!this.sessionId) return;
    this.setAnalysisInProgress(true);
    this.showNotification('endurance-analysis-started');
  }

  onAnalysisProgress(progress: number): void {
    if (!this.sessionId || !this.analysisInProgress) return;

    if (progress === 25) {
      this.showNotification('endurance-analysis-progress-25');
    } else if (progress === 50) {
      this.showNotification('endurance-analysis-progress-50');
    } else if (progress === 75) {
      this.showNotification('endurance-analysis-progress-75');
    }
  }

  onAnalysisComplete(): void {
    if (!this.sessionId) return;
    this.setAnalysisInProgress(false);
    this.showNotification('endurance-analysis-complete');
  }

  /**
   * Session lifecycle notifications
   */
  onSessionStart(discipline: string): void {
    if (!this.sessionId) return;
    this.showNotification('endurance-session-start', { discipline });
  }

  onSessionPaused(): void {
    if (!this.sessionId) return;
    this.showNotification('endurance-session-paused');
  }

  onSessionResumed(): void {
    if (!this.sessionId) return;
    this.showNotification('endurance-session-resumed');
  }

  onHalfwayPoint(): void {
    if (!this.sessionId) return;
    this.showNotification('endurance-halfway-point');
  }

  onFinalStretch(): void {
    if (!this.sessionId) return;
    this.showNotification('endurance-final-stretch');
  }

  onSessionComplete(totalDuration: number, blocksCompleted: number): void {
    if (!this.sessionId) return;
    this.showNotification('endurance-session-complete', {
      totalDuration,
      blocksCompleted
    });
  }

  /**
   * Block notifications
   */
  onBlockStart(blockName: string, targetZone: string, context?: TrainingNotificationContext): void {
    if (!this.sessionId) return;
    this.showNotification('endurance-block-start', {
      blockName,
      targetZone,
      ...context
    });
  }

  onBlockComplete(blockName: string, context?: TrainingNotificationContext): void {
    if (!this.sessionId) return;
    this.showNotification('endurance-block-complete', {
      blockName,
      ...context
    });
  }

  onZoneChange(newZone: string, zoneLabel: string): void {
    if (!this.sessionId) return;
    this.showNotification('endurance-zone-change', {
      zone: newZone,
      zoneLabel
    });
  }

  /**
   * Interval notifications
   */
  onIntervalWork(intervalNumber: number, totalIntervals: number, targetZone: string): void {
    if (!this.sessionId) return;
    this.showNotification('endurance-interval-work', {
      intervalNumber,
      totalIntervals,
      targetZone
    });
  }

  onIntervalRest(intervalNumber: number, totalIntervals: number): void {
    if (!this.sessionId) return;
    this.showNotification('endurance-interval-rest', {
      intervalNumber,
      totalIntervals
    });
  }

  /**
   * Motivational notifications
   */
  onEncouragement(): void {
    if (!this.sessionId) return;
    this.showNotification('endurance-encouragement');
  }

  onTechniqueReminder(cue: string): void {
    if (!this.sessionId) return;
    this.showNotification('endurance-technique-reminder', { cue });
  }

  /**
   * Cleanup
   */
  cleanup(): void {
    this.sessionId = null;
    this.analysisInProgress = false;
    trainingNotificationService.cleanup();
    logger.info('ENDURANCE_ADAPTER', 'Cleaned up via adapter');
  }
}

// Export singleton instance (maintains backward compatibility)
export const enduranceCoachNotificationService = new EnduranceCoachNotificationAdapter();
