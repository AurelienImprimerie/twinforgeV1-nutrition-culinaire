import { useEffect } from 'react';
import { supabase } from '../system/supabase/client';
import { useMealPlanGenerationPipeline } from '../system/store/mealPlanGenerationPipeline';
import logger from '../lib/utils/logger';

/**
 * Hook to listen for real-time updates to recipe images
 * This will automatically update the meal plan state when images are generated
 */
export const useRecipeImageRealtime = (isActive: boolean, recipeIds: string[]) => {
  const { updateMealImageUrl } = useMealPlanGenerationPipeline();

  useEffect(() => {
    if (!isActive || recipeIds.length === 0) return;

    logger.info('RECIPE_IMAGE_REALTIME', 'Setting up Realtime listener for recipe images', {
      recipeCount: recipeIds.length,
      timestamp: new Date().toISOString()
    });

    // Subscribe to changes on the recipes table
    const channel = supabase
      .channel('recipe-images-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'recipes',
          filter: `id=in.(${recipeIds.join(',')})` // Only listen to our specific recipes
        },
        (payload) => {
          const updatedRecipe = payload.new as any;

          logger.info('RECIPE_IMAGE_REALTIME', 'Received recipe update', {
            recipeId: updatedRecipe.id,
            hasImageUrl: !!updatedRecipe.image_url,
            imageUrl: updatedRecipe.image_url,
            timestamp: new Date().toISOString()
          });

          // If the recipe has an image URL, update our state
          if (updatedRecipe.image_url) {
            updateMealImageUrl(updatedRecipe.id, updatedRecipe.image_url);

            logger.info('RECIPE_IMAGE_REALTIME', 'Recipe image updated in state', {
              recipeId: updatedRecipe.id,
              imageUrl: updatedRecipe.image_url,
              timestamp: new Date().toISOString()
            });
          }
        }
      )
      .subscribe((status) => {
        logger.debug('RECIPE_IMAGE_REALTIME', 'Subscription status changed', {
          status,
          timestamp: new Date().toISOString()
        });
      });

    // Cleanup subscription on unmount or when dependencies change
    return () => {
      logger.info('RECIPE_IMAGE_REALTIME', 'Cleaning up Realtime listener', {
        timestamp: new Date().toISOString()
      });
      supabase.removeChannel(channel);
    };
  }, [isActive, recipeIds.join(','), updateMealImageUrl]);
};
