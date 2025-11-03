/**
 * Training Notification Service (Consolidated)
 * Unified service for all training-related notifications across all pipeline steps
 *
 * Replaces:
 * - step1NotificationService
 * - step2NotificationService
 * - step4NotificationService
 * - step5NotificationService
 * - trainingCoachNotificationService
 * - enduranceCoachNotificationService
 *
 * Features:
 * - Centralized notification management
 * - Step-aware context
 * - Automatic lifecycle management
 * - Performance optimized
 */

import { NotificationLifecycleManager, type NotificationConfig } from './NotificationLifecycleManager';
import { useUnifiedCoachStore } from '../../../store/unifiedCoachStore';
import { Haptics } from '../../../../utils/haptics';
import logger from '../../../../lib/utils/logger';
import { supabase } from '../../../supabase/client';

export type TrainingNotificationId = string;
export type PipelineStep = 'step1' | 'step2' | 'step3' | 'step4' | 'step5';

export interface TrainingNotificationContext {
  // Exercise context
  exerciseName?: string;
  exerciseVariant?: string;
  currentSet?: number;
  totalSets?: number;
  load?: number;
  oldLoad?: number;
  newLoad?: number;
  loadAdjustment?: number;
  loadIncrement?: number;
  restTime?: number;
  rpe?: number;

  // Session context
  sessionId?: string;
  userId?: string;
  discipline?: string;

  // Progression context
  nextExerciseName?: string;
  nextExerciseVariant?: string;
  substitutionName?: string;

  // Metadata
  [key: string]: any;
}

export class TrainingNotificationService {
  private lifecycleManager: NotificationLifecycleManager;
  private sessionId: string | null = null;
  private userId: string | null = null;
  private currentStep: PipelineStep | null = null;
  private isInitialized: boolean = false;

  constructor() {
    this.lifecycleManager = new NotificationLifecycleManager();

    // Register callbacks to sync with store
    this.lifecycleManager.setCallbacks(
      (notification) => this.syncToStore(notification),
      () => this.clearFromStore()
    );

    logger.info('TRAINING_NOTIFICATION_SERVICE', 'Service created');
  }

  /**
   * Initialize service for a training session
   */
  async initialize(sessionId: string, step: PipelineStep): Promise<void> {
    this.sessionId = sessionId;
    this.currentStep = step;

    // Get user ID
    const { data: { user } } = await supabase.auth.getUser();
    this.userId = user?.id || null;

    this.isInitialized = true;

    logger.info('TRAINING_NOTIFICATION_SERVICE', 'Service initialized', {
      sessionId,
      step,
      userId: this.userId
    });
  }

  /**
   * Check if service is ready
   */
  isReady(): boolean {
    return this.isInitialized && this.userId !== null;
  }

  /**
   * Show notification immediately
   */
  show(
    id: TrainingNotificationId,
    message: string,
    context?: TrainingNotificationContext
  ): void {
    if (!this.isReady()) {
      logger.warn('TRAINING_NOTIFICATION_SERVICE', 'Cannot show notification: not initialized', { id });
      return;
    }

    const config = this.createNotificationConfig(id, message, context);
    this.lifecycleManager.show(config);

    // Trigger haptic feedback
    this.triggerHapticFeedback(config.type);

    // Persist to database (async, non-blocking)
    this.persistNotificationAsync(id, message, config.type, config.priority, context);
  }

  /**
   * Queue notification with delay
   */
  queue(
    id: TrainingNotificationId,
    message: string,
    delayMs: number,
    context?: TrainingNotificationContext
  ): void {
    const config = this.createNotificationConfig(id, message, context);

    this.lifecycleManager.queue({
      ...config,
      delayMs
    });

    logger.debug('TRAINING_NOTIFICATION_SERVICE', 'Notification queued', {
      id,
      delayMs
    });
  }

  /**
   * Hide current notification
   */
  hide(): void {
    this.lifecycleManager.hide();
  }

  /**
   * Pause notifications (use during transitions/loaders)
   */
  pause(): void {
    this.lifecycleManager.pause();
  }

  /**
   * Resume notifications
   */
  resume(): void {
    this.lifecycleManager.resume();
  }

  /**
   * Clear notification queue
   */
  clearQueue(): void {
    this.lifecycleManager.clearQueue();
  }

  /**
   * Cleanup service
   */
  cleanup(): void {
    this.lifecycleManager.cleanup();
    this.sessionId = null;
    this.userId = null;
    this.currentStep = null;
    this.isInitialized = false;

    logger.info('TRAINING_NOTIFICATION_SERVICE', 'Service cleaned up');
  }

  /**
   * Update current step
   */
  setCurrentStep(step: PipelineStep): void {
    this.currentStep = step;
    logger.debug('TRAINING_NOTIFICATION_SERVICE', 'Step updated', { step });
  }

  /**
   * Get current state for debugging
   */
  getState() {
    return {
      ...this.lifecycleManager.getState(),
      sessionId: this.sessionId,
      userId: this.userId,
      currentStep: this.currentStep,
      isInitialized: this.isInitialized
    };
  }

  // ==================== Private Methods ====================

  /**
   * Create notification config from parameters
   */
  private createNotificationConfig(
    id: TrainingNotificationId,
    message: string,
    context?: TrainingNotificationContext
  ): NotificationConfig {
    const { type, priority, color } = this.inferNotificationProperties(id);

    return {
      id,
      message,
      type,
      priority,
      duration: 7000,
      color,
      context: {
        ...context,
        step: this.currentStep,
        sessionId: this.sessionId,
        userId: this.userId
      }
    };
  }

  /**
   * Infer notification properties from ID
   */
  private inferNotificationProperties(id: TrainingNotificationId) {
    // Motivation: encouragement, success
    if (id.includes('success') || id.includes('complete') || id.includes('ready')) {
      return {
        type: 'success' as const,
        priority: 'high' as const,
        color: '#22C55E'
      };
    }

    // Warning: pain, fatigue, issues
    if (id.includes('warning') || id.includes('pain') || id.includes('error')) {
      return {
        type: 'warning' as const,
        priority: 'high' as const,
        color: '#F59E0B'
      };
    }

    // Instructions: how-to, guidance
    if (id.includes('instruction') || id.includes('analyzing') || id.includes('calculating')) {
      return {
        type: 'instruction' as const,
        priority: 'medium' as const,
        color: '#3B82F6'
      };
    }

    // Tips: helpful hints
    if (id.includes('tip') || id.includes('fatigue') || id.includes('rest')) {
      return {
        type: 'tip' as const,
        priority: 'low' as const,
        color: '#10B981'
      };
    }

    // Feedback: adjustments, changes
    if (id.includes('feedback') || id.includes('adjust') || id.includes('decreased')) {
      return {
        type: 'feedback' as const,
        priority: 'medium' as const,
        color: '#8B5CF6'
      };
    }

    // Motivation (default)
    return {
      type: 'motivation' as const,
      priority: 'medium' as const,
      color: '#FF6B35'
    };
  }

  /**
   * Sync notification to unified coach store
   */
  private syncToStore(notification: NotificationConfig): void {
    useUnifiedCoachStore.getState().showNotification({
      id: notification.id,
      message: notification.message,
      mode: 'training',
      autoHideDelay: notification.duration
    });
  }

  /**
   * Clear notification from store
   */
  private clearFromStore(): void {
    useUnifiedCoachStore.getState().hideNotification();
  }

  /**
   * Trigger appropriate haptic feedback
   */
  private triggerHapticFeedback(type: string): void {
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
      case 'tip':
        Haptics.tap();
        break;
      default:
        Haptics.tap();
    }
  }

  /**
   * Persist notification to database (async, non-blocking)
   */
  private async persistNotificationAsync(
    notificationId: string,
    message: string,
    type: string,
    priority: string,
    context?: TrainingNotificationContext
  ): Promise<void> {
    if (!this.userId) {
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
        logger.error('TRAINING_NOTIFICATION_SERVICE', 'Failed to persist notification', {
          error: error.message,
          notificationId
        });
      }
    } catch (err) {
      logger.error('TRAINING_NOTIFICATION_SERVICE', 'Exception persisting notification', {
        error: err instanceof Error ? err.message : 'Unknown error'
      });
    }
  }
}

// Export singleton instance
export const trainingNotificationService = new TrainingNotificationService();
