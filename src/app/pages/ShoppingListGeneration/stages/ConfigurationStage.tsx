import React from 'react';
import { motion } from 'framer-motion';
import { usePerformanceMode } from '../../../../system/context/PerformanceModeContext';
import GlassCard from '../../../../ui/cards/GlassCard';
import SpatialIcon from '../../../../ui/icons/SpatialIcon';
import { ICONS } from '../../../../ui/icons/registry';
import CustomDropdown from '../../../pages/Fridge/tabs/RecipesTab/components/CustomDropdown';

interface ConfigurationStageProps {
  availableMealPlans: any[];
  selectedMealPlanId: string | null;
  generationMode: 'user_only' | 'user_and_family';
  onSetGenerationMode: (mode: 'user_only' | 'user_and_family') => void;
  onSetSelectedMealPlan: (id: string) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  onExit: () => void;
}

const ConfigurationStage: React.FC<ConfigurationStageProps> = ({
  availableMealPlans,
  selectedMealPlanId,
  generationMode,
  onSetGenerationMode,
  onSetSelectedMealPlan,
  onGenerate,
  isGenerating,
  onExit
}) => {
  const { isPerformanceMode } = usePerformanceMode();
  const MotionDiv = isPerformanceMode ? 'div' : motion.div;

  const selectedPlan = availableMealPlans.find(plan => plan.id === selectedMealPlanId);
  const hasValidPlan = selectedPlan && selectedPlan.days && selectedPlan.days.length > 0;

  const mealPlanOptions = availableMealPlans.map(plan => {
    // Parse the date properly from different possible formats
    let dateStr = 'Date inconnue';
    try {
      const date = new Date(plan.created_at || plan.createdAt);
      if (!isNaN(date.getTime())) {
        dateStr = date.toLocaleDateString('fr-FR', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        });
      }
    } catch (e) {
      console.warn('Invalid date for meal plan:', plan);
    }

    return {
      value: plan.id,
      label: `Plan du ${dateStr}`
    };
  });

  return (
    <div className="space-y-6">
      {/* Main Configuration Card */}
      <MotionDiv
        {...(!isPerformanceMode && {
          initial: { opacity: 0, y: 20 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.5 }
        })}
      >
        <GlassCard
          className="p-8"
          style={{
            background: `
              radial-gradient(circle at 30% 20%, color-mix(in srgb, #fb923c 12%, transparent) 0%, transparent 60%),
              radial-gradient(circle at 70% 80%, color-mix(in srgb, #f97316 8%, transparent) 0%, transparent 50%),
              linear-gradient(145deg, rgba(255,255,255,0.08), rgba(255,255,255,0.05)),
              rgba(11, 14, 23, 0.85)
            `,
            borderColor: 'color-mix(in srgb, #fb923c 30%, transparent)',
            boxShadow: `
              0 20px 60px rgba(0, 0, 0, 0.3),
              0 0 40px color-mix(in srgb, #fb923c 20%, transparent),
              inset 0 2px 0 rgba(255, 255, 255, 0.15)
            `,
            backdropFilter: 'blur(24px) saturate(150%)',
            WebkitBackdropFilter: 'blur(24px) saturate(150%)'
          }}
        >
          <div className="space-y-8">
            {/* Header */}
            <div className="text-center space-y-4">
              <div
                className="w-20 h-20 mx-auto rounded-2xl flex items-center justify-center"
                style={{
                  background: `
                    radial-gradient(circle at 30% 30%, rgba(255,255,255,0.25) 0%, transparent 60%),
                    linear-gradient(135deg, color-mix(in srgb, #fb923c 40%, transparent), color-mix(in srgb, #f97316 35%, transparent))
                  `,
                  border: '3px solid color-mix(in srgb, #fb923c 50%, transparent)',
                  boxShadow: `
                    0 0 30px color-mix(in srgb, #fb923c 40%, transparent),
                    inset 0 2px 0 rgba(255,255,255,0.3)
                  `
                }}
              >
                <SpatialIcon
                  Icon={ICONS.Settings}
                  size={48}
                  color="rgba(255, 255, 255, 0.95)"
                  variant="pure"
                />
              </div>

              <div>
                <h2
                  className="text-3xl font-bold text-white mb-3"
                  style={{
                    textShadow: '0 0 25px color-mix(in srgb, #fb923c 50%, transparent)'
                  }}
                >
                  Configurez votre Liste de Courses
                </h2>
                <p className="text-white/80 text-lg">
                  Sélectionnez votre plan de repas et vos préférences
                </p>
              </div>
            </div>

            {/* Configuration Form */}
            <div className="space-y-6">
              {/* Meal Plan Selection */}
              <div className="space-y-3">
                <label className="block text-white font-semibold text-sm">
                  Plan de repas
                </label>
                <CustomDropdown
                  options={mealPlanOptions}
                  value={selectedMealPlanId || ''}
                  onChange={(value) => onSetSelectedMealPlan(value)}
                  placeholder="Choisir un plan de repas"
                  className="w-full"
                  disabled={isGenerating}
                />
              </div>

              {/* Generation Mode Buttons */}
              <div className="space-y-3">
                <label className="block text-white font-semibold text-sm">
                  Type de liste
                </label>
                <div className="flex gap-4">
                  <button
                    onClick={() => onSetGenerationMode('user_only')}
                    disabled={isGenerating}
                    className={`flex-1 p-4 rounded-xl border transition-all duration-200 ${
                      generationMode === 'user_only'
                        ? 'border-orange-400/50 bg-gradient-to-br from-orange-500/25 to-orange-600/15 text-orange-300'
                        : 'border-white/20 bg-white/5 text-white/60 hover:border-orange-400/30 hover:bg-orange-500/10'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-3">
                      <SpatialIcon Icon={ICONS.User} size={24} />
                      <div className="text-center">
                        <div className="font-medium">Personnel</div>
                        <div className="text-sm opacity-75">Pour vous uniquement</div>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => onSetGenerationMode('user_and_family')}
                    disabled={isGenerating}
                    className={`flex-1 p-4 rounded-xl border transition-all duration-200 ${
                      generationMode === 'user_and_family'
                        ? 'border-orange-400/50 bg-gradient-to-br from-orange-500/25 to-orange-600/15 text-orange-300'
                        : 'border-white/20 bg-white/5 text-white/60 hover:border-orange-400/30 hover:bg-orange-500/10'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-3">
                      <SpatialIcon Icon={ICONS.Users} size={24} />
                      <div className="text-center">
                        <div className="font-medium">Familial</div>
                        <div className="text-sm opacity-75">Pour toute la famille</div>
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Selected Plan Info */}
              {!availableMealPlans.length ? (
                <div
                  className="p-4 rounded-xl"
                  style={{
                    background: 'rgba(251, 146, 60, 0.1)',
                    border: '1px solid rgba(251, 146, 60, 0.3)'
                  }}
                >
                  <div className="flex items-center gap-3">
                    <SpatialIcon Icon={ICONS.AlertTriangle} size={20} className="text-amber-400" />
                    <div>
                      <p className="text-white font-medium">Aucun plan disponible</p>
                      <p className="text-white/70 text-sm">
                        Créez un plan de repas pour générer votre liste de courses !
                      </p>
                    </div>
                  </div>
                </div>
              ) : hasValidPlan && (
                <div
                  className="p-4 rounded-xl"
                  style={{
                    background: 'rgba(251, 146, 60, 0.1)',
                    border: '1px solid rgba(251, 146, 60, 0.3)'
                  }}
                >
                  <div className="flex items-center gap-3">
                    <SpatialIcon Icon={ICONS.Check} size={20} className="text-orange-400" />
                    <div>
                      <p className="text-white font-medium">Plan sélectionné</p>
                      <p className="text-white/70 text-sm">
                        {selectedPlan.days?.length || 0} jours de repas planifiés
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Generate Button */}
            <button
              onClick={onGenerate}
              disabled={!hasValidPlan || isGenerating}
              className={`w-full text-white font-semibold py-4 px-8 rounded-xl transition-all duration-200 flex items-center justify-center space-x-3 ${
                !hasValidPlan || isGenerating ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'
              }`}
              style={{
                background: hasValidPlan && !isGenerating
                  ? 'linear-gradient(135deg, rgba(251, 146, 60, 0.9) 0%, rgba(249, 115, 22, 0.85) 100%)'
                  : 'linear-gradient(135deg, rgba(100, 100, 100, 0.5) 0%, rgba(80, 80, 80, 0.5) 100%)',
                backdropFilter: 'blur(20px) saturate(160%)',
                WebkitBackdropFilter: 'blur(20px) saturate(160%)',
                border: hasValidPlan && !isGenerating
                  ? '2px solid rgba(251, 146, 60, 0.6)'
                  : '2px solid rgba(100, 100, 100, 0.3)',
                boxShadow: hasValidPlan && !isGenerating
                  ? `
                    0 12px 40px rgba(251, 146, 60, 0.4),
                    0 0 60px rgba(251, 146, 60, 0.3),
                    inset 0 3px 0 rgba(255, 255, 255, 0.4),
                    inset 0 -3px 0 rgba(0, 0, 0, 0.2)
                  `
                  : '0 4px 12px rgba(0, 0, 0, 0.3)'
              }}
            >
              {isGenerating ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span className="text-lg">Génération en cours...</span>
                </>
              ) : (
                <>
                  <SpatialIcon Icon={ICONS.Sparkles} size={24} />
                  <span className="text-lg">Générer ma Liste de Courses</span>
                </>
              )}
            </button>
          </div>
        </GlassCard>
      </MotionDiv>

      {/* Process Understanding Cards */}
      {selectedPlan && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: Votre Plan de Repas */}
          <MotionDiv
            {...(!isPerformanceMode && {
              initial: { opacity: 0, y: 20 },
              animate: { opacity: 1, y: 0 },
              transition: { duration: 0.3, delay: 0.3 }
            })}
          >
            <GlassCard
              className="p-4"
              style={{
                background: 'rgba(251, 146, 60, 0.05)',
                borderColor: 'rgba(251, 146, 60, 0.2)',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)'
              }}
            >
              <div className="flex items-start gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{
                    background: 'rgba(251, 146, 60, 0.2)',
                    border: '1px solid rgba(251, 146, 60, 0.3)'
                  }}
                >
                  <SpatialIcon
                    Icon={ICONS.Calendar}
                    size={20}
                    className="text-orange-400"
                    style={{
                      filter: 'drop-shadow(0 0 8px rgba(251, 146, 60, 0.6))'
                    }}
                  />
                </div>
                <div className="flex-1">
                  <h3 className="text-white font-semibold mb-1 text-sm">Votre Plan de Repas</h3>
                  <p className="text-white/80 text-xs">
                    Liste basée sur vos repas planifiés pour la semaine
                  </p>
                  <p className="text-orange-400 text-xs mt-1 font-medium">
                    {selectedPlan.days?.length || 0} jours de repas
                  </p>
                </div>
              </div>
            </GlassCard>
          </MotionDiv>

          {/* Card 2: Liste Intelligente */}
          <MotionDiv
            {...(!isPerformanceMode && {
              initial: { opacity: 0, y: 20 },
              animate: { opacity: 1, y: 0 },
              transition: { duration: 0.3, delay: 0.4 }
            })}
          >
            <GlassCard
              className="p-4"
              style={{
                background: 'rgba(251, 146, 60, 0.05)',
                borderColor: 'rgba(251, 146, 60, 0.2)',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)'
              }}
            >
              <div className="flex items-start gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{
                    background: 'rgba(251, 146, 60, 0.2)',
                    border: '1px solid rgba(251, 146, 60, 0.3)'
                  }}
                >
                  <SpatialIcon
                    Icon={ICONS.Brain}
                    size={20}
                    className="text-orange-400"
                    style={{
                      filter: 'drop-shadow(0 0 8px rgba(251, 146, 60, 0.6))'
                    }}
                  />
                </div>
                <div className="flex-1">
                  <h3 className="text-white font-semibold mb-1 text-sm">Liste Intelligente</h3>
                  <p className="text-white/80 text-xs">
                    IA qui optimise les quantités et organise par rayons
                  </p>
                  <p className="text-orange-400 text-xs mt-1 font-medium">
                    Organisation automatique
                  </p>
                </div>
              </div>
            </GlassCard>
          </MotionDiv>

          {/* Card 3: Budget Optimisé */}
          <MotionDiv
            {...(!isPerformanceMode && {
              initial: { opacity: 0, y: 20 },
              animate: { opacity: 1, y: 0 },
              transition: { duration: 0.3, delay: 0.5 }
            })}
          >
            <GlassCard
              className="p-4"
              style={{
                background: 'rgba(251, 146, 60, 0.05)',
                borderColor: 'rgba(251, 146, 60, 0.2)',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)'
              }}
            >
              <div className="flex items-start gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{
                    background: 'rgba(251, 146, 60, 0.2)',
                    border: '1px solid rgba(251, 146, 60, 0.3)'
                  }}
                >
                  <SpatialIcon
                    Icon={ICONS.Wallet}
                    size={20}
                    className="text-orange-400"
                    style={{
                      filter: 'drop-shadow(0 0 8px rgba(251, 146, 60, 0.6))'
                    }}
                  />
                </div>
                <div className="flex-1">
                  <h3 className="text-white font-semibold mb-1 text-sm">Budget Optimisé</h3>
                  <p className="text-white/80 text-xs">
                    Estimation des coûts adaptée à votre région (DOM-TOM inclus)
                  </p>
                  <p className="text-orange-400 text-xs mt-1 font-medium">
                    Prix géolocalisés
                  </p>
                </div>
              </div>
            </GlassCard>
          </MotionDiv>
        </div>
      )}

      {/* Exit Button */}
      <div className="flex justify-center">
        <button
          onClick={onExit}
          className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-white font-medium transition-all duration-200"
        >
          Quitter
        </button>
      </div>
    </div>
  );
};

export default ConfigurationStage;
