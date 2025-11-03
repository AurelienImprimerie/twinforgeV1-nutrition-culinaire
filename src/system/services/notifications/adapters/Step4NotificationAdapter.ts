/**
 * Step 4 Notification Adapter
 * Adapts the old step4NotificationService API to use the new TrainingNotificationService
 */

import { trainingNotificationService, generateNotificationMessage } from '../core';
import type { TrainingNotificationContext } from '../core';
import logger from '../../../../lib/utils/logger';

class Step4NotificationAdapter {
  /**
   * Initialize (proxied to new service)
   */
  async initialize(sessionId?: string): Promise<void> {
    const sid = sessionId || `step4-${Date.now()}`;
    await trainingNotificationService.initialize(sid, 'step4');
    logger.info('STEP4_ADAPTER', 'Initialized via adapter', { sessionId: sid });
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
   * Arrival sequence notifications
   */
  onArrival(): void {
    this.showNotification('step4-arrival-welcome');
    this.showNotification('step4-analysis-ready', undefined, 2500);
    this.showNotification('step4-insights-highlight', undefined, 5000);
  }

  /**
   * Analysis notifications
   */
  onAnalysisStarted(): void {
    this.showNotification('step4-analysis-started');
  }

  onAnalysisProgress(percentComplete: number): void {
    // Show progress notification at 25%, 50%, 75%
    if (percentComplete === 25 || percentComplete === 50 || percentComplete === 75) {
      this.showNotification('step4-analysis-progress', { percentComplete });
    }
  }

  onAnalysisComplete(): void {
    this.showNotification('step4-analysis-complete');
  }

  /**
   * Achievement notifications
   */
  showZoneComplianceCongratulation(compliancePercent: number, prescribedZones: string[]): void {
    if (compliancePercent < 75) {
      logger.debug('STEP4_ADAPTER', 'Zone compliance below threshold, no congratulation', {
        compliancePercent
      });
      return;
    }

    let badge: string;
    if (compliancePercent >= 90) {
      badge = '🏆 Zone Master';
    } else if (compliancePercent >= 80) {
      badge = '🎯 Zone Expert';
    } else {
      badge = '✅ Zone Contrôle';
    }

    this.showNotification('step4-zone-compliance-achievement', {
      compliancePercent,
      prescribedZones: prescribedZones.join(', '),
      badge
    });
  }

  showWearableMetricsAchievement(effortScore: number, dataQuality: string): void {
    if ((dataQuality !== 'excellent' && dataQuality !== 'good') || effortScore < 80) {
      return;
    }

    this.showNotification('step4-wearable-data-achievement', {
      effortScore,
      dataQuality
    });
  }

  /**
   * Cleanup
   */
  reset(): void {
    logger.info('STEP4_ADAPTER', 'Reset called via adapter');
  }

  cleanup(): void {
    trainingNotificationService.cleanup();
    logger.info('STEP4_ADAPTER', 'Cleaned up via adapter');
  }
}

// Export singleton instance (maintains backward compatibility)
export const step4NotificationService = new Step4NotificationAdapter();
