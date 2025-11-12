import React from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { usePerformanceMode } from '../../../system/context/PerformanceModeContext';
import { useLocation } from 'react-router-dom';
import { mealsRepo } from '../../../system/data/repositories/mealsRepo';
import { useUserStore } from '../../../system/store/userStore';
import { format } from 'date-fns';
import logger from '../../../lib/utils/logger';
import ProfileCompletenessAlert from '../../../ui/components/profile/ProfileCompletenessAlert';
import DynamicScanCTA from './components/DailyRecap/DynamicScanCTA';
import DailyStatsGrid from './components/DailyRecap/DailyStatsGrid';
import CalorieProgressCard from './components/DailyRecap/CalorieProgressCard';
import MacronutrientsCard from './components/DailyRecap/MacronutrientsCard';
import RecentMealsCard from './components/DailyRecap/RecentMealsCard';
import DailyRecapSkeleton from './components/DailyRecap/DailyRecapSkeleton';
import { calculateIntelligentCalorieTarget, analyzeCalorieStatus } from './components/DailyRecap/CalorieAnalysis';
import { AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../../ui/components/ToastProvider';
import { useFeedback } from '../../../hooks/useFeedback';
import GlassCard from '../../../ui/cards/GlassCard';
import SpatialIcon from '../../../ui/icons/SpatialIcon';
import { ICONS } from '../../../ui/icons/registry';
import MealDetailModal from './components/shared/MealDetailModal';
import EmptyMealsScannerState from './components/DailyRecap/EmptyMealsScannerState';

/**
 * Daily Recap Tab - Récap Nutritionnel TwinForge
 * Affiche le résumé de la journée avec CTA pour scanner un nouveau repas
 */
interface DailyRecapTabProps {
  onLoadingChange?: (isLoading: boolean) => void;
}

const DailyRecapTab: React.FC<DailyRecapTabProps> = ({ onLoadingChange }) => {
  const location = useLocation();
  const { session, profile } = useUserStore();
  const { isPerformanceMode } = usePerformanceMode();
  const MotionDiv = isPerformanceMode ? 'div' : motion.div;
  const userId = session?.user?.id;
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { success, error: errorSound, click } = useFeedback();

  // Détecter si on arrive depuis une sauvegarde de repas récente
  const freshMealSaved = location.state?.freshMealSaved;
  const savedMealId = location.state?.mealId;
  
  // ÉTAT DE LA MODALE GÉRÉ AU NIVEAU DU TAB
  const [selectedMeal, setSelectedMeal] = useState<any>(null);
  const [deletingMealId, setDeletingMealId] = useState<string | null>(null);

  // Récupérer l'historique des repas pour déterminer si l'utilisateur a déjà scanné
  const { data: recentMeals } = useQuery({
    queryKey: ['meals-recent', userId],
    queryFn: async () => {
      if (!userId) return [];
      return mealsRepo.getRecentMeals(userId, 30);
    },
    enabled: !!userId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  // Récupérer les repas du jour
  const { data: todayMeals, isLoading } = useQuery({
    queryKey: ['meals-today', userId],
    queryFn: async () => {
      if (!userId) return [];
      logger.info('DAILY_RECAP_TAB', 'Fetching today meals', {
        userId,
        freshMealSaved,
        savedMealId,
        timestamp: new Date().toISOString()
      });
      return mealsRepo.getTodayMeals(userId);
    },
    enabled: !!userId,
    staleTime: 0, // CRITIQUE: Aucun cache pour garantir des données fraîches
    refetchOnWindowFocus: true, // Refetch quand la fenêtre reprend le focus
    refetchOnMount: true, // CRITIQUE: Toujours refetch au montage du composant
    // CRITICAL: Retry configuration to handle cancellations gracefully
    retry: (failureCount, error) => {
      // Don't retry on cancellation errors
      if (error?.name === 'CancelledError') return false;
      // Retry other errors once
      return failureCount < 1;
    },
  });

  // OPTIMISATION CRITIQUE: Force refetch si on détecte une sauvegarde récente
  React.useEffect(() => {
    if (freshMealSaved && userId) {
      logger.info('DAILY_RECAP_TAB', 'Fresh meal detected, forcing immediate refetch', {
        savedMealId,
        userId,
        timestamp: new Date().toISOString()
      });

      // Force refetch immédiat avec cancelRefetch: false pour éviter les CancelledError
      queryClient.refetchQueries({
        queryKey: ['meals-today', userId],
        type: 'active',
      }).catch(error => {
        // Gracefully handle cancellation errors
        if (error?.name === 'CancelledError') {
          logger.debug('DAILY_RECAP_TAB', 'Refetch cancelled, ignoring', {
            savedMealId,
            userId,
            timestamp: new Date().toISOString()
          });
        } else {
          logger.error('DAILY_RECAP_TAB', 'Refetch failed', {
            error: error instanceof Error ? error.message : String(error),
            savedMealId,
            userId,
            timestamp: new Date().toISOString()
          });
        }
      });

      // Nettoyer l'état de navigation après utilisation
      if (location.state) {
        window.history.replaceState({}, document.title);
      }
    }
  }, [freshMealSaved, savedMealId, userId, queryClient, location.state]);

  // Récupérer le résumé IA quotidien
  const { data: dailySummary, isLoading: isSummaryLoading } = useQuery({
    queryKey: ['daily-ai-summary', userId, format(new Date(), 'yyyy-MM-dd')],
    queryFn: async () => {
      if (!userId || !todayMeals || todayMeals.length === 0) return null;
      return mealsRepo.generateDailySummary(userId, todayMeals, profile);
    },
    enabled: !!userId && !!todayMeals && todayMeals.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes pour mise à jour plus rapide
  });

  // Notify parent about loading state changes
  React.useEffect(() => {
    onLoadingChange?.(isSummaryLoading);
  }, [isSummaryLoading, onLoadingChange]);

  // Calculer les statistiques du jour
  const todayStats = React.useMemo(() => {
    logger.debug('STATS_CALCULATION', {
      mealsCount: todayMeals?.length || 0,
      hasMeals: !!todayMeals
    });
    
    if (!todayMeals || todayMeals.length === 0) {
      return { 
        totalCalories: 0, 
        mealsCount: 0, 
        lastMealTime: null,
        macros: { proteins: 0, carbs: 0, fats: 0, fiber: 0 }
      };
    }

    const totalCalories = todayMeals.reduce((sum, meal) => sum + (meal.total_kcal || 0), 0);
    const mealsCount = todayMeals.length;
    const lastMealTime = todayMeals[0]?.timestamp ? new Date(todayMeals[0].timestamp) : null;
    
    // Calculer les macronutriments (estimation basée sur les items JSONB)
    const macros = todayMeals.reduce((acc, meal) => {
      const items = meal.items || [];
      items.forEach((item: any) => {
        acc.proteins += item.proteins || 0;
        acc.carbs += item.carbs || 0;
        acc.fats += item.fats || 0;
        acc.fiber += item.fiber || 0;
      });
      return acc;
    }, { proteins: 0, carbs: 0, fats: 0, fiber: 0 });

    return { totalCalories, mealsCount, lastMealTime, macros };
  }, [todayMeals]);

  // Calcul intelligent de l'objectif calorique
  const calorieTargetAnalysis = React.useMemo(() => {
    return calculateIntelligentCalorieTarget(profile);
  }, [profile?.height_cm, profile?.weight_kg, profile?.sex, profile?.activity_level, profile?.objective, profile?.birthdate]);

  // Analyse du statut calorique
  const calorieStatus = React.useMemo(() => {
    return analyzeCalorieStatus(
      todayStats.totalCalories, 
      calorieTargetAnalysis.target, 
      calorieTargetAnalysis.objectiveType
    );
  }, [todayStats.totalCalories, calorieTargetAnalysis.target, calorieTargetAnalysis.objectiveType]);

  // Déterminer si l'utilisateur a un historique de repas (au-delà d'aujourd'hui)
  const hasAnyMealHistory = React.useMemo(() => {
    if (!recentMeals) return false;
    
    // Filtrer les repas qui ne sont pas d'aujourd'hui
    const today = new Date().toDateString();
    const historicalMeals = recentMeals.filter(meal => 
      new Date(meal.timestamp).toDateString() !== today
    );
    
    return historicalMeals.length > 0;
  }, [recentMeals]);

  // GESTIONNAIRES DE LA MODALE AU NIVEAU DU TAB
  const handleMealClick = React.useCallback((meal: any) => {
    click();
    setSelectedMeal(meal);
  }, [click]);

  const handleModalClose = React.useCallback(() => {
    setSelectedMeal(null);
  }, [selectedMeal?.id]);

  const handleDeleteMeal = React.useCallback(async (mealId: string) => {
    if (!userId) return;
    
    setDeletingMealId(mealId);
    
    try {
      await mealsRepo.deleteMeal(mealId, userId);

      // Forcer le refetch immédiat des queries actives pour mise à jour UI
      // Wrap in try-catch to gracefully handle cancellation errors
      await Promise.all([
        queryClient.refetchQueries({
          queryKey: ['meals-today', userId],
          type: 'active'
        }).catch(error => {
          if (error?.name !== 'CancelledError') throw error;
        }),
        queryClient.refetchQueries({
          queryKey: ['meals-week', userId],
          type: 'active'
        }).catch(error => {
          if (error?.name !== 'CancelledError') throw error;
        }),
        queryClient.refetchQueries({
          queryKey: ['meals-history', userId],
          type: 'active'
        }).catch(error => {
          if (error?.name !== 'CancelledError') throw error;
        }),
        queryClient.invalidateQueries({ queryKey: ['meals-month', userId] }),
        queryClient.invalidateQueries({ queryKey: ['daily-ai-summary', userId] })
      ]);

      success();
      showToast({
        type: 'success',
        title: 'Repas supprimé',
        message: 'Le repas a été retiré de votre forge nutritionnelle',
        duration: 3000,
      });

      logger.info('MEAL_DELETE', 'Meal deleted and all queries refetched', {
        mealId,
        userId,
        queriesRefetched: ['meals-today', 'meals-week', 'meals-history'],
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      errorSound();
      showToast({
        type: 'error',
        title: 'Erreur de suppression',
        message: 'Impossible de supprimer le repas. Veuillez réessayer.',
        duration: 4000,
      });
      
      logger.error('MEAL_DELETE', 'Failed to delete meal', {
        mealId,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    } finally {
      setDeletingMealId(null);
    }
  }, [userId, queryClient, success, errorSound, showToast]);

  // OPTIMISATION: Afficher le contenu immédiatement si on a des données en cache
  // Même si isLoading est true (refetch en arrière-plan)
  const hasCachedData = todayMeals !== undefined;

  // Show skeleton only when truly loading for the first time (no cached data)
  if (isLoading && !hasCachedData) {
    return <DailyRecapSkeleton />;
  }

  // Show empty state if no meals today AND no historical meals
  if (todayStats.mealsCount === 0 && !hasAnyMealHistory && !isLoading) {
    return <EmptyMealsScannerState />;
  }

  return (
    <>
      <MotionDiv
        {...(!isPerformanceMode && {
          initial: { opacity: 0, y: 20 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.5, ease: 'easeOut' }
        })}
        className="space-y-6 w-full"
      >
      {/* Profile Completeness Alert - CRITICAL FIX: Add debugging key */}
      <ProfileCompletenessAlert
        key={`profile-alert-${profile?._immutabilityMarker || 'no-marker'}`}
        profile={profile}
        forgeContext="meals"
      />

      {/* CTA Principal Dynamique - Remonté en haut */}
      <DynamicScanCTA
        todayStats={todayStats}
        profile={profile}
        calorieStatus={calorieStatus}
        calorieTargetAnalysis={calorieTargetAnalysis}
      />

      {/* Résumé de la Journée */}
      <DailyStatsGrid 
        todayStats={todayStats}
        calorieStatus={calorieStatus}
      />

      {/* Barre de Progression Calorique */}
      <CalorieProgressCard
        todayStats={todayStats}
        calorieTargetAnalysis={calorieTargetAnalysis}
        calorieStatus={calorieStatus}
        profile={profile}
      />

      {/* Macronutriments du Jour */}
      <MacronutrientsCard 
        todayStats={todayStats}
        profile={profile}
      />

      {/* Repas Récents */}
      <RecentMealsCard 
        todayMeals={todayMeals}
        todayStats={todayStats}
        hasAnyMealHistory={hasAnyMealHistory}
        onMealClick={handleMealClick}
        deletingMealId={deletingMealId}
        onDeleteMeal={handleDeleteMeal}
      />
      </MotionDiv>

      {/* Modal de Détail - GÉRÉE AU NIVEAU DU TAB */}
      <AnimatePresence>
        {selectedMeal && (
          <MealDetailModal
            meal={selectedMeal}
            onClose={handleModalClose}
            onDelete={handleDeleteMeal}
          />
        )}
      </AnimatePresence>
    </>
  );
};

export default DailyRecapTab;