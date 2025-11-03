/**
 * Step 5 Notification Adapter
 * Adapts the old step5NotificationService API to use the new TrainingNotificationService
 */

import { trainingNotificationService, generateNotificationMessage } from '../core';
import type { TrainingNotificationContext } from '../core';
import logger from '../../../../lib/utils/logger';

class Step5NotificationAdapter {
  /**
   * Initialize (proxied to new service)
   */
  async initialize(sessionId?: string): Promise<void> {
    const sid = sessionId || `step5-${Date.now()}`;
    await trainingNotificationService.initialize(sid, 'step5');
    logger.info('STEP5_ADAPTER', 'Initialized via adapter', { sessionId: sid });
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
   * Arrival notifications
   */
  onArrival(): void {
    this.showNotification('step5-arrival-welcome');
    this.showNotification('step5-recommendation-ready', undefined, 2000);
  }

  onRecoveryOptimal(): void {
    this.showNotification('step5-recovery-optimal');
  }

  onActionAccepted(): void {
    this.showNotification('step5-action-accepted');
  }

  /**
   * Wearable recovery guidance
   */
  showWearableRecoveryGuidance(
    recoveryScore: number,
    deviceName: string,
    estimatedRecoveryHours?: number
  ): void {
    this.showNotification('step5-wearable-recovery-guidance', {
      recoveryScore,
      deviceName,
      estimatedRecoveryHours
    });
  }

  /**
   * Wearable metrics insights
   */
  showWearableMetricsInsights(hrv?: number, restingHR?: number, sleepHours?: number): void {
    if (!hrv && !restingHR && !sleepHours) {
      return;
    }

    this.showNotification('step5-wearable-metrics-insights', {
      hrv,
      restingHR,
      sleepHours
    });
  }

  /**
   * Cleanup
   */
  reset(): void {
    logger.info('STEP5_ADAPTER', 'Reset called via adapter');
  }

  cleanup(): void {
    trainingNotificationService.cleanup();
    logger.info('STEP5_ADAPTER', 'Cleaned up via adapter');
  }
}

// Export singleton instance (maintains backward compatibility)
export const step5NotificationService = new Step5NotificationAdapter();
