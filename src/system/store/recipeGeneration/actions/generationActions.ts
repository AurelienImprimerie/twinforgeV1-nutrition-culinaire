import logger from '../../../../lib/utils/logger';
import type { RecipeGenerationPipelineState } from '../types';
import type { Recipe } from '../../../../domain/recipe';

export const createGenerationActions = (
  set: (partial: Partial<RecipeGenerationPipelineState>) => void,
  get: () => RecipeGenerationPipelineState
) => ({
  generateRecipes: async () => {
    const state = get();

    if (!state.config.selectedInventoryId) {
      throw new Error('Aucun inventaire sélectionné');
    }

    logger.info('RECIPE_GENERATION_PIPELINE', 'Starting recipe generation', {
      sessionId: state.currentSessionId,
      inventoryId: state.config.selectedInventoryId,
      recipeCount: state.config.recipeCount,
      timestamp: new Date().toISOString()
    });

    set({
      currentStep: 'generating',
      loadingState: 'generating',
      loadingMessage: 'La Forge Spatiale crée vos recettes personnalisées...',
      simulatedOverallProgress: 33
    });

    try {
      // Get inventory from meal plan store
      const { useMealPlanStore } = await import('../../mealPlanStore');
      const mealPlanState = useMealPlanStore.getState();

      const selectedInventory = mealPlanState.availableInventories?.find(
        inv => inv.id === state.config.selectedInventoryId
      );

      if (!selectedInventory || !selectedInventory.inventory_final?.length) {
        throw new Error('Inventaire introuvable ou vide');
      }

      const inventoryToUse = selectedInventory.inventory_final;

      logger.info('RECIPE_GENERATION_PIPELINE', 'Inventory loaded for generation', {
        sessionId: state.currentSessionId,
        inventoryCount: inventoryToUse.length,
        timestamp: new Date().toISOString()
      });

      // Transition to streaming state
      set({
        loadingState: 'streaming',
        loadingMessage: 'Génération des recettes en cours...',
        recipeCandidates: [],
        simulatedOverallProgress: 50
      });

      // Get user preferences
      const { useUserStore } = await import('../../userStore');
      const userProfile = useUserStore.getState().profile;
      const userId = useUserStore.getState().session?.user?.id;

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
          .limit(20);

        if (recipeSessions) {
          existingRecipes = recipeSessions
            .flatMap((session: any) => session.recipes || [])
            .map((recipe: any) => ({
              title: recipe.title,
              main_ingredients: recipe.ingredients?.slice(0, 3).map((ing: any) => ing.name) || []
            }));
        }
      } catch (error) {
        logger.warn('RECIPE_GENERATION_PIPELINE', 'Failed to fetch existing recipes', {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }

      // Prepare user preferences
      const userPreferences = {
        nutrition: {
          diet: userProfile?.nutrition?.diet || '',
          allergies: userProfile?.nutrition?.allergies || [],
          intolerances: userProfile?.nutrition?.intolerances || [],
          budgetLevel: userProfile?.nutrition?.budgetLevel || 'medium',
          proteinTarget_g: userProfile?.nutrition?.proteinTarget_g || undefined,
          disliked: userProfile?.nutrition?.disliked || []
        },
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
        user_identity: {
          sex: userProfile?.sex || 'male',
          height_cm: userProfile?.height_cm || 175,
          weight_kg: userProfile?.weight_kg || 70,
          activity_level: userProfile?.activity_level || 'moderate',
          objective: userProfile?.objective || 'recomp'
        }
      };

      // Create SSE connection to recipe-generator Edge Function
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
          filters: {
            recipe_count: state.config.recipeCount
          },
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

      const processSSEMessage = (eventType: string, data: string) => {
        if (eventType === 'skeleton') {
          try {
            const parsedData = JSON.parse(data);
            const actualSkeletonCount = parsedData.recipe_count || state.config.recipeCount;

            logger.info('RECIPE_GENERATION_PIPELINE', 'Received skeleton count', {
              skeletonCount: actualSkeletonCount
            });

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

            set({ recipeCandidates: placeholderRecipes });
          } catch (error) {
            logger.error('RECIPE_GENERATION_PIPELINE', 'Error parsing skeleton event', {
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        } else if (eventType === 'recipe') {
          try {
            const trimmedData = data.trim();
            const firstBrace = trimmedData.indexOf('{');
            const lastBrace = trimmedData.lastIndexOf('}');

            if (firstBrace === -1 || lastBrace === -1 || firstBrace >= lastBrace) {
              throw new Error('Invalid JSON structure in recipe data');
            }

            const jsonString = trimmedData.substring(firstBrace, lastBrace + 1);
            const recipeData = JSON.parse(jsonString);

            const transformedInstructions = Array.isArray(recipeData.instructions)
              ? recipeData.instructions.map((instruction: any, index: number) => {
                  if (typeof instruction === 'object' && instruction.instruction) {
                    return {
                      step: instruction.step || index + 1,
                      instruction: instruction.instruction,
                      timeMin: instruction.timeMin || instruction.time_min,
                      temperature: instruction.temperature,
                      equipment: instruction.equipment
                    };
                  }
                  return {
                    step: index + 1,
                    instruction: typeof instruction === 'string' ? instruction : String(instruction || '')
                  };
                })
              : [];

            const recipe: Recipe = {
              id: recipeData.id || crypto.randomUUID(),
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
              imageUrl: undefined,
              imageSignature: recipeData.image_signature,
              reasons: recipeData.reasons || [],
              createdAt: new Date().toISOString(),
              status: 'ready',
              isGeneratingImage: true
            };

            logger.info('RECIPE_GENERATION_PIPELINE', 'Received recipe via SSE', {
              recipeId: recipe.id,
              recipeTitle: recipe.title
            });

            const currentCandidates = get().recipeCandidates;
            const placeholderIndex = currentCandidates.findIndex(candidate =>
              candidate.status === 'loading' && candidate.title === ''
            );

            let updatedCandidates;
            if (placeholderIndex !== -1) {
              updatedCandidates = [...currentCandidates];
              updatedCandidates[placeholderIndex] = {
                ...updatedCandidates[placeholderIndex],
                ...recipe,
                status: 'ready',
                isGeneratingImage: true
              };
            } else {
              updatedCandidates = [...currentCandidates, recipe];
            }

            set({ recipeCandidates: updatedCandidates });

            // Trigger background image generation
            get()._triggerImageGenerationForRecipes([recipe], state.currentSessionId!);

          } catch (error) {
            logger.error('RECIPE_GENERATION_PIPELINE', 'Error parsing recipe event', {
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        } else if (eventType === 'complete') {
          try {
            const parsedData = JSON.parse(data);

            logger.info('RECIPE_GENERATION_PIPELINE', 'Recipe generation completed', {
              processingTimeMs: parsedData.processing_time_ms,
              costUsd: parsedData.cost_usd
            });

            set({
              currentStep: 'validation',
              loadingState: 'idle',
              loadingMessage: '',
              simulatedOverallProgress: 100
            });
          } catch (error) {
            logger.error('RECIPE_GENERATION_PIPELINE', 'Error parsing complete event', {
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        } else if (eventType === 'error') {
          try {
            const parsedData = JSON.parse(data);

            logger.error('RECIPE_GENERATION_PIPELINE', 'SSE error event received', {
              error: parsedData.error || 'Unknown SSE error'
            });

            set({
              loadingState: 'idle',
              loadingMessage: '',
              recipeCandidates: []
            });

            throw new Error(parsedData.error || 'Recipe generation failed');
          } catch (parseError) {
            throw new Error('Recipe generation failed');
          }
        }
      };

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          let currentEvent = '';
          let currentData = '';

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              currentEvent = line.slice(7).trim();
            } else if (line.startsWith('data: ')) {
              currentData = line.slice(6);
            } else if (line === '' && currentEvent && currentData) {
              processSSEMessage(currentEvent, currentData);
              currentEvent = '';
              currentData = '';
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

    } catch (error) {
      logger.error('RECIPE_GENERATION_PIPELINE', 'Recipe generation failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      set({
        loadingState: 'idle',
        loadingMessage: '',
        recipeCandidates: []
      });

      throw error;
    }
  },

  _triggerImageGenerationForRecipes: async (recipes: Recipe[], sessionId: string) => {
    if (!recipes.length) return;

    const currentCandidates = get().recipeCandidates;
    const updatedCandidates = currentCandidates.map(candidate => {
      const matchingRecipe = recipes.find(r => r.id === candidate.id);
      if (matchingRecipe) {
        return { ...candidate, isGeneratingImage: true };
      }
      return candidate;
    });
    set({ recipeCandidates: updatedCandidates });

    const { supabase } = await import('../../../supabase/client');
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.access_token) {
      logger.error('RECIPE_GENERATION_PIPELINE', 'No authenticated session for image generation');
      return;
    }

    for (const recipe of recipes) {
      try {
        const imageSignature = `recipe-${recipe.id}-${Date.now()}`;

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
          get().updateRecipeImageUrlInCandidates(recipe.id, result.image_url, false);
        } else {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
      } catch (error) {
        logger.error('RECIPE_GENERATION_PIPELINE', 'Image generation failed for recipe', {
          recipeId: recipe.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        get().updateRecipeImageUrlInCandidates(recipe.id, undefined, false, true);
      }
    }
  }
});
