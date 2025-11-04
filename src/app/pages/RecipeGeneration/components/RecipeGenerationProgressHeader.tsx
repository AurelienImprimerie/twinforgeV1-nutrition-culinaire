import React from 'react';
import { motion } from 'framer-motion';
import GlassCard from '../../../../ui/cards/GlassCard';
import SpatialIcon from '../../../../ui/icons/SpatialIcon';
import { ICONS } from '../../../../ui/icons/registry';
import { RECIPE_GENERATION_STEPS, type RecipeGenerationStepData } from '../../../../system/store/recipeGeneration';
import s from './RecipeGenerationProgressHeader.module.css';

interface RecipeGenerationProgressHeaderProps {
  currentStep: RecipeGenerationStepData;
  overallProgress: number;
  loadingMessage?: string;
}

const STEP_ICONS: Record<string, keyof typeof ICONS> = {
  configuration: 'Settings',
  generating: 'Sparkles',
  validation: 'Check',
};

const RecipeGenerationProgressHeader: React.FC<RecipeGenerationProgressHeaderProps> = ({
  currentStep,
  overallProgress,
  loadingMessage
}) => {
  const safeProgress = Number.isFinite(overallProgress) ? Math.min(100, Math.max(0, overallProgress)) : 0;

  const steps = RECIPE_GENERATION_STEPS.map(step => ({
    id: step.id,
    title: step.title
  }));

  const stepSize = 100 / steps.length;
  const currentStepIndex = Math.max(0, steps.findIndex(s => s.id === currentStep.id));
  const stepStart = currentStepIndex * stepSize;
  const pctInStep = Math.max(0, Math.min(1, (safeProgress - stepStart) / stepSize));

  const currentIcon = STEP_ICONS[currentStep.id] || 'ChefHat';

  return (
    <div className={s.wrap}>
      <GlassCard className={s.card}>
        <div className={s.grid} data-recipe-forge>
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
            <h2 className={s.title}>{currentStep.title || 'Forge Culinaire'}</h2>
            {currentStep.subtitle && (
              <p className={s.subtitle}>{currentStep.subtitle}</p>
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

                const themeClass = i % 2 === 0 ? s.segGreen : s.segGreenLight;
                const fillTheme = i % 2 === 0 ? s.fillGreen : s.fillGreenLight;

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

      {/* Loading message */}
      {loadingMessage && (
        <div className="mt-3 text-sm text-gray-300 animate-pulse text-center">
          {loadingMessage}
        </div>
      )}
    </div>
  );
};

export default RecipeGenerationProgressHeader;
