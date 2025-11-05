import { useEffect, useRef, useMemo } from 'react';
import { supabase } from '../system/supabase/client';
import { useMealPlanGenerationPipeline } from '../system/store/mealPlanGenerationPipeline';
import logger from '../lib/utils/logger';

/**
 * Hook to listen for real-time updates to recipe images
 * This will automatically update the meal plan state when images are generated
 * OPTIMIZED: Prevents unnecessary reconnections when images are added
 */
export const useRecipeImageRealtime = (isActive: boolean, recipeIds: string[]) => {
  const { updateMealImageUrl } = useMealPlanGenerationPipeline();
  const channelRef = useRef<any>(null);
  const isSubscribedRef = useRef(false);

  // Stable reference to recipe IDs - only changes when the SET of IDs changes
  const stableRecipeIds = useMemo(() => {
    return [...new Set(recipeIds)].sort().join(',');
  }, [recipeIds.join(',')]);

  useEffect(() => {
    // Don't resubscribe if already subscribed with the same IDs
    if (!isActive || recipeIds.length === 0) {
      if (channelRef.current && isSubscribedRef.current) {
        logger.info('RECIPE_IMAGE_REALTIME', 'Cleaning up Realtime listener (inactive)', {
          timestamp: new Date().toISOString()
        });
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
        isSubscribedRef.current = false;
      }
      return;
    }

    // If already subscribed, don't resubscribe
    if (isSubscribedRef.current && channelRef.current) {
      logger.debug('RECIPE_IMAGE_REALTIME', 'Already subscribed, skipping reconnection', {
        recipeCount: recipeIds.length,
        timestamp: new Date().toISOString()
      });
      return;
    }

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

    channelRef.current = channel;
    isSubscribedRef.current = true;

    // Cleanup subscription ONLY on unmount or when isActive becomes false
    return () => {
      if (channelRef.current) {
        logger.info('RECIPE_IMAGE_REALTIME', 'Cleaning up Realtime listener (unmount)', {
          timestamp: new Date().toISOString()
        });
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
        isSubscribedRef.current = false;
      }
    };
  }, [isActive, stableRecipeIds]); // Only reconnect when active state or the SET of IDs changes
};
