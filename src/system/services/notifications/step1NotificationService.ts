/**
 * Step 1 Notification Service
 * Service pour gérer les notifications contextuelles pendant la phase de préparation (Step 1)
 */

import { useUnifiedCoachStore } from '../../store/unifiedCoachStore';
import { getStep1Message, type Step1NotificationId } from '../../../config/step1CoachMessages';
import { Haptics } from '../../../utils/haptics';
import logger from '../../../lib/utils/logger';
import type { NotificationType, NotificationPriority } from '../../../domain/trainingCoachNotification';
import { trainingWearableIntegrationService } from '../training/trainingWearableIntegrationService';

const NOTIFICATION_TYPES: Record<Step1NotificationId, NotificationType> = {
  'step1-time-selection': 'feedback',
  'step1-time-short': 'instruction',
  'step1-time-long': 'motivation',
  'step1-energy-high': 'motivation',
  'step1-energy-moderate': 'feedback',
  'step1-energy-low': 'tip',
  'step1-location-selected': 'success',
  'step1-location-photo-mode': 'instruction',
  'step1-location-manual-mode': 'feedback',
  'step1-fatigue-checked': 'tip',
  'step1-pain-checked': 'warning',
  'step1-short-version-enabled': 'motivation',
  'step1-ready-to-continue': 'success'
};

const NOTIFICATION_PRIORITIES: Record<Step1NotificationId, NotificationPriority> = {
  'step1-time-selection': 'low',
  'step1-time-short': 'medium',
  'step1-time-long': 'medium',
  'step1-energy-high': 'medium',
  'step1-energy-moderate': 'low',
  'step1-energy-low': 'medium',
  'step1-location-selected': 'high',
  'step1-location-photo-mode': 'medium',
  'step1-location-manual-mode': 'medium',
  'step1-fatigue-checked': 'medium',
  'step1-pain-checked': 'high',
  'step1-short-version-enabled': 'high',
  'step1-ready-to-continue': 'high'
};

const NOTIFICATION_COLORS: Record<NotificationType, string> = {
  motivation: '#FF6B35',
  instruction: '#3B82F6',
  tip: '#10B981',
  feedback: '#8B5CF6',
  warning: '#F59E0B',
  success: '#22C55E'
};

class Step1NotificationService {
  private sessionId: string | null = null;
  private notificationsStopped: boolean = false;

  initialize(sessionId?: string) {
    this.sessionId = sessionId || `step1-${Date.now()}`;
    this.notificationsStopped = false;
    logger.info('STEP1_NOTIFICATION_SERVICE', 'Service initialized', {
      sessionId: this.sessionId
    });
  }

  showNotification(id: Step1NotificationId, customMessage?: string) {
    if (this.notificationsStopped) {
      logger.debug('STEP1_NOTIFICATION_SERVICE', 'Notification blocked (stopped)', { id });
      return;
    }

    const message = customMessage || getStep1Message(id);
    const type = NOTIFICATION_TYPES[id];
    const priority = NOTIFICATION_PRIORITIES[id];
    const color = NOTIFICATION_COLORS[type];

    useUnifiedCoachStore.getState().showNotification(
      id as any,
      message,
      type,
      priority,
      7000,
      color
    );

    this.triggerHapticFeedback(type);

    logger.debug('STEP1_NOTIFICATION_SERVICE', 'Notification triggered', {
      id,
      type,
      priority,
      message: message.substring(0, 50)
    });
  }

  queueNotification(id: Step1NotificationId, delayMs: number, customMessage?: string) {
    const message = customMessage || getStep1Message(id);
    const type = NOTIFICATION_TYPES[id];
    const priority = NOTIFICATION_PRIORITIES[id];
    const color = NOTIFICATION_COLORS[type];

    useUnifiedCoachStore.getState().queueNotification(
      id as any,
      message,
      type,
      priority,
      7000,
      delayMs,
      color
    );

    logger.debug('STEP1_NOTIFICATION_SERVICE', 'Notification queued', {
      id,
      delayMs,
      priority
    });
  }

  triggerHapticFeedback(type: NotificationType) {
    switch (type) {
      case 'motivation':
      case 'success':
        Haptics.success();
        break;
      case 'warning':
        Haptics.warning();
        break;
      case 'instruction':
      case 'feedback':
        Haptics.tap();
        break;
      default:
        Haptics.tap();
    }
  }

  onTimeSelection(availableTime: number) {
    if (availableTime <= 30) {
      this.showNotification('step1-time-short');
    } else if (availableTime >= 60) {
      this.showNotification('step1-time-long');
    } else {
      this.showNotification('step1-time-selection');
    }
  }

  onEnergyLevelChange(energyLevel: number) {
    if (energyLevel >= 8) {
      this.showNotification('step1-energy-high');
    } else if (energyLevel >= 5) {
      this.showNotification('step1-energy-moderate');
    } else {
      this.showNotification('step1-energy-low');
    }
  }

  onLocationSelected() {
    this.showNotification('step1-location-selected');

    setTimeout(() => {
      this.showNotification('step1-location-photo-mode');
    }, 1500);
  }

  onFatigueChecked() {
    this.showNotification('step1-fatigue-checked');
  }

  onPainChecked() {
    this.showNotification('step1-pain-checked');
  }

  onShortVersionEnabled() {
    this.showNotification('step1-short-version-enabled');
  }

  onReadyToContinue() {
    this.showNotification('step1-ready-to-continue');
  }

  /**
   * Check wearable recovery and show notification if low recovery detected
   * Triggered automatically during Step 1 initialization
   */
  async checkWearableRecoveryAndNotify(userId: string) {
    try {
      logger.info('STEP1_NOTIFICATION_SERVICE', 'Checking wearable recovery status', { userId });

      const recoveryMetrics = await trainingWearableIntegrationService.getRecoveryMetrics(userId);
      const intensityAdjustment = await trainingWearableIntegrationService.suggestIntensityAdjustment(userId);

      // Only show notification if we have wearable data
      if (!recoveryMetrics.recoveryScore && !recoveryMetrics.hrv) {
        logger.debug('STEP1_NOTIFICATION_SERVICE', 'No wearable data available for recovery check');
        return;
      }

      // Show notification if recovery is low (< 60)
      if (recoveryMetrics.recoveryScore && recoveryMetrics.recoveryScore < 60) {
        const hrvText = recoveryMetrics.hrv ? ` Votre HRV est à ${Math.round(recoveryMetrics.hrv)} ms,` : '';
        const message = `🌙${hrvText} une séance modérée est recommandée aujourd'hui. Écoutez votre corps et privilégiez la qualité sur la quantité.`;

        useUnifiedCoachStore.getState().showNotification(
          'step1-wearable-low-recovery' as any,
          message,
          'tip',
          'high',
          10000,
          '#F59E0B'
        );

        this.triggerHapticFeedback('warning');

        logger.info('STEP1_NOTIFICATION_SERVICE', 'Low recovery notification shown', {
          recoveryScore: recoveryMetrics.recoveryScore,
          hrv: recoveryMetrics.hrv,
          shouldReduceIntensity: intensityAdjustment.shouldReduceIntensity
        });
      } else if (recoveryMetrics.recoveryScore && recoveryMetrics.recoveryScore >= 80) {
        // Optional: positive notification for excellent recovery
        const message = `💪 Excellente récupération détectée ! Vous êtes prêt pour une séance intense.`;

        useUnifiedCoachStore.getState().showNotification(
          'step1-wearable-excellent-recovery' as any,
          message,
          'motivation',
          'medium',
          7000,
          '#10B981'
        );

        this.triggerHapticFeedback('success');

        logger.info('STEP1_NOTIFICATION_SERVICE', 'Excellent recovery notification shown', {
          recoveryScore: recoveryMetrics.recoveryScore
        });
      }
    } catch (error) {
      logger.error('STEP1_NOTIFICATION_SERVICE', 'Error checking wearable recovery', {
        error: error instanceof Error ? error.message : String(error),
        userId
      });
    }
  }

  reset() {
    this.sessionId = null;
    logger.info('STEP1_NOTIFICATION_SERVICE', 'Service reset');
  }

  stopNotifications() {
    this.notificationsStopped = true;
    useUnifiedCoachStore.getState().clearQueue();
    useUnifiedCoachStore.getState().hideNotification();
    logger.info('STEP1_NOTIFICATION_SERVICE', 'Notifications stopped');
  }

  resumeNotifications() {
    this.notificationsStopped = false;
    logger.info('STEP1_NOTIFICATION_SERVICE', 'Notifications resumed');
  }

  cleanup() {
    useUnifiedCoachStore.getState().clearQueue();
    this.notificationsStopped = false;
    logger.info('STEP1_NOTIFICATION_SERVICE', 'Service cleaned up');
  }
}

export const step1NotificationService = new Step1NotificationService();
