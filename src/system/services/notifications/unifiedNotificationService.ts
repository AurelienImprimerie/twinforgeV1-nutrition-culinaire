/**
 * Unified Notification Service
 * Système unifié de gestion des notifications du chat
 * Gère hiérarchiquement: Step2 > Notifications contextuelles > Badges de messages non lus
 */

import { useGlobalChatStore } from '../../store/globalChatStore';
import type { ChatMode } from '../../store/globalChatStore';
import logger from '../../../lib/utils/logger';

export type NotificationId =
  | 'step1-welcome'
  | 'step2-adjust'
  | 'training-intro'
  | 'nutrition-intro'
  | 'fasting-intro';

export type NotificationType = 'contextual' | 'unread-badge' | 'step2-alert';

export interface NotificationConfig {
  id: NotificationId;
  type: NotificationType;
  message: string;
  mode: ChatMode;
  priority: number;
  addToHistory: boolean;
  autoHideDelay?: number;
}

interface NotificationState {
  viewCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  cooldownUntil?: string;
}

interface NotificationPersistence {
  [key: string]: NotificationState;
}

const STORAGE_KEY = 'twinforge-unified-notifications';
const MAX_VIEW_COUNT = 3;
const COOLDOWN_MINUTES = 30;

const NOTIFICATION_CONFIGS: Record<NotificationId, Omit<NotificationConfig, 'id'>> = {
  'step1-welcome': {
    type: 'contextual',
    message: 'Salut ! Je suis là si tu as besoin 👋',
    mode: 'general',
    priority: 2,
    addToHistory: false,
    autoHideDelay: 3000
  },
  'step2-adjust': {
    type: 'step2-alert',
    message: 'Ton coach t\'attend pour ajuster ta séance !',
    mode: 'training',
    priority: 10,
    addToHistory: false,
    autoHideDelay: 5000
  },
  'training-intro': {
    type: 'contextual',
    message: 'Prêt pour ta séance ? Clique pour commencer !',
    mode: 'training',
    priority: 3,
    addToHistory: false,
    autoHideDelay: 3000
  },
  'nutrition-intro': {
    type: 'contextual',
    message: 'Un conseil nutrition ? Je suis disponible !',
    mode: 'nutrition',
    priority: 3,
    addToHistory: false,
    autoHideDelay: 3000
  },
  'fasting-intro': {
    type: 'contextual',
    message: 'Ton coach jeûne est là pour t\'accompagner !',
    mode: 'fasting',
    priority: 3,
    addToHistory: false,
    autoHideDelay: 3000
  }
};

const NOTIFICATION_DELAYS = {
  appearance: 2000,
  step2Appearance: 1000
};

class UnifiedNotificationService {
  private persistence: NotificationPersistence = {};
  private activeNotificationId: NotificationId | null = null;
  private scheduledTimeout: NodeJS.Timeout | null = null;
  private hideTimeout: NodeJS.Timeout | null = null;
  private notificationQueue: NotificationId[] = [];

  constructor() {
    this.loadPersistence();
  }

  private loadPersistence(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.persistence = JSON.parse(stored);
      }
    } catch (error) {
      logger.warn('UNIFIED_NOTIFICATION', 'Failed to load persistence', { error });
      this.persistence = {};
    }
  }

  private savePersistence(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.persistence));
    } catch (error) {
      logger.warn('UNIFIED_NOTIFICATION', 'Failed to save persistence', { error });
    }
  }

  private isInCooldown(notificationId: NotificationId): boolean {
    const state = this.persistence[notificationId];
    if (!state?.cooldownUntil) return false;

    const cooldownEnd = new Date(state.cooldownUntil);
    const now = new Date();

    return now < cooldownEnd;
  }

  private hasReachedMaxViews(notificationId: NotificationId): boolean {
    const state = this.persistence[notificationId];
    return (state?.viewCount || 0) >= MAX_VIEW_COUNT;
  }

  private shouldShow(notificationId: NotificationId): boolean {
    const { isOpen } = useGlobalChatStore.getState();

    if (isOpen) {
      logger.debug('UNIFIED_NOTIFICATION', 'Chat is open, skipping notification', { notificationId });
      return false;
    }

    if (this.activeNotificationId === notificationId) {
      logger.debug('UNIFIED_NOTIFICATION', 'Notification already active', { notificationId });
      return false;
    }

    if (this.isInCooldown(notificationId)) {
      logger.debug('UNIFIED_NOTIFICATION', 'Notification in cooldown', { notificationId });
      return false;
    }

    if (this.hasReachedMaxViews(notificationId)) {
      logger.debug('UNIFIED_NOTIFICATION', 'Notification reached max views', {
        notificationId,
        viewCount: this.persistence[notificationId]?.viewCount
      });
      return false;
    }

    return true;
  }

  private markAsViewed(notificationId: NotificationId): void {
    const now = new Date();
    const cooldownEnd = new Date(now.getTime() + COOLDOWN_MINUTES * 60 * 1000);

    if (!this.persistence[notificationId]) {
      this.persistence[notificationId] = {
        viewCount: 1,
        firstSeenAt: now.toISOString(),
        lastSeenAt: now.toISOString(),
        cooldownUntil: cooldownEnd.toISOString()
      };
    } else {
      this.persistence[notificationId].viewCount += 1;
      this.persistence[notificationId].lastSeenAt = now.toISOString();
      this.persistence[notificationId].cooldownUntil = cooldownEnd.toISOString();
    }

    this.savePersistence();

    logger.debug('UNIFIED_NOTIFICATION', 'Notification marked as viewed', {
      notificationId,
      viewCount: this.persistence[notificationId].viewCount,
      cooldownUntil: cooldownEnd.toISOString()
    });
  }

  private clearTimeouts(): void {
    if (this.scheduledTimeout) {
      clearTimeout(this.scheduledTimeout);
      this.scheduledTimeout = null;
    }
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }
  }

  private showNotification(notificationId: NotificationId): void {
    const config = NOTIFICATION_CONFIGS[notificationId];
    if (!config) {
      logger.error('UNIFIED_NOTIFICATION', 'Unknown notification ID', { notificationId });
      return;
    }

    const fullConfig: NotificationConfig = { id: notificationId, ...config };
    const { showNotification, addMessage } = useGlobalChatStore.getState();

    showNotification({
      id: notificationId,
      message: config.message,
      mode: config.mode,
      autoHideDelay: config.autoHideDelay
    });

    this.activeNotificationId = notificationId;

    if (config.addToHistory) {
      addMessage({
        role: 'coach',
        type: 'text',
        content: config.message
      });
    }

    this.markAsViewed(notificationId);

    logger.info('UNIFIED_NOTIFICATION', 'Notification shown', {
      notificationId,
      type: config.type,
      priority: config.priority,
      addedToHistory: config.addToHistory
    });

    if (config.autoHideDelay) {
      this.hideTimeout = setTimeout(() => {
        this.hideNotification(notificationId);
      }, config.autoHideDelay);
    }
  }

  scheduleNotification(notificationId: NotificationId, immediate: boolean = false): void {
    if (!this.shouldShow(notificationId)) {
      return;
    }

    this.clearTimeouts();

    const config = NOTIFICATION_CONFIGS[notificationId];
    const delay = immediate || config.type === 'step2-alert'
      ? NOTIFICATION_DELAYS.step2Appearance
      : NOTIFICATION_DELAYS.appearance;

    this.scheduledTimeout = setTimeout(() => {
      this.showNotification(notificationId);
    }, delay);

    logger.debug('UNIFIED_NOTIFICATION', 'Notification scheduled', {
      notificationId,
      delayMs: delay,
      immediate
    });
  }

  hideNotification(notificationId?: NotificationId): void {
    const { currentNotification, hideNotification } = useGlobalChatStore.getState();

    if (!currentNotification) return;

    if (notificationId && currentNotification.id !== notificationId) {
      logger.debug('UNIFIED_NOTIFICATION', 'Notification ID mismatch, skipping hide', {
        requested: notificationId,
        current: currentNotification.id
      });
      return;
    }

    hideNotification();
    this.activeNotificationId = null;
    this.clearTimeouts();

    logger.debug('UNIFIED_NOTIFICATION', 'Notification hidden', {
      notificationId: currentNotification.id
    });

    this.processQueue();
  }

  private processQueue(): void {
    if (this.notificationQueue.length === 0) return;
    if (this.activeNotificationId !== null) return;

    const nextNotificationId = this.notificationQueue.shift();
    if (nextNotificationId) {
      this.scheduleNotification(nextNotificationId, true);
    }
  }

  queueNotification(notificationId: NotificationId): void {
    if (!this.shouldShow(notificationId)) return;

    if (!this.notificationQueue.includes(notificationId)) {
      this.notificationQueue.push(notificationId);
      this.notificationQueue.sort((a, b) => {
        const priorityA = NOTIFICATION_CONFIGS[a].priority;
        const priorityB = NOTIFICATION_CONFIGS[b].priority;
        return priorityB - priorityA;
      });

      logger.debug('UNIFIED_NOTIFICATION', 'Notification queued', {
        notificationId,
        queueLength: this.notificationQueue.length
      });
    }

    if (this.activeNotificationId === null) {
      this.processQueue();
    }
  }

  cancelScheduled(): void {
    this.clearTimeouts();
    logger.debug('UNIFIED_NOTIFICATION', 'Scheduled notification cancelled');
  }

  clearQueue(): void {
    this.notificationQueue = [];
    this.clearTimeouts();
    logger.debug('UNIFIED_NOTIFICATION', 'Notification queue cleared');
  }

  resetNotification(notificationId?: NotificationId): void {
    if (notificationId) {
      delete this.persistence[notificationId];
    } else {
      this.persistence = {};
    }
    this.savePersistence();

    logger.info('UNIFIED_NOTIFICATION', 'Notification reset', {
      notificationId: notificationId || 'all'
    });
  }

  getNotificationState(notificationId: NotificationId): NotificationState | null {
    return this.persistence[notificationId] || null;
  }

  cleanup(): void {
    this.clearTimeouts();
    this.notificationQueue = [];
    this.activeNotificationId = null;
    logger.debug('UNIFIED_NOTIFICATION', 'Service cleaned up');
  }
}

export const unifiedNotificationService = new UnifiedNotificationService();
