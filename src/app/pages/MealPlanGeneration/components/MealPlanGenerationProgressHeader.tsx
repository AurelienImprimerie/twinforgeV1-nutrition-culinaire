import React from 'react';
import { motion } from 'framer-motion';
import SpatialIcon from '../../../../ui/icons/SpatialIcon';
import { ICONS } from '../../../../ui/icons/registry';

interface Step {
  id: string;
  label: string;
  description: string;
}

interface MealPlanGenerationProgressHeaderProps {
  currentStep: Step;
  overallProgress: number;
  loadingMessage: string;
}

const MealPlanGenerationProgressHeader: React.FC<MealPlanGenerationProgressHeaderProps> = ({
  currentStep,
  overallProgress,
  loadingMessage
}) => {
  const steps = [
    { id: 'configuration', label: 'Configuration', icon: ICONS.Settings },
    { id: 'generating_plan', label: 'Génération', icon: ICONS.Sparkles },
    { id: 'preview', label: 'Aperçu', icon: ICONS.Eye },
    { id: 'generating_recipes', label: 'Recettes', icon: ICONS.Book },
    { id: 'validation', label: 'Validation', icon: ICONS.Check }
  ];

  const currentStepIndex = steps.findIndex(s => s.id === currentStep.id);

  return (
    <div
      className="rounded-2xl p-6 backdrop-blur-xl"
      style={{
        background: `radial-gradient(circle at 30% 20%, rgba(139, 92, 246, 0.15) 0%, transparent 60%), linear-gradient(145deg, rgba(255,255,255,0.08), rgba(255,255,255,0.05)), rgba(11, 14, 23, 0.85)`,
        border: '2px solid rgba(139, 92, 246, 0.3)',
        boxShadow: '0 12px 40px rgba(0, 0, 0, 0.25)'
      }}
    >
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-2">Génération de Plan Alimentaire</h1>
        <p className="text-white/70">{currentStep.description}</p>
      </div>

      <div className="flex items-center justify-between mb-6 relative">
        <div
          className="absolute left-0 right-0 top-1/2 h-0.5 -translate-y-1/2"
          style={{ background: 'rgba(139, 92, 246, 0.2)' }}
        />
        <motion.div
          className="absolute left-0 top-1/2 h-0.5 -translate-y-1/2"
          style={{ background: 'linear-gradient(90deg, rgba(139, 92, 246, 0.8), rgba(168, 85, 247, 0.8))' }}
          initial={{ width: '0%' }}
          animate={{ width: `${(currentStepIndex / (steps.length - 1)) * 100}%` }}
          transition={{ duration: 0.5 }}
        />

        {steps.map((step, index) => {
          const isActive = step.id === currentStep.id;
          const isCompleted = index < currentStepIndex;
          const isPending = index > currentStepIndex;

          return (
            <div key={step.id} className="relative z-10 flex flex-col items-center">
              <motion.div
                className={`w-12 h-12 rounded-xl flex items-center justify-center mb-2 ${
                  isActive ? 'scale-110' : ''
                }`}
                style={{
                  background: isActive
                    ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.5), rgba(168, 85, 247, 0.45))'
                    : isCompleted
                    ? 'rgba(139, 92, 246, 0.3)'
                    : 'rgba(255, 255, 255, 0.05)',
                  border: `2px solid ${
                    isActive
                      ? 'rgba(139, 92, 246, 0.6)'
                      : isCompleted
                      ? 'rgba(139, 92, 246, 0.4)'
                      : 'rgba(255, 255, 255, 0.1)'
                  }`,
                  boxShadow: isActive ? '0 0 20px rgba(139, 92, 246, 0.4)' : 'none'
                }}
                animate={{
                  scale: isActive ? [1, 1.05, 1] : 1
                }}
                transition={{
                  duration: 2,
                  repeat: isActive ? Infinity : 0
                }}
              >
                <SpatialIcon
                  Icon={step.icon}
                  size={24}
                  className={
                    isActive
                      ? 'text-purple-200'
                      : isCompleted
                      ? 'text-purple-300'
                      : 'text-white/30'
                  }
                />
              </motion.div>
              <span
                className={`text-xs font-medium ${
                  isActive
                    ? 'text-purple-300'
                    : isCompleted
                    ? 'text-purple-400'
                    : 'text-white/40'
                }`}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-white/70">Progression globale</span>
          <span className="text-purple-300 font-semibold">{Math.round(overallProgress)}%</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(139, 92, 246, 0.2)' }}>
          <motion.div
            className="h-full rounded-full"
            style={{ background: 'linear-gradient(90deg, rgba(139, 92, 246, 0.9), rgba(168, 85, 247, 0.85))' }}
            initial={{ width: '0%' }}
            animate={{ width: `${overallProgress}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
        {loadingMessage && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-white/60 text-sm text-center mt-3"
          >
            {loadingMessage}
          </motion.p>
        )}
      </div>
    </div>
  );
};

export default MealPlanGenerationProgressHeader;
