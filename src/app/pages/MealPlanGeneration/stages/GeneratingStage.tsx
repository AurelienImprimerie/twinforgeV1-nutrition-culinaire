import React from 'react';
import { motion } from 'framer-motion';
import { usePerformanceMode } from '../../../../system/context/PerformanceModeContext';
import { useMealPlanGenerationPipeline } from '../../../../system/store/mealPlanGenerationPipeline';
import GlassCard from '../../../../ui/cards/GlassCard';
import SpatialIcon from '../../../../ui/icons/SpatialIcon';
import { ICONS } from '../../../../ui/icons/registry';
import SkeletonBase from '../../../../ui/components/skeletons/SkeletonBase';

interface GeneratingStageProps {
  onExit: () => void;
}

const GeneratingStage: React.FC<GeneratingStageProps> = ({ onExit }) => {
  const { isPerformanceMode } = usePerformanceMode();
  const { mealPlanCandidates, loadingState, config } = useMealPlanGenerationPipeline();
  const MotionDiv = isPerformanceMode ? 'div' : motion.div;

  // Calculate progress based on received days
  const currentPlan = mealPlanCandidates[0];
  const totalDays = 7;
  const receivedDays = currentPlan?.days?.length || 0;
  const progressPercentage = Math.round((receivedDays / totalDays) * 100);
  const isStreaming = loadingState === 'streaming' && receivedDays > 0;

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

            {/* Title and Description */}
            <div className="space-y-4">
              <h2
                className="text-3xl font-bold text-white"
                style={{
                  textShadow: '0 0 30px color-mix(in srgb, #8B5CF6 60%, transparent)'
                }}
              >
                Forge des Plans Alimentaires
              </h2>
              <p className="text-white/80 text-lg max-w-2xl mx-auto leading-relaxed">
                La Forge Nutritionnelle analyse votre inventaire et vos préférences pour créer des plans alimentaires optimisés...
              </p>
            </div>

            {/* Progress Bar */}
            {isStreaming && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/80">Génération en cours...</span>
                  <span className="text-violet-400 font-semibold">{receivedDays}/{totalDays} jours</span>
                </div>
                <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-violet-500 to-purple-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercentage}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                    style={{
                      boxShadow: '0 0 20px rgba(139, 92, 246, 0.6)'
                    }}
                  />
                </div>
                <div className="text-center">
                  <span className="text-violet-300 text-2xl font-bold">{progressPercentage}%</span>
                </div>
              </div>
            )}

            {/* Loading Steps - Only show when not streaming */}
            {!isStreaming && (
              <div className="space-y-3 max-w-md mx-auto">
                {[
                  'Analyse de votre inventaire',
                  'Optimisation nutritionnelle',
                  'Création des plans hebdomadaires',
                  'Génération de la structure des repas'
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

      {/* Days Streaming Display */}
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
                <div>
                  <h3 className="text-white font-bold text-xl">{currentPlan.title}</h3>
                  <p className="text-white/60 text-sm">
                    {receivedDays} jour{receivedDays > 1 ? 's' : ''} généré{receivedDays > 1 ? 's' : ''}
                  </p>
                </div>
              </div>

              {/* Days Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {/* Show generated days with staggered animation */}
                {currentPlan.days.map((day, index) => (
                  <MotionDiv
                    key={`day-${day.date}-${index}`}
                    {...(!isPerformanceMode && {
                      initial: { opacity: 0, y: 20, scale: 0.95 },
                      animate: { opacity: 1, y: 0, scale: 1 },
                      transition: {
                        duration: 0.4,
                        delay: index * 0.15,
                        ease: [0.4, 0, 0.2, 1]
                      }
                    })}
                    className="p-4 rounded-lg"
                    style={{
                      background: 'rgba(139, 92, 246, 0.08)',
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
                    <div className="space-y-2">
                      {day.meals?.map((meal, mealIndex) => {
                        const mealIcons = {
                          breakfast: ICONS.Coffee,
                          lunch: ICONS.UtensilsCrossed,
                          dinner: ICONS.UtensilsCrossed,
                          snack: ICONS.Cookie
                        };
                        return (
                          <div
                            key={`meal-${mealIndex}`}
                            className="flex items-start gap-2 p-2 rounded"
                            style={{ background: 'rgba(139, 92, 246, 0.08)' }}
                          >
                            <SpatialIcon
                              Icon={mealIcons[meal.type as keyof typeof mealIcons] || ICONS.UtensilsCrossed}
                              size={14}
                              className="text-violet-400 mt-0.5 flex-shrink-0"
                            />
                            <p className="text-white/90 text-sm font-medium leading-tight">
                              {meal.name}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </MotionDiv>
                ))}

                {/* Show skeleton placeholders for remaining days */}
                {Array.from({ length: totalDays - receivedDays }).map((_, index) => (
                  <div
                    key={`skeleton-${index}`}
                    className="p-4 rounded-lg"
                    style={{
                      background: 'rgba(139, 92, 246, 0.05)',
                      border: '1px solid rgba(139, 92, 246, 0.1)'
                    }}
                  >
                    <SkeletonBase width="60%" height="16px" className="mb-3" />
                    <div className="space-y-2">
                      <SkeletonBase width="100%" height="32px" />
                      <SkeletonBase width="100%" height="32px" />
                      <SkeletonBase width="100%" height="32px" />
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

export default GeneratingStage;
