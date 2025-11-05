import type { StateCreator } from 'zustand';
import type { MealPlanGenerationPipelineState, MealPlan } from '../types';
import { supabase } from '../../../supabase/client';
import { useUserStore } from '../../userStore';
import logger from '../../../../lib/utils/logger';
import { nanoid } from 'nanoid';
import { mealPlanProgressService } from '../../../services/mealPlanProgressService';
import { handleTokenError } from '../../../../lib/utils/tokenErrorHandler';

// Helper function to trigger background image generation
interface ImageGenerationParams {
  recipeId: string;
  recipeDetails: any;
  imageSignature: string;
  userId: string;
  accessToken: string;
  planId: string;
  dayIndex: number;
  mealId: string;
  signal?: AbortSignal;
  updateMealImageUrl: (recipeId: string, imageUrl: string) => void;
  incrementImageCount: () => void;
}

async function triggerImageGeneration(params: ImageGenerationParams): Promise<void> {
  const { recipeId, recipeDetails, imageSignature, userId, accessToken, planId, dayIndex, mealId, signal, updateMealImageUrl, incrementImageCount } = params;

  logger.info('MEAL_PLAN_GENERATION_PIPELINE', 'Triggering background image generation', {
    recipeId,
    recipeTitle: recipeDetails.title,
    planId,
    dayIndex,
    mealId,
    timestamp: new Date().toISOString()
  });

  try {
    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/image-generator`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recipe_id: recipeId,
        recipe_details: {
          title: recipeDetails.title,
          ingredients: recipeDetails.ingredients || [],
          description: recipeDetails.description
        },
        image_signature: imageSignature,
        user_id: userId
      }),
      signal
    });

    if (response.ok) {
      const result = await response.json();

      logger.info('MEAL_PLAN_GENERATION_PIPELINE', '🖼️ Background image generation successful', {
        recipeId,
        imageUrl: result.image_url,
        generationMethod: result.generation_method,
        cached: result.cache_hit,
        costUsd: result.cost_usd,
        planId,
        dayIndex,
        mealId,
        timestamp: new Date().toISOString()
      });

      // CRITICAL: Update the state with the image URL so it displays immediately
      logger.info('MEAL_PLAN_GENERATION_PIPELINE', '🔄 Calling updateMealImageUrl to update UI', {
        recipeId,
        imageUrl: result.image_url,
        timestamp: new Date().toISOString()
      });

      // Update the meal image URL directly
      updateMealImageUrl(recipeId, result.image_url);

      logger.info('MEAL_PLAN_GENERATION_PIPELINE', '✅ updateMealImageUrl called successfully', {
        recipeId,
        imageUrl: result.image_url,
        timestamp: new Date().toISOString()
      });

      // Increment images generated count
      incrementImageCount();

      logger.info('MEAL_PLAN_GENERATION_PIPELINE', '📊 Image count incremented', {
        recipeId,
        timestamp: new Date().toISOString()
      });
    } else {
      logger.error('MEAL_PLAN_GENERATION_PIPELINE', 'Background image generation failed', {
        recipeId,
        status: response.status,
        statusText: response.statusText
      });
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      logger.info('MEAL_PLAN_GENERATION_PIPELINE', 'Image generation cancelled', {
        recipeId
      });
      return;
    }
    logger.error('MEAL_PLAN_GENERATION_PIPELINE', 'Background image generation error', {
      recipeId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Helper function to enrich meal with detailed recipe data
interface EnrichMealParams {
  meal: {
    id: string;
    name: string;
    type: string;
    ingredients?: string[];
    calories?: number;
  };
  userId: string;
  accessToken: string;
  userPreferences: any;
  signal?: AbortSignal;
}

async function enrichMealWithRecipeDetails(params: EnrichMealParams): Promise<any | null> {
  const { meal, userId, accessToken, userPreferences, signal } = params;

  const startTime = Date.now();
  logger.info('MEAL_PLAN_GENERATION_PIPELINE', 'Starting recipe enrichment', {
    mealId: meal.id,
    mealName: meal.name,
    mealType: meal.type,
    timestamp: new Date().toISOString()
  });

  try {
    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/recipe-detail-generator`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: userId,
        meal_title: meal.name,
        main_ingredients: meal.ingredients || [],
        user_preferences: userPreferences,
        meal_type: meal.type,
        target_calories: meal.calories
      }),
      signal
    });

    if (!response.ok) {
      if (response.status === 402) {
        let errorData = null;
        try {
          errorData = await response.json();
        } catch {}

        handleTokenError({
          status: 402,
          data: errorData,
          message: errorData?.error || 'Insufficient tokens'
        }, 'recipe-enrichment');

        return null;
      }

      logger.error('MEAL_PLAN_GENERATION_PIPELINE', 'Recipe enrichment API error', {
        mealId: meal.id,
        status: response.status,
        statusText: response.statusText
      });
      return null;
    }

    const result = await response.json();
    const detailedRecipe = result.recipe;

    const elapsedTime = Date.now() - startTime;
    logger.info('MEAL_PLAN_GENERATION_PIPELINE', 'Recipe enrichment successful', {
      mealId: meal.id,
      mealName: meal.name,
      recipeId: detailedRecipe.id,
      cached: result.cached,
      elapsedMs: elapsedTime,
      timestamp: new Date().toISOString()
    });

    return detailedRecipe;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      logger.info('MEAL_PLAN_GENERATION_PIPELINE', 'Recipe enrichment cancelled', {
        mealId: meal.id,
        mealName: meal.name
      });
      return null;
    }
    logger.error('MEAL_PLAN_GENERATION_PIPELINE', 'Recipe enrichment error', {
      mealId: meal.id,
      mealName: meal.name,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return null;
  }
}

export interface GenerationActions {
  generateMealPlans: () => Promise<void>;
  saveMealPlans: (withRecipes: boolean) => Promise<void>;
  discardMealPlans: () => void;
  cancelGeneration: () => Promise<void>;
  updateMealPlanStatus: (planId: string, status: 'loading' | 'ready') => void;
  updateMealStatus: (planId: string, mealId: string, status: 'loading' | 'ready', recipe?: any) => void;
  updateMealWithDetailedRecipe: (planId: string, mealId: string, detailedRecipe: any) => void;
  updateMealImageUrl: (recipeId: string, imageUrl: string) => void;
  loadProgressFromDatabase: () => Promise<boolean>;
  clearSavedProgress: () => Promise<void>;
}

export const createGenerationActions = (
  set: StateCreator<MealPlanGenerationPipelineState>['setState'],
  get: StateCreator<MealPlanGenerationPipelineState>['getState']
): GenerationActions => ({
  generateMealPlans: async () => {
    const state = get();
    const { config, currentSessionId } = state;

    if (!config.selectedInventoryId) {
      throw new Error('Aucun inventaire sélectionné');
    }

    const { session } = useUserStore.getState();
    const userId = session?.user?.id;

    if (!userId) {
      throw new Error('Utilisateur non authentifié');
    }

    // Create AbortController for cancellation support
    const abortController = new AbortController();
    set({ abortController });

    logger.info('MEAL_PLAN_GENERATION_PIPELINE', 'Starting meal plan generation', {
      config,
      sessionId: currentSessionId,
      timestamp: new Date().toISOString()
    });

    // CRITICAL: Créer la session dans la base de données AVANT la génération
    // Cela résout le problème de foreign key lors de la sauvegarde
    if (currentSessionId) {
      const sessionSaved = await mealPlanProgressService.saveSession(
        userId,
        currentSessionId,
        config
      );

      if (!sessionSaved) {
        logger.error('MEAL_PLAN_GENERATION_PIPELINE', 'Failed to save session to database', {
          sessionId: currentSessionId
        });
      } else {
        logger.info('MEAL_PLAN_GENERATION_PIPELINE', 'Session saved to database successfully', {
          sessionId: currentSessionId
        });
      }
    }

    logger.info('MEAL_PLAN_GENERATION_PIPELINE', 'Transitioning to generating step', {
      sessionId: currentSessionId,
      timestamp: new Date().toISOString()
    });

    set({
      currentStep: 'generating',
      loadingState: 'generating',
      loadingMessage: 'Analyse de votre inventaire et préférences...',
      simulatedOverallProgress: 10,
      receivedDaysCount: 0,
      totalDaysToGenerate: config.weekCount * 7,
      enrichedMealsCount: 0,
      totalMealsToEnrich: config.weekCount * 7 * 3, // 7 days * 3 meals per day (breakfast, lunch, dinner)
      imagesGeneratedCount: 0,
      totalImagesToGenerate: config.weekCount * 7 * 3, // Same as meals - one image per meal
      lastStateUpdate: Date.now()
    });

    try {
      // Initialize empty plans for each week
      const initialPlans: MealPlan[] = [];
      for (let i = 0; i < config.weekCount; i++) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() + i * 7);
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 6);

        initialPlans.push({
          id: nanoid(),
          title: `Plan Semaine ${i + 1}`,
          weekNumber: i + 1,
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          batchCookingEnabled: config.batchCooking,
          status: 'loading',
          days: [],
          aiExplanation: 'Plan en cours de génération...'
        });
      }

      logger.info('MEAL_PLAN_GENERATION_PIPELINE', 'Starting SSE streaming phase', {
        planCount: initialPlans.length,
        sessionId: currentSessionId,
        timestamp: new Date().toISOString()
      });

      set({
        mealPlanCandidates: initialPlans,
        loadingState: 'streaming',
        loadingMessage: 'Génération des plans avec l\'IA...',
        simulatedOverallProgress: 15,
        lastStateUpdate: Date.now()
      });

      // Generate plans via edge function with streaming
      for (let i = 0; i < config.weekCount; i++) {
        const plan = initialPlans[i];

        logger.info('MEAL_PLAN_GENERATION_PIPELINE', 'Calling meal-plan-generator edge function', {
          weekNumber: plan.weekNumber,
          startDate: plan.startDate,
          sessionId: currentSessionId
        });

        const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/meal-plan-generator`;

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_id: userId,
            session_id: currentSessionId,
            week_number: plan.weekNumber,
            start_date: plan.startDate,
            inventory_count: 0,
            has_preferences: true,
            batch_cooking_enabled: config.batchCooking || false
          }),
          signal: abortController.signal
        });

        if (!response.ok) {
          // Check if it's a token error (402)
          if (response.status === 402) {
            let errorData = null;
            try {
              errorData = await response.json();
            } catch {}

            handleTokenError({
              status: 402,
              data: errorData,
              message: errorData?.error || 'Insufficient tokens'
            }, 'meal-plan-generation');
          }

          throw new Error(`Erreur de génération: ${response.statusText}`);
        }

        // Read SSE stream
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        const receivedDays: any[] = [];
        let weeklyData: any = null;

        while (reader) {
          const { done, value } = await reader.read();

          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));

                if (data.type === 'progress') {
                  // Handle progress events from backend
                  logger.info('MEAL_PLAN_GENERATION_PIPELINE', 'SSE progress event received', {
                    weekNumber: plan.weekNumber,
                    phase: data.data.phase,
                    message: data.data.message,
                    progress: data.data.progress,
                    sessionId: currentSessionId,
                    timestamp: new Date().toISOString()
                  });

                  set((currentState) => ({
                    loadingMessage: data.data.message || 'Génération en cours...',
                    simulatedOverallProgress: data.data.progress || currentState.simulatedOverallProgress,
                    lastStateUpdate: Date.now()
                  }));
                } else if (data.type === 'heartbeat') {
                  // Heartbeat to keep connection alive
                  logger.debug('MEAL_PLAN_GENERATION_PIPELINE', 'Heartbeat received', {
                    daysGenerated: data.data.daysGenerated,
                    timestamp: data.data.timestamp
                  });
                } else if (data.type === 'day') {
                  receivedDays.push(data.data);

                  logger.info('MEAL_PLAN_GENERATION_PIPELINE', 'SSE day event received', {
                    weekNumber: plan.weekNumber,
                    dayIndex: receivedDays.length,
                    date: data.data.date,
                    hasMeals: !!data.data.breakfast,
                    sessionId: currentSessionId,
                    timestamp: new Date().toISOString()
                  });

                  // CRITICAL: Update plan with received day AND force UI update with timestamp
                  // PRESERVE existing enriched days and only add/update the new day
                  set((currentState) => {
                    const totalDays = currentState.totalDaysToGenerate;
                    const newReceivedCount = (i * 7) + receivedDays.length;
                    const progressPercent = 5 + (newReceivedCount / totalDays) * 70; // 5% to 75%

                    const currentPlan = currentState.mealPlanCandidates[i];
                    const existingDays = currentPlan?.days || [];
                    const newDayIndex = receivedDays.length - 1;
                    const newDayData = data.data;

                    // Create new day structure
                    const breakfastId = nanoid();
                    const lunchId = nanoid();
                    const dinnerId = nanoid();

                    logger.info('MEAL_PLAN_GENERATION_PIPELINE', '🆕 Creating new day meals', {
                      weekNumber: i + 1,
                      dayIndex: newDayIndex,
                      date: newDayData.date,
                      breakfastId,
                      lunchId,
                      dinnerId,
                      breakfast: newDayData.breakfast?.title,
                      lunch: newDayData.lunch?.title,
                      dinner: newDayData.dinner?.title,
                      timestamp: new Date().toISOString()
                    });

                    const newDay = {
                      date: newDayData.date,
                      dayIndex: newDayIndex,
                      meals: [
                        {
                          id: breakfastId,
                          type: 'breakfast',
                          name: newDayData.breakfast?.title || 'Petit-déjeuner',
                          description: newDayData.breakfast?.description,
                          ingredients: newDayData.breakfast?.ingredients,
                          prepTime: newDayData.breakfast?.prep_time_min,
                          cookTime: newDayData.breakfast?.cook_time_min,
                          calories: newDayData.breakfast?.calories_est,
                          status: 'ready' as const,
                          recipeGenerated: false
                        },
                        {
                          id: lunchId,
                          type: 'lunch',
                          name: newDayData.lunch?.title || 'Déjeuner',
                          description: newDayData.lunch?.description,
                          ingredients: newDayData.lunch?.ingredients,
                          prepTime: newDayData.lunch?.prep_time_min,
                          cookTime: newDayData.lunch?.cook_time_min,
                          calories: newDayData.lunch?.calories_est,
                          status: 'ready' as const,
                          recipeGenerated: false
                        },
                        {
                          id: dinnerId,
                          type: 'dinner',
                          name: newDayData.dinner?.title || 'Dîner',
                          description: newDayData.dinner?.description,
                          ingredients: newDayData.dinner?.ingredients,
                          prepTime: newDayData.dinner?.prep_time_min,
                          cookTime: newDayData.dinner?.cook_time_min,
                          calories: newDayData.dinner?.calories_est,
                          status: 'ready' as const,
                          recipeGenerated: false
                        }
                      ]
                    };

                    // Merge: keep existing enriched days, add new day
                    const updatedDays = [...existingDays];
                    if (updatedDays[newDayIndex]) {
                      logger.info('MEAL_PLAN_GENERATION_PIPELINE', '🔄 Merging day with existing data', {
                        dayIndex: newDayIndex,
                        existingMealsCount: updatedDays[newDayIndex]?.meals?.length || 0,
                        existingEnrichedMeals: updatedDays[newDayIndex]?.meals?.filter(m => m.recipeGenerated).map(m => ({
                          id: m.id,
                          name: m.name,
                          type: m.type,
                          hasDetailedRecipe: !!m.detailedRecipe,
                          hasImage: !!m.detailedRecipe?.imageUrl
                        })) || [],
                        timestamp: new Date().toISOString()
                      });

                      // Day exists but might have been enriched - preserve enriched meals
                      updatedDays[newDayIndex] = {
                        ...newDay,
                        meals: newDay.meals.map((newMeal, mealIdx) => {
                          const existingMeal = updatedDays[newDayIndex]?.meals[mealIdx];
                          // If existing meal has enrichment, preserve it
                          if (existingMeal?.recipeGenerated && existingMeal?.detailedRecipe) {
                            logger.info('MEAL_PLAN_GENERATION_PIPELINE', '✅ PRESERVING enriched meal', {
                              mealId: existingMeal.id,
                              mealName: existingMeal.name,
                              type: existingMeal.type,
                              hasDetailedRecipe: true,
                              hasImage: !!existingMeal.detailedRecipe.imageUrl,
                              imageUrl: existingMeal.detailedRecipe.imageUrl,
                              recipeId: existingMeal.detailedRecipe.id,
                              timestamp: new Date().toISOString()
                            });
                            return existingMeal;
                          }
                          logger.info('MEAL_PLAN_GENERATION_PIPELINE', '🔄 Replacing unenriched meal with new data', {
                            oldMealId: existingMeal?.id,
                            newMealId: newMeal.id,
                            mealName: newMeal.name,
                            type: newMeal.type,
                            wasEnriched: existingMeal?.recipeGenerated || false,
                            timestamp: new Date().toISOString()
                          });
                          return newMeal;
                        })
                      };
                    } else {
                      logger.info('MEAL_PLAN_GENERATION_PIPELINE', '➕ Adding new day to plan', {
                        dayIndex: newDayIndex,
                        date: newDay.date,
                        mealsCount: newDay.meals.length,
                        timestamp: new Date().toISOString()
                      });
                      updatedDays.push(newDay);
                    }

                    return {
                      mealPlanCandidates: currentState.mealPlanCandidates.map((p, idx) =>
                        idx === i ? {
                          ...p,
                          days: updatedDays,
                          status: receivedDays.length === 7 ? 'ready' as const : 'loading' as const
                        } : p
                      ),
                      simulatedOverallProgress: Math.round(progressPercent),
                      receivedDaysCount: newReceivedCount,
                      loadingMessage: `Jour ${newReceivedCount}/${totalDays} généré`,
                      lastStateUpdate: Date.now()
                    };
                  });

                  logger.info('MEAL_PLAN_GENERATION_PIPELINE', 'Day received via streaming', {
                    weekNumber: plan.weekNumber,
                    dayIndex: receivedDays.length,
                    date: data.data.date,
                    receivedDaysCount: get().receivedDaysCount,
                    planDaysLength: get().mealPlanCandidates[i]?.days?.length || 0
                  });

                  // PARALLEL ENRICHMENT: Trigger recipe-detail-generator and image-generator for all meals of this day
                  const currentDay = data.data;
                  const currentPlan = get().mealPlanCandidates[i];
                  const currentDayIndex = receivedDays.length - 1;
                  const mealsToEnrich = currentPlan.days[currentDayIndex]?.meals || [];

                  // CRITICAL: Capture store methods before async operations
                  const capturedUpdateMealImageUrl = get().updateMealImageUrl;
                  const capturedGetState = get;

                  // Get user preferences for recipe enrichment
                  (async () => {
                    try {
                      const { data: profileData } = await supabase
                        .from('user_profile')
                        .select('*')
                        .eq('user_id', userId)
                        .single();

                      const userPreferences = {
                        identity: profileData?.identity,
                        nutrition: profileData?.nutrition,
                        kitchen_equipment: profileData?.kitchen_equipment,
                        food_preferences: profileData?.food_preferences,
                        sensory_preferences: profileData?.sensory_preferences
                      };

                      // Enrich ALL meals of this day in parallel
                      const enrichmentPromises = mealsToEnrich.map(async (meal) => {
                        // Check if cancelled before enriching
                        if (capturedGetState().isCancelling) {
                          return null;
                        }

                        const detailedRecipe = await enrichMealWithRecipeDetails({
                          meal: {
                            id: meal.id,
                            name: meal.name,
                            type: meal.type,
                            ingredients: meal.ingredients,
                            calories: meal.calories
                          },
                          userId,
                          accessToken: session?.access_token || '',
                          userPreferences,
                          signal: abortController.signal
                        });

                        if (detailedRecipe) {
                          logger.info('MEAL_PLAN_GENERATION_PIPELINE', '🍽️ ENRICHMENT SUCCESS - Updating meal with detailed recipe', {
                            mealId: meal.id,
                            mealName: meal.name,
                            mealType: meal.type,
                            recipeId: detailedRecipe.id,
                            recipeTitle: detailedRecipe.title,
                            hasIngredients: !!detailedRecipe.ingredients,
                            hasInstructions: !!detailedRecipe.instructions,
                            imageSignature: detailedRecipe.imageSignature,
                            dayIndex: currentDayIndex,
                            weekNumber: i + 1,
                            timestamp: new Date().toISOString()
                          });

                          // Update state with detailed recipe
                          set((state) => {
                            const updatedState = {
                              mealPlanCandidates: state.mealPlanCandidates.map((p) =>
                                p.id === plan.id
                                  ? {
                                      ...p,
                                      days: p.days.map((d, dIdx) =>
                                        dIdx === currentDayIndex
                                          ? {
                                              ...d,
                                              meals: d.meals.map((m) =>
                                                m.id === meal.id
                                                  ? {
                                                      ...m,
                                                      recipeGenerated: true,
                                                      status: 'ready' as const,
                                                      detailedRecipe: {
                                                        id: detailedRecipe.id,
                                                        title: detailedRecipe.title || meal.name,
                                                        prepTimeMin: detailedRecipe.prepTimeMin,
                                                        cookTimeMin: detailedRecipe.cookTimeMin,
                                                        imageUrl: undefined,
                                                        ingredients: detailedRecipe.ingredients,
                                                        instructions: detailedRecipe.instructions,
                                                        tips: detailedRecipe.tips,
                                                        variations: detailedRecipe.variations,
                                                        difficulty: detailedRecipe.difficulty,
                                                        servings: detailedRecipe.servings,
                                                        nutritionalInfo: detailedRecipe.nutritionalInfo,
                                                        dietaryTags: detailedRecipe.dietaryTags,
                                                        imageSignature: detailedRecipe.imageSignature,
                                                        status: 'ready' as const
                                                      }
                                                    }
                                                  : m
                                              )
                                            }
                                          : d
                                      )
                                    }
                                  : p
                              ),
                              enrichedMealsCount: state.enrichedMealsCount + 1,
                              lastStateUpdate: Date.now()
                            };

                            logger.info('MEAL_PLAN_GENERATION_PIPELINE', '✅ STATE UPDATED with enriched meal', {
                              mealId: meal.id,
                              mealName: meal.name,
                              recipeGenerated: true,
                              status: 'ready',
                              enrichedCount: updatedState.enrichedMealsCount,
                              totalToEnrich: state.totalMealsToEnrich,
                              timestamp: new Date().toISOString()
                            });

                            return updatedState;
                          });

                          logger.info('MEAL_PLAN_GENERATION_PIPELINE', 'Meal enriched successfully', {
                            mealId: meal.id,
                            mealName: meal.name,
                            recipeId: detailedRecipe.id,
                            enrichedCount: capturedGetState().enrichedMealsCount,
                            totalToEnrich: capturedGetState().totalMealsToEnrich
                          });

                          // Trigger image generation in parallel (non-blocking)
                          if (detailedRecipe.imageSignature && !capturedGetState().isCancelling) {
                            triggerImageGeneration({
                              recipeId: detailedRecipe.id,
                              recipeDetails: {
                                title: meal.name,
                                ingredients: detailedRecipe.ingredients,
                                description: meal.description
                              },
                              imageSignature: detailedRecipe.imageSignature,
                              userId,
                              accessToken: session?.access_token || '',
                              planId: plan.id,
                              dayIndex: currentDayIndex,
                              mealId: meal.id,
                              signal: abortController.signal,
                              updateMealImageUrl: capturedUpdateMealImageUrl,
                              incrementImageCount: () => {
                                set((state) => ({
                                  imagesGeneratedCount: state.imagesGeneratedCount + 1
                                }));
                              }
                            }).catch((imgError) => {
                              logger.error('MEAL_PLAN_GENERATION_PIPELINE', 'Image generation failed (non-blocking)', {
                                mealId: meal.id,
                                error: imgError instanceof Error ? imgError.message : 'Unknown'
                              });
                              // Still increment count even on failure so we don't wait forever
                              set((state) => ({
                                imagesGeneratedCount: state.imagesGeneratedCount + 1
                              }));
                            });
                          }
                        }
                      });

                      // Execute all enrichments in parallel
                      await Promise.allSettled(enrichmentPromises);

                      logger.info('MEAL_PLAN_GENERATION_PIPELINE', 'Day enrichment completed', {
                        dayIndex: currentDayIndex,
                        mealsEnriched: mealsToEnrich.length,
                        totalEnriched: capturedGetState().enrichedMealsCount,
                        totalToEnrich: capturedGetState().totalMealsToEnrich
                      });
                    } catch (error) {
                      logger.error('MEAL_PLAN_GENERATION_PIPELINE', 'Day enrichment error', {
                        dayIndex: currentDayIndex,
                        error: error instanceof Error ? error.message : 'Unknown'
                      });
                    }
                  })();
                } else if (data.type === 'complete') {
                  weeklyData = data.data;

                  logger.info('MEAL_PLAN_GENERATION_PIPELINE', 'SSE complete event received', {
                    weekNumber: plan.weekNumber,
                    totalDays: receivedDays.length,
                    hasWeeklySummary: !!data.data.weekly_summary,
                    sessionId: currentSessionId,
                    timestamp: new Date().toISOString()
                  });

                  // Update plan with weekly summary
                  set((currentState) => ({
                    mealPlanCandidates: currentState.mealPlanCandidates.map((p, idx) =>
                      idx === i ? {
                        ...p,
                        status: 'ready' as const,
                        weeklySummary: weeklyData.weekly_summary,
                        nutritionalHighlights: weeklyData.nutritional_highlights,
                        shoppingOptimization: weeklyData.shopping_optimization,
                        avgCaloriesPerDay: weeklyData.avg_calories_per_day,
                        aiExplanation: weeklyData.ai_explanation?.personalizedReasoning
                      } : p
                    ),
                    lastStateUpdate: Date.now()
                  }));

                  logger.info('MEAL_PLAN_GENERATION_PIPELINE', 'Week completed', {
                    weekNumber: plan.weekNumber,
                    avgCaloriesPerDay: weeklyData.avg_calories_per_day
                  });
                }
              } catch (parseError) {
                logger.error('MEAL_PLAN_GENERATION_PIPELINE', 'Failed to parse SSE data', {
                  error: parseError instanceof Error ? parseError.message : String(parseError),
                  line,
                  linePreview: line.substring(0, 200),
                  sessionId: currentSessionId,
                  timestamp: new Date().toISOString()
                });
              }
            }
          }
        }
      }

      // Get the updated plans from the store
      const finalPlans = get().mealPlanCandidates;
      const totalDaysReceived = finalPlans.reduce((sum, p) => sum + (p.days?.length || 0), 0);

      logger.info('MEAL_PLAN_GENERATION_PIPELINE', 'Meal plan generation complete, waiting for enrichments', {
        planCount: config.weekCount,
        totalDaysReceived,
        enrichedMealsCount: get().enrichedMealsCount,
        totalMealsToEnrich: get().totalMealsToEnrich,
        imagesGeneratedCount: get().imagesGeneratedCount,
        totalImagesToGenerate: get().totalImagesToGenerate,
        sessionId: currentSessionId,
        timestamp: new Date().toISOString()
      });

      // Wait for all enrichments to complete (with timeout)
      set({
        loadingState: 'enriching',
        loadingMessage: 'Enrichissement des recettes en cours...',
        simulatedOverallProgress: 60
      });

      const startWaitTime = Date.now();
      const maxRecipeWaitTime = 120000; // 2 minutes max wait for recipes
      const maxImageWaitTime = 60000; // 1 minute additional wait for images after recipes are done
      const checkInterval = 500; // Check every 500ms

      // PHASE 1: Wait for recipes (mandatory - higher priority)
      while (get().enrichedMealsCount < get().totalMealsToEnrich) {
        const elapsed = Date.now() - startWaitTime;

        if (elapsed > maxRecipeWaitTime) {
          logger.warn('MEAL_PLAN_GENERATION_PIPELINE', 'Recipe enrichment timeout, proceeding anyway', {
            enrichedMealsCount: get().enrichedMealsCount,
            totalMealsToEnrich: get().totalMealsToEnrich,
            elapsedMs: elapsed
          });
          break;
        }

        // Update progress - recipes are 60% to 85%
        const progressPercent = 60 + (get().enrichedMealsCount / get().totalMealsToEnrich) * 25;
        set({
          simulatedOverallProgress: Math.round(progressPercent),
          loadingMessage: `Enrichissement ${get().enrichedMealsCount}/${get().totalMealsToEnrich} recettes...`
        });

        await new Promise(resolve => setTimeout(resolve, checkInterval));
      }

      logger.info('MEAL_PLAN_GENERATION_PIPELINE', 'Recipe enrichments complete, waiting for images', {
        enrichedMealsCount: get().enrichedMealsCount,
        totalMealsToEnrich: get().totalMealsToEnrich,
        imagesGeneratedCount: get().imagesGeneratedCount,
        totalImagesToGenerate: get().totalImagesToGenerate,
        sessionId: currentSessionId,
        timestamp: new Date().toISOString()
      });

      // PHASE 2: Wait for images (optional - lower priority, shorter timeout)
      // Continue waiting but with a shorter timeout since images are less critical
      const imageWaitStartTime = Date.now();
      set({
        loadingMessage: 'Génération des images en cours...',
        simulatedOverallProgress: 85
      });

      while (get().imagesGeneratedCount < get().totalImagesToGenerate) {
        const elapsed = Date.now() - imageWaitStartTime;

        if (elapsed > maxImageWaitTime) {
          logger.warn('MEAL_PLAN_GENERATION_PIPELINE', 'Image generation timeout, proceeding to validation', {
            imagesGeneratedCount: get().imagesGeneratedCount,
            totalImagesToGenerate: get().totalImagesToGenerate,
            elapsedMs: elapsed,
            note: 'Images will continue generating in background via Realtime'
          });
          break;
        }

        // Update progress - images are 85% to 95%
        const progressPercent = 85 + (get().imagesGeneratedCount / get().totalImagesToGenerate) * 10;
        set({
          simulatedOverallProgress: Math.round(progressPercent),
          loadingMessage: `Génération ${get().imagesGeneratedCount}/${get().totalImagesToGenerate} images...`
        });

        await new Promise(resolve => setTimeout(resolve, checkInterval));
      }

      logger.info('MEAL_PLAN_GENERATION_PIPELINE', 'All enrichments complete, transitioning to validation', {
        enrichedMealsCount: get().enrichedMealsCount,
        totalMealsToEnrich: get().totalMealsToEnrich,
        imagesGeneratedCount: get().imagesGeneratedCount,
        totalImagesToGenerate: get().totalImagesToGenerate,
        sessionId: currentSessionId,
        timestamp: new Date().toISOString()
      });

      // Sauvegarder automatiquement la progression dans la base de données
      if (currentSessionId) {
        await mealPlanProgressService.saveValidationProgress(
          currentSessionId,
          get().mealPlanCandidates
        );
      }

      // FIXED: Transition to recipe_details_validation since recipes are enriched
      // Previously went to 'validation' which shows basic plan without recipe details
      set({
        loadingState: 'idle',
        currentStep: 'recipe_details_validation',
        simulatedOverallProgress: 100,
        loadingMessage: 'Plan complet généré avec succès !',
        lastStateUpdate: Date.now()
      });

      logger.info('MEAL_PLAN_GENERATION_PIPELINE', 'All meal plans generated successfully', {
        planCount: config.weekCount,
        sessionId: currentSessionId,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        logger.info('MEAL_PLAN_GENERATION_PIPELINE', 'Generation cancelled by user', {
          sessionId: currentSessionId,
          timestamp: new Date().toISOString()
        });

        set({
          loadingState: 'idle',
          isCancelling: false,
          abortController: null
        });

        return;
      }

      logger.error('MEAL_PLAN_GENERATION_PIPELINE', 'Generation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        sessionId: currentSessionId,
        timestamp: new Date().toISOString()
      });

      set({
        loadingState: 'idle',
        currentStep: 'configuration',
        abortController: null,
        isCancelling: false
      });

      throw error;
    } finally {
      // Cleanup AbortController
      set({ abortController: null });
    }
  },

  updateMealWithDetailedRecipe: (planId: string, mealId: string, detailedRecipe: any) => {
    set(state => ({
      mealPlanCandidates: state.mealPlanCandidates.map((p) =>
        p.id === planId
          ? {
              ...p,
              days: p.days.map((d) => ({
                ...d,
                meals: d.meals.map((m) =>
                  m.id === mealId
                    ? {
                        ...m,
                        recipeGenerated: true,
                        detailedRecipe
                      }
                    : m
                )
              }))
            }
          : p
      ),
      lastStateUpdate: Date.now()
    }));
  },

  saveMealPlans: async (withRecipes: boolean) => {
    const state = get();
    const { mealPlanCandidates, currentSessionId, config } = state;
    const { session } = useUserStore.getState();
    const userId = session?.user?.id;

    if (!userId) {
      throw new Error('Utilisateur non authentifié');
    }

    set({ loadingState: 'saving' });

    logger.info('MEAL_PLAN_GENERATION_PIPELINE', 'Starting meal plans save operation', {
      planCount: mealPlanCandidates.length,
      sessionId: currentSessionId,
      sessionIdType: typeof currentSessionId,
      sessionIdLength: currentSessionId?.length,
      userId,
      withRecipes,
      timestamp: new Date().toISOString()
    });

    try {
      // Save each meal plan to Supabase
      for (const plan of mealPlanCandidates) {
        logger.debug('MEAL_PLAN_GENERATION_PIPELINE', 'Inserting meal plan to database', {
          planWeekNumber: plan.weekNumber,
          sessionId: currentSessionId,
          inventorySessionId: config.selectedInventoryId,
          daysCount: plan.days.length,
          timestamp: new Date().toISOString()
        });

        const { data: mealPlanData, error: planError } = await supabase
          .from('meal_plans')
          .insert({
            session_id: currentSessionId,
            user_id: userId,
            inventory_session_id: config.selectedInventoryId,
            week_number: plan.weekNumber,
            start_date: plan.startDate,
            end_date: plan.endDate,
            batch_cooking_enabled: plan.batchCookingEnabled,
            ai_explanation: plan.aiExplanation,
            nutritional_summary: plan.nutritionalSummary,
            title: plan.title,
            status: 'completed',
            is_archived: false,
            plan_data: { days: plan.days }
          })
          .select()
          .single();

        if (planError) {
          logger.error('MEAL_PLAN_GENERATION_PIPELINE', 'Database insert error', {
            error: planError.message,
            code: planError.code,
            details: planError.details,
            hint: planError.hint,
            planWeekNumber: plan.weekNumber,
            sessionId: currentSessionId,
            timestamp: new Date().toISOString()
          });
          throw planError;
        }

        logger.debug('MEAL_PLAN_GENERATION_PIPELINE', 'Meal plan saved', {
          planId: mealPlanData.id,
          weekNumber: plan.weekNumber,
          timestamp: new Date().toISOString()
        });
      }

      logger.info('MEAL_PLAN_GENERATION_PIPELINE', 'All meal plans saved successfully', {
        planCount: mealPlanCandidates.length,
        sessionId: currentSessionId,
        timestamp: new Date().toISOString()
      });

      // Mark session as completed but keep progress data for potential return
      if (currentSessionId) {
        await mealPlanProgressService.markSessionCompleted(currentSessionId);
      }

      // IMPORTANT: Do NOT reset pipeline after save - keep user on validation screen
      // This allows them to view their saved plan and navigate back if needed
      set({
        loadingState: 'idle',
        simulatedOverallProgress: 100
      });

      logger.info('MEAL_PLAN_GENERATION_PIPELINE', 'Meal plans saved, user remains on validation screen', {
        currentStep: state.currentStep,
        sessionId: currentSessionId,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('MEAL_PLAN_GENERATION_PIPELINE', 'Failed to save meal plans', {
        error: error instanceof Error ? error.message : 'Unknown error',
        errorStack: error instanceof Error ? error.stack : undefined,
        errorDetails: error,
        sessionId: currentSessionId,
        sessionIdType: typeof currentSessionId,
        planCount: mealPlanCandidates.length,
        timestamp: new Date().toISOString()
      });

      set({ loadingState: 'idle' });
      throw error;
    }
  },

  discardMealPlans: () => {
    const state = get();

    set({
      mealPlanCandidates: [],
      currentStep: 'configuration',
      simulatedOverallProgress: 0,
      loadingState: 'idle'
    });

    logger.info('MEAL_PLAN_GENERATION_PIPELINE', 'Meal plans discarded', {
      sessionId: state.currentSessionId,
      timestamp: new Date().toISOString()
    });
  },

  cancelGeneration: async () => {
    const state = get();
    const { abortController, currentSessionId } = state;

    logger.info('MEAL_PLAN_GENERATION_PIPELINE', 'Cancelling generation', {
      sessionId: currentSessionId,
      hasAbortController: !!abortController,
      timestamp: new Date().toISOString()
    });

    // Set cancelling flag to stop new enrichments
    set({
      isCancelling: true,
      loadingState: 'cancelling',
      loadingMessage: 'Arrêt en cours...'
    });

    // Abort ongoing fetch requests
    if (abortController) {
      abortController.abort();
      logger.info('MEAL_PLAN_GENERATION_PIPELINE', 'AbortController.abort() called', {
        sessionId: currentSessionId
      });
    }

    // Wait a bit for abort to propagate
    await new Promise(resolve => setTimeout(resolve, 500));

    logger.info('MEAL_PLAN_GENERATION_PIPELINE', 'Generation cancelled successfully', {
      sessionId: currentSessionId,
      timestamp: new Date().toISOString()
    });

    // State cleanup is handled by the catch block in generateMealPlans
  },

  updateMealPlanStatus: (planId: string, status: 'loading' | 'ready') => {
    set(state => ({
      mealPlanCandidates: state.mealPlanCandidates.map(p =>
        p.id === planId ? { ...p, status } : p
      )
    }));
  },

  updateMealStatus: (planId: string, mealId: string, status: 'loading' | 'ready', recipe?: any) => {
    set(state => ({
      mealPlanCandidates: state.mealPlanCandidates.map(p =>
        p.id === planId
          ? {
              ...p,
              days: p.days.map(d => ({
                ...d,
                meals: d.meals.map(m =>
                  m.id === mealId
                    ? { ...m, status, recipe, recipeGenerated: !!recipe }
                    : m
                )
              }))
            }
          : p
      )
    }));
  },

  updateMealImageUrl: (recipeId: string, imageUrl: string) => {
    logger.info('MEAL_PLAN_GENERATION_PIPELINE', '🖼️ IMAGE GENERATION COMPLETE - Updating meal image URL', {
      recipeId,
      imageUrl,
      timestamp: new Date().toISOString()
    });

    // LOG CURRENT STATE BEFORE UPDATE
    const beforeState = get();
    logger.info('MEAL_PLAN_GENERATION_PIPELINE', '📊 STATE BEFORE IMAGE UPDATE', {
      recipeId,
      candidatesCount: beforeState.mealPlanCandidates.length,
      allMeals: beforeState.mealPlanCandidates.flatMap((plan, planIdx) =>
        plan.days.flatMap((day, dayIdx) =>
          day.meals.map(meal => ({
            planIdx,
            dayIdx,
            mealId: meal.id,
            mealName: meal.name,
            recipeId: meal.detailedRecipe?.id,
            hasDetailedRecipe: !!meal.detailedRecipe,
            currentImageUrl: meal.detailedRecipe?.imageUrl,
            recipeGenerated: meal.recipeGenerated
          }))
        )
      ),
      timestamp: new Date().toISOString()
    });

    let mealFound = false;
    let mealInfo: any = null;

    set(state => {
      const updatedState = {
        mealPlanCandidates: state.mealPlanCandidates.map(plan => ({
          ...plan,
          days: plan.days.map(day => ({
            ...day,
            meals: day.meals.map(meal => {
              if (meal.detailedRecipe?.id === recipeId) {
                mealFound = true;
                mealInfo = {
                  mealId: meal.id,
                  mealName: meal.name,
                  mealType: meal.type,
                  recipeId,
                  previousImageUrl: meal.detailedRecipe.imageUrl,
                  newImageUrl: imageUrl
                };

                logger.info('MEAL_PLAN_GENERATION_PIPELINE', '✅ MATCHED MEAL - Applying image URL', {
                  mealId: meal.id,
                  mealName: meal.name,
                  mealType: meal.type,
                  recipeId,
                  previousImageUrl: meal.detailedRecipe.imageUrl,
                  newImageUrl: imageUrl,
                  hasDetailedRecipe: !!meal.detailedRecipe,
                  recipeGenerated: meal.recipeGenerated,
                  status: meal.status,
                  timestamp: new Date().toISOString()
                });

                return {
                  ...meal,
                  imageUrl, // Set at meal level for library display
                  detailedRecipe: {
                    ...meal.detailedRecipe,
                    imageUrl // Also set at detailedRecipe level
                  }
                };
              }
              return meal;
            })
          }))
        })),
        lastStateUpdate: Date.now()
      };

      if (mealFound && mealInfo) {
        logger.info('MEAL_PLAN_GENERATION_PIPELINE', '✅ IMAGE URL UPDATED SUCCESSFULLY', {
          ...mealInfo,
          timestamp: new Date().toISOString()
        });
      } else {
        logger.warn('MEAL_PLAN_GENERATION_PIPELINE', '⚠️ IMAGE UPDATE FAILED - Recipe not found in any meal', {
          recipeId,
          imageUrl,
          candidatesCount: state.mealPlanCandidates.length,
          totalMeals: state.mealPlanCandidates.reduce((sum, p) =>
            sum + p.days.reduce((dSum, d) => dSum + d.meals.length, 0), 0
          ),
          timestamp: new Date().toISOString()
        });
      }

      return updatedState;
    });
  },

  loadProgressFromDatabase: async () => {
    const { session } = useUserStore.getState();
    const userId = session?.user?.id;

    if (!userId) {
      logger.error('MEAL_PLAN_GENERATION_PIPELINE', 'Cannot load progress: User not authenticated');
      return false;
    }

    try {
      const summary = await mealPlanProgressService.getProgressSummary(userId);

      if (!summary.hasSession || !summary.sessionId) {
        logger.info('MEAL_PLAN_GENERATION_PIPELINE', 'No saved progress found');
        return false;
      }

      logger.info('MEAL_PLAN_GENERATION_PIPELINE', 'Loading progress from database', {
        sessionId: summary.sessionId,
        currentStep: summary.currentStep
      });

      if (summary.currentStep === 'validation') {
        const data = await mealPlanProgressService.loadValidationProgress(summary.sessionId);
        if (!data) return false;

        set({
          currentSessionId: summary.sessionId,
          config: data.config,
          mealPlanCandidates: data.mealPlans,
          currentStep: 'validation',
          isActive: true,
          loadingState: 'idle',
          simulatedOverallProgress: 60
        });

        logger.info('MEAL_PLAN_GENERATION_PIPELINE', 'Validation progress loaded successfully');
        return true;
      }

      if (summary.currentStep === 'recipe_details_generating') {
        const data = await mealPlanProgressService.loadRecipesProgress(summary.sessionId);
        if (!data) return false;

        set({
          currentSessionId: summary.sessionId,
          config: data.config,
          mealPlanCandidates: data.mealPlans,
          currentStep: 'recipe_details_generating',
          isActive: true,
          loadingState: 'idle',
          simulatedOverallProgress: 70
        });

        logger.info('MEAL_PLAN_GENERATION_PIPELINE', 'Recipe generation progress loaded successfully');
        return true;
      }

      if (summary.currentStep === 'recipe_details_validation') {
        const data = await mealPlanProgressService.loadRecipesProgress(summary.sessionId);
        if (!data) return false;

        set({
          currentSessionId: summary.sessionId,
          config: data.config,
          mealPlanCandidates: data.mealPlans,
          currentStep: 'recipe_details_validation',
          isActive: true,
          loadingState: 'idle',
          simulatedOverallProgress: 95
        });

        logger.info('MEAL_PLAN_GENERATION_PIPELINE', 'Recipe details progress loaded successfully');
        return true;
      }

      return false;
    } catch (error) {
      logger.error('MEAL_PLAN_GENERATION_PIPELINE', 'Failed to load progress from database', { error });
      return false;
    }
  },

  clearSavedProgress: async () => {
    const state = get();
    const { currentSessionId } = state;
    const { session } = useUserStore.getState();
    const userId = session?.user?.id;

    if (!userId) {
      logger.error('MEAL_PLAN_GENERATION_PIPELINE', 'Cannot clear progress: User not authenticated');
      return;
    }

    try {
      if (currentSessionId) {
        await mealPlanProgressService.deleteProgress(currentSessionId);
        logger.info('MEAL_PLAN_GENERATION_PIPELINE', 'Saved progress cleared', { sessionId: currentSessionId });
      }
    } catch (error) {
      logger.error('MEAL_PLAN_GENERATION_PIPELINE', 'Failed to clear saved progress', { error });
    }
  }
});
