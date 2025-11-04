import React, { useState } from 'react';
import { motion } from 'framer-motion';
import GlassCard from '../../../../ui/cards/GlassCard';
import SpatialIcon from '../../../../ui/icons/SpatialIcon';
import { ICONS } from '../../../../ui/icons/registry';
import type { MealPlanCandidate } from '../../../../system/store/mealPlanGenerationStore';

interface PreviewStageProps {
  plans: MealPlanCandidate[];
  onProceedToRecipes: () => void;
  onRegenerateWeek: (weekNumber: number) => void;
  onRegenerateMeal: (weekNumber: number, dayIndex: number, mealId: string) => void;
  onDiscard: () => void;
  isGenerating: boolean;
}

const PreviewStage: React.FC<PreviewStageProps> = ({
  plans,
  onProceedToRecipes,
  onDiscard
}) => {
  const [expandedWeek, setExpandedWeek] = useState<number | null>(0);
  const [expandedDay, setExpandedDay] = useState<number | null>(null);

  const getMealTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      breakfast: 'Petit-déjeuner',
      lunch: 'Déjeuner',
      dinner: 'Dîner',
      snack: 'Collation'
    };
    return labels[type] || type;
  };

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <GlassCard className="p-6" style={{ background: 'rgba(139, 92, 246, 0.05)', borderColor: 'rgba(139, 92, 246, 0.2)' }}>
          <div className="flex items-start gap-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{
                background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.3), rgba(168, 85, 247, 0.25))',
                border: '2px solid rgba(139, 92, 246, 0.4)'
              }}
            >
              <SpatialIcon Icon={ICONS.Eye} size={24} className="text-purple-300" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white mb-2">Aperçu du Plan</h3>
              <p className="text-white/70">
                Votre plan alimentaire est prêt ! Parcourez les repas générés et validez avant de passer aux recettes détaillées.
              </p>
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {plans.map((plan, planIndex) => (
        <motion.div
          key={plan.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: planIndex * 0.1 }}
        >
          <GlassCard className="p-6" style={{ background: 'rgba(139, 92, 246, 0.05)', borderColor: 'rgba(139, 92, 246, 0.2)' }}>
            <button
              onClick={() => setExpandedWeek(expandedWeek === planIndex ? null : planIndex)}
              className="w-full flex items-center justify-between mb-4"
            >
              <div className="flex items-center gap-3">
                <div className="px-3 py-1 rounded-lg bg-purple-500/20 border border-purple-500/30">
                  <span className="text-purple-300 font-bold">Semaine {plan.weekNumber}</span>
                </div>
                <span className="text-white font-semibold">{plan.days.length} jours</span>
              </div>
              <SpatialIcon
                Icon={ICONS.ChevronDown}
                size={20}
                className={`text-white transition-transform ${expandedWeek === planIndex ? 'rotate-180' : ''}`}
              />
            </button>

            {expandedWeek === planIndex && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-3"
              >
                {plan.days.map((day, dayIndex) => (
                  <div
                    key={dayIndex}
                    className="p-4 rounded-xl"
                    style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(139, 92, 246, 0.2)' }}
                  >
                    <button
                      onClick={() => setExpandedDay(expandedDay === dayIndex ? null : dayIndex)}
                      className="w-full flex items-center justify-between mb-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-purple-500/20">
                          <span className="text-white font-bold text-sm">{dayIndex + 1}</span>
                        </div>
                        <span className="text-white font-medium">
                          {new Date(day.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </span>
                        <span className="text-white/60 text-sm">• {day.meals.length} repas</span>
                      </div>
                      <SpatialIcon
                        Icon={ICONS.ChevronDown}
                        size={18}
                        className={`text-white/60 transition-transform ${expandedDay === dayIndex ? 'rotate-180' : ''}`}
                      />
                    </button>

                    {expandedDay === dayIndex && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="space-y-2 pl-11"
                      >
                        {day.meals.map((meal) => (
                          <div
                            key={meal.id}
                            className="p-3 rounded-lg"
                            style={{ background: 'rgba(139, 92, 246, 0.08)' }}
                          >
                            <div className="flex items-start justify-between mb-1">
                              <span className="text-purple-400 text-xs font-semibold uppercase">{getMealTypeLabel(meal.mealType)}</span>
                              {meal.nutritionalInfo?.calories && (
                                <span className="text-white/70 text-xs">{meal.nutritionalInfo.calories} kcal</span>
                              )}
                            </div>
                            <h4 className="text-white font-semibold text-sm">{meal.mealName}</h4>
                            {meal.mealDescription && (
                              <p className="text-white/60 text-xs mt-1">{meal.mealDescription}</p>
                            )}
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </div>
                ))}
              </motion.div>
            )}
          </GlassCard>
        </motion.div>
      ))}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between gap-4"
      >
        <button
          onClick={onDiscard}
          className="px-6 py-3 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-xl text-red-300 font-medium transition-all duration-200"
        >
          Recommencer
        </button>

        <button
          onClick={onProceedToRecipes}
          className="px-8 py-3 rounded-xl font-semibold text-white transition-all duration-200 hover:scale-105 flex items-center gap-3"
          style={{
            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.9) 0%, rgba(168, 85, 247, 0.85) 100%)',
            border: '2px solid rgba(139, 92, 246, 0.5)',
            boxShadow: '0 8px 24px rgba(139, 92, 246, 0.3)'
          }}
        >
          <span>Générer les Recettes</span>
          <SpatialIcon Icon={ICONS.ArrowRight} size={20} />
        </button>
      </motion.div>
    </div>
  );
};

export default PreviewStage;
