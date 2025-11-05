import React from 'react';
import { motion } from 'framer-motion';
import GlassCard from '../../../../ui/cards/GlassCard';
import SpatialIcon from '../../../../ui/icons/SpatialIcon';
import { ICONS } from '../../../../ui/icons/registry';
import { MEAL_PLAN_GENERATION_STEPS, type MealPlanGenerationStepData, useMealPlanGenerationPipeline } from '../../../../system/store/mealPlanGenerationPipeline';
import s from './MealPlanGenerationProgressHeader.module.css';

interface MealPlanGenerationProgressHeaderProps {
  currentStep: MealPlanGenerationStepData;
  overallProgress: number;
  loadingMessage?: string;
}

const STEP_ICONS: Record<string, keyof typeof ICONS> = {
  configuration: 'Settings',
  generating: 'Sparkles',
  validation: 'Calendar',
  recipe_details_generating: 'ChefHat',
  recipe_details_validation: 'Check'
};

const MealPlanGenerationProgressHeader: React.FC<MealPlanGenerationProgressHeaderProps> = ({
  currentStep,
  overallProgress,
  loadingMessage
}) => {
  const { receivedDaysCount, totalDaysToGenerate, processedRecipesCount, totalRecipesToGenerate, currentStep: storeCurrentStep } = useMealPlanGenerationPipeline();
  const safeProgress = Number.isFinite(overallProgress) ? Math.min(100, Math.max(0, overallProgress)) : 0;

  // Show days/recipes count in subtitle when generating
  let dynamicSubtitle = currentStep.subtitle;
  if (storeCurrentStep === 'generating' && totalDaysToGenerate > 0 && receivedDaysCount > 0) {
    dynamicSubtitle = `${receivedDaysCount}/${totalDaysToGenerate} jours générés`;
  } else if (storeCurrentStep === 'recipe_details_generating' && totalRecipesToGenerate > 0 && processedRecipesCount > 0) {
    dynamicSubtitle = `${processedRecipesCount}/${totalRecipesToGenerate} recettes générées`;
  }

  const steps = MEAL_PLAN_GENERATION_STEPS.map(step => ({
    id: step.id,
    title: step.title
  }));

  const stepSize = 100 / steps.length;
  const currentStepIndex = Math.max(0, steps.findIndex(s => s.id === currentStep.id));
  const stepStart = currentStepIndex * stepSize;
  const pctInStep = Math.max(0, Math.min(1, (safeProgress - stepStart) / stepSize));

  const currentIcon = STEP_ICONS[currentStep.id] || 'Calendar';

  return (
    <div className={s.wrap}>
      <GlassCard className={s.card}>
        <div className={s.grid} data-meal-plan-forge>
          {/* Col 1 — Icône */}
          <div className={s.icon}>
            <div className={s.iconHalo} />
            <SpatialIcon
              Icon={ICONS[currentIcon]}
              size={26}
              className={s.iconGlyph}
            />
          </div>

          {/* Col 2 — Titre / Barre / Étape */}
          <div className={s.center}>
            <h2 className={s.title}>{currentStep.title || 'Forge Nutritionnelle'}</h2>
            {dynamicSubtitle && (
              <p className={s.subtitle}>{dynamicSubtitle}</p>
            )}

            <div
              className={s.rail}
              role="progressbar"
              aria-valuenow={Math.round(safeProgress)}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              {steps.map((step, i) => {
                const completed = i < currentStepIndex;
                const current = i === currentStepIndex;
                const width = completed ? '100%' : current ? `${pctInStep * 100}%` : '0%';

                const themeClass = i % 2 === 0 ? s.segViolet : s.segVioletLight;
                const fillTheme = i % 2 === 0 ? s.fillViolet : s.fillVioletLight;

                return (
                  <div
                    key={step.id}
                    className={`${s.seg} ${themeClass} ${completed ? s.isComplete : ''} ${current ? s.isCurrent : ''}`}
                  >
                    {(completed || current) && (
                      <motion.span
                        className={`${s.fill} ${fillTheme}`}
                        initial={{ width: 0 }}
                        animate={{ width }}
                        transition={{ duration: 0.45, ease: 'easeOut' }}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            <div className={s.step}>Étape {currentStepIndex + 1} sur {steps.length}</div>
          </div>

          {/* Col 3 — % */}
          <div className={s.percent} aria-hidden="true">
            {Math.round(safeProgress)}%
          </div>
        </div>
      </GlassCard>
    </div>
  );
};

export default MealPlanGenerationProgressHeader;
