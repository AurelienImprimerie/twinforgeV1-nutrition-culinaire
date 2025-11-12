/**
 * Plan Generation Module
 * Handles meal plan generation and regeneration
 */

import { supabase } from '../../../../supabase/client';
import { useUserStore } from '../../../userStore';
import logger from '../../../../../lib/utils/logger';
import type { MealPlanData, MealPlanDay } from '../../types';
import { getWeekStartDate, transformEdgeDayToFrontendDay } from '../../constants';
import { createSkeletonDay } from './helpers';

/**
 * Generate meal plan for a specific week
 */
export const generateMealPlanCore = async (
  weekNumber: number,
  inventory: any[] | undefined,
  selectedInventoryId: string | null,
  referenceStartDate: string | null,
  onProgress: (progress: number, title?: string, subtitle?: string, message?: string) => void,
  onComplete: (plan: MealPlanData) => void,
  onError: (error: Error) => void,
  startProgressSimulation: () => void,
  stopProgressSimulation: () => void
) => {
  if (!selectedInventoryId) {
    logger.error('MEAL_PLAN_STORE', 'No inventory selected for meal plan generation');
    return;
  }

  try {
    onProgress(0, 'Initialisation', 'Préparation de votre plan personnalisé', 'Démarrage de la génération...');

    // Calculate week dates using reference date
    const weekStartDate = getWeekStartDate(weekNumber, referenceStartDate);
    const skeletonDays: MealPlanDay[] = [];

    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(weekStartDate);
      currentDate.setDate(weekStartDate.getDate() + i);
      const dateString = currentDate.toISOString().split('T')[0];
      const dayName = currentDate.toLocaleDateString('fr-FR', { weekday: 'long' });

      skeletonDays.push(createSkeletonDay(dateString, dayName));
    }

    // Initialize skeleton plan immediately
    const skeletonPlan: MealPlanData = {
      id: `week-${weekNumber}-skeleton`,
      weekNumber,
      startDate: weekStartDate.toISOString().split('T')[0],
      days: skeletonDays,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    onComplete(skeletonPlan);

    logger.info('MEAL_PLAN_STORE', 'Skeleton plan initialized', {
      weekNumber,
      skeletonDaysCount: skeletonDays.length,
      timestamp: new Date().toISOString()
    });

    // Start progress simulation
    startProgressSimulation();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const userProfile = useUserStore.getState().profile;
    if (!userProfile) throw new Error('User profile not found');

    logger.info('MEAL_PLAN_STORE', 'Starting meal plan generation', {
      weekNumber,
      inventoryId: selectedInventoryId,
      userId: user.id,
      timestamp: new Date().toISOString()
    });

    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setDate(weekStartDate.getDate() + 6);

    // Get session for authentication
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('No session found');

    // Create AbortController for timeout management
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 180000); // 3 minutes timeout

    let response: Response;
    try {
      response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/meal-plan-generator`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: user.id,
          week_number: weekNumber,
          start_date: weekStartDate.toISOString().split('T')[0],
          end_date: weekEndDate.toISOString().split('T')[0],
          inventory_count: inventory?.length || 0,
          has_preferences: !!userProfile
        }),
        signal: controller.signal
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        throw new Error('La génération du plan prend trop de temps. Veuillez réessayer.');
      }
      throw fetchError;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    if (!response.body) {
      throw new Error('No response body');
    }

    // Handle SSE stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    let transformedDays: MealPlanDay[] = [];
    let planId = `week-${weekNumber}-${Date.now()}`;
    let nutritionalSummary: any = null;
    let estimatedWeeklyCost: number | null = null;
    let batchCookingDays: string[] = [];
    let aiExplanation: any = null;
    let streamCompleted = false;
    let lastEventTime = Date.now();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          streamCompleted = true;
          break;
        }

        lastEventTime = Date.now();
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === 'day') {
                const transformedDay = transformEdgeDayToFrontendDay(data.data);
                transformedDays.push(transformedDay);

                // Replace skeleton day with real day
                const updatedDays = skeletonDays.map(skeletonDay => {
                  const matchingRealDay = transformedDays.find(rd => rd.date === skeletonDay.date);
                  return matchingRealDay || skeletonDay;
                });

                const updatedPlan = {
                  ...skeletonPlan,
                  days: updatedDays,
                  updatedAt: new Date().toISOString()
                };

                onComplete(updatedPlan);

                // Calculate progress based on received days: each day = ~11% (7 days = ~77%), leaving 23% for initialization and finalization
                const readyDaysCount = transformedDays.filter(d => d.status === 'ready').length;
                const daysProgress = Math.floor((readyDaysCount / 7) * 77);
                const totalProgress = Math.min(90, 10 + daysProgress); // Start at 10%, max 87% for days

                onProgress(
                  totalProgress,
                  readyDaysCount < 7 ? 'Génération en cours' : 'Finalisation',
                  readyDaysCount < 7 ? `${readyDaysCount} jour${readyDaysCount > 1 ? 's' : ''} sur 7 généré${readyDaysCount > 1 ? 's' : ''}` : 'Derniers ajustements',
                  readyDaysCount < 7 ? `Création du jour ${readyDaysCount + 1}...` : 'Optimisation finale...'
                );

                logger.info('MEAL_PLAN_STORE', 'Day received and skeleton replaced', {
                  date: transformedDay.date,
                  dayName: transformedDay.dayName,
                  readyDaysCount,
                  progress: totalProgress,
                  timestamp: new Date().toISOString()
                });
              } else if (data.type === 'complete') {
                planId = data.data.id || planId;
                nutritionalSummary = data.data.nutritional_summary;
                estimatedWeeklyCost = data.data.estimated_weekly_cost;
                batchCookingDays = data.data.batch_cooking_days || [];
                aiExplanation = data.data.ai_explanation || null;
                streamCompleted = true;
              }
            } catch (parseError) {
              logger.warn('MEAL_PLAN_STORE', 'Failed to parse SSE data', {
                line: line,
                error: parseError instanceof Error ? parseError.message : 'Unknown error',
                timestamp: new Date().toISOString()
              });
            }
          }
        }
      }
    } catch (streamError) {
      logger.error('MEAL_PLAN_STORE', 'Stream reading error', {
        error: streamError instanceof Error ? streamError.message : 'Unknown error',
        transformedDaysCount: transformedDays.length,
        streamCompleted,
        timestamp: new Date().toISOString()
      });

      // If we received some days but stream failed, try to recover
      if (transformedDays.length > 0 && !streamCompleted) {
        logger.warn('MEAL_PLAN_STORE', 'Attempting to recover partial plan', {
          daysReceived: transformedDays.length,
          timestamp: new Date().toISOString()
        });
        // Continue with partial data instead of throwing
      } else {
        throw streamError;
      }
    } finally {
      reader.releaseLock();
    }

    const readyDays = transformedDays.filter(d => d.status === 'ready');

    // Fallback: if stream failed but we have some days, try to fetch complete plan from database
    if (readyDays.length === 0 || !streamCompleted) {
      logger.warn('MEAL_PLAN_STORE', 'Incomplete plan received, attempting database recovery', {
        receivedDays: transformedDays.length,
        streamCompleted,
        timestamp: new Date().toISOString()
      });

      try {
        // Wait a moment for backend to save
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Try to fetch the latest plan from database
        const { data: savedPlans, error: fetchError } = await supabase
          .from('meal_plans')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1);

        if (!fetchError && savedPlans && savedPlans.length > 0) {
          const savedPlan = savedPlans[0].plan_data;
          if (savedPlan && savedPlan.days && savedPlan.days.length === 7) {
            logger.info('MEAL_PLAN_STORE', 'Successfully recovered plan from database', {
              planId: savedPlans[0].id,
              daysCount: savedPlan.days.length,
              timestamp: new Date().toISOString()
            });

            // Transform and use the saved plan
            const recoveredDays = savedPlan.days.map((day: any) => transformEdgeDayToFrontendDay(day));

            const recoveredPlanData: MealPlanData = {
              id: savedPlans[0].id,
              weekNumber,
              startDate: weekStartDate.toISOString().split('T')[0],
              days: recoveredDays,
              createdAt: savedPlans[0].created_at,
              updatedAt: savedPlans[0].updated_at,
              nutritionalSummary: savedPlan.nutritional_highlights,
              estimatedWeeklyCost: savedPlan.estimated_weekly_cost,
              batchCookingDays: savedPlan.batch_cooking_days || [],
              aiExplanation: savedPlan.ai_explanation
            };

            onProgress(100, 'Terminé !', 'Votre plan est prêt', 'Plan de repas récupéré avec succès');
            onComplete(recoveredPlanData);
            stopProgressSimulation();

            return recoveredPlanData;
          }
        }
      } catch (recoveryError) {
        logger.error('MEAL_PLAN_STORE', 'Failed to recover plan from database', {
          error: recoveryError instanceof Error ? recoveryError.message : 'Unknown error',
          timestamp: new Date().toISOString()
        });
      }

      throw new Error('Aucun jour de plan reçu. Le plan a peut-être été généré côté serveur, veuillez actualiser la page.');
    }

    const mealPlanData: MealPlanData = {
      id: planId,
      weekNumber,
      startDate: weekStartDate.toISOString().split('T')[0],
      days: transformedDays,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      nutritionalSummary,
      estimatedWeeklyCost,
      batchCookingDays,
      aiExplanation
    };

    // Final progress update
    onProgress(100, 'Terminé !', 'Votre plan est prêt', 'Plan de repas généré avec succès');
    onComplete(mealPlanData);

    // Stop progress simulation
    stopProgressSimulation();

    logger.info('MEAL_PLAN_STORE', 'Meal plan generation completed', {
      weekNumber,
      planId: mealPlanData.id,
      daysCount: readyDays.length,
      timestamp: new Date().toISOString()
    });

    // Award XP for meal plan generation
    try {
      const { useForgeXpRewards } = await import('../../../../../hooks/useForgeXpRewards');
      const { awardForgeXpSilently } = useForgeXpRewards();
      await awardForgeXpSilently('meal_plan_generated');

      // Force immediate refresh of gaming widget
      const { queryClient } = await import('../../../../../app/providers/AppProviders');
      await queryClient.invalidateQueries({ queryKey: ['gamification-progress'] });
      await queryClient.invalidateQueries({ queryKey: ['xp-events'] });
      await queryClient.invalidateQueries({ queryKey: ['daily-actions'] });

      logger.info('MEAL_PLAN_STORE', 'XP awarded and gaming widget refreshed', {
        action: 'meal_plan_generated',
        xpAwarded: 35,
        weekNumber,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.warn('MEAL_PLAN_STORE', 'Failed to award XP for meal plan', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    return mealPlanData;

  } catch (error) {
    stopProgressSimulation();
    onError(error instanceof Error ? error : new Error('Unknown error'));
    logger.error('MEAL_PLAN_STORE', 'Meal plan generation failed', {
      weekNumber,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
    throw error;
  }
};
