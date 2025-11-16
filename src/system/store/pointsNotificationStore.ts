import { create } from 'zustand';
import logger from '@/lib/utils/logger';

export interface PointsNotification {
  id: string;
  type: 'forge-action' | 'level-up' | 'milestone';
  actionId: string;
  actionLabel: string;
  pointsAwarded: number;
  icon: string;
  color: string;
  category: 'nutrition' | 'culinaire' | 'training' | 'fasting' | 'general';
  metadata?: {
    oldLevel?: number;
    newLevel?: number;
    milestoneName?: string;
    [key: string]: any;
  };
  timestamp: number;
  duration?: number;
}

interface PointsNotificationState {
  currentNotification: PointsNotification | null;
  queuedNotifications: PointsNotification[];
  isDisplaying: boolean;

  showNotification: (notification: Omit<PointsNotification, 'id' | 'timestamp'>) => void;
  dismissCurrentNotification: () => void;
  clearQueue: () => void;
  processQueue: () => void;
}

export const usePointsNotificationStore = create<PointsNotificationState>((set, get) => ({
  currentNotification: null,
  queuedNotifications: [],
  isDisplaying: false,

  showNotification: (notification) => {
    const fullNotification: PointsNotification = {
      ...notification,
      id: `xp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      duration: notification.duration || (notification.type === 'level-up' || notification.type === 'milestone' ? 5000 : 3500),
    };

    logger.info('POINTS_NOTIFICATION', 'New notification queued', {
      notificationId: fullNotification.id,
      actionId: fullNotification.actionId,
      pointsAwarded: fullNotification.pointsAwarded,
      type: fullNotification.type,
      category: fullNotification.category,
    });

    const state = get();

    if (!state.isDisplaying && !state.currentNotification) {
      set({
        currentNotification: fullNotification,
        isDisplaying: true,
      });

      setTimeout(() => {
        get().dismissCurrentNotification();
      }, fullNotification.duration);
    } else {
      set((state) => ({
        queuedNotifications: [...state.queuedNotifications, fullNotification],
      }));
    }
  },

  dismissCurrentNotification: () => {
    const state = get();

    logger.info('POINTS_NOTIFICATION', 'Dismissing current notification', {
      notificationId: state.currentNotification?.id,
      queuedCount: state.queuedNotifications.length,
    });

    set({
      currentNotification: null,
      isDisplaying: false,
    });

    setTimeout(() => {
      get().processQueue();
    }, 300);
  },

  processQueue: () => {
    const state = get();

    if (state.queuedNotifications.length > 0 && !state.isDisplaying) {
      const [nextNotification, ...remainingQueue] = state.queuedNotifications;

      logger.info('POINTS_NOTIFICATION', 'Processing next notification from queue', {
        notificationId: nextNotification.id,
        remainingInQueue: remainingQueue.length,
      });

      set({
        currentNotification: nextNotification,
        queuedNotifications: remainingQueue,
        isDisplaying: true,
      });

      setTimeout(() => {
        get().dismissCurrentNotification();
      }, nextNotification.duration);
    }
  },

  clearQueue: () => {
    logger.info('POINTS_NOTIFICATION', 'Clearing notification queue');
    set({
      queuedNotifications: [],
    });
  },
}));
