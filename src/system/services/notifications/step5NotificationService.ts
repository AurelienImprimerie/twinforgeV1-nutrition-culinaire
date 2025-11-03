/**
 * Step 5 Notification Service
 * Service for managing notifications during Step 5 (Avancer)
 */

import { useUnifiedCoachStore } from '../../store/unifiedCoachStore';
import { getStep5Message, type Step5NotificationId } from '../../../config/step5CoachMessages';
import { Haptics } from '../../../utils/haptics';
import logger from '../../../lib/utils/logger';
import type { NotificationType, NotificationPriority } from '../../../domain/trainingCoachNotification';

const NOTIFICATION_TYPES: Record<Step5NotificationId, NotificationType> = {
  'step5-arrival-welcome': 'motivation',
  'step5-recommendation-ready': 'success',
  'step5-recovery-optimal': 'feedback',
  'step5-action-accepted': 'success'
};

const NOTIFICATION_PRIORITIES: Record<Step5NotificationId, NotificationPriority> = {
  'step5-arrival-welcome': 'high',
  'step5-recommendation-ready': 'medium',
  'step5-recovery-optimal': 'medium',
  'step5-action-accepted': 'high'
};

const NOTIFICATION_COLORS: Record<NotificationType, string> = {
  motivation: '#FF6B35',
  instruction: '#3B82F6',
  tip: '#10B981',
  feedback: '#8B5CF6',
  warning: '#F59E0B',
  success: '#22C55E'
};

class Step5NotificationService {
  private sessionId: string | null = null;

  /**
   * Initialize the service
   */
  initialize(sessionId?: string) {
    this.sessionId = sessionId || `step5-${Date.now()}`;
    logger.info('STEP5_NOTIFICATION_SERVICE', 'Service initialized', {
      sessionId: this.sessionId
    });
  }

  /**
   * Show a notification
   */
  showNotification(id: Step5NotificationId, customMessage?: string) {
    const message = customMessage || getStep5Message(id);
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

    logger.debug('STEP5_NOTIFICATION_SERVICE', 'Notification triggered', {
      id,
      type,
      priority,
      message: message.substring(0, 50)
    });
  }

  /**
   * Queue a notification with delay
   */
  queueNotification(id: Step5NotificationId, delayMs: number, customMessage?: string) {
    const message = customMessage || getStep5Message(id);
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

    logger.debug('STEP5_NOTIFICATION_SERVICE', 'Notification queued', {
      id,
      delayMs,
      priority
    });
  }

  /**
   * Trigger appropriate haptic feedback
   */
  private triggerHapticFeedback(type: NotificationType) {
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

  /**
   * Show arrival welcome notification
   */
  onArrival() {
    this.showNotification('step5-arrival-welcome');
    this.queueNotification('step5-recommendation-ready', 2000);
  }

  /**
   * Show recovery optimal notification
   */
  onRecoveryOptimal() {
    this.showNotification('step5-recovery-optimal');
  }

  /**
   * Show action accepted notification
   */
  onActionAccepted() {
    this.showNotification('step5-action-accepted');
  }

  /**
   * Show wearable recovery guidance based on recovery score
   * Provides personalized recommendations for next session timing
   */
  showWearableRecoveryGuidance(recoveryScore: number, deviceName: string, estimatedRecoveryHours?: number) {
    try {
      let message: string;
      let type: NotificationType;
      let priority: NotificationPriority;
      let color: string;

      if (recoveryScore < 40) {
        // Very low recovery - need significant rest
        const hours = estimatedRecoveryHours || 48;
        message = `🛌 Votre corps a besoin de ${hours}h de récupération d'après vos métriques ${deviceName}. Privilégiez le repos, l'hydratation et le sommeil.`;
        type = 'warning';
        priority = 'high';
        color = '#F59E0B';
      } else if (recoveryScore < 60) {
        // Low recovery - moderate rest needed
        const hours = estimatedRecoveryHours || 36;
        message = `⚠️ Récupération modérée détectée. Prévoyez ${hours}h de repos avant votre prochaine séance intense. Une séance légère est possible dans 24h.`;
        type = 'feedback';
        priority = 'high';
        color = '#F59E0B';
      } else if (recoveryScore < 75) {
        // Good recovery - normal training possible
        message = `✅ Bonne récupération ! Vous pouvez planifier votre prochaine séance dans 24-36h. Écoutez votre corps pendant l'entraînement.`;
        type = 'feedback';
        priority = 'medium';
        color = '#10B981';
      } else {
        // Excellent recovery - can intensify
        message = `💪 Excellente récupération ! Vos métriques ${deviceName} montrent que vous êtes prêt. Vous pouvez intensifier votre prochaine séance en toute confiance.`;
        type = 'motivation';
        priority = 'high';
        color = '#10B981';
      }

      useUnifiedCoachStore.getState().showNotification(
        'step5-wearable-recovery-guidance' as any,
        message,
        type,
        priority,
        10000,
        color
      );

      this.triggerHapticFeedback(type);

      logger.info('STEP5_NOTIFICATION_SERVICE', 'Wearable recovery guidance shown', {
        recoveryScore,
        deviceName,
        estimatedRecoveryHours,
        type
      });
    } catch (error) {
      logger.error('STEP5_NOTIFICATION_SERVICE', 'Error showing wearable recovery guidance', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Show detailed wearable metrics insights
   * Provides context on HRV, resting HR, and sleep quality
   */
  showWearableMetricsInsights(hrv?: number, restingHR?: number, sleepHours?: number) {
    try {
      if (!hrv && !restingHR && !sleepHours) {
        return;
      }

      const insights: string[] = [];

      if (hrv !== undefined) {
        if (hrv > 60) {
          insights.push(`HRV excellente (${Math.round(hrv)} ms) - système nerveux bien récupéré`);
        } else if (hrv > 40) {
          insights.push(`HRV correcte (${Math.round(hrv)} ms) - récupération en cours`);
        } else {
          insights.push(`HRV basse (${Math.round(hrv)} ms) - stress ou fatigue détectée`);
        }
      }

      if (restingHR !== undefined) {
        if (restingHR < 60) {
          insights.push(`FC repos optimale (${Math.round(restingHR)} bpm) - excellent niveau de forme`);
        } else if (restingHR < 70) {
          insights.push(`FC repos normale (${Math.round(restingHR)} bpm)`);
        } else {
          insights.push(`FC repos élevée (${Math.round(restingHR)} bpm) - peut-être signe de fatigue`);
        }
      }

      if (sleepHours !== undefined) {
        if (sleepHours >= 7) {
          insights.push(`Sommeil suffisant (${sleepHours.toFixed(1)}h) - récupération optimale`);
        } else if (sleepHours >= 6) {
          insights.push(`Sommeil correct (${sleepHours.toFixed(1)}h) - un peu plus serait idéal`);
        } else {
          insights.push(`Sommeil insuffisant (${sleepHours.toFixed(1)}h) - priorisez le repos`);
        }
      }

      if (insights.length > 0) {
        const message = `📊 Analyse de vos métriques:\n\n${insights.join('\n• ')}`;

        useUnifiedCoachStore.getState().showNotification(
          'step5-wearable-metrics-insights' as any,
          message,
          'tip',
          'medium',
          12000,
          '#3B82F6'
        );

        this.triggerHapticFeedback('feedback');

        logger.info('STEP5_NOTIFICATION_SERVICE', 'Wearable metrics insights shown', {
          hrv,
          restingHR,
          sleepHours,
          insightsCount: insights.length
        });
      }
    } catch (error) {
      logger.error('STEP5_NOTIFICATION_SERVICE', 'Error showing wearable metrics insights', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Reset service
   */
  reset() {
    this.sessionId = null;
    logger.info('STEP5_NOTIFICATION_SERVICE', 'Service reset');
  }

  /**
   * Cleanup
   */
  cleanup() {
    useUnifiedCoachStore.getState().clearQueue();
    logger.info('STEP5_NOTIFICATION_SERVICE', 'Service cleaned up');
  }
}

export const step5NotificationService = new Step5NotificationService();
