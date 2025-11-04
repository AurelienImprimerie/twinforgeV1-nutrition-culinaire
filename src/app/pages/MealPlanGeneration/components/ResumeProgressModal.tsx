import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import SpatialIcon from '../../../../ui/icons/SpatialIcon';
import { ICONS } from '../../../../ui/icons/registry';
import { useFeedback } from '../../../../hooks/useFeedback';

interface ResumeProgressModalProps {
  isOpen: boolean;
  currentStep: 'validation' | 'recipe_details_validation' | null;
  sessionId: string | null;
  updatedAt: string | null;
  onResume: () => void;
  onRestart: () => void;
}

const ResumeProgressModal: React.FC<ResumeProgressModalProps> = ({
  isOpen,
  currentStep,
  sessionId,
  updatedAt,
  onResume,
  onRestart
}) => {
  const { click } = useFeedback();

  if (!isOpen) return null;

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Date inconnue';
    const date = new Date(dateString);
    return date.toLocaleString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStepLabel = (step: string | null) => {
    if (step === 'validation') return 'Validation du plan de base';
    if (step === 'recipe_details_validation') return 'Génération des recettes détaillées';
    return 'Étape inconnue';
  };

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
        style={{
          background: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)'
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="relative w-full max-w-2xl rounded-3xl p-8"
          style={{
            background: `
              radial-gradient(ellipse at top, rgba(16, 185, 129, 0.15) 0%, transparent 50%),
              radial-gradient(ellipse at bottom, rgba(52, 211, 153, 0.1) 0%, transparent 50%),
              linear-gradient(180deg, rgba(17, 24, 39, 0.95) 0%, rgba(11, 14, 23, 0.98) 100%)
            `,
            border: '2px solid rgba(16, 185, 129, 0.3)',
            boxShadow: `
              0 25px 70px rgba(0, 0, 0, 0.5),
              0 0 50px rgba(16, 185, 129, 0.2),
              inset 0 2px 0 rgba(255, 255, 255, 0.1)
            `,
            backdropFilter: 'blur(32px) saturate(150%)',
            WebkitBackdropFilter: 'blur(32px) saturate(150%)'
          }}
        >
          {/* Icon Header */}
          <div className="flex flex-col items-center mb-6">
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center mb-4"
              style={{
                background: `
                  radial-gradient(circle at 30% 30%, rgba(16, 185, 129, 0.4) 0%, transparent 70%),
                  linear-gradient(135deg, rgba(16, 185, 129, 0.3), rgba(52, 211, 153, 0.2))
                `,
                border: '2px solid rgba(16, 185, 129, 0.5)',
                boxShadow: `
                  0 0 30px rgba(16, 185, 129, 0.4),
                  inset 0 2px 0 rgba(255, 255, 255, 0.3)
                `
              }}
            >
              <SpatialIcon
                Icon={ICONS.Clock}
                size={40}
                style={{
                  color: '#10B981',
                  filter: 'drop-shadow(0 0 12px rgba(16, 185, 129, 0.8))'
                }}
              />
            </div>

            <h2
              className="text-3xl font-bold text-white text-center mb-2"
              style={{
                textShadow: '0 0 20px rgba(16, 185, 129, 0.5)'
              }}
            >
              Génération en cours
            </h2>

            <p className="text-white/70 text-center text-lg">
              Vous avez une génération de plan alimentaire en cours
            </p>
          </div>

          {/* Progress Info Card */}
          <div
            className="rounded-2xl p-6 mb-6"
            style={{
              background: `
                radial-gradient(circle at top left, rgba(16, 185, 129, 0.1) 0%, transparent 60%),
                rgba(17, 24, 39, 0.6)
              `,
              border: '1px solid rgba(16, 185, 129, 0.2)',
              boxShadow: `
                0 8px 24px rgba(0, 0, 0, 0.3),
                inset 0 1px 0 rgba(255, 255, 255, 0.05)
              `
            }}
          >
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <SpatialIcon
                  Icon={ICONS.MapPin}
                  size={20}
                  className="text-green-400 mt-0.5"
                  style={{
                    filter: 'drop-shadow(0 0 8px rgba(16, 185, 129, 0.6))'
                  }}
                />
                <div>
                  <p className="text-white/60 text-sm mb-1">Étape actuelle</p>
                  <p className="text-white font-semibold text-lg">
                    {getStepLabel(currentStep)}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <SpatialIcon
                  Icon={ICONS.Clock}
                  size={20}
                  className="text-green-400 mt-0.5"
                  style={{
                    filter: 'drop-shadow(0 0 8px rgba(16, 185, 129, 0.6))'
                  }}
                />
                <div>
                  <p className="text-white/60 text-sm mb-1">Dernière modification</p>
                  <p className="text-white font-medium">
                    {formatDate(updatedAt)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Benefits */}
          <div
            className="rounded-2xl p-5 mb-6"
            style={{
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.2)'
            }}
          >
            <div className="flex items-start gap-3">
              <SpatialIcon
                Icon={ICONS.Lightbulb}
                size={20}
                className="text-green-400 mt-0.5"
                style={{
                  filter: 'drop-shadow(0 0 8px rgba(16, 185, 129, 0.6))'
                }}
              />
              <div>
                <p className="text-white/90 text-sm leading-relaxed">
                  <strong className="text-green-400">Bonne nouvelle !</strong> Votre progression et vos plans générés ont été sauvegardés automatiquement. Vous pouvez reprendre là où vous vous êtes arrêté sans perdre vos tokens dépensés.
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Resume Button */}
            <button
              onClick={() => {
                click();
                onResume();
              }}
              className="group relative px-6 py-4 rounded-xl font-semibold text-white transition-all duration-300"
              style={{
                background: `
                  linear-gradient(135deg,
                    rgba(16, 185, 129, 0.9) 0%,
                    rgba(34, 197, 94, 0.85) 100%
                  )
                `,
                border: '2px solid rgba(16, 185, 129, 0.6)',
                boxShadow: `
                  0 12px 40px rgba(16, 185, 129, 0.4),
                  0 0 60px rgba(16, 185, 129, 0.3),
                  inset 0 3px 0 rgba(255, 255, 255, 0.4)
                `
              }}
              onMouseEnter={(e) => {
                if (window.matchMedia('(hover: hover)').matches) {
                  e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)';
                  e.currentTarget.style.boxShadow = `
                    0 16px 48px rgba(16, 185, 129, 0.5),
                    0 0 70px rgba(16, 185, 129, 0.4),
                    inset 0 3px 0 rgba(255, 255, 255, 0.5)
                  `;
                }
              }}
              onMouseLeave={(e) => {
                if (window.matchMedia('(hover: hover)').matches) {
                  e.currentTarget.style.transform = 'translateY(0) scale(1)';
                  e.currentTarget.style.boxShadow = `
                    0 12px 40px rgba(16, 185, 129, 0.4),
                    0 0 60px rgba(16, 185, 129, 0.3),
                    inset 0 3px 0 rgba(255, 255, 255, 0.4)
                  `;
                }
              }}
            >
              <div className="flex items-center justify-center gap-3">
                <SpatialIcon Icon={ICONS.Play} size={20} color="white" variant="pure" />
                <span>Reprendre</span>
              </div>
            </button>

            {/* Restart Button */}
            <button
              onClick={() => {
                click();
                onRestart();
              }}
              className="group relative px-6 py-4 rounded-xl font-semibold transition-all duration-300"
              style={{
                background: 'rgba(17, 24, 39, 0.8)',
                border: '2px solid rgba(255, 255, 255, 0.15)',
                boxShadow: `
                  0 8px 24px rgba(0, 0, 0, 0.3),
                  inset 0 2px 0 rgba(255, 255, 255, 0.1)
                `,
                color: 'white'
              }}
              onMouseEnter={(e) => {
                if (window.matchMedia('(hover: hover)').matches) {
                  e.currentTarget.style.background = 'rgba(17, 24, 39, 0.95)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.25)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }
              }}
              onMouseLeave={(e) => {
                if (window.matchMedia('(hover: hover)').matches) {
                  e.currentTarget.style.background = 'rgba(17, 24, 39, 0.8)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }
              }}
            >
              <div className="flex items-center justify-center gap-3">
                <SpatialIcon Icon={ICONS.RefreshCw} size={20} style={{ color: 'white' }} />
                <span>Recommencer</span>
              </div>
            </button>
          </div>

          {/* Warning */}
          <p className="text-white/50 text-xs text-center mt-4">
            Si vous recommencez, votre progression actuelle sera définitivement perdue
          </p>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default ResumeProgressModal;
