/**
 * Step 4 Notification Service
 * Service pour gérer les notifications contextuelles pendant la phase d'analyse (Step 4)
 */

import { useUnifiedCoachStore } from '../../store/unifiedCoachStore';
import { getStep4Message, type Step4NotificationId } from '../../../config/step4CoachMessages';
import { Haptics } from '../../../utils/haptics';
import logger from '../../../lib/utils/logger';
import type { NotificationType, NotificationPriority } from '../../../domain/trainingCoachNotification';

const NOTIFICATION_TYPES: Record<Step4NotificationId, NotificationType> = {
  'step4-arrival-welcome': 'motivation',
  'step4-analysis-ready': 'success',
  'step4-insights-highlight': 'feedback',
  'step4-analysis-started': 'instruction',
  'step4-analysis-progress': 'feedback',
  'step4-analysis-complete': 'success'
};

const NOTIFICATION_PRIORITIES: Record<Step4NotificationId, NotificationPriority> = {
  'step4-arrival-welcome': 'high',
  'step4-analysis-ready': 'medium',
  'step4-insights-highlight': 'medium',
  'step4-analysis-started': 'high',
  'step4-analysis-progress': 'medium',
  'step4-analysis-complete': 'high'
};

const NOTIFICATION_COLORS: Record<NotificationType, string> = {
  motivation: '#FF6B35',
  instruction: '#3B82F6',
  tip: '#10B981',
  feedback: '#8B5CF6',
  warning: '#F59E0B',
  success: '#22C55E'
};

class Step4NotificationService {
  private sessionId: string | null = null;

  initialize(sessionId?: string) {
    this.sessionId = sessionId || `step4-${Date.now()}`;
    logger.info('STEP4_NOTIFICATION_SERVICE', 'Service initialized', {
      sessionId: this.sessionId
    });
  }

  showNotification(id: Step4NotificationId, customMessage?: string) {
    const message = customMessage || getStep4Message(id);
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

    logger.debug('STEP4_NOTIFICATION_SERVICE', 'Notification triggered', {
      id,
      type,
      priority,
      message: message.substring(0, 50)
    });
  }

  queueNotification(id: Step4NotificationId, delayMs: number, customMessage?: string) {
    const message = customMessage || getStep4Message(id);
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

    logger.debug('STEP4_NOTIFICATION_SERVICE', 'Notification queued', {
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

  onArrival() {
    this.showNotification('step4-arrival-welcome');
    this.queueNotification('step4-analysis-ready', 2500);
    this.queueNotification('step4-insights-highlight', 5000);
  }

  onAnalysisStarted() {
    this.showNotification('step4-analysis-started');
    logger.info('STEP4_NOTIFICATION_SERVICE', 'Analysis started notification shown');
  }

  onAnalysisProgress(percentComplete: number) {
    // Show progress notification at 25%, 50%, 75%
    if (percentComplete === 25 || percentComplete === 50 || percentComplete === 75) {
      this.showNotification('step4-analysis-progress');
      logger.debug('STEP4_NOTIFICATION_SERVICE', 'Analysis progress notification', {
        percentComplete
      });
    }
  }

  onAnalysisComplete() {
    this.showNotification('step4-analysis-complete');
    logger.info('STEP4_NOTIFICATION_SERVICE', 'Analysis complete notification shown');
  }

  /**
   * Show zone compliance congratulation for endurance sessions
   * Triggered when zone compliance > 75%
   */
  showZoneComplianceCongratulation(compliancePercent: number, prescribedZones: string[]) {
    try {
      if (compliancePercent < 75) {
        logger.debug('STEP4_NOTIFICATION_SERVICE', 'Zone compliance below threshold, no congratulation', {
          compliancePercent
        });
        return;
      }

      let message: string;
      let badge: string;

      if (compliancePercent >= 90) {
        message = `🏆 Bravo ! ${Math.round(compliancePercent)}% du temps passé dans vos zones cibles (${prescribedZones.join(', ')}). Performance exceptionnelle !`;
        badge = '🏆 Zone Master';
      } else if (compliancePercent >= 80) {
        message = `🎯 Excellent ! ${Math.round(compliancePercent)}% du temps en zones cibles (${prescribedZones.join(', ')}). Très bonne maîtrise de votre allure.`;
        badge = '🎯 Zone Expert';
      } else {
        message = `✅ Bien joué ! ${Math.round(compliancePercent)}% du temps en zones cibles (${prescribedZones.join(', ')}). Continuez à travailler votre régularité.`;
        badge = '✅ Zone Contrôle';
      }

      useUnifiedCoachStore.getState().showNotification(
        'step4-zone-compliance-achievement' as any,
        `${badge}\n\n${message}`,
        'success',
        'high',
        10000,
        '#10B981'
      );

      this.triggerHapticFeedback('success');

      logger.info('STEP4_NOTIFICATION_SERVICE', 'Zone compliance congratulation shown', {
        compliancePercent,
        prescribedZones,
        badge
      });
    } catch (error) {
      logger.error('STEP4_NOTIFICATION_SERVICE', 'Error showing zone compliance congratulation', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Show wearable metrics achievement badge
   * Triggered when wearable analysis is available with excellent metrics
   */
  showWearableMetricsAchievement(effortScore: number, dataQuality: string) {
    try {
      if (dataQuality !== 'excellent' && dataQuality !== 'good') {
        return;
      }

      if (effortScore < 80) {
        return;
      }

      const message = `📊 Données wearable complètes ! Score d'effort de ${effortScore}/100 avec qualité ${dataQuality === 'excellent' ? 'excellente' : 'bonne'}. Vos métriques permettent une analyse précise de votre performance.`;

      useUnifiedCoachStore.getState().showNotification(
        'step4-wearable-data-achievement' as any,
        message,
        'success',
        'medium',
        8000,
        '#3B82F6'
      );

      this.triggerHapticFeedback('success');

      logger.info('STEP4_NOTIFICATION_SERVICE', 'Wearable metrics achievement shown', {
        effortScore,
        dataQuality
      });
    } catch (error) {
      logger.error('STEP4_NOTIFICATION_SERVICE', 'Error showing wearable achievement', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  reset() {
    this.sessionId = null;
    logger.info('STEP4_NOTIFICATION_SERVICE', 'Service reset');
  }

  cleanup() {
    useUnifiedCoachStore.getState().clearQueue();
    logger.info('STEP4_NOTIFICATION_SERVICE', 'Service cleaned up');
  }
}

export const step4NotificationService = new Step4NotificationService();
