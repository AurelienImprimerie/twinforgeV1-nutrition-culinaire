import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { usePerformanceMode } from '../../../../system/context/PerformanceModeContext';
import GlassCard from '../../../../ui/cards/GlassCard';
import SpatialIcon from '../../../../ui/icons/SpatialIcon';
import { ICONS } from '../../../../ui/icons/registry';
import RecipeDetailModal from '../../../pages/Fridge/tabs/RecipesTab/components/RecipeDetailModal';
import type { Recipe } from '../../../../domain/recipe';
import type { MealPlan } from '../../../../system/store/mealPlanGenerationPipeline/types';

interface RecipeDetailsValidationStageProps {
  mealPlan: MealPlan | null;
  onSaveCompletePlan: () => void;
  onDiscard: () => void;
  isSaving: boolean;
  onExit: () => void;
}

const RecipeDetailsValidationStage: React.FC<RecipeDetailsValidationStageProps> = ({
  mealPlan,
  onSaveCompletePlan,
  onDiscard,
  isSaving,
  onExit
}) => {
  const { isPerformanceMode } = usePerformanceMode();
  const MotionDiv = isPerformanceMode ? 'div' : motion.div;
  const [showRecipeDetailModal, setShowRecipeDetailModal] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);

  if (!mealPlan) {
    return null;
  }

  const weekCount = mealPlan.days.length / 7;
  const totalMeals = mealPlan.days.reduce((sum, day) => sum + (day.meals?.length || 0), 0);
  const recipesWithDetails = mealPlan.days.reduce((sum, day) =>
    sum + (day.meals?.filter(m => m.detailedRecipe).length || 0), 0
  );

  const handleViewRecipe = (meal: any) => {
    if (meal.detailedRecipe) {
      setSelectedRecipe(meal.detailedRecipe);
      setShowRecipeDetailModal(true);
    }
  };

  const handleCloseModal = () => {
    setShowRecipeDetailModal(false);
    setSelectedRecipe(null);
  };

  return (
    <>
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
                radial-gradient(circle at 30% 20%, color-mix(in srgb, #10B981 12%, transparent) 0%, transparent 60%),
                linear-gradient(145deg, rgba(255,255,255,0.08), rgba(255,255,255,0.05)),
                rgba(11, 14, 23, 0.85)
              `,
              borderColor: 'color-mix(in srgb, #10B981 30%, transparent)',
              boxShadow: `
                0 12px 40px rgba(0, 0, 0, 0.3),
                0 0 30px color-mix(in srgb, #10B981 20%, transparent),
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
                      linear-gradient(135deg, color-mix(in srgb, #10B981 35%, transparent), color-mix(in srgb, #10B981 25%, transparent))
                    `,
                    border: '2px solid color-mix(in srgb, #10B981 50%, transparent)',
                    boxShadow: '0 0 30px color-mix(in srgb, #10B981 40%, transparent)'
                  }}
                >
                  <SpatialIcon Icon={ICONS.Check} size={32} className="text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white mb-1">
                    Plan Alimentaire Complet !
                  </h2>
                  <div className="flex items-center gap-3">
                    <p className="text-white/70">
                      {weekCount} semaine{weekCount > 1 ? 's' : ''} · {recipesWithDetails} recettes détaillées
                    </p>
                    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-green-400/20 border border-green-400/30">
                      <div className="w-2 h-2 bg-green-400 rounded-full" />
                      <span className="text-green-400 text-xs font-medium">Complet</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={onDiscard}
                  disabled={isSaving}
                  className={`px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-white font-medium transition-all duration-200 ${
                    isSaving ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  Régénérer
                </button>

                <button
                  onClick={onSaveCompletePlan}
                  disabled={isSaving}
                  className={`px-6 py-2 text-white font-semibold rounded-xl transition-all duration-200 flex items-center gap-2 ${
                    isSaving ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'
                  }`}
                  style={
                    !isSaving
                      ? {
                          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.9) 0%, rgba(34, 197, 94, 0.85) 100%)',
                          border: '2px solid color-mix(in srgb, #10B981 60%, transparent)',
                          boxShadow: `
                            0 8px 24px color-mix(in srgb, #10B981 40%, transparent),
                            inset 0 2px 0 rgba(255, 255, 255, 0.3)
                          `
                        }
                      : {
                          background: 'rgba(16, 185, 129, 0.2)',
                          border: '2px solid rgba(16, 185, 129, 0.3)'
                        }
                  }
                >
                  {isSaving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Sauvegarde...</span>
                    </>
                  ) : (
                    <>
                      <SpatialIcon Icon={ICONS.Save} size={18} />
                      <span>Sauvegarder dans ma Bibliothèque</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </GlassCard>
        </MotionDiv>

        {/* Week Cards with Meals */}
        <div className="grid grid-cols-1 gap-4">
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
                        {weekDays.length} jours avec recettes complètes
                      </p>
                    </div>
                  </div>

                  {/* Days Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {weekDays.map((day, dayIndex) => (
                      <div
                        key={`day-${dayIndex}`}
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

                        {/* Meals List with Enhanced Details */}
                        <div className="space-y-3">
                          {day.meals?.map((meal, mealIndex) => {
                            const mealIcons = {
                              breakfast: ICONS.Coffee,
                              lunch: ICONS.UtensilsCrossed,
                              dinner: ICONS.UtensilsCrossed,
                              snack: ICONS.Cookie
                            };

                            const mealLabels = {
                              breakfast: 'Petit-déjeuner',
                              lunch: 'Déjeuner',
                              dinner: 'Dîner',
                              snack: 'Collation'
                            };

                            return (
                              <div
                                key={`meal-${mealIndex}`}
                                onClick={() => handleViewRecipe(meal)}
                                className="p-3 rounded-lg cursor-pointer hover:bg-white/10 transition-all duration-200"
                                style={{
                                  background: 'rgba(139, 92, 246, 0.08)',
                                  border: '1px solid rgba(139, 92, 246, 0.2)'
                                }}
                              >
                                <div className="flex items-start gap-3">
                                  <div
                                    className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                                    style={{
                                      background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.3), rgba(168, 85, 247, 0.2))',
                                      border: '1px solid rgba(139, 92, 246, 0.4)'
                                    }}
                                  >
                                    <SpatialIcon
                                      Icon={mealIcons[meal.type as keyof typeof mealIcons] || ICONS.UtensilsCrossed}
                                      size={20}
                                      className="text-violet-300"
                                    />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="text-white/50 text-xs font-medium uppercase tracking-wide">
                                        {mealLabels[meal.type as keyof typeof mealLabels]}
                                      </span>
                                      {meal.detailedRecipe && (
                                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-400/20 border border-green-400/30">
                                          <div className="w-1.5 h-1.5 bg-green-400 rounded-full" />
                                          <span className="text-green-400 text-xs font-medium">Recette prête</span>
                                        </div>
                                      )}
                                    </div>
                                    <p className="text-white font-semibold text-base leading-tight mb-2">
                                      {meal.name}
                                    </p>

                                    {meal.detailedRecipe && (
                                      <div className="flex flex-wrap items-center gap-3 text-xs text-white/60">
                                        {meal.detailedRecipe.prepTimeMin && (
                                          <div className="flex items-center gap-1.5">
                                            <SpatialIcon Icon={ICONS.Clock} size={12} className="text-violet-400" />
                                            <span>{meal.detailedRecipe.prepTimeMin + (meal.detailedRecipe.cookTimeMin || 0)} min</span>
                                          </div>
                                        )}
                                        {meal.detailedRecipe.nutritionalInfo?.kcal && (
                                          <div className="flex items-center gap-1.5">
                                            <SpatialIcon Icon={ICONS.Flame} size={12} className="text-orange-400" />
                                            <span>{meal.detailedRecipe.nutritionalInfo.kcal} kcal</span>
                                          </div>
                                        )}
                                        {meal.detailedRecipe.difficulty && (
                                          <div className="flex items-center gap-1.5">
                                            <SpatialIcon Icon={ICONS.TrendingUp} size={12} className="text-blue-400" />
                                            <span className="capitalize">{meal.detailedRecipe.difficulty}</span>
                                          </div>
                                        )}
                                      </div>
                                    )}

                                    {!meal.detailedRecipe && meal.ingredients && meal.ingredients.length > 0 && (
                                      <p className="text-white/50 text-xs line-clamp-1">
                                        {meal.ingredients.slice(0, 3).join(', ')}
                                      </p>
                                    )}
                                  </div>
                                  {meal.detailedRecipe && (
                                    <SpatialIcon
                                      Icon={ICONS.ChevronRight}
                                      size={18}
                                      className="text-violet-400 flex-shrink-0 mt-1"
                                    />
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </GlassCard>
              </MotionDiv>
            );
          })}
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
              background: 'rgba(16, 185, 129, 0.05)',
              borderColor: 'rgba(16, 185, 129, 0.2)',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)'
            }}
          >
            <div className="flex items-center gap-3">
              <SpatialIcon Icon={ICONS.Lightbulb} size={20} className="text-green-400" />
              <p className="text-white/80 text-sm">
                <strong className="text-white">Prêt à utiliser :</strong> Votre plan alimentaire est complet avec toutes les recettes détaillées.
                Cliquez sur les repas pour voir les instructions complètes !
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

      {/* Recipe Detail Modal */}
      {showRecipeDetailModal && selectedRecipe && (
        <RecipeDetailModal
          recipe={selectedRecipe}
          onClose={handleCloseModal}
          onToggleSave={() => {}}
          isSaved={false}
        />
      )}
    </>
  );
};

export default RecipeDetailsValidationStage;
