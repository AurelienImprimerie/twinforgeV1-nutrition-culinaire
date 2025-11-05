import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import MealPlanLibraryCTA from '../components/MealPlanLibraryCTA';
import SavedMealPlanCard from './PlanTab/components/SavedMealPlanCard';
import GlassCard from '../../../../ui/cards/GlassCard';
import SpatialIcon from '../../../../ui/icons/SpatialIcon';
import { ICONS } from '../../../../ui/icons/registry';
import { useMealPlanStore } from '../../../../system/store/mealPlanStore';
import type { MealPlanData } from '../../../../system/store/mealPlanStore/types';

/**
 * Plan Tab - Bibliothèque de Plans Alimentaires
 * Affiche tous les plans alimentaires sauvegardés de l'utilisateur
 * La génération se fait maintenant via une pipeline dédiée
 */
const PlanTab: React.FC = () => {
  const { allMealPlans, loadAllMealPlans } = useMealPlanStore();
  const [isLoading, setIsLoading] = useState(true);

  // Load meal plans on mount
  useEffect(() => {
    const loadPlans = async () => {
      try {
        setIsLoading(true);
        await loadAllMealPlans();
      } finally {
        setIsLoading(false);
      }
    };

    loadPlans();
  }, [loadAllMealPlans]);

  // Handle plan selection
  const handlePlanClick = (plan: MealPlanData) => {
    // TODO: Navigate to plan details or open plan viewer modal
    console.log('Selected plan:', plan);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="space-y-6"
    >
      {/* CTA pour Générer des Plans Alimentaires */}
      <MealPlanLibraryCTA />

      {/* Loading State */}
      {isLoading && (
        <GlassCard
          className="p-8 text-center"
          style={{
            background: 'rgba(11, 14, 23, 0.8)',
            borderColor: 'rgba(139, 92, 246, 0.2)'
          }}
        >
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
            <p className="text-white/70">Chargement de vos plans...</p>
          </div>
        </GlassCard>
      )}

      {/* Meal Plans Grid */}
      {!isLoading && allMealPlans.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <SpatialIcon
              Icon={ICONS.BookOpen}
              size={24}
              className="text-green-400"
            />
            <h2 className="text-white text-2xl font-bold">
              Mes Plans Alimentaires
            </h2>
            <span className="px-3 py-1 bg-green-400/20 text-green-400 text-sm font-semibold rounded-full">
              {allMealPlans.length}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {allMealPlans.map((plan) => (
              <SavedMealPlanCard
                key={plan.id}
                plan={plan}
                onClick={() => handlePlanClick(plan)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && allMealPlans.length === 0 && (
        <GlassCard
          className="p-8 text-center"
          style={{
            background: `
              radial-gradient(circle at 30% 20%, color-mix(in srgb, #8B5CF6 8%, transparent) 0%, transparent 60%),
              var(--glass-opacity)
            `,
            borderColor: 'color-mix(in srgb, #8B5CF6 20%, transparent)'
          }}
        >
          <div className="space-y-6">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center mx-auto"
              style={{
                background: `
                  radial-gradient(circle at 30% 30%, rgba(255,255,255,0.2) 0%, transparent 60%),
                  linear-gradient(135deg, color-mix(in srgb, #8B5CF6 35%, transparent), color-mix(in srgb, #A855F7 25%, transparent))
                `,
                border: '2px solid color-mix(in srgb, #8B5CF6 50%, transparent)',
                boxShadow: `
                  0 0 30px color-mix(in srgb, #8B5CF6 40%, transparent),
                  inset 0 2px 0 rgba(255, 255, 255, 0.2)
                `
              }}
            >
              <SpatialIcon
                Icon={ICONS.BookOpen}
                size={48}
                style={{
                  color: '#8B5CF6',
                  filter: 'drop-shadow(0 0 12px rgba(139, 92, 246, 0.6))'
                }}
                variant="pure"
              />
            </div>

            <div>
              <h3 className="text-2xl font-bold text-white mb-2">
                Votre Bibliothèque de Plans
              </h3>
              <p className="text-white/70 text-lg leading-relaxed">
                Tous vos plans alimentaires sauvegardés apparaîtront ici.
                <br />
                Commencez par générer votre premier plan !
              </p>
            </div>

            <div className="max-w-lg mx-auto">
              <div
                className="p-4 rounded-lg"
                style={{
                  background: 'rgba(139, 92, 246, 0.1)',
                  border: '1px solid rgba(139, 92, 246, 0.2)'
                }}
              >
                <div className="flex items-start gap-3">
                  <SpatialIcon
                    Icon={ICONS.Lightbulb}
                    size={20}
                    className="text-purple-400 mt-0.5"
                    style={{ filter: 'drop-shadow(0 0 6px #8B5CF6)' }}
                  />
                  <div className="text-left">
                    <h5 className="text-purple-300 font-semibold text-sm mb-1">À savoir</h5>
                    <p className="text-white/70 text-sm">
                      Vos plans peuvent couvrir plusieurs semaines et s'adaptent à votre inventaire.
                      Chaque plan contient des recettes détaillées pour tous vos repas.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </GlassCard>
      )}
    </motion.div>
  );
};

export default PlanTab;