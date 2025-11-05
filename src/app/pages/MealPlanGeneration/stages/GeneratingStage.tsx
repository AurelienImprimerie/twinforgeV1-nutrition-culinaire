import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { usePerformanceMode } from '../../../../system/context/PerformanceModeContext';
import { useMealPlanGenerationPipeline } from '../../../../system/store/mealPlanGenerationPipeline';
import { useRecipeImageRealtime } from '../../../../hooks/useRecipeImageRealtime';
import GlassCard from '../../../../ui/cards/GlassCard';
import SpatialIcon from '../../../../ui/icons/SpatialIcon';
import { ICONS } from '../../../../ui/icons/registry';
import SkeletonBase from '../../../../ui/components/skeletons/SkeletonBase';
import MealPlanRecipeCard from '../components/MealPlanRecipeCard';
import RecipeDetailModal from '../../Fridge/tabs/RecipesTab/components/RecipeDetailModal';
import type { Recipe } from '../../../../domain/recipe';
import type { DetailedRecipe } from '../../../../system/store/mealPlanGenerationPipeline/types';

interface GeneratingStageProps {
  onExit: () => void;
}

const GeneratingStage: React.FC<GeneratingStageProps> = ({ onExit }) => {
  const { isPerformanceMode } = usePerformanceMode();
  const {
    mealPlanCandidates,
    loadingState,
    loadingMessage,
    config,
    receivedDaysCount,
    totalDaysToGenerate,
    simulatedOverallProgress,
    lastStateUpdate
  } = useMealPlanGenerationPipeline();
  const MotionDiv = isPerformanceMode ? 'div' : motion.div;

  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);

  // Convert DetailedRecipe to Recipe for the modal
  const convertToRecipe = (detailedRecipe: DetailedRecipe, mealId: string, sessionId: string): Recipe => {
    return {
      id: detailedRecipe.id,
      sessionId: sessionId,
      title: detailedRecipe.title,
      ingredients: detailedRecipe.ingredients.map(ing => ({
        name: ing.name,
        quantity: ing.quantity,
        unit: ing.unit,
        optional: false
      })),
      instructions: detailedRecipe.instructions,
      prepTimeMin: detailedRecipe.prepTimeMin || 0,
      cookTimeMin: detailedRecipe.cookTimeMin || 0,
      servings: detailedRecipe.servings,
      dietaryTags: detailedRecipe.dietaryTags,
      nutritionalInfo: {
        calories: detailedRecipe.nutritionalInfo.kcal,
        protein: detailedRecipe.nutritionalInfo.protein,
        carbs: detailedRecipe.nutritionalInfo.carbs,
        fat: detailedRecipe.nutritionalInfo.fat,
        fiber: detailedRecipe.nutritionalInfo.fiber
      },
      imageUrl: detailedRecipe.imageUrl,
      imageSignature: detailedRecipe.imageSignature,
      status: detailedRecipe.status,
      createdAt: new Date().toISOString()
    };
  };

  // Calculate progress based on received days from store
  const currentPlan = mealPlanCandidates[0];
  const totalDays = totalDaysToGenerate || config.weekCount * 7;
  const receivedDays = receivedDaysCount || currentPlan?.days?.length || 0;
  // Use simulatedOverallProgress from store which now reflects actual backend progress
  const progressPercentage = simulatedOverallProgress;
  const isStreaming = loadingState === 'streaming' && receivedDays > 0;
  const isGenerating = loadingState === 'generating' || loadingState === 'streaming';

  // Force re-render when lastStateUpdate changes
  React.useEffect(() => {
    // This effect ensures the component re-renders when state updates
  }, [lastStateUpdate, receivedDaysCount, mealPlanCandidates]);

  // Collect all recipe IDs for realtime image listening
  const recipeIds = useMemo(() => {
    const ids: string[] = [];
    mealPlanCandidates.forEach(plan => {
      plan.days.forEach(day => {
        day.meals?.forEach(meal => {
          if (meal.detailedRecipe?.id) {
            ids.push(meal.detailedRecipe.id);
          }
        });
      });
    });
    return ids;
  }, [mealPlanCandidates]);

  // Listen for real-time image updates
  useRecipeImageRealtime(isStreaming, recipeIds);

  // Generate dynamic title and subtitle based on progress
  const getDynamicTitle = (): string => {
    if (receivedDays === 0) {
      return 'Analyse en cours...';
    } else if (receivedDays < 3) {
      return 'Création de vos repas...';
    } else if (receivedDays < 5) {
      return 'Optimisation nutritionnelle...';
    } else if (receivedDays < 7) {
      return 'Finalisation de votre plan...';
    } else {
      return 'Plan hebdomadaire prêt !';
    }
  };

  const getDynamicSubtitle = (): string => {
    if (receivedDays > 0) {
      return `${receivedDays} jour${receivedDays > 1 ? 's' : ''} généré${receivedDays > 1 ? 's' : ''} sur ${totalDays}`;
    }
    return 'Analyse de votre inventaire et de vos préférences nutritionnelles';
  };

  return (
    <div className="space-y-6">
      {/* Loader Card */}
      <MotionDiv
        {...(!isPerformanceMode && {
          initial: { opacity: 0, scale: 0.95 },
          animate: { opacity: 1, scale: 1 },
          transition: { duration: 0.5 }
        })}
      >
        <GlassCard
          className="p-12"
          style={{
            background: `
              radial-gradient(circle at 30% 20%, color-mix(in srgb, #8B5CF6 15%, transparent) 0%, transparent 60%),
              radial-gradient(circle at 70% 80%, color-mix(in srgb, #A855F7 12%, transparent) 0%, transparent 50%),
              linear-gradient(145deg, rgba(255,255,255,0.08), rgba(255,255,255,0.05)),
              rgba(11, 14, 23, 0.85)
            `,
            borderColor: 'color-mix(in srgb, #8B5CF6 30%, transparent)',
            boxShadow: `
              0 20px 60px rgba(0, 0, 0, 0.3),
              0 0 40px color-mix(in srgb, #8B5CF6 25%, transparent),
              0 0 80px color-mix(in srgb, #A855F7 20%, transparent),
              inset 0 2px 0 rgba(255, 255, 255, 0.15)
            `,
            backdropFilter: 'blur(32px) saturate(170%)',
            WebkitBackdropFilter: 'blur(32px) saturate(170%)'
          }}
        >
          <div className="space-y-8 text-center">
            {/* Animated Icon */}
            <div className="relative inline-block">
              <MotionDiv
                className="w-32 h-32 mx-auto rounded-full flex items-center justify-center relative"
                style={{
                  background: `
                    radial-gradient(circle at 30% 30%, rgba(255,255,255,0.3) 0%, transparent 60%),
                    radial-gradient(circle at 70% 70%, color-mix(in srgb, #8B5CF6 25%, transparent) 0%, transparent 50%),
                    linear-gradient(135deg, color-mix(in srgb, #8B5CF6 45%, transparent), color-mix(in srgb, #A855F7 40%, transparent))
                  `,
                  border: '4px solid color-mix(in srgb, #8B5CF6 50%, transparent)',
                  boxShadow: `
                    0 0 40px color-mix(in srgb, #8B5CF6 50%, transparent),
                    0 0 80px color-mix(in srgb, #A855F7 40%, transparent),
                    inset 0 3px 0 rgba(255,255,255,0.4)
                  `
                }}
                {...(!isPerformanceMode && {
                  animate: {
                    scale: [1, 1.05, 1],
                    rotate: [0, 5, 0, -5, 0]
                  },
                  transition: {
                    duration: 3,
                    repeat: Infinity,
                    ease: [0.45, 0.05, 0.55, 0.95]
                  }
                })}
              >
                <SpatialIcon
                  Icon={ICONS.Sparkles}
                  size={64}
                  color="rgba(255, 255, 255, 0.95)"
                  variant="pure"
                  style={{
                    filter: 'drop-shadow(0 0 12px rgba(255, 255, 255, 0.6))'
                  }}
                />
              </MotionDiv>

              {/* Orbiting particles */}
              {!isPerformanceMode && [0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="absolute w-3 h-3 rounded-full"
                  style={{
                    background: 'linear-gradient(135deg, #8B5CF6, #A855F7)',
                    boxShadow: '0 0 12px #8B5CF6',
                    top: '50%',
                    left: '50%',
                    marginTop: '-6px',
                    marginLeft: '-6px',
                    transformOrigin: `${80 * Math.cos((i * 120 * Math.PI) / 180)}px ${80 * Math.sin((i * 120 * Math.PI) / 180)}px`
                  }}
                  animate={{
                    rotate: [0, 360],
                    scale: [1, 1.2, 1]
                  }}
                  transition={{
                    duration: 2,
                    delay: i * 0.66,
                    repeat: Infinity,
                    ease: 'linear'
                  }}
                />
              ))}
            </div>

            {/* Dynamic Title and Description */}
            <div className="space-y-4">
              <h2
                className="text-3xl font-bold text-white"
                style={{
                  textShadow: '0 0 30px color-mix(in srgb, #8B5CF6 60%, transparent)'
                }}
              >
                {getDynamicTitle()}
              </h2>
              <p className="text-white/80 text-lg max-w-2xl mx-auto leading-relaxed">
                {getDynamicSubtitle()}
              </p>
            </div>

            {/* Progress Bar - Always visible with dynamic progress */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/80">
                  {isGenerating ? (loadingMessage || 'Génération en cours...') : 'Initialisation...'}
                </span>
                <span className="text-violet-400 font-semibold">
                  {receivedDays}/{totalDays} jours
                </span>
              </div>
              <div className="relative w-full h-4 bg-white/5 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-violet-500 via-purple-500 to-violet-600"
                  initial={{ width: '0%' }}
                  animate={{ width: `${progressPercentage}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                  style={{
                    boxShadow: '0 0 20px rgba(139, 92, 246, 0.6)'
                  }}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="text-center flex-1">
                  <span className="text-violet-300 text-2xl font-bold">
                    {progressPercentage}%
                  </span>
                </div>
                {config.batchCooking && (
                  <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/20 border border-violet-400/30">
                    <SpatialIcon Icon={ICONS.Sparkles} size={14} className="text-violet-400" />
                    <span className="text-violet-300 text-xs font-medium">Batch Cooking</span>
                  </div>
                )}
              </div>
            </div>

            {/* Dynamic Progress Steps */}
            {receivedDays === 0 && (
              <div className="space-y-3 max-w-md mx-auto">
                {[
                  'Analyse de votre inventaire',
                  'Chargement de vos préférences',
                  'Calcul des besoins nutritionnels',
                  'Préparation de la génération'
                ].map((step, index) => (
                  <MotionDiv
                    key={step}
                    className="flex items-center gap-3 p-3 rounded-lg"
                    style={{
                      background: 'rgba(139, 92, 246, 0.1)',
                      border: '1px solid rgba(139, 92, 246, 0.2)'
                    }}
                    {...(!isPerformanceMode && {
                      initial: { opacity: 0, x: -20 },
                      animate: { opacity: 1, x: 0 },
                      transition: { duration: 0.3, delay: index * 0.15 }
                    })}
                  >
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{
                        background: 'linear-gradient(135deg, #8B5CF6, #A855F7)',
                        boxShadow: '0 0 12px rgba(139, 92, 246, 0.5)'
                      }}
                    >
                      <motion.div
                        className="w-2 h-2 bg-white rounded-full"
                        animate={{ scale: [1, 1.3, 1], opacity: [1, 0.7, 1] }}
                        transition={{
                          duration: 1.5,
                          delay: index * 0.3,
                          repeat: Infinity,
                          ease: 'easeInOut'
                        }}
                      />
                    </div>
                    <span className="text-white/90 text-sm font-medium">{step}</span>
                  </MotionDiv>
                ))}
              </div>
            )}
          </div>
        </GlassCard>
      </MotionDiv>

      {/* Real-time Stats Card */}
      {isStreaming && currentPlan && (
        <MotionDiv
          {...(!isPerformanceMode && {
            initial: { opacity: 0, scale: 0.95 },
            animate: { opacity: 1, scale: 1 },
            transition: { duration: 0.4 }
          })}
        >
          <GlassCard
            className="p-6"
            style={{
              background: 'rgba(11, 14, 23, 0.75)',
              borderColor: 'rgba(139, 92, 246, 0.3)',
              boxShadow: '0 8px 32px rgba(139, 92, 246, 0.15)'
            }}
          >
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-violet-400 text-3xl font-bold mb-1">
                  {receivedDays * 3}
                </div>
                <div className="text-white/60 text-xs">Repas Créés</div>
              </div>
              <div className="text-center">
                <div className="text-violet-400 text-3xl font-bold mb-1">
                  {receivedDays}
                </div>
                <div className="text-white/60 text-xs">Jours Générés</div>
              </div>
              <div className="text-center">
                <div className="text-violet-400 text-3xl font-bold mb-1">
                  {config.weekCount}
                </div>
                <div className="text-white/60 text-xs">Semaine{config.weekCount > 1 ? 's' : ''}</div>
              </div>
            </div>
          </GlassCard>
        </MotionDiv>
      )}

      {/* Days Streaming Display */}
      {isStreaming && currentPlan && (
        <MotionDiv
          {...(!isPerformanceMode && {
            initial: { opacity: 0, y: 20 },
            animate: { opacity: 1, y: 0 },
            transition: { duration: 0.5, delay: 0.2 }
          })}
        >
          <GlassCard
            className="p-6"
            style={{
              background: 'rgba(11, 14, 23, 0.8)',
              borderColor: 'rgba(139, 92, 246, 0.25)',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)'
            }}
          >
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-5">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(135deg, #8B5CF6, #A855F7)',
                    boxShadow: '0 0 16px rgba(139, 92, 246, 0.4)'
                  }}
                >
                  <SpatialIcon
                    Icon={ICONS.Calendar}
                    size={24}
                    className="text-white"
                  />
                </div>
                <div className="flex-1">
                  <h3 className="text-white font-bold text-xl">{currentPlan.title}</h3>
                  <p className="text-white/60 text-sm">
                    {receivedDays} jour{receivedDays > 1 ? 's' : ''} généré{receivedDays > 1 ? 's' : ''}
                  </p>
                </div>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  className="w-6 h-6"
                >
                  <SpatialIcon
                    Icon={ICONS.Sparkles}
                    size={24}
                    className="text-violet-400"
                  />
                </motion.div>
              </div>

              {/* Rich Recipe Cards Grid - Progressive Display */}
              <div className="space-y-8">
                {currentPlan.days.map((day, dayIndex) => (
                  <div key={`day-${day.date}-${dayIndex}`}>
                    {/* Day Header */}
                    <MotionDiv
                      {...(!isPerformanceMode && {
                        initial: { opacity: 0, x: -20 },
                        animate: { opacity: 1, x: 0 },
                        transition: { duration: 0.4, delay: dayIndex * 0.1 }
                      })}
                      className="flex items-center gap-3 mb-4"
                    >
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{
                          background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.3), rgba(168, 85, 247, 0.2))',
                          border: '1.5px solid rgba(139, 92, 246, 0.4)'
                        }}
                      >
                        <SpatialIcon Icon={ICONS.Calendar} size={20} className="text-violet-300" />
                      </div>
                      <div>
                        <h4 className="text-white font-bold text-lg">
                          {new Date(day.date).toLocaleDateString('fr-FR', {
                            weekday: 'long',
                            day: 'numeric',
                            month: 'long'
                          })}
                        </h4>
                        <p className="text-white/60 text-xs">
                          Jour {dayIndex + 1} - {day.meals?.filter(m => m.recipeGenerated).length || 0}/{day.meals?.length || 0} repas enrichis
                        </p>
                      </div>
                    </MotionDiv>

                    {/* Meals Grid with Rich Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                      {day.meals?.map((meal, mealIndex) => {
                        const isGenerated = meal.recipeGenerated && meal.status === 'ready';
                        return (
                          <MealPlanRecipeCard
                            key={`meal-${dayIndex}-${mealIndex}`}
                            meal={meal}
                            dayIndex={dayIndex}
                            isGenerated={isGenerated}
                            onClick={isGenerated && meal.detailedRecipe ? () => {
                              const recipe = convertToRecipe(meal.detailedRecipe!, meal.id, currentPlan.id);
                              setSelectedRecipe(recipe);
                            } : undefined}
                          />
                        );
                      })}
                    </div>
                  </div>
                ))}

                {/* Skeleton Days for Remaining Generation */}
                {Array.from({ length: totalDays - receivedDays }).map((_, skeletonDayIndex) => (
                  <div key={`skeleton-day-${skeletonDayIndex}`}>
                    {/* Day Header Skeleton */}
                    <div className="flex items-center gap-3 mb-4">
                      <SkeletonBase width="40px" height="40px" borderRadius="8px" />
                      <div className="flex-1">
                        <SkeletonBase width="180px" height="20px" className="mb-1" />
                        <SkeletonBase width="120px" height="14px" />
                      </div>
                    </div>

                    {/* Skeleton Meal Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                      {[0, 1, 2].map((skeletonMealIndex) => (
                        <div
                          key={`skeleton-meal-${skeletonDayIndex}-${skeletonMealIndex}`}
                          className="rounded-xl overflow-hidden"
                          style={{
                            background: 'rgba(139, 92, 246, 0.05)',
                            border: '1.5px solid rgba(139, 92, 246, 0.15)'
                          }}
                        >
                          <SkeletonBase width="100%" height="192px" borderRadius="0" />
                          <div className="p-4">
                            <SkeletonBase width="80%" height="20px" className="mb-3" />
                            <div className="grid grid-cols-2 gap-2 mb-3">
                              <SkeletonBase width="100%" height="48px" />
                              <SkeletonBase width="100%" height="48px" />
                              <SkeletonBase width="100%" height="48px" />
                              <SkeletonBase width="100%" height="48px" />
                            </div>
                            <div className="flex gap-1.5">
                              <SkeletonBase width="60px" height="24px" borderRadius="12px" />
                              <SkeletonBase width="70px" height="24px" borderRadius="12px" />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </GlassCard>
        </MotionDiv>
      )}

      {/* Exit Button */}
      <MotionDiv
        {...(!isPerformanceMode && {
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          transition: { duration: 0.3, delay: 0.3 }
        })}
        className="flex justify-center"
      >
        <button
          onClick={onExit}
          className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-white font-medium transition-all duration-200"
        >
          Quitter
        </button>
      </MotionDiv>

      {/* Recipe Detail Modal */}
      {selectedRecipe && (
        <RecipeDetailModal
          recipe={selectedRecipe}
          onClose={() => setSelectedRecipe(null)}
        />
      )}
    </div>
  );
};

export default GeneratingStage;
