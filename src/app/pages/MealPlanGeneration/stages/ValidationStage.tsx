import React, { useState } from 'react';
import { motion } from 'framer-motion';
import GlassCard from '../../../../ui/cards/GlassCard';
import SpatialIcon from '../../../../ui/icons/SpatialIcon';
import { ICONS } from '../../../../ui/icons/registry';
import type { MealPlanCandidate } from '../../../../system/store/mealPlanGenerationStore';

interface ValidationStageProps {
  plans: MealPlanCandidate[];
  onSaveAll: () => void;
  onDiscard: () => void;
  isSaving: boolean;
}

const ValidationStage: React.FC<ValidationStageProps> = ({
  plans,
  onSaveAll,
  onDiscard,
  isSaving
}) => {
  const [expandedWeek, setExpandedWeek] = useState<number | null>(0);

  const totalDays = plans.reduce((sum, plan) => sum + plan.days.length, 0);
  const totalMeals = plans.reduce(
    (sum, plan) => sum + plan.days.reduce((daySum, day) => daySum + day.meals.length, 0),
    0
  );

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <GlassCard
          className="p-6"
          style={{
            background: `radial-gradient(circle at 30% 20%, rgba(139, 92, 246, 0.15) 0%, transparent 60%), linear-gradient(145deg, rgba(255,255,255,0.08), rgba(255,255,255,0.05)), rgba(11, 14, 23, 0.85)`,
            borderColor: 'rgba(139, 92, 246, 0.3)'
          }}
        >
          <div className="flex items-start gap-4">
            <div
              className="w-16 h-16 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{
                background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.4), rgba(168, 85, 247, 0.35))',
                border: '2px solid rgba(139, 92, 246, 0.5)',
                boxShadow: '0 0 25px rgba(139, 92, 246, 0.4)'
              }}
            >
              <SpatialIcon Icon={ICONS.Check} size={32} className="text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-2xl font-bold text-white mb-2">Plan Complet Généré !</h3>
              <p className="text-white/70 mb-4">
                Votre plan alimentaire personnalisé est prêt avec toutes les recettes détaillées et les images.
              </p>
              <div className="grid grid-cols-3 gap-4">
                <div className="p-3 rounded-lg" style={{ background: 'rgba(139, 92, 246, 0.15)' }}>
                  <div className="text-2xl font-bold text-purple-300 mb-1">{plans.length}</div>
                  <div className="text-white/70 text-sm">Semaine{plans.length > 1 ? 's' : ''}</div>
                </div>
                <div className="p-3 rounded-lg" style={{ background: 'rgba(139, 92, 246, 0.15)' }}>
                  <div className="text-2xl font-bold text-purple-300 mb-1">{totalDays}</div>
                  <div className="text-white/70 text-sm">Jour{totalDays > 1 ? 's' : ''}</div>
                </div>
                <div className="p-3 rounded-lg" style={{ background: 'rgba(139, 92, 246, 0.15)' }}>
                  <div className="text-2xl font-bold text-purple-300 mb-1">{totalMeals}</div>
                  <div className="text-white/70 text-sm">Repas</div>
                </div>
              </div>
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
              className="w-full flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="px-4 py-2 rounded-lg bg-purple-500/20 border border-purple-500/30">
                  <span className="text-purple-300 font-bold">Semaine {plan.weekNumber}</span>
                </div>
                <span className="text-white font-semibold">{plan.days.length} jours • {plan.days.reduce((sum, day) => sum + day.meals.length, 0)} repas</span>
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
                className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3"
              >
                {plan.days.map((day, dayIndex) => (
                  <div
                    key={dayIndex}
                    className="p-4 rounded-xl"
                    style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(139, 92, 246, 0.2)' }}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-purple-500/20">
                        <span className="text-white font-bold text-sm">{dayIndex + 1}</span>
                      </div>
                      <span className="text-white/80 text-sm font-medium">
                        {new Date(day.date).toLocaleDateString('fr-FR', { weekday: 'short' })}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {day.meals.map((meal) => (
                        <div key={meal.id} className="flex items-center gap-2">
                          {meal.imageStatus === 'generated' && meal.imageUrl ? (
                            <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0">
                              <img src={meal.imageUrl} alt={meal.mealName} className="w-full h-full object-cover" />
                            </div>
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                              <SpatialIcon Icon={ICONS.Image} size={16} className="text-purple-400" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-xs font-medium truncate">{meal.mealName}</p>
                            <p className="text-white/50 text-xs">{meal.nutritionalInfo?.calories || 0} kcal</p>
                          </div>
                        </div>
                      ))}
                    </div>
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
          disabled={isSaving}
          className="px-6 py-3 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-xl text-red-300 font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Ne Pas Sauvegarder
        </button>

        <button
          onClick={onSaveAll}
          disabled={isSaving}
          className={`px-8 py-3 rounded-xl font-semibold text-white transition-all duration-200 flex items-center gap-3 ${
            isSaving
              ? 'opacity-50 cursor-not-allowed'
              : 'hover:scale-105'
          }`}
          style={{
            background: isSaving
              ? 'rgba(139, 92, 246, 0.3)'
              : 'linear-gradient(135deg, rgba(139, 92, 246, 0.9) 0%, rgba(168, 85, 247, 0.85) 100%)',
            border: '2px solid rgba(139, 92, 246, 0.5)',
            boxShadow: isSaving ? 'none' : '0 8px 24px rgba(139, 92, 246, 0.3)'
          }}
        >
          {isSaving ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Sauvegarde en cours...</span>
            </>
          ) : (
            <>
              <SpatialIcon Icon={ICONS.Save} size={20} />
              <span>Sauvegarder dans ma Bibliothèque</span>
            </>
          )}
        </button>
      </motion.div>
    </div>
  );
};

export default ValidationStage;
