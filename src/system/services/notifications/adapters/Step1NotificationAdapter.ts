/**
 * Step 1 Notification Adapter
 * Adapts the old step1NotificationService API to use the new TrainingNotificationService
 * This allows for gradual migration without breaking existing code
 */

import { trainingNotificationService, generateNotificationMessage } from '../core';
import type { TrainingNotificationContext } from '../core';
import logger from '../../../../lib/utils/logger';

class Step1NotificationAdapter {
  /**
   * Initialize (proxied to new service)
   */
  initialize(sessionId?: string): void {
    const sid = sessionId || `step1-${Date.now()}`;
    trainingNotificationService.initialize(sid, 'step1');
    logger.info('STEP1_ADAPTER', 'Initialized via adapter', { sessionId: sid });
  }

  /**
   * Show notification (generates message and proxies to new service)
   */
  private showNotification(id: string, customMessage?: string, context?: TrainingNotificationContext): void {
    const message = customMessage || generateNotificationMessage(id, context);
    trainingNotificationService.show(id, message, context);
  }

  /**
   * Queue notification with delay
   */
  private queueNotification(id: string, delayMs: number, customMessage?: string, context?: TrainingNotificationContext): void {
    const message = customMessage || generateNotificationMessage(id, context);
    trainingNotificationService.queue(id, message, delayMs, context);
  }

  /**
   * Time selection notifications
   */
  onTimeSelection(availableTime: number): void {
    if (availableTime <= 30) {
      this.showNotification('step1-time-short');
    } else if (availableTime >= 60) {
      this.showNotification('step1-time-long');
    }
  }

  /**
   * Energy level change notifications
   */
  onEnergyLevelChange(energyLevel: number): void {
    if (energyLevel >= 8) {
      this.showNotification('step1-energy-high');
    } else if (energyLevel >= 5) {
      this.showNotification('step1-energy-moderate');
    } else {
      this.showNotification('step1-energy-low');
    }
  }

  /**
   * Location selected notification
   */
  onLocationSelected(): void {
    this.showNotification('step1-location-selected');
  }

  /**
   * Fatigue checked notification
   */
  onFatigueChecked(): void {
    this.showNotification('step1-fatigue-checked');
  }

  /**
   * Pain checked notification
   */
  onPainChecked(): void {
    this.showNotification('step1-pain-checked');
  }

  /**
   * Short version enabled notification
   */
  onShortVersionEnabled(): void {
    this.showNotification('step1-short-version-enabled', 'Séance express ! On va à l\'essentiel 💨');
  }

  /**
   * Ready to continue notification
   */
  onReadyToContinue(): void {
    this.showNotification('step1-ready-to-continue', 'C\'est parti ! Génère ton training ! 🔥');
  }

  /**
   * Cleanup (proxied to new service)
   */
  cleanup(): void {
    trainingNotificationService.cleanup();
    logger.info('STEP1_ADAPTER', 'Cleaned up via adapter');
  }
}

// Export singleton instance (maintains backward compatibility)
export const step1NotificationService = new Step1NotificationAdapter();
