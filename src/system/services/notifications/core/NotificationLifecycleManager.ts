/**
 * Notification Lifecycle Manager
 * Manages the complete lifecycle of notifications: creation, display, queuing, auto-dismiss, and cleanup
 *
 * Features:
 * - Auto-dismiss with configurable timeout
 * - Intelligent queueing system with priority
 * - Pause/resume during transitions
 * - Memory leak prevention
 * - Performance optimized
 */

import logger from '../../../../lib/utils/logger';

export type NotificationPriority = 'low' | 'medium' | 'high' | 'critical';
export type NotificationType = 'motivation' | 'instruction' | 'tip' | 'feedback' | 'warning' | 'success';

export interface NotificationConfig {
  id: string;
  message: string;
  type: NotificationType;
  priority: NotificationPriority;
  duration?: number;
  color?: string;
  context?: Record<string, any>;
}

export interface QueuedNotification extends NotificationConfig {
  delayMs: number;
  timeoutId?: NodeJS.Timeout;
}

export class NotificationLifecycleManager {
  private currentNotification: NotificationConfig | null = null;
  private notificationQueue: QueuedNotification[] = [];
  private isPaused: boolean = false;
  private autoHideTimeout: NodeJS.Timeout | null = null;
  private onShowCallback: ((notification: NotificationConfig) => void) | null = null;
  private onHideCallback: (() => void) | null = null;

  constructor() {
    logger.info('NOTIFICATION_LIFECYCLE', 'NotificationLifecycleManager initialized');
  }

  /**
   * Register callbacks for show/hide events
   */
  setCallbacks(
    onShow: (notification: NotificationConfig) => void,
    onHide: () => void
  ) {
    this.onShowCallback = onShow;
    this.onHideCallback = onHide;
  }

  /**
   * Show a notification immediately
   */
  show(config: NotificationConfig): void {
    if (this.isPaused) {
      logger.debug('NOTIFICATION_LIFECYCLE', 'Notification blocked (paused)', { id: config.id });
      this.queue({
        ...config,
        delayMs: 0
      });
      return;
    }

    // Clear any existing notification
    this.hide();

    // Set as current
    this.currentNotification = config;

    // Trigger callback
    if (this.onShowCallback) {
      this.onShowCallback(config);
    }

    logger.debug('NOTIFICATION_LIFECYCLE', 'Notification shown', {
      id: config.id,
      type: config.type,
      priority: config.priority,
      duration: config.duration || 7000
    });

    // Setup auto-hide
    const duration = config.duration || 7000;
    this.autoHideTimeout = setTimeout(() => {
      this.hide();
      this.processNextInQueue();
    }, duration);
  }

  /**
   * Hide current notification
   */
  hide(): void {
    if (!this.currentNotification) {
      return;
    }

    // Clear auto-hide timeout
    if (this.autoHideTimeout) {
      clearTimeout(this.autoHideTimeout);
      this.autoHideTimeout = null;
    }

    logger.debug('NOTIFICATION_LIFECYCLE', 'Notification hidden', {
      id: this.currentNotification.id
    });

    // Clear current
    this.currentNotification = null;

    // Trigger callback
    if (this.onHideCallback) {
      this.onHideCallback();
    }
  }

  /**
   * Queue a notification with delay
   */
  queue(queuedNotification: QueuedNotification): void {
    // Add to queue
    this.notificationQueue.push(queuedNotification);

    // Sort by priority (critical > high > medium > low)
    this.notificationQueue.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });

    logger.debug('NOTIFICATION_LIFECYCLE', 'Notification queued', {
      id: queuedNotification.id,
      delayMs: queuedNotification.delayMs,
      queueLength: this.notificationQueue.length
    });

    // If not paused and no current notification, process immediately
    if (!this.isPaused && !this.currentNotification) {
      this.processNextInQueue();
    }
  }

  /**
   * Process next notification in queue
   */
  private processNextInQueue(): void {
    if (this.isPaused || this.notificationQueue.length === 0) {
      return;
    }

    const next = this.notificationQueue.shift();
    if (!next) {
      return;
    }

    // Clear any existing timeout
    if (next.timeoutId) {
      clearTimeout(next.timeoutId);
    }

    // Show after delay
    if (next.delayMs > 0) {
      next.timeoutId = setTimeout(() => {
        this.show(next);
      }, next.delayMs);
    } else {
      this.show(next);
    }
  }

  /**
   * Pause notifications (e.g., during transitions)
   */
  pause(): void {
    if (this.isPaused) {
      return;
    }

    this.isPaused = true;

    // Hide current notification
    this.hide();

    logger.info('NOTIFICATION_LIFECYCLE', 'Notifications paused', {
      queueLength: this.notificationQueue.length
    });
  }

  /**
   * Resume notifications
   */
  resume(): void {
    if (!this.isPaused) {
      return;
    }

    this.isPaused = false;

    logger.info('NOTIFICATION_LIFECYCLE', 'Notifications resumed', {
      queueLength: this.notificationQueue.length
    });

    // Process next in queue
    this.processNextInQueue();
  }

  /**
   * Clear all queued notifications
   */
  clearQueue(): void {
    // Clear all timeouts
    this.notificationQueue.forEach(n => {
      if (n.timeoutId) {
        clearTimeout(n.timeoutId);
      }
    });

    const clearedCount = this.notificationQueue.length;
    this.notificationQueue = [];

    logger.info('NOTIFICATION_LIFECYCLE', 'Queue cleared', { clearedCount });
  }

  /**
   * Cleanup all resources
   */
  cleanup(): void {
    this.hide();
    this.clearQueue();
    this.isPaused = false;
    this.onShowCallback = null;
    this.onHideCallback = null;

    logger.info('NOTIFICATION_LIFECYCLE', 'Lifecycle manager cleaned up');
  }

  /**
   * Get current state for debugging
   */
  getState() {
    return {
      currentNotification: this.currentNotification,
      queueLength: this.notificationQueue.length,
      isPaused: this.isPaused,
      hasAutoHideTimeout: this.autoHideTimeout !== null
    };
  }
}
