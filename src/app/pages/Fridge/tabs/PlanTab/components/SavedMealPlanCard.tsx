import React from 'react';
import { motion } from 'framer-motion';
import GlassCard from '../../../../../../ui/cards/GlassCard';
import SpatialIcon from '../../../../../../ui/icons/SpatialIcon';
import { ICONS } from '../../../../../../ui/icons/registry';
import type { MealPlanData } from '../../../../../../system/store/mealPlanStore/types';

interface SavedMealPlanCardProps {
  plan: MealPlanData;
  onClick: () => void;
}

const SavedMealPlanCard: React.FC<SavedMealPlanCardProps> = ({ plan, onClick }) => {
  // Calculate totals
  const totalDays = plan.days?.length || 0;
  const totalMeals = plan.days?.reduce((sum, day) => {
    return sum + Object.values(day.meals || {}).filter(m => m).length;
  }, 0) || 0;

  // Format date
  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -4 }}
      transition={{ duration: 0.2 }}
    >
      <GlassCard
        className="p-6 cursor-pointer"
        onClick={onClick}
        style={{
          background: `
            radial-gradient(circle at 30% 20%, color-mix(in srgb, #10B981 8%, transparent) 0%, transparent 60%),
            rgba(11, 14, 23, 0.8)
          `,
          borderColor: 'color-mix(in srgb, #10B981 25%, transparent)',
          boxShadow: `
            0 8px 24px rgba(0, 0, 0, 0.2),
            0 0 20px color-mix(in srgb, #10B981 15%, transparent)
          `
        }}
      >
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 flex-1">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
                style={{
                  background: 'linear-gradient(135deg, #10B981, #34D399)',
                  boxShadow: '0 0 16px rgba(16, 185, 129, 0.4)'
                }}
              >
                <SpatialIcon
                  Icon={ICONS.ChefHat}
                  size={24}
                  className="text-white"
                />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-white font-bold text-lg truncate">
                  Semaine {plan.weekNumber}
                </h3>
                <p className="text-white/60 text-sm">
                  {formatDate(plan.startDate)}
                </p>
              </div>
            </div>

            <SpatialIcon
              Icon={ICONS.ChevronRight}
              size={20}
              className="text-white/40 flex-shrink-0"
            />
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3">
            {/* Days */}
            <div
              className="p-3 rounded-lg"
              style={{
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.2)'
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <SpatialIcon
                  Icon={ICONS.Calendar}
                  size={16}
                  className="text-green-400"
                />
                <span className="text-green-400 text-xs font-medium">Jours</span>
              </div>
              <p className="text-white text-xl font-bold">{totalDays}</p>
            </div>

            {/* Meals */}
            <div
              className="p-3 rounded-lg"
              style={{
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.2)'
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <SpatialIcon
                  Icon={ICONS.UtensilsCrossed}
                  size={16}
                  className="text-green-400"
                />
                <span className="text-green-400 text-xs font-medium">Repas</span>
              </div>
              <p className="text-white text-xl font-bold">{totalMeals}</p>
            </div>
          </div>

          {/* Nutritional Summary */}
          {plan.nutritionalSummary && (
            <div
              className="p-3 rounded-lg"
              style={{
                background: 'rgba(16, 185, 129, 0.05)',
                border: '1px solid rgba(16, 185, 129, 0.15)'
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <SpatialIcon
                  Icon={ICONS.Activity}
                  size={14}
                  className="text-green-300"
                />
                <span className="text-green-300 text-xs font-medium">
                  Moyenne journalière
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div>
                  <p className="text-white/60 text-xs mb-0.5">Calories</p>
                  <p className="text-white text-sm font-semibold">
                    {Math.round(plan.nutritionalSummary.avgCaloriesPerDay)}
                  </p>
                </div>
                <div>
                  <p className="text-white/60 text-xs mb-0.5">Protéines</p>
                  <p className="text-white text-sm font-semibold">
                    {Math.round(plan.nutritionalSummary.avgProteinPerDay)}g
                  </p>
                </div>
                <div>
                  <p className="text-white/60 text-xs mb-0.5">Glucides</p>
                  <p className="text-white text-sm font-semibold">
                    {Math.round(plan.nutritionalSummary.avgCarbsPerDay)}g
                  </p>
                </div>
                <div>
                  <p className="text-white/60 text-xs mb-0.5">Lipides</p>
                  <p className="text-white text-sm font-semibold">
                    {Math.round(plan.nutritionalSummary.avgFatPerDay)}g
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Cost */}
          {plan.estimatedWeeklyCost && (
            <div className="flex items-center justify-between">
              <span className="text-white/60 text-sm">Coût estimé</span>
              <span className="text-green-400 font-semibold">
                {plan.estimatedWeeklyCost.toFixed(2)}€
              </span>
            </div>
          )}
        </div>
      </GlassCard>
    </motion.div>
  );
};

export default SavedMealPlanCard;
