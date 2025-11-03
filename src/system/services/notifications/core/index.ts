/**
 * Core Notification Services
 * Centralized exports for the new unified notification system
 */

export { NotificationLifecycleManager } from './NotificationLifecycleManager';
export type {
  NotificationPriority,
  NotificationType,
  NotificationConfig,
  QueuedNotification
} from './NotificationLifecycleManager';

export { TrainingNotificationService, trainingNotificationService } from './TrainingNotificationService';
export type {
  TrainingNotificationId,
  PipelineStep,
  TrainingNotificationContext
} from './TrainingNotificationService';

export {
  generateNotificationMessage,
  hasCustomMessages,
  getAllNotificationIds
} from './NotificationMessageGenerator';
