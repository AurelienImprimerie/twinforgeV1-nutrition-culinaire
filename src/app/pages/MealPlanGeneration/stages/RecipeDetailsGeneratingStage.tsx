import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { usePerformanceMode } from '../../../../system/context/PerformanceModeContext';
import { useMealPlanGenerationPipeline } from '../../../../system/store/mealPlanGenerationPipeline';
import { useRecipeImageRealtime } from '../../../../hooks/useRecipeImageRealtime';
import GlassCard from '../../../../ui/cards/GlassCard';
import SpatialIcon from '../../../../ui/icons/SpatialIcon';
import { ICONS } from '../../../../ui/icons/registry';
import MealPlanRecipeCard from '../components/MealPlanRecipeCard';

interface RecipeDetailsGeneratingStageProps {
  onExit: () => void;
}

const RecipeDetailsGeneratingStage: React.FC<RecipeDetailsGeneratingStageProps> = ({ onExit }) => {
  const { isPerformanceMode } = usePerformanceMode();
  const { mealPlanCandidates, loadingState, loadingMessage } = useMealPlanGenerationPipeline();
  const MotionDiv = isPerformanceMode ? 'div' : motion.div;

  // Calculate progress based on generated recipes
  const currentPlan = mealPlanCandidates[0];
  let totalMeals = 0;
  let generatedMeals = 0;

  if (currentPlan) {
    currentPlan.days.forEach(day => {
      day.meals?.forEach(meal => {
        totalMeals++;
        if (meal.recipeGenerated && meal.status === 'ready') {
          generatedMeals++;
        }
      });
    });
  }

  const progressPercentage = totalMeals > 0 ? Math.round((generatedMeals / totalMeals) * 100) : 0;
  const isStreaming = loadingState === 'streaming_recipes' && generatedMeals > 0;

  // Collect all recipe IDs for realtime listening
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
              radial-gradient(circle at 30% 20%, color-mix(in srgb, #A855F7 15%, transparent) 0%, transparent 60%),
              radial-gradient(circle at 70% 80%, color-mix(in srgb, #7C3AED 12%, transparent) 0%, transparent 50%),
              linear-gradient(145deg, rgba(255,255,255,0.08), rgba(255,255,255,0.05)),
              rgba(11, 14, 23, 0.85)
            `,
            borderColor: 'color-mix(in srgb, #A855F7 30%, transparent)',
            boxShadow: `
              0 20px 60px rgba(0, 0, 0, 0.3),
              0 0 40px color-mix(in srgb, #A855F7 25%, transparent),
              0 0 80px color-mix(in srgb, #7C3AED 20%, transparent),
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
                    radial-gradient(circle at 70% 70%, color-mix(in srgb, #A855F7 25%, transparent) 0%, transparent 50%),
                    linear-gradient(135deg, color-mix(in srgb, #A855F7 45%, transparent), color-mix(in srgb, #7C3AED 40%, transparent))
                  `,
                  border: '4px solid color-mix(in srgb, #A855F7 50%, transparent)',
                  boxShadow: `
                    0 0 40px color-mix(in srgb, #A855F7 50%, transparent),
                    0 0 80px color-mix(in srgb, #7C3AED 40%, transparent),
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
                  Icon={ICONS.ChefHat}
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
                    background: 'linear-gradient(135deg, #A855F7, #7C3AED)',
                    boxShadow: '0 0 12px #A855F7',
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

            {/* Title and Description */}
            <div className="space-y-4">
              <h2
                className="text-3xl font-bold text-white"
                style={{
                  textShadow: '0 0 30px color-mix(in srgb, #A855F7 60%, transparent)'
                }}
              >
                Génération des Recettes Détaillées
              </h2>
              <p className="text-white/80 text-lg max-w-2xl mx-auto leading-relaxed">
                {loadingMessage || 'La Forge Nutritionnelle crée des recettes complètes avec instructions détaillées, temps de préparation et informations nutritionnelles...'}
              </p>
            </div>

            {/* Progress Bar */}
            {isStreaming && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/80">Génération des recettes en cours...</span>
                  <span className="text-purple-400 font-semibold">{generatedMeals}/{totalMeals} recettes</span>
                </div>
                <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-purple-500 to-violet-600"
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercentage}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                    style={{
                      boxShadow: '0 0 20px rgba(168, 85, 247, 0.6)'
                    }}
                  />
                </div>
                <div className="text-center">
                  <span className="text-purple-300 text-2xl font-bold">{progressPercentage}%</span>
                </div>
              </div>
            )}

            {/* Loading Steps - Only show when not streaming */}
            {!isStreaming && (
              <div className="space-y-3 max-w-md mx-auto">
                {[
                  'Analyse des repas planifiés',
                  'Création des recettes détaillées',
                  'Optimisation des instructions',
                  'Calcul des valeurs nutritionnelles'
                ].map((step, index) => (
                  <MotionDiv
                    key={step}
                    className="flex items-center gap-3 p-3 rounded-lg"
                    style={{
                      background: 'rgba(168, 85, 247, 0.1)',
                      border: '1px solid rgba(168, 85, 247, 0.2)'
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
                        background: 'linear-gradient(135deg, #A855F7, #7C3AED)',
                        boxShadow: '0 0 12px rgba(168, 85, 247, 0.5)'
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

      {/* Recipes Streaming Display - Rich Card Grid */}
      {isStreaming && currentPlan && (
        <MotionDiv
          {...(!isPerformanceMode && {
            initial: { opacity: 0, y: 20 },
            animate: { opacity: 1, y: 0 },
            transition: { duration: 0.5 }
          })}
        >
          <GlassCard
            className="p-6"
            style={{
              background: 'rgba(11, 14, 23, 0.8)',
              borderColor: 'rgba(168, 85, 247, 0.25)',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)'
            }}
          >
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(135deg, #A855F7, #7C3AED)',
                    boxShadow: '0 0 20px rgba(168, 85, 247, 0.5)'
                  }}
                >
                  <SpatialIcon
                    Icon={ICONS.ChefHat}
                    size={28}
                    className="text-white"
                  />
                </div>
                <div>
                  <h3 className="text-white font-bold text-2xl mb-1">Recettes Générées</h3>
                  <p className="text-white/70 text-sm">
                    {generatedMeals}/{totalMeals} recettes complètes avec détails nutritionnels
                  </p>
                </div>
              </div>

              {/* Recipes Grid by Day */}
              <div className="space-y-8">
                {currentPlan.days.map((day, dayIndex) => (
                  <div key={`day-${dayIndex}`}>
                    {/* Day Header */}
                    <div className="flex items-center gap-3 mb-4">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{
                          background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.3), rgba(139, 92, 246, 0.2))',
                          border: '1.5px solid rgba(168, 85, 247, 0.4)'
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
                          Jour {dayIndex + 1} - {day.meals?.filter(m => m.recipeGenerated).length || 0}/{day.meals?.length || 0} repas prêts
                        </p>
                      </div>
                    </div>

                    {/* Meals Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {day.meals?.map((meal, mealIndex) => {
                        const isGenerated = meal.recipeGenerated && meal.status === 'ready';

                        return (
                          <MealPlanRecipeCard
                            key={`meal-${dayIndex}-${mealIndex}`}
                            meal={meal}
                            dayIndex={dayIndex}
                            isGenerated={isGenerated}
                          />
                        );
                      })}
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

export default RecipeDetailsGeneratingStage;
