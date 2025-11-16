import logger from '../../../../lib/utils/logger';
import { FRIDGE_SCAN_STEPS } from '../constants';
import type { FridgeScanPipelineState } from '../types';
import type { Recipe } from '../../../../domain/recipe';

export const createRecipeGenerationActions = (
  set: (partial: Partial<FridgeScanPipelineState>) => void,
  get: () => FridgeScanPipelineState
) => ({
  _triggerImageGenerationForRecipes: async (recipes: Recipe[], sessionId: string) => {
    if (!recipes.length) return;

    // Mark recipes as generating images immediately
    const currentCandidates = get().recipeCandidates;
    const updatedCandidates = currentCandidates.map(candidate => {
      const matchingRecipe = recipes.find(r => r.id === candidate.id);
      if (matchingRecipe) {
        return { ...candidate, isGeneratingImage: true };
      }
      return candidate;
    });
    set({ recipeCandidates: updatedCandidates });

    // Get authenticated session for proper authorization
    const { supabase } = await import('../../../supabase/client');
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.access_token) {
      logger.error('FRIDGE_SCAN_PIPELINE', 'No authenticated session for image generation', {
        sessionId,
        timestamp: new Date().toISOString()
      });
      return;
    }
    logger.info('FRIDGE_SCAN_PIPELINE', 'Starting background image generation for recipes', {
      sessionId,
      recipeCount: recipes.length,
      recipeIds: recipes.map(r => r.id),
      timestamp: new Date().toISOString()
    });

    // Process each recipe for image generation
    for (const recipe of recipes) {
      try {
        // Generate unique image signature
        const imageSignature = `recipe-${recipe.id}-${Date.now()}`;
        
        // Prepare payload for image generation
        const imagePayload = {
          user_id: session.user.id,
          recipe_id: recipe.id,
          image_signature: imageSignature,
          recipe_details: {
            session_id: sessionId,
            title: recipe.title,
            description: recipe.description || '',
            ingredients: recipe.ingredients.slice(0, 5).map(ing => ing.name),
            dietary_tags: recipe.dietary_tags
          }
        };

        // Call image-generator Edge Function
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/image-generator`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(imagePayload)
        });

        if (response.ok) {
          const result = await response.json();
          
          logger.info('FRIDGE_SCAN_PIPELINE', 'Image generation initiated successfully', {
            sessionId,
            recipeId: recipe.id,
            imageSignature,
            imageUrl: result.image_url,
            timestamp: new Date().toISOString()
          });

          // Update recipe with image URL and remove generating flag
          get().updateRecipeImageUrlInCandidates(recipe.id, result.image_url, false);
        } else {
          const errorText = await response.text();
          throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        }
      } catch (error) {
        logger.error('FRIDGE_SCAN_PIPELINE', 'Image generation failed for recipe', {
          sessionId,
          recipeId: recipe.id,
          recipeTitle: recipe.title,
          error: error instanceof Error ? error.message : 'Unknown error',
          errorDetails: error instanceof Error && error.message.includes('HTTP error!') ? error.message : undefined,
          timestamp: new Date().toISOString()
        });

        // Mark recipe as having image generation error
        get().updateRecipeImageUrlInCandidates(recipe.id, undefined, false, true);
      }
    }
  },

  updateRecipeImageUrlInCandidates: (recipeId: string, imageUrl?: string, isGeneratingImage: boolean = false, hasError: boolean = false) => {
    const currentCandidates = get().recipeCandidates;
    const updatedCandidates = currentCandidates.map(recipe => {
      if (recipe.id === recipeId) {
        return {
          ...recipe,
          imageUrl,
          isGeneratingImage,
          imageGenerationError: hasError
        };
      }
      return recipe;
    });
    set({ recipeCandidates: updatedCandidates });
  },

  generateRecipes: async () => {
    const state = get();
    
    // Log initial state for debugging
    logger.info('FRIDGE_SCAN_PIPELINE', 'Starting generateRecipes - Initial state', {
      sessionId: state.currentSessionId,
      userEditedInventoryCount: state.userEditedInventory?.length || 0,
      userEditedInventory: state.userEditedInventory,
      timestamp: new Date().toISOString()
    });
    
    // Check if we have inventory, if not try to get from meal plan store
    let inventoryToUse = state.userEditedInventory;
    
    if (!inventoryToUse || inventoryToUse.length === 0) {
      logger.info('FRIDGE_SCAN_PIPELINE', 'No userEditedInventory found, attempting to get from meal plan store', {
        sessionId: state.currentSessionId,
        timestamp: new Date().toISOString()
      });
      
      try {
        const { useMealPlanStore } = await import('../../mealPlanStore');
        const mealPlanState = useMealPlanStore.getState();
        
        // Log meal plan store state
        logger.info('FRIDGE_SCAN_PIPELINE', 'Meal plan store state retrieved', {
          sessionId: state.currentSessionId,
          selectedInventoryId: mealPlanState.selectedInventoryId,
          availableInventoriesCount: mealPlanState.availableInventories?.length || 0,
          availableInventories: mealPlanState.availableInventories?.map(inv => ({
            id: inv.id,
            itemCount: inv.inventory_final?.length || 0,
            createdAt: inv.createdAt
          })),
          timestamp: new Date().toISOString()
        });
        
        // Find the selected inventory by filtering availableInventories with selectedInventoryId
        const selectedInventory = mealPlanState.selectedInventoryId && mealPlanState.availableInventories
          ? mealPlanState.availableInventories.find(inv => inv.id === mealPlanState.selectedInventoryId)
          : null;
        
        if (selectedInventory && selectedInventory.inventory_final && selectedInventory.inventory_final.length > 0) {
          inventoryToUse = selectedInventory.inventory_final;
          
          // Update the fridge scan store with this inventory for consistency
          set({ userEditedInventory: inventoryToUse });
          
          logger.info('FRIDGE_SCAN_PIPELINE', 'Using inventory from meal plan store', {
            sessionId: state.currentSessionId,
            selectedInventoryId: mealPlanState.selectedInventoryId,
            inventoryCount: inventoryToUse.length,
            inventoryItems: inventoryToUse.map(item => ({
              name: item.name,
              category: item.category,
              quantity: item.quantity
            })),
            timestamp: new Date().toISOString()
          });
        } else {
          logger.warn('FRIDGE_SCAN_PIPELINE', 'Meal plan store has no selected inventory', {
            sessionId: state.currentSessionId,
            selectedInventoryId: mealPlanState.selectedInventoryId,
            availableInventoriesCount: mealPlanState.availableInventories?.length || 0,
            foundSelectedInventory: !!selectedInventory,
            selectedInventoryLength: selectedInventory?.inventory_final?.length || 0,
            timestamp: new Date().toISOString()
          });
        }
      } catch (error) {
        logger.warn('FRIDGE_SCAN_PIPELINE', 'Failed to get inventory from meal plan store', {
          sessionId: state.currentSessionId,
          error: error instanceof Error ? error.message : 'Unknown error',
          errorStack: error instanceof Error ? error.stack : undefined,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    // Log final inventory state before validation
    logger.info('FRIDGE_SCAN_PIPELINE', 'Final inventory state before validation', {
      sessionId: state.currentSessionId,
      inventoryToUseExists: !!inventoryToUse,
      inventoryToUseCount: inventoryToUse?.length || 0,
      inventoryToUse: inventoryToUse?.map(item => ({
        name: item.name,
        category: item.category,
        quantity: item.quantity,
        freshnessScore: item.freshnessScore
      })),
      timestamp: new Date().toISOString()
    });
    
    // Final validation - ensure we have inventory
    if (!inventoryToUse || inventoryToUse.length === 0) {
      const errorMessage = 'Aucun ingrédient disponible pour générer des recettes. Veuillez d\'abord scanner votre frigo ou sélectionner un inventaire.';
      
      logger.error('FRIDGE_SCAN_PIPELINE', 'No inventory available for recipe generation', {
        sessionId: state.currentSessionId,
        userEditedInventoryCount: state.userEditedInventory.length,
        finalInventoryToUseCount: inventoryToUse?.length || 0,
        timestamp: new Date().toISOString()
      });
      
      set({
        loadingState: 'idle',
        loadingMessage: '',
        recipeCandidates: []
      });
      
      throw new Error(errorMessage);
    }
    
    const generatingStep = FRIDGE_SCAN_STEPS.find(step => step.id === 'generating_recipes');
    
    set({
      currentStep: 'generating_recipes',
      loadingState: 'generating',
      loadingMessage: 'La Forge Spatiale crée vos recettes personnalisées...',
      simulatedOverallProgress: generatingStep?.startProgress || 60
    });

    try {
      logger.info('FRIDGE_SCAN_PIPELINE', 'Starting streaming recipe generation', {
        sessionId: state.currentSessionId,
        inventoryCount: inventoryToUse.length,
        aiModel: 'gpt-5-mini',
        streamingEnabled: true,
        timestamp: new Date().toISOString()
      });

      // Transition to recipes step
      const recipesStep = FRIDGE_SCAN_STEPS.find(step => step.id === 'recipes');
      set({
        recipeCandidates: [],
        currentStep: 'recipes',
        loadingState: 'streaming',
        loadingMessage: 'Génération des recettes en cours...',
        simulatedOverallProgress: recipesStep?.startProgress || 80,
        simulatedScanProgress: 0,
        simulatedLoadingStep: 0
      });

      // Stop progress simulation since we're now streaming
      get().stopProgressSimulation();

      // Get user preferences for recipe generation
      const { useUserStore } = await import('../../userStore');
      const userProfile = useUserStore.getState().profile;
      const userId = useUserStore.getState().session?.user?.id;
      
      // Validate user ID before proceeding
      if (!userId) {
        throw new Error('User must be authenticated to generate recipes');
      }
      
      // Get existing recipes to avoid repetition
      const { supabase } = await import('../../../supabase/client');
      
      let existingRecipes: any[] = [];
      try {
        const { data: recipeSessions } = await supabase
          .from('recipe_sessions')
          .select(`
            recipes (
              title,
              ingredients
            )
          `)
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(20); // Get last 20 recipe sessions to avoid too much data
        
        if (recipeSessions) {
          existingRecipes = recipeSessions
            .flatMap((session: any) => session.recipes || [])
            .map((recipe: any) => ({
              title: recipe.title,
              main_ingredients: recipe.ingredients?.slice(0, 3).map((ing: any) => ing.name) || []
            }));
        }
      } catch (error) {
        logger.warn('FRIDGE_SCAN_PIPELINE', 'Failed to fetch existing recipes', {
          sessionId: state.currentSessionId,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        });
      }
      
      // Prepare user preferences for API call
      const userPreferences = {
        // Core nutrition data
        nutrition: {
          diet: userProfile?.nutrition?.diet || '',
          allergies: userProfile?.nutrition?.allergies || [],
          intolerances: userProfile?.nutrition?.intolerances || [],
          budgetLevel: userProfile?.nutrition?.budgetLevel || 'medium',
          proteinTarget_g: userProfile?.nutrition?.proteinTarget_g || undefined,
          disliked: userProfile?.nutrition?.disliked || []
        },
        
        // Enhanced Recipe Workshop preferences
        household_details: {
          adults: userProfile?.householdDetails?.adults || 1,
          children: userProfile?.householdDetails?.children || 0,
          dietaryRestrictions: userProfile?.householdDetails?.dietaryRestrictions || []
        },
        
        meal_prep_preferences: {
          weekdayTimeMin: userProfile?.mealPrepPreferences?.weekdayTimeMin || 30,
          weekendTimeMin: userProfile?.mealPrepPreferences?.weekendTimeMin || 60,
          cookingSkill: userProfile?.mealPrepPreferences?.cookingSkill || 'intermediate',
          preferredMealTimes: userProfile?.mealPrepPreferences?.preferredMealTimes || {}
        },
        
        kitchen_equipment: {
          oven: userProfile?.kitchenEquipment?.oven ?? true,
          stove: userProfile?.kitchenEquipment?.stove ?? true,
          microwave: userProfile?.kitchenEquipment?.microwave ?? true,
          airFryer: userProfile?.kitchenEquipment?.airFryer ?? false,
          slowCooker: userProfile?.kitchenEquipment?.slowCooker ?? false,
          blender: userProfile?.kitchenEquipment?.blender ?? false,
          foodProcessor: userProfile?.kitchenEquipment?.foodProcessor ?? false,
          standMixer: userProfile?.kitchenEquipment?.standMixer ?? false,
          riceCooker: userProfile?.kitchenEquipment?.riceCooker ?? false,
          grill: userProfile?.kitchenEquipment?.grill ?? false,
          steamBasket: userProfile?.kitchenEquipment?.steamBasket ?? false,
          pressureCooker: userProfile?.kitchenEquipment?.pressureCooker ?? false
        },
        
        food_preferences: {
          cuisines: userProfile?.foodPreferences?.cuisines || [],
          ingredients: userProfile?.foodPreferences?.ingredients || [],
          flavors: userProfile?.foodPreferences?.flavors || []
        },
        
        sensory_preferences: {
          spiceTolerance: userProfile?.sensoryPreferences?.spiceTolerance || 1,
          textureAversions: userProfile?.sensoryPreferences?.textureAversions || [],
          temperaturePreferences: userProfile?.sensoryPreferences?.temperaturePreferences || []
        },
        
        macro_targets: {
          kcal: userProfile?.macroTargets?.kcal || undefined,
          fiberMinG: userProfile?.macroTargets?.fiberMinG || undefined,
          sugarMaxG: userProfile?.macroTargets?.sugarMaxG || undefined,
          saltMaxMg: userProfile?.macroTargets?.saltMaxMg || undefined,
          carbsMaxG: userProfile?.macroTargets?.carbsMaxG || undefined,
          fatMinG: userProfile?.macroTargets?.fatMinG || undefined
        },
        
        shopping_preferences: {
          frequencyPerWeek: userProfile?.shoppingPreferences?.frequencyPerWeek || 2,
          defaultPortionsPerMeal: userProfile?.shoppingPreferences?.defaultPortionsPerMeal || 2,
          batchCooking: userProfile?.shoppingPreferences?.batchCooking || 'sometimes',
          bias: userProfile?.shoppingPreferences?.bias || [],
          preferredStores: userProfile?.shoppingPreferences?.preferredStores || [],
          budgetPerWeek: userProfile?.shoppingPreferences?.budgetPerWeek || undefined
        },
        
        // User identity for portion calculations
        user_identity: {
          sex: userProfile?.sex || 'male',
          height_cm: userProfile?.height_cm || 175,
          weight_kg: userProfile?.weight_kg || 70,
          activity_level: userProfile?.activity_level || 'moderate',
          objective: userProfile?.objective || 'recomp'
        }
      };

      // Create fetch-based SSE connection to recipe-generator Edge Function
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/recipe-generator`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inventory_final: inventoryToUse.map(item => ({
            name: item.name,
            category: item.category,
            quantity: item.quantity,
            freshness: item.freshnessScore > 70 ? 'Excellent' : 
                      item.freshnessScore > 40 ? 'Bon' : 'À utiliser rapidement'
          })),
          user_preferences: userPreferences,
          filters: {},
          user_id: userId,
          existing_recipes: existingRecipes
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      let totalRecipesReceived = 0;

      const processSSEMessage = (eventType: string, data: string) => {
        if (eventType === 'skeleton') {
          try {
            const parsedData = JSON.parse(data);
            const actualSkeletonCount = parsedData.recipe_count || 4;
            
            logger.info('FRIDGE_SCAN_PIPELINE', 'Received skeleton count', {
              sessionId: state.currentSessionId,
              skeletonCount: actualSkeletonCount,
              timestamp: new Date().toISOString()
            });

            // Create placeholder recipes for all skeletons
            const placeholderRecipes: Recipe[] = Array.from({ length: actualSkeletonCount }, (_, index) => ({
              id: `placeholder-${index}-${Date.now()}`,
              sessionId: state.currentSessionId!,
              title: '',
              description: '',
              ingredients: [],
              instructions: [],
              prepTimeMin: 0,
              cookTimeMin: 0,
              servings: 0,
              dietaryTags: [],
              nutritionalInfo: {
                calories: 0,
                protein: 0,
                carbs: 0,
                fat: 0
              },
              imageUrl: undefined,
              imageSignature: undefined,
              reasons: [],
              createdAt: new Date().toISOString(),
              status: 'loading',
              isGeneratingImage: true
            }));

            // Set all placeholder recipes at once to show skeletons
            set({ recipeCandidates: placeholderRecipes });
          } catch (error) {
            logger.error('FRIDGE_SCAN_PIPELINE', 'Error parsing skeleton event', {
              sessionId: state.currentSessionId,
              error: error instanceof Error ? error.message : 'Unknown error',
              timestamp: new Date().toISOString()
            });
          }
        } else if (eventType === 'recipe') {
          try {
            // Robust JSON extraction - trim and extract content between first { and last }
            const trimmedData = data.trim();
            const firstBrace = trimmedData.indexOf('{');
            const lastBrace = trimmedData.lastIndexOf('}');
            
            if (firstBrace === -1 || lastBrace === -1 || firstBrace >= lastBrace) {
              throw new Error('Invalid JSON structure in recipe data');
            }
            
            const jsonString = trimmedData.substring(firstBrace, lastBrace + 1);
            const recipeData = JSON.parse(jsonString);
            
            // Transform instructions from string[] to RecipeInstruction[]
            const transformedInstructions = Array.isArray(recipeData.instructions)
              ? recipeData.instructions.map((instruction: any, index: number) => {
                  // If instruction is already an object with step and instruction properties, use it
                  if (typeof instruction === 'object' && instruction.instruction) {
                    return {
                      step: instruction.step || index + 1,
                      instruction: instruction.instruction,
                      timeMin: instruction.timeMin || instruction.time_min,
                      temperature: instruction.temperature,
                      equipment: instruction.equipment
                    };
                  }
                  // If instruction is a string, convert it to the expected format
                  return {
                    step: index + 1,
                    instruction: typeof instruction === 'string' ? instruction : String(instruction || '')
                  };
                })
              : [];

            // Convert API response to Recipe format with backend-provided ID
            const recipe: Recipe = {
              id: recipeData.id || crypto.randomUUID(), // Use backend ID or fallback
              sessionId: state.currentSessionId!,
              title: recipeData.title,
              description: recipeData.description,
              ingredients: recipeData.ingredients || [],
              instructions: transformedInstructions,
              prepTimeMin: recipeData.prep_time_min || 0,
              cookTimeMin: recipeData.cook_time_min || 0,
              servings: recipeData.servings || 2,
              dietaryTags: recipeData.dietary_tags || [],
              nutritionalInfo: recipeData.nutritional_info || {},
              imageUrl: undefined, // Will be generated later
              imageSignature: recipeData.image_signature,
              reasons: recipeData.reasons || [],
              createdAt: new Date().toISOString(),
              status: 'ready',
              isGeneratingImage: true // Set to true to show loading state for image only
            };

            totalRecipesReceived++;

            logger.info('FRIDGE_SCAN_PIPELINE', 'Received recipe via SSE', {
              sessionId: state.currentSessionId,
              recipeId: recipe.id,
              recipeTitle: recipe.title,
              totalReceived: totalRecipesReceived,
              timestamp: new Date().toISOString()
            });

            // Find and update the corresponding placeholder recipe
            const currentCandidates = get().recipeCandidates;
            const placeholderIndex = currentCandidates.findIndex(candidate => 
              candidate.status === 'loading' && candidate.title === ''
            );

            let updatedCandidates;
            if (placeholderIndex !== -1) {
              // Update the placeholder with actual recipe data
              updatedCandidates = [...currentCandidates];
              updatedCandidates[placeholderIndex] = {
                ...updatedCandidates[placeholderIndex],
                ...recipe,
                status: 'ready',
                isGeneratingImage: true // Keep true until image loads
              };
            } else {
              // Fallback: append if no placeholder found
              updatedCandidates = [...currentCandidates, recipe];
            }

            set({ recipeCandidates: updatedCandidates });

            // Emit custom event to notify UI components that recipes have been updated
            window.dispatchEvent(new CustomEvent('recipes-updated', {
              detail: {
                sessionId: state.currentSessionId,
                recipeId: recipe.id,
                totalRecipes: updatedCandidates.length,
                timestamp: new Date().toISOString()
              }
            }));

            logger.info('FRIDGE_SCAN_PIPELINE', 'Emitted recipes-updated event', {
              sessionId: state.currentSessionId,
              recipeId: recipe.id,
              totalCandidates: updatedCandidates.length,
              timestamp: new Date().toISOString()
            });

            // Trigger background image generation for this recipe
            get()._triggerImageGenerationForRecipes([recipe], state.currentSessionId!);

          } catch (error) {
            logger.error('FRIDGE_SCAN_PIPELINE', 'Error parsing recipe event', {
              sessionId: state.currentSessionId,
              error: error instanceof Error ? error.message : 'Unknown error',
              rawData: data,
              timestamp: new Date().toISOString()
            });
          }
        } else if (eventType === 'complete') {
          try {
            const parsedData = JSON.parse(data);
            
            logger.info('FRIDGE_SCAN_PIPELINE', 'Recipe generation completed via SSE', {
              sessionId: state.currentSessionId,
              totalRecipesReceived,
              processingTimeMs: parsedData.processing_time_ms,
              costUsd: parsedData.cost_usd,
              cacheHit: parsedData.cache_hit,
              aiModel: 'gpt-5-mini',
              inputTokens: parsedData.input_tokens,
              outputTokens: parsedData.output_tokens,
              timestamp: new Date().toISOString()
            });

            set({
              loadingState: 'idle',
              loadingMessage: '',
              isActive: false
            });

            // Award XP for recipe generation using GamificationService
            // This ensures proper integration with the gaming system and correct XP values (20 XP per recipe)
            (async () => {
              try {
                const { supabase } = await import('../../../supabase/client');
                const { data: { user } } = await supabase.auth.getUser();

                if (user && totalRecipesReceived > 0) {
                  const { gamificationService } = await import('../../../../services/dashboard/coeur');

                  // Award XP for recipe generation with detailed metadata
                  const xpResult = await gamificationService.awardRecipeGeneratedXp(user.id, {
                    session_id: state.currentSessionId,
                    recipes_generated: totalRecipesReceived,
                    source: 'fridge_scan_pipeline',
                    inventory_count: state.userEditedInventory.length,
                    timestamp: new Date().toISOString()
                  });

                  logger.info('FRIDGE_SCAN_PIPELINE', 'XP awarded successfully via GamificationService', {
                    sessionId: state.currentSessionId,
                    recipesGenerated: totalRecipesReceived,
                    xpAwarded: xpResult.xpAwarded,
                    baseXp: xpResult.baseXp,
                    multiplier: xpResult.multiplier,
                    leveledUp: xpResult.leveledUp,
                    newLevel: xpResult.newLevel,
                    userId: user.id,
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

                  logger.info('FRIDGE_SCAN_PIPELINE', 'Gaming widget queries invalidated and refetched after recipe generation', {
                    sessionId: state.currentSessionId,
                    xpAwarded: xpResult.xpAwarded,
                    timestamp: new Date().toISOString()
                  });
                }
              } catch (xpError) {
                logger.warn('FRIDGE_SCAN_PIPELINE', 'Failed to award XP for recipe generation', {
                  error: xpError instanceof Error ? xpError.message : 'Unknown error',
                  sessionId: state.currentSessionId,
                  recipesGenerated: totalRecipesReceived,
                  timestamp: new Date().toISOString()
                });
                // Don't throw - XP attribution failure should not block user workflow
              }
            })();
          } catch (error) {
            logger.error('FRIDGE_SCAN_PIPELINE', 'Error parsing complete event', {
              sessionId: state.currentSessionId,
              error: error instanceof Error ? error.message : 'Unknown error',
              timestamp: new Date().toISOString()
            });
          }
        } else if (eventType === 'error') {
          try {
            const parsedData = JSON.parse(data);
            
            logger.error('FRIDGE_SCAN_PIPELINE', 'SSE error event received', {
              sessionId: state.currentSessionId,
              error: parsedData.error || 'Unknown SSE error',
              timestamp: new Date().toISOString()
            });

            // Show error toast and revert to error state
            set({
              loadingState: 'idle',
              loadingMessage: '',
              recipeCandidates: []
            });

            throw new Error(parsedData.error || 'Recipe generation failed via SSE');
          } catch (parseError) {
            logger.error('FRIDGE_SCAN_PIPELINE', 'Error parsing SSE error event', {
              sessionId: state.currentSessionId,
              error: parseError instanceof Error ? parseError.message : 'Unknown error',
              timestamp: new Date().toISOString()
            });
            throw new Error('Recipe generation failed');
          }
        }
      };

      // Process the stream
      logger.info('FRIDGE_SCAN_PIPELINE', 'SSE connection opened', {
        sessionId: state.currentSessionId,
        timestamp: new Date().toISOString()
      });

      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            break;
          }

          // Decode the chunk and add to buffer
          buffer += decoder.decode(value, { stream: true });

          // Process complete lines
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep the incomplete line in buffer

          let currentEvent = '';
          let currentData = '';

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              currentEvent = line.slice(7).trim();
            } else if (line.startsWith('data: ')) {
              currentData = line.slice(6);
            } else if (line === '' && currentEvent && currentData) {
              // Process the complete SSE message
              processSSEMessage(currentEvent, currentData);
              currentEvent = '';
              currentData = '';
            }
          }
        }
      } catch (streamError) {
        logger.error('FRIDGE_SCAN_PIPELINE', 'Stream reading error', {
          sessionId: state.currentSessionId,
          error: streamError instanceof Error ? streamError.message : 'Unknown stream error',
          timestamp: new Date().toISOString()
        });

        set({
          loadingState: 'idle',
          loadingMessage: '',
          recipeCandidates: []
        });

        throw new Error('Failed to read recipe generation stream');
      } finally {
        reader.releaseLock();
      }

    } catch (error) {
      logger.error('FRIDGE_SCAN_PIPELINE', 'Recipe generation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        sessionId: state.currentSessionId,
        costUsd: 0, // No cost on failure
        aiModel: 'gpt-5-mini',
        timestamp: new Date().toISOString()
      });
      
      // Revert to error state
      set({
        loadingState: 'idle',
        loadingMessage: '',
        recipeCandidates: []
      });
      
      throw error;
    }
  }
});