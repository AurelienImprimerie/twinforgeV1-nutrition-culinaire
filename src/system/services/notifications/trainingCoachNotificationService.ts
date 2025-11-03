/**
 * Training Coach Notification Service
 * Service principal pour gérer les notifications contextuelles du coach pendant la Step 3
 */

import { useUnifiedCoachStore } from '../../store/unifiedCoachStore';
import { getCoachMessage } from '../../../config/trainingCoachMessages';
import { supabase } from '../../supabase/client';
import { Haptics } from '../../../utils/haptics';
import logger from '../../../lib/utils/logger';
import type {
  TrainingNotificationId,
  TrainingNotificationContext,
  NotificationType,
  NotificationPriority
} from '../../../domain/trainingCoachNotification';

const NOTIFICATION_COLORS: Record<NotificationType, string> = {
  motivation: '#FF6B35',
  instruction: '#3B82F6',
  tip: '#10B981',
  feedback: '#8B5CF6',
  warning: '#F59E0B',
  success: '#22C55E'
};

const NOTIFICATION_PRIORITIES: Record<TrainingNotificationId, NotificationPriority> = {
  'step2-generation-start': 'high',
  'step2-generation-analyzing': 'medium',
  'step2-generation-selecting': 'medium',
  'step2-generation-calculating': 'medium',
  'step2-generation-complete': 'high',
  'step2-welcome-intro': 'high',
  'step2-welcome-help': 'medium',
  'step2-sets-increased': 'medium',
  'step2-sets-decreased': 'medium',
  'step2-reps-increased': 'medium',
  'step2-reps-decreased': 'medium',
  'step2-load-increased': 'medium',
  'step2-load-decreased': 'medium',
  'step2-alternative-selected': 'high',
  'step2-exercise-regenerating': 'medium',
  'step2-exercise-regenerated': 'high',
  'step2-exercise-error': 'high',
  'step2-draft-saved': 'high',
  'step3-warmup-start': 'high',
  'step3-warmup-tip': 'medium',
  'step3-warmup-complete': 'high',
  'step3-warmup-skipped': 'medium',
  'step3-arrival': 'high',
  'step3-countdown-10s': 'medium',
  'step3-countdown-5s': 'high',
  'step3-countdown-3s': 'high',
  'step3-countdown-go': 'critical',
  'step3-new-exercise': 'high',
  'step3-set-complete': 'medium',
  'step3-load-adjust-up': 'medium',
  'step3-load-adjust-down': 'medium',
  'step3-rest-tip-1': 'low',
  'step3-rest-tip-2': 'low',
  'step3-rest-tip-3': 'low',
  'step3-transition-ready': 'high',
  'step3-rpe-feedback-easy': 'medium',
  'step3-rpe-feedback-moderate': 'medium',
  'step3-rpe-feedback-hard': 'medium',
  'step3-exercise-complete': 'high',
  'step3-session-paused': 'medium',
  'step3-session-resumed': 'medium',
  'step3-rest-paused': 'low',
  'step3-rest-resumed': 'low',
  'step4-arrival-welcome': 'high',
  'step4-analysis-ready': 'medium',
  'step4-insights-highlight': 'medium'
};

const NOTIFICATION_TYPES: Record<TrainingNotificationId, NotificationType> = {
  'step2-generation-start': 'motivation',
  'step2-generation-analyzing': 'instruction',
  'step2-generation-selecting': 'instruction',
  'step2-generation-calculating': 'instruction',
  'step2-generation-complete': 'success',
  'step2-welcome-intro': 'motivation',
  'step2-welcome-help': 'instruction',
  'step2-sets-increased': 'success',
  'step2-sets-decreased': 'feedback',
  'step2-reps-increased': 'success',
  'step2-reps-decreased': 'feedback',
  'step2-load-increased': 'success',
  'step2-load-decreased': 'feedback',
  'step2-alternative-selected': 'success',
  'step2-exercise-regenerating': 'instruction',
  'step2-exercise-regenerated': 'success',
  'step2-exercise-error': 'warning',
  'step2-draft-saved': 'success',
  'step3-warmup-start': 'instruction',
  'step3-warmup-tip': 'tip',
  'step3-warmup-complete': 'success',
  'step3-warmup-skipped': 'feedback',
  'step3-arrival': 'motivation',
  'step3-countdown-10s': 'instruction',
  'step3-countdown-5s': 'instruction',
  'step3-countdown-3s': 'instruction',
  'step3-countdown-go': 'motivation',
  'step3-new-exercise': 'motivation',
  'step3-set-complete': 'success',
  'step3-load-adjust-up': 'feedback',
  'step3-load-adjust-down': 'feedback',
  'step3-rest-tip-1': 'tip',
  'step3-rest-tip-2': 'tip',
  'step3-rest-tip-3': 'tip',
  'step3-transition-ready': 'motivation',
  'step3-rpe-feedback-easy': 'feedback',
  'step3-rpe-feedback-moderate': 'feedback',
  'step3-rpe-feedback-hard': 'feedback',
  'step3-exercise-complete': 'success',
  'step3-session-paused': 'instruction',
  'step3-session-resumed': 'motivation',
  'step3-rest-paused': 'tip',
  'step3-rest-resumed': 'tip',
  'step4-arrival-welcome': 'motivation',
  'step4-analysis-ready': 'instruction',
  'step4-insights-highlight': 'feedback'
};

class TrainingCoachNotificationService {
  private sessionId: string | null = null;
  private userId: string | null = null;
  private initializationPromise: Promise<void> | null = null;
  private _isInitialized: boolean = false;

  async initialize(sessionId: string): Promise<void> {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = (async () => {
      this.sessionId = sessionId;

      const { data: { user } } = await supabase.auth.getUser();
      this.userId = user?.id || null;

      this._isInitialized = true;

      logger.info('TRAINING_COACH_SERVICE', 'Service initialized', {
        sessionId,
        userId: this.userId,
        isInitialized: this._isInitialized
      });
    })();

    // Add 3 second timeout for initialization
    const timeoutPromise = new Promise<void>((_, reject) => {
      setTimeout(() => reject(new Error('Initialization timeout')), 3000);
    });

    try {
      await Promise.race([this.initializationPromise, timeoutPromise]);
    } catch (error) {
      logger.error('TRAINING_COACH_SERVICE', 'Initialization failed or timed out', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      this._isInitialized = false;
      throw error;
    }

    return this.initializationPromise;
  }

  isInitialized(): boolean {
    return this._isInitialized && this.userId !== null;
  }

  private async ensureInitialized(): Promise<boolean> {
    if (this.initializationPromise) {
      await this.initializationPromise;
    }
    return this.userId !== null;
  }

  showNotification(
    id: TrainingNotificationId,
    context?: TrainingNotificationContext,
    customMessage?: string
  ) {
    const message = customMessage || getCoachMessage(id, context);
    const type = NOTIFICATION_TYPES[id];
    const priority = NOTIFICATION_PRIORITIES[id];
    const color = NOTIFICATION_COLORS[type];

    useUnifiedCoachStore.getState().showNotification(
      id,
      message,
      type,
      priority,
      7000,
      color,
      context
    );

    this.triggerHapticFeedback(type);

    this.persistNotificationAsync(id, message, type, priority, context);

    logger.info('TRAINING_COACH_SERVICE', 'Notification shown', {
      id,
      type,
      priority
    });
  }

  private async persistNotificationAsync(
    notificationId: TrainingNotificationId,
    message: string,
    type: NotificationType,
    priority: NotificationPriority,
    context?: TrainingNotificationContext
  ) {
    const isInitialized = await this.ensureInitialized();
    if (!isInitialized) {
      logger.warn('TRAINING_COACH_SERVICE', 'Cannot persist notification: initialization incomplete or no user ID');
      return;
    }

    await this.persistNotification(notificationId, message, type, priority, context);
  }

  queueNotification(
    id: TrainingNotificationId,
    delayMs: number,
    context?: TrainingNotificationContext,
    customMessage?: string
  ) {
    const message = customMessage || getCoachMessage(id, context);
    const type = NOTIFICATION_TYPES[id];
    const priority = NOTIFICATION_PRIORITIES[id];
    const color = NOTIFICATION_COLORS[type];

    useUnifiedCoachStore.getState().queueNotification(
      id,
      message,
      type,
      priority,
      7000,
      delayMs,
      color,
      context
    );

    logger.debug('TRAINING_COACH_SERVICE', 'Notification queued', {
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

  private async persistNotification(
    notificationId: TrainingNotificationId,
    message: string,
    type: NotificationType,
    priority: NotificationPriority,
    context?: TrainingNotificationContext
  ) {
    if (!this.userId) {
      logger.warn('TRAINING_COACH_SERVICE', 'Cannot persist notification: no user ID');
      return;
    }

    try {
      const { error } = await supabase
        .from('training_coach_notifications')
        .insert({
          user_id: this.userId,
          session_id: this.sessionId || null,
          notification_id: notificationId,
          notification_type: type,
          message,
          priority,
          context: context || {},
          was_displayed: true,
          was_clicked: false,
          display_duration_ms: 7000
        });

      if (error) {
        logger.error('TRAINING_COACH_SERVICE', 'Failed to persist notification', {
          error: error.message,
          code: error.code,
          details: error.details,
          sessionId: this.sessionId,
          hasSessionId: !!this.sessionId
        });
      } else {
        logger.debug('TRAINING_COACH_SERVICE', 'Notification persisted successfully', {
          notificationId,
          userId: this.userId,
          sessionId: this.sessionId
        });
      }
    } catch (err) {
      logger.error('TRAINING_COACH_SERVICE', 'Exception persisting notification', {
        error: err instanceof Error ? err.message : 'Unknown error'
      });
    }
  }

  async trackNotificationClick(notificationId: string) {
    if (!this.userId) return;

    try {
      const { error } = await supabase
        .from('training_coach_notifications')
        .update({ was_clicked: true })
        .eq('user_id', this.userId)
        .eq('notification_id', notificationId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        logger.error('TRAINING_COACH_SERVICE', 'Failed to track click', { error });
      }
    } catch (err) {
      logger.error('TRAINING_COACH_SERVICE', 'Exception tracking click', { err });
    }
  }

  onArrival(context?: TrainingNotificationContext) {
    this.showNotification('step3-arrival', context);
  }

  onCountdown10s(context?: TrainingNotificationContext) {
    this.showNotification('step3-countdown-10s', context);
  }

  onCountdown5s(context?: TrainingNotificationContext) {
    this.showNotification('step3-countdown-5s', context);
  }

  onCountdown3s(context?: TrainingNotificationContext) {
    this.showNotification('step3-countdown-3s', context);
  }

  onCountdownGo(context?: TrainingNotificationContext) {
    this.showNotification('step3-countdown-go', context);
  }

  onNewExercise(context: TrainingNotificationContext) {
    this.showNotification('step3-new-exercise', context);
  }

  onSetComplete(context?: TrainingNotificationContext) {
    this.showNotification('step3-set-complete', context);
  }

  onLoadAdjustUp(context: TrainingNotificationContext) {
    this.showNotification('step3-load-adjust-up', context);
  }

  onLoadAdjustDown(context: TrainingNotificationContext) {
    this.showNotification('step3-load-adjust-down', context);
  }

  onRestPhase(context: TrainingNotificationContext) {
    // First tip: Immediately show the next load progression
    this.queueNotification('step3-rest-tip-1', 2000, context);

    const restTime = context.restTime || 60;

    // Second tip: Mid-rest, emphasize the progression increment
    if (restTime >= 30) {
      const secondTipDelay = Math.min(restTime * 1000 * 0.4, 15000);
      this.queueNotification('step3-rest-tip-2', secondTipDelay, context);
    }

    // Third tip: Near end of rest, final reminder of upcoming load
    if (restTime >= 45) {
      const thirdTipDelay = Math.min(restTime * 1000 * 0.7, 25000);
      this.queueNotification('step3-rest-tip-3', thirdTipDelay, context);
    }

    logger.debug('TRAINING_COACH_SERVICE', 'Rest tips scheduled with progression info', {
      restTime,
      newLoad: context.newLoad,
      loadIncrement: context.loadIncrement,
      tipsCount: restTime >= 45 ? 3 : restTime >= 30 ? 2 : 1
    });
  }

  onTransitionReady(context?: TrainingNotificationContext) {
    this.showNotification('step3-transition-ready', context);
  }

  onRPEFeedback(rpe: number, context?: TrainingNotificationContext) {
    let notificationId: TrainingNotificationId;

    if (rpe <= 6) {
      notificationId = 'step3-rpe-feedback-easy';
    } else if (rpe <= 8) {
      notificationId = 'step3-rpe-feedback-moderate';
    } else {
      notificationId = 'step3-rpe-feedback-hard';
    }

    this.showNotification(notificationId, { ...context, rpe });
  }

  onExerciseComplete(context?: TrainingNotificationContext) {
    this.showNotification('step3-exercise-complete', context);
  }

  onSessionPaused(isResting: boolean, context?: TrainingNotificationContext) {
    const notificationId = isResting ? 'step3-rest-paused' : 'step3-session-paused';
    this.showNotification(notificationId, context);
  }

  onSessionResumed(isResting: boolean, context?: TrainingNotificationContext) {
    const notificationId = isResting ? 'step3-rest-resumed' : 'step3-session-resumed';
    this.showNotification(notificationId, context);
  }

  reset() {
    useUnifiedCoachStore.getState().reset();
    this.sessionId = null;
    this.userId = null;
    this._isInitialized = false;
    this.initializationPromise = null;
    logger.info('TRAINING_COACH_SERVICE', 'Service reset');
  }

  cleanup() {
    useUnifiedCoachStore.getState().clearQueue();
    logger.info('TRAINING_COACH_SERVICE', 'Service cleaned up');
  }
  /**
   * Show HR zone encouragement during endurance sessions
   * Triggered periodically (every 5-10 minutes) based on current HR zone
   */
  showHRZoneEncouragement(currentZone: number, prescribedZones: string[], currentBpm: number) {
    try {
      // Only for endurance sessions with wearable tracking
      if (!prescribedZones || prescribedZones.length === 0) {
        return;
      }

      let message: string;
      let type: NotificationType;
      let priority: NotificationPriority;
      let color: string;

      // Extract zone number from prescribed zones (e.g., "Zone 2" -> 2)
      const targetZones = prescribedZones.map(z => parseInt(z.replace(/\D/g, '')));

      if (targetZones.includes(currentZone)) {
        // Perfect zone
        if (currentZone === 2) {
          message = `🎯 Excellent ! Vous êtes en Zone 2 parfaite (${currentBpm} bpm). Maintenez cette allure pour développer votre endurance aérobie.`;
        } else if (currentZone === 3) {
          message = `💪 Parfait ! Zone 3 idéale (${currentBpm} bpm). Vous travaillez au seuil aérobie, continuez ainsi.`;
        } else if (currentZone === 4) {
          message = `🔥 Super ! Zone 4 atteinte (${currentBpm} bpm). Intensité élevée, concentrez-vous sur votre respiration.`;
        } else {
          message = `✅ Parfait ! Vous êtes dans votre zone cible (${currentBpm} bpm).`;
        }
        type = 'success';
        priority = 'medium';
        color = '#10B981';
      } else if (currentZone > Math.max(...targetZones)) {
        // Too high
        const diff = currentZone - Math.max(...targetZones);
        if (diff === 1) {
          message = `⚠️ Ralentissez légèrement, vous êtes en Zone ${currentZone} (${currentBpm} bpm). Cible: Zone ${Math.max(...targetZones)}.`;
        } else {
          message = `🛑 Réduisez l'intensité ! Zone ${currentZone} (${currentBpm} bpm) trop élevée. Revenez en Zone ${Math.max(...targetZones)}.`;
        }
        type = 'warning';
        priority = 'high';
        color = '#F59E0B';
      } else {
        // Too low
        message = `📈 Vous pouvez accélérer ! Zone ${currentZone} (${currentBpm} bpm). Cible: Zone ${targetZones.join(' ou ')}.`;
        type = 'feedback';
        priority = 'medium';
        color = '#3B82F6';
      }

      useUnifiedCoachStore.getState().showNotification(
        `step3-hr-zone-${currentZone}` as any,
        message,
        type,
        priority,
        8000,
        color
      );

      this.triggerHapticFeedback(type);

      logger.info('TRAINING_COACH_SERVICE', 'HR zone encouragement shown', {
        currentZone,
        prescribedZones,
        currentBpm,
        type
      });
    } catch (error) {
      logger.error('TRAINING_COACH_SERVICE', 'Error showing HR zone encouragement', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Start periodic HR zone monitoring for endurance sessions
   * Checks HR zone every 5-10 minutes and provides feedback
   */
  startHRZoneMonitoring(
    getCurrentZone: () => number | undefined,
    getCurrentBpm: () => number | undefined,
    prescribedZones: string[],
    intervalMinutes: number = 5
  ): NodeJS.Timeout {
    const intervalMs = intervalMinutes * 60 * 1000;

    logger.info('TRAINING_COACH_SERVICE', 'Starting HR zone monitoring', {
      intervalMinutes,
      prescribedZones
    });

    const intervalId = setInterval(() => {
      const currentZone = getCurrentZone();
      const currentBpm = getCurrentBpm();

      if (currentZone !== undefined && currentBpm !== undefined) {
        this.showHRZoneEncouragement(currentZone, prescribedZones, currentBpm);
      }
    }, intervalMs);

    return intervalId;
  }
}

export const trainingCoachNotificationService = new TrainingCoachNotificationService();
