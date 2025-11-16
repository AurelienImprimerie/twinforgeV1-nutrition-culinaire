import { useMarkActionCompleted } from './coeur/useDailyActionsTracking';
import { useToast } from '@/ui/components/ToastProvider';
import { useQueryClient } from '@tanstack/react-query';
import { usePointsNotificationStore } from '@/system/store/pointsNotificationStore';
import { ICONS } from '@/ui/icons/registry';

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
 * Get icon for action
 */
function getActionIcon(actionId: ForgeActionId): keyof typeof ICONS {
  const icons: Record<ForgeActionId, keyof typeof ICONS> = {
    meal_scan: 'Utensils',
    barcode_scan: 'ScanLine',
    daily_recap_viewed: 'Calendar',
    trend_analysis_viewed: 'TrendingUp',
    fridge_scan: 'Refrigerator',
    recipe_generated: 'ChefHat',
    meal_plan_generated: 'Calendar',
    shopping_list_generated: 'ShoppingCart',
  };
  return icons[actionId] || 'Star';
}

/**
 * Get color for action
 */
function getActionColor(actionId: ForgeActionId): string {
  const nutritionColor = '#10B981'; // Vert - Forge Nutritionnelle
  const culinaireColor = '#EC4899'; // Rose - Forge Culinaire

  const colors: Record<ForgeActionId, string> = {
    meal_scan: nutritionColor,
    barcode_scan: nutritionColor,
    daily_recap_viewed: nutritionColor,
    trend_analysis_viewed: nutritionColor,
    fridge_scan: culinaireColor,
    recipe_generated: culinaireColor,
    meal_plan_generated: culinaireColor,
    shopping_list_generated: culinaireColor,
  };
  return colors[actionId] || nutritionColor;
}

/**
 * Get category for action
 */
function getActionCategory(actionId: ForgeActionId): 'nutrition' | 'culinaire' {
  const culinaireActions: ForgeActionId[] = ['fridge_scan', 'recipe_generated', 'meal_plan_generated', 'shopping_list_generated'];
  return culinaireActions.includes(actionId) ? 'culinaire' : 'nutrition';
}

/**
 * Hook to award XP for forge actions
 * Automatically tracks actions and awards XP through the gaming system
 */
export function useForgeXpRewards() {
  const { mutateAsync: markCompleted } = useMarkActionCompleted();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const { showNotification } = usePointsNotificationStore();

  /**
   * Award XP for a forge action with visual notification
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
        showNotification({
          type: 'forge-action',
          actionId,
          actionLabel: getActionLabel(actionId),
          pointsAwarded: result.xp_awarded,
          icon: getActionIcon(actionId),
          color: getActionColor(actionId),
          category: getActionCategory(actionId),
        });
      }

      // Force immediate refresh of gaming widget
      await queryClient.invalidateQueries({ queryKey: ['gamification-progress'] });
      await queryClient.invalidateQueries({ queryKey: ['xp-events'] });
      await queryClient.invalidateQueries({ queryKey: ['daily-actions'] });

      return result;
    } catch (error) {
      console.error('[useForgeXpRewards] Error awarding XP:', error);
      throw error;
    }
  };

  /**
   * Award XP silently (no notification)
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
