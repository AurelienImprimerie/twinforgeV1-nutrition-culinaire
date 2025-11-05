import type { StateCreator } from 'zustand';
import type { MealPlanGenerationPipelineState, MealPlan } from '../types';
import { supabase } from '../../../supabase/client';
import { useUserStore } from '../../userStore';
import logger from '../../../../lib/utils/logger';
import { nanoid } from 'nanoid';
import { mealPlanProgressService } from '../../../services/mealPlanProgressService';

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
}

async function triggerImageGeneration(params: ImageGenerationParams): Promise<void> {
  const { recipeId, recipeDetails, imageSignature, userId, accessToken, planId, dayIndex, mealId } = params;

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
      })
    });

    if (response.ok) {
      const result = await response.json();

      logger.info('MEAL_PLAN_GENERATION_PIPELINE', 'Background image generation successful', {
        recipeId,
        imageUrl: result.image_url,
        generationMethod: result.generation_method,
        cached: result.cache_hit,
        costUsd: result.cost_usd,
        timestamp: new Date().toISOString()
      });

      // Note: We don't update the state here since the image is stored in the database
      // and will be fetched when the meal plan is loaded
    } else {
      logger.error('MEAL_PLAN_GENERATION_PIPELINE', 'Background image generation failed', {
        recipeId,
        status: response.status,
        statusText: response.statusText
      });
    }
  } catch (error) {
    logger.error('MEAL_PLAN_GENERATION_PIPELINE', 'Background image generation error', {
      recipeId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

export interface GenerationActions {
  generateMealPlans: () => Promise<void>;
  generateDetailedRecipes: () => Promise<void>;
  saveMealPlans: (withRecipes: boolean) => Promise<void>;
  discardMealPlans: () => void;
  updateMealPlanStatus: (planId: string, status: 'loading' | 'ready') => void;
  updateMealStatus: (planId: string, mealId: string, status: 'loading' | 'ready', recipe?: any) => void;
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
          })
        });

        if (!response.ok) {
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
                  // Use set() with a callback to ensure we get the latest state
                  set((currentState) => {
                    const totalDays = currentState.totalDaysToGenerate;
                    const newReceivedCount = (i * 7) + receivedDays.length;
                    const progressPercent = 5 + (newReceivedCount / totalDays) * 70; // 5% to 75%

                    return {
                      mealPlanCandidates: currentState.mealPlanCandidates.map((p, idx) =>
                        idx === i ? {
                          ...p,
                          days: receivedDays.map((day, dayIdx) => ({
                            date: day.date,
                            dayIndex: dayIdx,
                            meals: [
                              {
                                id: nanoid(),
                                type: 'breakfast',
                                name: day.breakfast?.title || 'Petit-déjeuner',
                                description: day.breakfast?.description,
                                ingredients: day.breakfast?.ingredients,
                                prepTime: day.breakfast?.prep_time_min,
                                cookTime: day.breakfast?.cook_time_min,
                                calories: day.breakfast?.calories_est,
                                status: 'ready' as const,
                                recipeGenerated: false
                              },
                              {
                                id: nanoid(),
                                type: 'lunch',
                                name: day.lunch?.title || 'Déjeuner',
                                description: day.lunch?.description,
                                ingredients: day.lunch?.ingredients,
                                prepTime: day.lunch?.prep_time_min,
                                cookTime: day.lunch?.cook_time_min,
                                calories: day.lunch?.calories_est,
                                status: 'ready' as const,
                                recipeGenerated: false
                              },
                              {
                                id: nanoid(),
                                type: 'dinner',
                                name: day.dinner?.title || 'Dîner',
                                description: day.dinner?.description,
                                ingredients: day.dinner?.ingredients,
                                prepTime: day.dinner?.prep_time_min,
                                cookTime: day.dinner?.cook_time_min,
                                calories: day.dinner?.calories_est,
                                status: 'ready' as const,
                                recipeGenerated: false
                              }
                            ]
                          })),
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

      logger.info('MEAL_PLAN_GENERATION_PIPELINE', 'Transitioning to validation step', {
        planCount: config.weekCount,
        totalDaysReceived,
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

      set({
        loadingState: 'idle',
        currentStep: 'validation',
        simulatedOverallProgress: 60,
        loadingMessage: 'Plan généré avec succès !',
        lastStateUpdate: Date.now()
      });

      logger.info('MEAL_PLAN_GENERATION_PIPELINE', 'All meal plans generated successfully', {
        planCount: config.weekCount,
        sessionId: currentSessionId,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('MEAL_PLAN_GENERATION_PIPELINE', 'Generation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        sessionId: currentSessionId,
        timestamp: new Date().toISOString()
      });

      set({
        loadingState: 'idle',
        currentStep: 'configuration'
      });

      throw error;
    }
  },

  generateDetailedRecipes: async () => {
    const state = get();
    const { mealPlanCandidates, currentSessionId } = state;

    const { session } = useUserStore.getState();
    const userId = session?.user?.id;

    if (!userId) {
      throw new Error('Utilisateur non authentifié');
    }

    logger.info('MEAL_PLAN_GENERATION_PIPELINE', 'Starting detailed recipe generation', {
      planCount: mealPlanCandidates.length,
      sessionId: currentSessionId,
      timestamp: new Date().toISOString()
    });

    // CRITICAL: Transition to recipe_details_generating step
    set(state => ({
      currentStep: 'recipe_details_generating',
      loadingState: 'generating_recipes',
      loadingMessage: 'Préparation de la génération des recettes...',
      simulatedOverallProgress: 65,
      processedRecipesCount: 0,
      mealPlanCandidates: state.mealPlanCandidates.map(plan => ({
        ...plan,
        days: plan.days.map(day => ({
          ...day,
          meals: day.meals.map(meal => ({
            ...meal,
            status: 'loading' as const
          }))
        }))
      })),
      lastStateUpdate: Date.now()
    }));

    try {
      // Count total meals first
      let totalMeals = 0;
      let processedMeals = 0;

      for (const plan of mealPlanCandidates) {
        for (const day of plan.days) {
          totalMeals += day.meals?.length || 0;
        }
      }

      // Get user profile for preferences
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

      logger.info('MEAL_PLAN_GENERATION_PIPELINE', 'Transitioning to recipe streaming phase', {
        totalMeals,
        sessionId: currentSessionId,
        timestamp: new Date().toISOString()
      });

      set({
        loadingState: 'streaming_recipes',
        currentStep: 'recipe_details_generating',
        simulatedOverallProgress: 70,
        totalRecipesToGenerate: totalMeals,
        lastStateUpdate: Date.now()
      });

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/recipe-detail-generator`;

      // Generate recipes for each meal with streaming
      for (const plan of mealPlanCandidates) {
        for (const day of plan.days) {
          for (const meal of day.meals || []) {
            if (!meal) continue;

            logger.info('MEAL_PLAN_GENERATION_PIPELINE', 'Generating detailed recipe', {
              planId: plan.id,
              dayIndex: day.dayIndex,
              mealName: meal.name,
              mealType: meal.type,
              progress: `${processedMeals + 1}/${totalMeals}`,
              sessionId: currentSessionId,
              timestamp: new Date().toISOString()
            });

            try {
              const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${session?.access_token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  user_id: userId,
                  meal_title: meal.name,
                  main_ingredients: meal.ingredients || [],
                  user_preferences: userPreferences,
                  meal_type: meal.type,
                  target_calories: meal.calories
                })
              });

              if (response.ok) {
                const result = await response.json();
                const detailedRecipe = result.recipe;

                // Update meal with detailed recipe immediately (streaming effect) + force UI update
                processedMeals++;
                const progress = 70 + (processedMeals / totalMeals) * 20; // 70% to 90%

                set(state => ({
                  mealPlanCandidates: state.mealPlanCandidates.map(p =>
                    p.id === plan.id
                      ? {
                          ...p,
                          days: p.days.map(d =>
                            d.dayIndex === day.dayIndex
                              ? {
                                  ...d,
                                  meals: (d.meals || []).map(m =>
                                    m.id === meal.id
                                      ? {
                                          ...m,
                                          status: 'ready' as const,
                                          recipeGenerated: true,
                                          detailedRecipe: {
                                            id: detailedRecipe.id,
                                            title: detailedRecipe.title,
                                            description: detailedRecipe.description,
                                            ingredients: detailedRecipe.ingredients,
                                            instructions: detailedRecipe.instructions,
                                            prepTime: detailedRecipe.prepTimeMin,
                                            cookTime: detailedRecipe.cookTimeMin,
                                            servings: detailedRecipe.servings,
                                            nutritionalInfo: detailedRecipe.nutritionalInfo,
                                            dietaryTags: detailedRecipe.dietaryTags,
                                            difficulty: detailedRecipe.difficulty,
                                            tips: detailedRecipe.tips,
                                            variations: detailedRecipe.variations,
                                            imageSignature: detailedRecipe.imageSignature,
                                            imageUrl: undefined, // Will be populated by background process
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
                  simulatedOverallProgress: Math.round(progress),
                  processedRecipesCount: processedMeals,
                  loadingMessage: `Génération des recettes... ${processedMeals}/${totalMeals}`,
                  lastStateUpdate: Date.now()
                }));

                logger.info('MEAL_PLAN_GENERATION_PIPELINE', 'Recipe generated and displayed', {
                  mealName: meal.name,
                  recipeTitle: detailedRecipe.title,
                  progress: `${processedMeals}/${totalMeals}`,
                  percentComplete: Math.round((processedMeals / totalMeals) * 100),
                  cached: result.cached,
                  sessionId: currentSessionId,
                  timestamp: new Date().toISOString()
                });

                // Trigger image generation in background (non-blocking)
                if (detailedRecipe.imageSignature) {
                  triggerImageGeneration({
                    recipeId: detailedRecipe.id,
                    recipeDetails: detailedRecipe,
                    imageSignature: detailedRecipe.imageSignature,
                    userId,
                    accessToken: session?.access_token || '',
                    planId: plan.id,
                    dayIndex: day.dayIndex,
                    mealId: meal.id
                  }).catch(imgError => {
                    logger.error('MEAL_PLAN_GENERATION_PIPELINE', 'Background image generation failed', {
                      mealName: meal.name,
                      error: imgError instanceof Error ? imgError.message : 'Unknown'
                    });
                  });
                }
              } else {
                logger.error('MEAL_PLAN_GENERATION_PIPELINE', 'Recipe generation failed for meal', {
                  mealName: meal.name,
                  status: response.status
                });

                // Mark as failed but continue
                processedMeals++;
              }
            } catch (recipeError) {
              logger.error('MEAL_PLAN_GENERATION_PIPELINE', 'Recipe generation error', {
                mealName: meal.name,
                error: recipeError instanceof Error ? recipeError.message : 'Unknown'
              });

              // Mark as failed but continue
              processedMeals++;
            }
          }
        }
      }

      // Transition vers l'étape de validation finale
      set({
        loadingState: 'idle',
        currentStep: 'recipe_details_validation',
        simulatedOverallProgress: 95,
        loadingMessage: 'Toutes les recettes ont été générées avec succès !',
        lastStateUpdate: Date.now()
      });

      logger.info('MEAL_PLAN_GENERATION_PIPELINE', 'All detailed recipes generated', {
        totalMeals,
        processedMeals,
        sessionId: currentSessionId,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('MEAL_PLAN_GENERATION_PIPELINE', 'Recipe generation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        sessionId: currentSessionId,
        timestamp: new Date().toISOString()
      });

      set({
        loadingState: 'idle',
        currentStep: 'recipe_details_generating'
      });

      throw error;
    }
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
    logger.info('MEAL_PLAN_GENERATION_PIPELINE', 'Updating meal image URL in state', {
      recipeId,
      imageUrl,
      timestamp: new Date().toISOString()
    });

    set(state => ({
      mealPlanCandidates: state.mealPlanCandidates.map(plan => ({
        ...plan,
        days: plan.days.map(day => ({
          ...day,
          meals: day.meals.map(meal => {
            if (meal.detailedRecipe?.id === recipeId) {
              logger.debug('MEAL_PLAN_GENERATION_PIPELINE', 'Found matching meal, updating image', {
                mealName: meal.name,
                recipeId,
                imageUrl
              });

              return {
                ...meal,
                detailedRecipe: {
                  ...meal.detailedRecipe,
                  imageUrl
                }
              };
            }
            return meal;
          })
        }))
      })),
      lastStateUpdate: Date.now()
    }));
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
