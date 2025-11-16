/**
 * Weight Update System Constants
 *
 * Centralized configuration for the weekly weight update system.
 * This system prevents XP farming by restricting weight updates to once every 7 days.
 */

export const WEIGHT_UPDATE_CONSTANTS = {
  /**
   * Minimum days required between weight updates
   */
  MINIMUM_DAYS_BETWEEN_UPDATES: 7,

  /**
   * Minimum days after registration before first weight update is allowed
   */
  MINIMUM_DAYS_AFTER_REGISTRATION: 7,

  /**
   * XP awarded for each weight update
   */
  WEIGHT_UPDATE_XP: 15,

  /**
   * Bonus XP for milestone weight achievements
   */
  WEIGHT_MILESTONE_BONUS_XP: 25,
} as const;

/**
 * Error messages for weight update restrictions
 */
export const WEIGHT_UPDATE_ERROR_MESSAGES = {
  /**
   * Error when user tries to update before 7 days after registration
   */
  FIRST_UPDATE_TOO_EARLY: (daysRemaining: number) =>
    `Première mise à jour disponible dans ${daysRemaining} jour${daysRemaining > 1 ? 's' : ''} (7 jours après inscription)`,

  /**
   * Error when user tries to update before 7 days after last update
   */
  UPDATE_TOO_FREQUENT: (daysRemaining: number) =>
    `Prochaine mise à jour disponible dans ${daysRemaining} jour${daysRemaining > 1 ? 's' : ''} (7 jours entre chaque pesée)`,

  /**
   * Generic error for unauthorized update attempt
   */
  NOT_ELIGIBLE: 'Mise à jour du poids non disponible pour le moment',

  /**
   * Error when user is not authenticated
   */
  NOT_AUTHENTICATED: 'Vous devez être connecté pour mettre à jour votre poids',
} as const;

/**
 * Informational messages for weight update availability
 */
export const WEIGHT_UPDATE_INFO_MESSAGES = {
  /**
   * Message when weight update is available
   */
  AVAILABLE_NOW: 'Mise à jour du poids disponible maintenant !',

  /**
   * Message for first update countdown
   */
  FIRST_UPDATE_COUNTDOWN: (daysRemaining: number) =>
    `Première pesée disponible dans ${daysRemaining} jour${daysRemaining > 1 ? 's' : ''}`,

  /**
   * Message for subsequent update countdown
   */
  NEXT_UPDATE_COUNTDOWN: (daysRemaining: number) =>
    `Prochaine pesée dans ${daysRemaining} jour${daysRemaining > 1 ? 's' : ''}`,

  /**
   * Explanation for 7-day restriction
   */
  WHY_7_DAYS: 'La pesée hebdomadaire permet de suivre une progression stable et évite les fluctuations quotidiennes trompeuses',

  /**
   * Encouragement message when update becomes available
   */
  READY_TO_UPDATE: 'C\'est le moment de mettre à jour ton poids et gagner des points !',

  /**
   * Message after successful update
   */
  UPDATE_SUCCESS: (xpAwarded: number) =>
    `Poids mis à jour ! +${xpAwarded} points gagnés. Prochaine mise à jour dans 7 jours.`,
} as const;

/**
 * Toast messages for weight update system
 */
export const WEIGHT_UPDATE_TOAST_MESSAGES = {
  /**
   * Success toast after weight update
   */
  SUCCESS: {
    title: '✅ Poids mis à jour !',
    getMessage: (xp: number) => `+${xp} points gagnés. Prochaine pesée dans 7 jours.`,
  },

  /**
   * Error toast when trying to update too soon (first time)
   */
  ERROR_FIRST_TOO_EARLY: {
    title: '⏱️ Trop tôt',
    getMessage: (days: number) =>
      `Première pesée disponible dans ${days} jour${days > 1 ? 's' : ''} (après inscription)`,
  },

  /**
   * Error toast when trying to update too soon (subsequent)
   */
  ERROR_TOO_FREQUENT: {
    title: '⏱️ Trop tôt',
    getMessage: (days: number) =>
      `Prochaine pesée dans ${days} jour${days > 1 ? 's' : ''}`,
  },

  /**
   * Info toast when weight update becomes available
   */
  NOW_AVAILABLE: {
    title: '🎯 Mise à jour disponible',
    message: 'Tu peux maintenant mettre à jour ton poids et gagner des points !',
  },
} as const;

/**
 * Badge texts for weight update availability
 */
export const WEIGHT_UPDATE_BADGES = {
  /**
   * Badge text when available
   */
  AVAILABLE: 'Disponible',

  /**
   * Badge text for first update
   */
  FIRST_UPDATE: 'Première mise à jour',

  /**
   * Badge text with countdown
   */
  COUNTDOWN: (days: number) => `Dans ${days}j`,

  /**
   * Badge text when locked
   */
  LOCKED: 'Verrouillé',
} as const;

/**
 * Help section content for weight update system
 */
export const WEIGHT_UPDATE_HELP = {
  title: 'Pourquoi 7 jours entre chaque pesée ?',
  sections: [
    {
      emoji: '📊',
      title: 'Suivi précis',
      description: 'Le poids varie naturellement chaque jour. Une pesée hebdomadaire permet de mesurer la vraie tendance.',
    },
    {
      emoji: '🎯',
      title: 'Objectifs réalistes',
      description: 'Les changements de poids significatifs prennent du temps. 7 jours est l\'intervalle idéal pour suivre ta progression.',
    },
    {
      emoji: '⚖️',
      title: 'Équité gaming',
      description: 'Le délai de 7 jours garantit que tout le monde gagne des points de manière équitable, sans abus.',
    },
  ],
} as const;
