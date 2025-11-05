import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { usePerformanceMode } from '../../../../system/context/PerformanceModeContext';
import { useRecipeImageRealtime } from '../../../../hooks/useRecipeImageRealtime';
import GlassCard from '../../../../ui/cards/GlassCard';
import SpatialIcon from '../../../../ui/icons/SpatialIcon';
import { ICONS } from '../../../../ui/icons/registry';
import RecipeDetailModal from '../../../pages/Fridge/tabs/RecipesTab/components/RecipeDetailModal';
import MealPlanRecipeCard from '../components/MealPlanRecipeCard';
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

  const weekCount = Math.ceil(mealPlan.days.length / 7);
  const totalMeals = mealPlan.days.reduce((sum, day) => sum + (day.meals?.length || 0), 0);
  const recipesWithDetails = mealPlan.days.reduce((sum, day) =>
    sum + (day.meals?.filter(m => m.detailedRecipe).length || 0), 0
  );
  const recipesWithImages = mealPlan.days.reduce((sum, day) =>
    sum + (day.meals?.filter(m => m.detailedRecipe?.imageUrl).length || 0), 0
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

  // Collect all recipe IDs for realtime listening
  const recipeIds = useMemo(() => {
    if (!mealPlan) return [];
    const ids: string[] = [];
    mealPlan.days.forEach(day => {
      day.meals?.forEach(meal => {
        if (meal.detailedRecipe?.id) {
          ids.push(meal.detailedRecipe.id);
        }
      });
    });
    return ids;
  }, [mealPlan]);

  // Listen for real-time image updates (in case some are still generating)
  useRecipeImageRealtime(true, recipeIds);

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
                  <div className="flex items-center gap-3 flex-wrap">
                    <p className="text-white/70">
                      {weekCount} semaine{weekCount > 1 ? 's' : ''} · {recipesWithDetails} recettes détaillées
                    </p>
                    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-green-400/20 border border-green-400/30">
                      <div className="w-2 h-2 bg-green-400 rounded-full" />
                      <span className="text-green-400 text-xs font-medium">Complet</span>
                    </div>
                    {recipesWithImages > 0 && (
                      <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-blue-400/20 border border-blue-400/30">
                        <SpatialIcon Icon={ICONS.Image} size={12} className="text-blue-400" />
                        <span className="text-blue-400 text-xs font-medium">{recipesWithImages} images</span>
                      </div>
                    )}
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
                  <div className="space-y-6">
                    {weekDays.map((day, dayIndex) => (
                      <div key={`day-${dayIndex}`}>
                        {/* Day Header */}
                        <div className="flex items-center gap-3 mb-4">
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
                            <h5 className="text-white font-bold text-base">
                              {new Date(day.date).toLocaleDateString('fr-FR', {
                                weekday: 'long',
                                day: 'numeric',
                                month: 'long'
                              })}
                            </h5>
                            <p className="text-white/60 text-xs">
                              {day.meals?.length || 0} repas avec recettes complètes
                            </p>
                          </div>
                        </div>

                        {/* Meals Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {day.meals?.map((meal, mealIndex) => (
                            <MealPlanRecipeCard
                              key={`meal-${mealIndex}`}
                              meal={meal}
                              dayIndex={weekIndex * 7 + dayIndex}
                              isGenerated={meal.recipeGenerated && meal.status === 'ready'}
                              onClick={meal.detailedRecipe ? () => handleViewRecipe(meal) : undefined}
                            />
                          ))}
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
