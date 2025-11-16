/**
 * useFirstTimeBonus - Sprint 3
 *
 * Hook pour gérer les bonus First Time (double XP sur première action).
 * Affiche badge et animation spéciale quand applicable.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/system/supabase/client';
import logger from '@/lib/utils/logger';

export type FirstTimeBonusType =
  | 'meal_scan'
  | 'activity'
  | 'training'
  | 'body_scan'
  | 'fasting'
  | 'calorie_goal';

interface FirstTimeBonusStatus {
  first_meal_scan_bonus_claimed: boolean;
  first_activity_bonus_claimed: boolean;
  first_training_bonus_claimed: boolean;
  first_body_scan_bonus_claimed: boolean;
  first_fasting_bonus_claimed: boolean;
  first_calorie_goal_bonus_claimed: boolean;
  first_time_bonuses_count: number;
}

interface FirstTimeBonusResult {
  bonus_applicable: boolean;
  bonus_type?: 'first_time';
  action_type?: string;
  base_xp?: number;
  bonus_xp?: number;
  total_xp?: number;
  message?: string;
  reason?: string;
}

/**
 * Hook pour récupérer le statut des bonus First Time
 */
export function useFirstTimeBonusStatus(userId: string | null) {
  return useQuery({
    queryKey: ['firstTimeBonusStatus', userId],
    queryFn: async (): Promise<FirstTimeBonusStatus | null> => {
      if (!userId) return null;

      try {
        const { data, error } = await supabase
          .from('user_gamification_progress')
          .select(
            `
            first_meal_scan_bonus_claimed,
            first_activity_bonus_claimed,
            first_training_bonus_claimed,
            first_body_scan_bonus_claimed,
            first_fasting_bonus_claimed,
            first_calorie_goal_bonus_claimed,
            first_time_bonuses_count
          `
          )
          .eq('user_id', userId)
          .maybeSingle();

        if (error) {
          logger.error('FIRST_TIME_BONUS', 'Error fetching status', { userId, error });
          return null;
        }

        return data;
      } catch (error) {
        logger.error('FIRST_TIME_BONUS', 'Exception fetching status', { userId, error });
        return null;
      }
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });
}

/**
 * Fonction pour réclamer un bonus First Time
 */
export async function claimFirstTimeBonus(
  userId: string,
  actionType: FirstTimeBonusType,
  baseXp: number
): Promise<FirstTimeBonusResult> {
  try {
    const { data, error } = await supabase.rpc('claim_first_time_bonus', {
      p_user_id: userId,
      p_action_type: actionType,
      p_base_xp: baseXp,
    });

    if (error) {
      logger.error('FIRST_TIME_BONUS', 'Error claiming bonus', { userId, actionType, error });
      return {
        bonus_applicable: false,
        reason: 'rpc_error',
      };
    }

    logger.info('FIRST_TIME_BONUS', 'Bonus result', { userId, actionType, result: data });

    return data as FirstTimeBonusResult;
  } catch (error) {
    logger.error('FIRST_TIME_BONUS', 'Exception claiming bonus', { userId, actionType, error });
    return {
      bonus_applicable: false,
      reason: 'exception',
    };
  }
}

/**
 * Hook pour vérifier si un bonus est disponible
 */
export function useIsFirstTimeBonusAvailable(
  userId: string | null,
  actionType: FirstTimeBonusType
): boolean {
  const { data: status } = useFirstTimeBonusStatus(userId);

  if (!status) return false;

  const bonusKey = `first_${actionType}_bonus_claimed` as keyof FirstTimeBonusStatus;
  return status[bonusKey] === false;
}

/**
 * Mapping des types d'actions vers les messages de notification
 */
export const FIRST_TIME_BONUS_MESSAGES: Record<FirstTimeBonusType, string> = {
  meal_scan: 'Premier repas scanné! 🌟 Double XP!',
  activity: 'Première activité logguée! 🌟 Double XP!',
  training: 'Première séance d\'entraînement! 🌟 Double XP!',
  body_scan: 'Premier body scan! 🌟 Double XP!',
  fasting: 'Premier jeûne complété! 🌟 Double XP!',
  calorie_goal: 'Premier objectif calorique atteint! 🌟 Double XP!',
};

/**
 * Mapping des types d'actions vers les emojis
 */
export const FIRST_TIME_BONUS_EMOJIS: Record<FirstTimeBonusType, string> = {
  meal_scan: '🍽️',
  activity: '🏃',
  training: '💪',
  body_scan: '📸',
  fasting: '⏰',
  calorie_goal: '🎯',
};
