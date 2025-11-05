import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { usePerformanceMode } from '../../../../system/context/PerformanceModeContext';
import { useMealPlanGenerationPipeline } from '../../../../system/store/mealPlanGenerationPipeline';
import GlassCard from '../../../../ui/cards/GlassCard';
import SpatialIcon from '../../../../ui/icons/SpatialIcon';
import { ICONS } from '../../../../ui/icons/registry';
import SkeletonBase from '../../../../ui/components/skeletons/SkeletonBase';
import type { MealPlan } from '../../../../system/store/mealPlanGenerationPipeline/types';

interface ValidationStageProps {
  mealPlan: MealPlan | null;
  onSaveBasicPlan: () => void;
  onGenerateAllRecipes: () => void;
  onDiscard: () => void;
  isSaving: boolean;
  onExit: () => void;
  isGeneratingRecipes: boolean;
}

const ValidationStage: React.FC<ValidationStageProps> = ({
  mealPlan,
  onSaveBasicPlan,
  onGenerateAllRecipes,
  onDiscard,
  isSaving,
  onExit,
  isGeneratingRecipes
}) => {
  const { isPerformanceMode } = usePerformanceMode();
  const { currentStep } = useMealPlanGenerationPipeline();
  const MotionDiv = isPerformanceMode ? 'div' : motion.div;

  if (!mealPlan) {
    return null;
  }

  const weekCount = mealPlan.days.length / 7;
  const totalMeals = mealPlan.days.reduce((sum, day) => sum + (day.meals?.length || 0), 0);
  const recipesGenerated = mealPlan.days.reduce((sum, day) =>
    sum + (day.meals?.filter(m => m.recipeGenerated && m.status === 'ready').length || 0), 0
  );

  return (
    <div className="space-y-6">
      {/* Validation Header */}
      <MotionDiv
        {...(!isPerformanceMode && {
          initial: { opacity: 0, y: -20 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.5 }
        })}
      >
        <GlassCard
          className="p-6"
          style={{
            background: `
              radial-gradient(circle at 30% 20%, color-mix(in srgb, #8B5CF6 12%, transparent) 0%, transparent 60%),
              linear-gradient(145deg, rgba(255,255,255,0.08), rgba(255,255,255,0.05)),
              rgba(11, 14, 23, 0.85)
            `,
            borderColor: 'color-mix(in srgb, #8B5CF6 30%, transparent)',
            boxShadow: `
              0 12px 40px rgba(0, 0, 0, 0.3),
              0 0 30px color-mix(in srgb, #8B5CF6 20%, transparent),
              inset 0 2px 0 rgba(255, 255, 255, 0.15)
            `,
            backdropFilter: 'blur(24px) saturate(150%)',
            WebkitBackdropFilter: 'blur(24px) saturate(150%)'
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{
                  background: `
                    radial-gradient(circle at 30% 30%, rgba(255,255,255,0.2) 0%, transparent 60%),
                    linear-gradient(135deg, color-mix(in srgb, #8B5CF6 35%, transparent), color-mix(in srgb, #A855F7 25%, transparent))
                  `,
                  border: '2px solid color-mix(in srgb, #8B5CF6 50%, transparent)',
                  boxShadow: '0 0 30px color-mix(in srgb, #8B5CF6 40%, transparent)'
                }}
              >
                <SpatialIcon
                  Icon={ICONS.Check}
                  size={32}
                  style={{
                    color: '#8B5CF6',
                    filter: 'drop-shadow(0 0 8px rgba(139, 92, 246, 0.6))'
                  }}
                />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white mb-1">
                  {isGeneratingRecipes ? 'Génération des Recettes en cours...' : 'Votre Plan Alimentaire est Prêt !'}
                </h2>
                <div className="flex items-center gap-3">
                  <p className="text-white/70">
                    {weekCount} semaine{weekCount > 1 ? 's' : ''} · {totalMeals} repas planifiés
                    {isGeneratingRecipes && ` · ${recipesGenerated}/${totalMeals} recettes générées`}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {isGeneratingRecipes && (
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-violet-400/20 border border-violet-400/30">
                  <div className="w-2 h-2 bg-violet-400 rounded-full animate-pulse" />
                  <span className="text-violet-400 text-sm font-medium">En cours</span>
                </div>
              )}
              <button
                onClick={onDiscard}
                disabled={isSaving || isGeneratingRecipes}
                className={`px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-white font-medium transition-all duration-200 ${
                  (isSaving || isGeneratingRecipes) ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                Régénérer
              </button>
            </div>
          </div>
        </GlassCard>
      </MotionDiv>

      {/* Week Summary Cards with Recipe Names */}
      <div className="space-y-4">
        {Array.from({ length: weekCount }).map((_, weekIndex) => {
          const weekDays = mealPlan.days.slice(weekIndex * 7, (weekIndex + 1) * 7);

          return (
            <MotionDiv
              key={`week-${weekIndex}`}
              {...(!isPerformanceMode && {
                initial: { opacity: 0, y: 20 },
                animate: { opacity: 1, y: 0 },
                transition: { duration: 0.4, delay: weekIndex * 0.1 }
              })}
            >
              <GlassCard
                className="p-6"
                style={{
                  background: `
                    radial-gradient(circle at 30% 20%, color-mix(in srgb, #8B5CF6 8%, transparent) 0%, transparent 60%),
                    rgba(11, 14, 23, 0.8)
                  `,
                  borderColor: 'color-mix(in srgb, #8B5CF6 25%, transparent)',
                  boxShadow: `
                    0 8px 24px rgba(0, 0, 0, 0.2),
                    0 0 20px color-mix(in srgb, #8B5CF6 15%, transparent)
                  `
                }}
              >
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
                  <div>
                    <h3 className="text-white font-bold text-xl">
                      Semaine {weekIndex + 1}
                    </h3>
                    <p className="text-white/60 text-sm">
                      {weekDays.length} jours planifiés
                    </p>
                  </div>
                </div>

                {/* Days Grid with Meal Names */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {weekDays.map((day, dayIndex) => (
                    <MotionDiv
                      key={`day-${day.date}-${dayIndex}`}
                      {...(!isPerformanceMode && {
                        initial: { opacity: 0, y: 15 },
                        animate: { opacity: 1, y: 0 },
                        transition: {
                          duration: 0.3,
                          delay: (weekIndex * 7 + dayIndex) * 0.05,
                          ease: 'easeOut'
                        }
                      })}
                      className="p-4 rounded-lg"
                      style={{
                        background: 'rgba(139, 92, 246, 0.05)',
                        border: '1px solid rgba(139, 92, 246, 0.2)'
                      }}
                    >
                      <div className="font-semibold text-white mb-3 text-sm">
                        {new Date(day.date).toLocaleDateString('fr-FR', {
                          weekday: 'long',
                          day: 'numeric',
                          month: 'short'
                        })}
                      </div>

                      {/* Meals List with Icons and Skeletons */}
                      <div className="space-y-2">
                        {day.meals?.map((meal, mealIndex) => {
                          const mealIcons = {
                            breakfast: ICONS.Coffee,
                            lunch: ICONS.UtensilsCrossed,
                            dinner: ICONS.UtensilsCrossed,
                            snack: ICONS.Cookie
                          };

                          const isLoading = isGeneratingRecipes && meal.status === 'loading';

                          return (
                            <div
                              key={`meal-${mealIndex}`}
                              className="flex items-start gap-2 p-2 rounded"
                              style={{
                                background: isLoading ? 'rgba(139, 92, 246, 0.05)' : 'rgba(139, 92, 246, 0.08)',
                                opacity: isLoading ? 0.7 : 1
                              }}
                            >
                              {isLoading ? (
                                <>
                                  <SkeletonBase width="24px" height="24px" borderRadius="4px" className="flex-shrink-0 mt-0.5" />
                                  <div className="flex-1 min-w-0">
                                    <SkeletonBase width="80%" height="14px" className="mb-1" />
                                    <SkeletonBase width="60%" height="12px" />
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div
                                    className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0 mt-0.5"
                                    style={{
                                      background: 'rgba(139, 92, 246, 0.2)',
                                      border: '1px solid rgba(139, 92, 246, 0.3)'
                                    }}
                                  >
                                    <SpatialIcon
                                      Icon={mealIcons[meal.type as keyof typeof mealIcons] || ICONS.UtensilsCrossed}
                                      size={14}
                                      className="text-violet-400"
                                    />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-white/90 text-sm font-medium leading-tight">
                                      {meal.name}
                                    </p>
                                    {meal.ingredients && meal.ingredients.length > 0 && (
                                      <p className="text-white/50 text-xs mt-1 line-clamp-1">
                                        {meal.ingredients.slice(0, 3).join(', ')}
                                      </p>
                                    )}
                                    {meal.calories && (
                                      <p className="text-violet-400/80 text-xs mt-1">
                                        {meal.calories} kcal
                                      </p>
                                    )}
                                  </div>
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </MotionDiv>
                  ))}
                </div>
              </GlassCard>
            </MotionDiv>
          );
        })}
      </div>

      {/* Action Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Save Basic Plan */}
        <MotionDiv
          {...(!isPerformanceMode && {
            initial: { opacity: 0, x: -20 },
            animate: { opacity: 1, x: 0 },
            transition: { duration: 0.4, delay: 0.3 }
          })}
        >
          <GlassCard
            className="p-6 cursor-pointer hover:scale-[1.02] transition-transform"
            onClick={onSaveBasicPlan}
            style={{
              background: `
                radial-gradient(circle at 30% 20%, color-mix(in srgb, #8B5CF6 15%, transparent) 0%, transparent 60%),
                rgba(11, 14, 23, 0.85)
              `,
              borderColor: 'color-mix(in srgb, #8B5CF6 30%, transparent)',
              boxShadow: `
                0 8px 24px rgba(0, 0, 0, 0.2),
                0 0 25px color-mix(in srgb, #8B5CF6 20%, transparent)
              `
            }}
          >
            <div className="flex items-start gap-4">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0"
                style={{
                  background: 'linear-gradient(135deg, #8B5CF6, #A855F7)',
                  boxShadow: '0 0 20px rgba(139, 92, 246, 0.5)'
                }}
              >
                <SpatialIcon
                  Icon={ICONS.Save}
                  size={24}
                  className="text-white"
                />
              </div>
              <div className="flex-1">
                <h3 className="text-white font-bold text-xl mb-2">
                  Sauvegarder le Plan de Base
                </h3>
                <p className="text-white/70 text-sm leading-relaxed mb-3">
                  Enregistrez votre plan avec les repas structurés. Vous pourrez générer les recettes détaillées plus tard.
                </p>
                <div className="flex items-center gap-2 text-violet-400 text-sm font-medium">
                  <span>Sauvegarder maintenant</span>
                  <SpatialIcon Icon={ICONS.ChevronRight} size={16} />
                </div>
              </div>
            </div>
          </GlassCard>
        </MotionDiv>

        {/* Generate All Recipes */}
        <MotionDiv
          {...(!isPerformanceMode && {
            initial: { opacity: 0, x: 20 },
            animate: { opacity: 1, x: 0 },
            transition: { duration: 0.4, delay: 0.4 }
          })}
        >
          <GlassCard
            className="p-6 cursor-pointer hover:scale-[1.02] transition-transform"
            onClick={onGenerateAllRecipes}
            style={{
              background: `
                radial-gradient(circle at 30% 20%, color-mix(in srgb, #A855F7 15%, transparent) 0%, transparent 60%),
                rgba(11, 14, 23, 0.85)
              `,
              borderColor: 'color-mix(in srgb, #A855F7 30%, transparent)',
              boxShadow: `
                0 8px 24px rgba(0, 0, 0, 0.2),
                0 0 25px color-mix(in srgb, #A855F7 20%, transparent)
              `
            }}
          >
            <div className="flex items-start gap-4">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0"
                style={{
                  background: 'linear-gradient(135deg, #A855F7, #7C3AED)',
                  boxShadow: '0 0 20px rgba(168, 85, 247, 0.5)'
                }}
              >
                <SpatialIcon
                  Icon={ICONS.Sparkles}
                  size={24}
                  className="text-white"
                />
              </div>
              <div className="flex-1">
                <h3 className="text-white font-bold text-xl mb-2">
                  Générer Toutes les Recettes
                </h3>
                <p className="text-white/70 text-sm leading-relaxed mb-3">
                  Continuez pour obtenir les recettes détaillées complètes pour tous vos repas planifiés.
                </p>
                <div className="flex items-center gap-2 text-violet-400 text-sm font-medium">
                  <span>Continuer la génération</span>
                  <SpatialIcon Icon={ICONS.ChevronRight} size={16} />
                </div>
              </div>
            </div>
          </GlassCard>
        </MotionDiv>
      </div>

      {/* Info Card */}
      <MotionDiv
        {...(!isPerformanceMode && {
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          transition: { delay: 0.5 }
        })}
      >
        <GlassCard
          className="p-4"
          style={{
            background: 'rgba(139, 92, 246, 0.05)',
            borderColor: 'rgba(139, 92, 246, 0.2)',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)'
          }}
        >
          <div className="flex items-center gap-3">
            <SpatialIcon
              Icon={ICONS.Lightbulb}
              size={20}
              style={{
                color: '#8B5CF6',
                filter: 'drop-shadow(0 0 6px rgba(139, 92, 246, 0.6))'
              }}
            />
            <p className="text-white/80 text-sm">
              <strong className="text-white">Astuce :</strong> Vous pouvez sauvegarder le plan maintenant
              et générer les recettes détaillées plus tard depuis votre bibliothèque.
            </p>
          </div>
        </GlassCard>
      </MotionDiv>

      {/* Exit Button */}
      <MotionDiv
        {...(!isPerformanceMode && {
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          transition: { duration: 0.3, delay: 0.6 }
        })}
        className="flex justify-end"
      >
        <button
          onClick={onExit}
          className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-white font-medium transition-all duration-200"
        >
          Quitter
        </button>
      </MotionDiv>
    </div>
  );
};

export default ValidationStage;
