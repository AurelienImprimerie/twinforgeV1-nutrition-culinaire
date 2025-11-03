/**
 * Notification Services Index
 * Centralized exports for all notification services
 *
 * MIGRATION NOTE:
 * - The adapters maintain backward compatibility with the old API
 * - All exports now use the new unified notification system under the hood
 * - Existing code continues to work without modifications
 */

// Core services (new unified system)
export { trainingNotificationService } from './core/TrainingNotificationService';
export { generateNotificationMessage } from './core/NotificationMessageGenerator';

// Adapters for backward compatibility (recommended exports)
export { step1NotificationService } from './adapters/Step1NotificationAdapter';
export { step2NotificationService } from './adapters/Step2NotificationAdapter';
export { step4NotificationService } from './adapters/Step4NotificationAdapter';
export { step5NotificationService } from './adapters/Step5NotificationAdapter';
export { enduranceCoachNotificationService } from './adapters/EnduranceNotificationAdapter';

// Legacy services (deprecated - will be removed in future version)
// These are still here for reference but should not be used
// export { step1NotificationService as step1NotificationServiceLegacy } from './step1NotificationService';
// export { step2NotificationService as step2NotificationServiceLegacy } from './step2NotificationService';
// export { step4NotificationService as step4NotificationServiceLegacy } from './step4NotificationService';
// export { step5NotificationService as step5NotificationServiceLegacy } from './step5NotificationService';
// export { enduranceCoachNotificationService as enduranceCoachNotificationServiceLegacy } from './enduranceCoachNotificationService';

// Re-export the remaining service that doesn't have an adapter yet
export { trainingCoachNotificationService } from './trainingCoachNotificationService';
