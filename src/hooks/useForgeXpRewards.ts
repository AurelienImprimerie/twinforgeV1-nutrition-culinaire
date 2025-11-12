import { useMarkActionCompleted } from './coeur/useDailyActionsTracking';
import { useToast } from '@/ui/components/ToastProvider';
import { useQueryClient } from '@tanstack/react-query';

/**
 * XP rewards for Forge Culinaire and Forge Nutritionnelle actions
 */
export const FORGE_XP_REWARDS = {
  // Forge Nutritionnelle
  meal_scan: 25,
  barcode_scan: 15,
  daily_recap_viewed: 10,
  trend_analysis_viewed: 10,

  // Forge Culinaire
  fridge_scan: 30,
  recipe_generated: 20,
  meal_plan_generated: 35,
  shopping_list_generated: 15,
} as const;

export type ForgeActionId = keyof typeof FORGE_XP_REWARDS;

/**
 * Hook to award XP for forge actions
 * Automatically tracks actions and awards XP through the gaming system
 */
export function useForgeXpRewards() {
  const { mutateAsync: markCompleted } = useMarkActionCompleted();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  /**
   * Award XP for a forge action
   * @param actionId - The forge action identifier
   * @returns The result of the action completion
   */
  const awardForgeXp = async (actionId: ForgeActionId) => {
    try {
      const xpReward = FORGE_XP_REWARDS[actionId];

      const result = await markCompleted({
        actionId,
        xpEarned: xpReward,
      });

      if (result.was_newly_completed && result.xp_awarded > 0) {
        showToast(
          `🎉 +${result.xp_awarded} XP pour ${getActionLabel(actionId)}!`,
          'success'
        );
      }

      return result;
    } catch (error) {
      console.error('[useForgeXpRewards] Error awarding XP:', error);
      throw error;
    }
  };

  /**
   * Award XP silently (no toast notification)
   */
  const awardForgeXpSilently = async (actionId: ForgeActionId) => {
    try {
      const xpReward = FORGE_XP_REWARDS[actionId];

      const result = await markCompleted({
        actionId,
        xpEarned: xpReward,
      });

      // Force immediate refresh of gaming widget
      await queryClient.invalidateQueries({ queryKey: ['gamification-progress'] });
      await queryClient.invalidateQueries({ queryKey: ['xp-events'] });
      await queryClient.invalidateQueries({ queryKey: ['daily-actions'] });

      return result;
    } catch (error) {
      console.error('[useForgeXpRewards] Error awarding XP silently:', error);
      throw error;
    }
  };

  return {
    awardForgeXp,
    awardForgeXpSilently,
    FORGE_XP_REWARDS,
  };
}

/**
 * Get user-friendly label for action
 */
function getActionLabel(actionId: ForgeActionId): string {
  const labels: Record<ForgeActionId, string> = {
    meal_scan: 'Scan de repas',
    barcode_scan: 'Scan de code-barre',
    daily_recap_viewed: 'Récap quotidien',
    trend_analysis_viewed: 'Analyse de tendances',
    fridge_scan: 'Scan de frigo',
    recipe_generated: 'Recette générée',
    meal_plan_generated: 'Plan de repas',
    shopping_list_generated: 'Liste de courses',
  };

  return labels[actionId] || actionId;
}
