import logger from '../../../../lib/utils/logger';
import { MINIMUM_ITEMS_THRESHOLD } from '../constants';
import { FRIDGE_SCAN_STEPS } from '../constants';
import type { FridgeScanPipelineState } from '../types';

export const createSessionActions = (
  set: (partial: Partial<FridgeScanPipelineState>) => void,
  get: () => FridgeScanPipelineState
) => ({
  // Action to save session to Supabase
  saveSessionToSupabase: async () => {
    const state = get();

    if (!state.currentSessionId) {
      logger.warn('FRIDGE_SCAN_PIPELINE', 'Cannot save session: no session ID');
      return;
    }

    // Validate that the current step is a valid database stage
    const validStages = ['photo', 'analyze', 'complement', 'validation', 'generating_recipes', 'recipes'];
    if (!validStages.includes(state.currentStep)) {
      logger.warn('FRIDGE_SCAN_PIPELINE', 'Invalid stage value detected, skipping save', {
        currentStep: state.currentStep,
        validStages,
        sessionId: state.currentSessionId
      });
      return;
    }

    try {
      const { useUserStore } = await import('../../userStore');
      const userId = useUserStore.getState().session?.user?.id;

      if (!userId) {
        logger.warn('FRIDGE_SCAN_PIPELINE', 'Cannot save session: no user ID');
        return;
      }

      const { supabase } = await import('../../../supabase/client');

      const sessionData = {
        session_id: state.currentSessionId,
        user_id: userId,
        stage: state.currentStep,
        captured_photos: state.capturedPhotos,
        raw_detected_items: state.rawDetectedItems,
        user_edited_inventory: state.userEditedInventory,
        suggested_complementary_items: state.suggestedComplementaryItems,
        recipe_candidates: state.recipeCandidates,
        selected_recipes: state.selectedRecipes,
        meal_plan: state.mealPlan,
        metadata: {
          simulatedOverallProgress: state.simulatedOverallProgress,
          loadingState: state.loadingState
        },
        completed: state.simulatedOverallProgress >= 100,
        updated_at: new Date().toISOString()
      };

      logger.debug('FRIDGE_SCAN_PIPELINE', 'Attempting to save session', {
        sessionId: state.currentSessionId,
        stage: state.currentStep,
        itemsCount: state.userEditedInventory.length
      });

      const { error } = await supabase
        .from('fridge_scan_sessions')
        .upsert(sessionData, {
          onConflict: 'session_id'
        });

      if (error) {
        // Si la table n'existe pas, on ignore silencieusement
        if (error.code === 'PGRST205' || error.message?.includes('does not exist')) {
          logger.debug('FRIDGE_SCAN_PIPELINE', 'fridge_scan_sessions table not found, skipping save');
          return;
        }

        // Log detailed error information for constraint violations
        if (error.code === '23514' || error.message?.includes('constraint')) {
          logger.error('FRIDGE_SCAN_PIPELINE', 'Database constraint violation', {
            error: error.message,
            code: error.code,
            currentStep: state.currentStep,
            sessionId: state.currentSessionId,
            validStages
          });
        }

        throw error;
      }

      logger.debug('FRIDGE_SCAN_PIPELINE', 'Session saved to Supabase successfully', {
        sessionId: state.currentSessionId,
        stage: state.currentStep,
        itemsCount: state.userEditedInventory.length
      });
    } catch (error) {
      logger.warn('FRIDGE_SCAN_PIPELINE', 'Failed to save session to Supabase', {
        error: error instanceof Error ? error.message : 'Unknown error',
        sessionId: state.currentSessionId,
        currentStep: state.currentStep
      });
    }
  },
  startScan: async () => {
    const sessionId = crypto.randomUUID();

    // CRITICAL: Force complete pipeline reset before starting new scan
    logger.info('FRIDGE_SCAN_PIPELINE', 'Force resetting pipeline before new scan', {
      previousStep: get().currentStep,
      previousSessionId: get().currentSessionId,
      wasActive: get().isActive,
      timestamp: new Date().toISOString()
    });

    const photoStep = FRIDGE_SCAN_STEPS.find(step => step.id === 'photo');

    set({
      currentStep: 'photo',
      isActive: true,
      currentSessionId: sessionId,
      simulatedOverallProgress: photoStep?.startProgress || 0,
      capturedPhotos: [],
      rawDetectedItems: [],
      userEditedInventory: [],
      recipeCandidates: [],
      selectedRecipes: [],
      loadingState: 'idle',
      loadingMessage: '',
    });

    logger.info('FRIDGE_SCAN_PIPELINE', 'Fridge scan session started', {
      sessionId,
      resetComplete: true,
      timestamp: new Date().toISOString()
    });

    // Save initial session to Supabase
    await get().saveSessionToSupabase();
  },

  saveRecipeSession: async () => {
    const state = get();
    
    set({
      loadingState: 'saving',
      loadingMessage: 'Sauvegarde de votre atelier de recettes...'
    });

    try {
      logger.info('FRIDGE_SCAN_PIPELINE', 'Saving recipe session', {
        sessionId: state.currentSessionId,
        selectedRecipesCount: state.selectedRecipes.length,
        inventoryCount: state.userEditedInventory.length,
        timestamp: new Date().toISOString()
      });

      // Get user profile for preferences snapshot
      const { useUserStore } = await import('../../userStore');
      const userProfile = useUserStore.getState().profile;
      const userId = useUserStore.getState().session?.user?.id;
      
      if (!userId || !state.currentSessionId) {
        throw new Error('User ID or session ID missing');
      }
      
      // Import Supabase client
      const { supabase } = await import('../../../supabase/client');
      
      // Create preferences snapshot
      const preferencesSnapshot = {
        nutrition: userProfile?.nutrition || {},
        householdDetails: userProfile?.householdDetails || {},
        mealPrepPreferences: userProfile?.mealPrepPreferences || {},
        kitchenEquipment: userProfile?.kitchenEquipment || {},
        foodPreferences: userProfile?.foodPreferences || {},
        sensoryPreferences: userProfile?.sensoryPreferences || {},
        macroTargets: userProfile?.macroTargets || {},
        shoppingPreferences: userProfile?.shoppingPreferences || {}
      };
      
      // Save recipe session to database
      const { data: sessionData, error: sessionError } = await supabase
        .from('recipe_sessions')
        .upsert({
          id: state.currentSessionId,
          user_id: userId,
          inventory_final: state.userEditedInventory,
          selected_recipe_ids: state.selectedRecipes.map(r => r.id),
          preferences_snapshot: preferencesSnapshot,
          filters_snapshot: {}, // No specific filters for now
          status: 'completed',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
        
      if (sessionError) {
        throw new Error(`Failed to save session: ${sessionError.message}`);
      }
      
      // Save individual recipes to database
      if (state.selectedRecipes.length > 0) {
        const recipesToSave = state.selectedRecipes.map(recipe => ({
          id: recipe.id,
          session_id: state.currentSessionId,
          title: recipe.title,
          description: recipe.description,
          ingredients: recipe.ingredients,
          instructions: recipe.instructions,
          prep_time_min: recipe.prepTimeMin,
          cook_time_min: recipe.cookTimeMin,
          servings: recipe.servings,
          dietary_tags: recipe.dietaryTags,
          nutritional_info: recipe.nutritionalInfo,
          ...(recipe.imageUrl && { image_url: recipe.imageUrl }),
          image_signature: recipe.imageSignature,
          reasons: recipe.reasons,
          created_at: recipe.createdAt,
          updated_at: recipe.updatedAt
        }));
        
        const { error: recipesError } = await supabase
          .from('recipes')
          .upsert(recipesToSave);
          
        if (recipesError) {
          logger.warn('FRIDGE_SCAN_PIPELINE', 'Failed to save some recipes', {
            error: recipesError.message,
            sessionId: state.currentSessionId,
            recipesCount: recipesToSave.length
          });
        }
      }

      logger.info('FRIDGE_SCAN_PIPELINE', 'Recipe session saved successfully', {
        sessionId: state.currentSessionId,
        savedRecipesCount: state.selectedRecipes.length,
        timestamp: new Date().toISOString()
      });

      // Award XP for fridge scan using GamificationService
      // This ensures proper integration with the gaming system
      (async () => {
        try {
          const { useUserStore } = await import('../../userStore');
          const userId = useUserStore.getState().session?.user?.id;

          if (!userId) {
            logger.warn('FRIDGE_SCAN_PIPELINE', 'Cannot award XP: user not authenticated', {
              sessionId: state.currentSessionId
            });
            return;
          }

          const { gamificationService } = await import('../../../../services/dashboard/coeur');
          const xpResult = await gamificationService.awardFridgeScanXp(userId, {
            session_id: state.currentSessionId,
            items_detected: state.userEditedInventory.length,
            photo_count: state.capturedPhotos.length,
            timestamp: new Date().toISOString(),
            source: 'fridge_scan_pipeline'
          });

          logger.info('FRIDGE_SCAN_PIPELINE', 'XP awarded successfully via GamificationService', {
            sessionId: state.currentSessionId,
            xpAwarded: xpResult.xpAwarded,
            baseXp: xpResult.baseXp,
            multiplier: xpResult.multiplier,
            leveledUp: xpResult.leveledUp,
            newLevel: xpResult.newLevel,
            timestamp: new Date().toISOString()
          });

          // Force immediate refresh of gaming widget with aggressive invalidation
          const { queryClient } = await import('../../../../app/providers/AppProviders');

          // Invalidate first to force cache clear
          await queryClient.invalidateQueries({ queryKey: ['gamification-progress'], refetchType: 'all' });
          await queryClient.invalidateQueries({ queryKey: ['xp-events'], refetchType: 'all' });
          await queryClient.invalidateQueries({ queryKey: ['daily-actions'], refetchType: 'all' });

          // Then refetch all queries (including inactive ones)
          await queryClient.refetchQueries({ queryKey: ['gamification-progress'], type: 'all' });
          await queryClient.refetchQueries({ queryKey: ['xp-events'], type: 'all' });
          await queryClient.refetchQueries({ queryKey: ['daily-actions'], type: 'all' });

          logger.info('FRIDGE_SCAN_PIPELINE', 'Gaming widget queries invalidated and refetched', {
            sessionId: state.currentSessionId,
            xpAwarded: xpResult.xpAwarded,
            timestamp: new Date().toISOString()
          });
        } catch (error) {
          logger.warn('FRIDGE_SCAN_PIPELINE', 'Failed to award XP for fridge scan', {
            error: error instanceof Error ? error.message : 'Unknown error',
            sessionId: state.currentSessionId,
            timestamp: new Date().toISOString()
          });
          // Don't throw - XP attribution failure should not block user workflow
        }
      })();

      // Update meal plan store with new inventory
      try {
        const { useMealPlanStore } = await import('../../mealPlanStore');
        await useMealPlanStore.getState().loadAvailableInventories();
        useMealPlanStore.getState().selectInventory(state.currentSessionId!);

        logger.info('FRIDGE_SCAN_PIPELINE', 'Meal plan store updated with new inventory', {
          sessionId: state.currentSessionId,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.warn('FRIDGE_SCAN_PIPELINE', 'Failed to update meal plan store', {
          error: error instanceof Error ? error.message : 'Unknown error',
          sessionId: state.currentSessionId,
          timestamp: new Date().toISOString()
        });
      }

      // Invalidate React Query cache to update Scanner tab and Recipes tab
      try {
        const { queryClient } = await import('../../../../app/providers/AppProviders');

        // Invalidate all fridge-scan-sessions queries to force refresh Scanner tab
        await queryClient.invalidateQueries({
          queryKey: ['fridge-scan-sessions'],
          refetchType: 'all'
        });

        // Invalidate recipes queries to force refresh Recipes tab
        await queryClient.invalidateQueries({
          queryKey: ['persisted-recipes'],
          refetchType: 'all'
        });

        logger.info('FRIDGE_SCAN_PIPELINE', 'React Query cache invalidated for all tabs', {
          sessionId: state.currentSessionId,
          queriesInvalidated: ['fridge-scan-sessions', 'persisted-recipes'],
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.warn('FRIDGE_SCAN_PIPELINE', 'Failed to invalidate React Query cache', {
          error: error instanceof Error ? error.message : 'Unknown error',
          sessionId: state.currentSessionId,
          timestamp: new Date().toISOString()
        });
      }

      // Dispatch custom event to notify RecipesTab to refetch
      window.dispatchEvent(new CustomEvent('recipes-updated', {
        detail: { sessionId: state.currentSessionId }
      }));

      // Mark session as completed - this will prevent re-hydration on next mount
      set({
        loadingState: 'idle',
        loadingMessage: 'Session sauvegardée avec succès',
        simulatedOverallProgress: 100,
        isActive: false  // Deactivate pipeline after successful save
      });

      logger.info('FRIDGE_SCAN_PIPELINE', 'Pipeline deactivated after successful save', {
        sessionId: state.currentSessionId,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('FRIDGE_SCAN_PIPELINE', 'Recipe session save failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        sessionId: state.currentSessionId,
        timestamp: new Date().toISOString()
      });
      
      set({
        loadingState: 'idle',
        loadingMessage: 'Erreur lors de la sauvegarde'
      });
      
      throw error;
    } finally {
      get().stopProgressSimulation();
    }
    
    return state.currentSessionId!;
  },


  resetPipeline: () => {
    const currentState = get();
    
    // Stop any active progress simulation
    currentState.stopProgressSimulation();
    
    logger.info('FRIDGE_SCAN_PIPELINE', 'Resetting pipeline completely', {
      previousStep: currentState.currentStep,
      previousSessionId: currentState.currentSessionId,
      wasActive: currentState.isActive,
      hadCapturedPhotos: currentState.capturedPhotos.length,
      hadInventory: currentState.userEditedInventory.length,
      loadingState: currentState.loadingState,
      timestamp: new Date().toISOString()
    });
    
    set({
      currentStep: 'photo',
      isActive: false,
      currentSessionId: null,
      simulatedLoadingStep: 0,
      simulatedScanProgress: 0,
      simulatedOverallProgress: 0,
      progressIntervalId: null,
      progressTimeoutId: null,
      capturedPhotos: [],
      rawDetectedItems: [],
      userEditedInventory: [],
      loadingState: 'idle',
      loadingMessage: '',
    });

    logger.info('FRIDGE_SCAN_PIPELINE', 'Pipeline reset', {
      resetComplete: true,
      newStep: 'photo',
      newSessionId: null,
      allDataCleared: true,
      timestamp: new Date().toISOString()
    });
  },

  resumePipeline: async () => {
    const state = get();
    
    logger.info('FRIDGE_SCAN_PIPELINE', 'Resuming pipeline from persisted state', {
      currentSessionId: state.currentSessionId,
      currentStep: state.currentStep,
      isActive: state.isActive,
      hasInventory: state.userEditedInventory.length > 0,
      timestamp: new Date().toISOString()
    });

    // Determine the correct step based on available data
    let correctStep = 'photo' as const;
    
    if (state.userEditedInventory.length > 0) {
      correctStep = 'validation';
    } else if (state.suggestedComplementaryItems.length > 0 && state.rawDetectedItems.length < MINIMUM_ITEMS_THRESHOLD) {
      correctStep = 'complement';
    } else if (state.rawDetectedItems.length > 0) {
      correctStep = 'validation';
    } else if (state.capturedPhotos.length > 0) {
      correctStep = 'analyze';
    }

    const targetStepData = FRIDGE_SCAN_STEPS.find(step => step.id === correctStep);
    
    set({
      isActive: true,
      currentStep: correctStep,
      simulatedOverallProgress: targetStepData?.startProgress || 0,
      loadingState: 'idle',
      loadingMessage: ''
    });

    // Update meal plan store if we have a valid session and inventory
    if (state.currentSessionId && state.userEditedInventory.length > 0) {
      try {
        const { useMealPlanStore } = await import('../../mealPlanStore');
        await useMealPlanStore.getState().loadAvailableInventories();
        useMealPlanStore.getState().selectInventory(state.currentSessionId);
        
        logger.info('FRIDGE_SCAN_PIPELINE', 'Meal plan store updated on resume', {
          sessionId: state.currentSessionId,
          inventoryCount: state.userEditedInventory.length,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.warn('FRIDGE_SCAN_PIPELINE', 'Failed to update meal plan store on resume', {
          error: error instanceof Error ? error.message : 'Unknown error',
          sessionId: state.currentSessionId,
          timestamp: new Date().toISOString()
        });
      }
    }

    logger.info('FRIDGE_SCAN_PIPELINE', 'Pipeline resumed successfully', {
      sessionId: state.currentSessionId,
      resumedToStep: correctStep,
      progress: targetStepData?.startProgress || 0,
      timestamp: new Date().toISOString()
    });
  },

  // New action to start recipe generation from existing inventory
  startRecipeGenerationFromInventory: async (inventory: any[]) => {
    try {
      logger.info('FRIDGE_SCAN_PIPELINE', 'Starting recipe generation from inventory', {
        inventoryCount: inventory?.length || 0,
        timestamp: new Date().toISOString()
      });

      // Generate a new session ID
      const newSessionId = crypto.randomUUID();

      // Set the pipeline state
      set({
        currentSessionId: newSessionId,
        isActive: true,
        currentStep: 'validation',
        userEditedInventory: inventory,
        rawDetectedItems: inventory, // Also set as raw items for consistency
        simulatedOverallProgress: 66, // Start at validation step progress
        loadingState: 'idle',
        loadingMessage: ''
      });

      logger.info('FRIDGE_SCAN_PIPELINE', 'Recipe generation from inventory started successfully', {
        sessionId: newSessionId,
        inventoryCount: inventory?.length || 0,
        currentStep: 'validation',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('FRIDGE_SCAN_PIPELINE', 'Failed to start recipe generation from inventory', {
        error: error instanceof Error ? error.message : 'Unknown error',
        inventoryCount: inventory?.length || 0,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  },
});