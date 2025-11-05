import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { usePerformanceMode } from '../../../system/context/PerformanceModeContext';
import SpatialIcon from '../../icons/SpatialIcon';
import { ICONS } from '../../icons/registry';
import { useFeedback } from '../../../hooks/useFeedback';

interface LowTokensModalProps {
  isOpen: boolean;
  requiredTokens: number;
  availableTokens: number;
  onClose: () => void;
}

const LowTokensModal: React.FC<LowTokensModalProps> = ({
  isOpen,
  requiredTokens,
  availableTokens,
  onClose
}) => {
  const navigate = useNavigate();
  const { click } = useFeedback();
  const { isPerformanceMode } = usePerformanceMode();

  const MotionDiv = isPerformanceMode ? 'div' : motion.div;

  const handleGoToSubscription = () => {
    click();
    onClose();
    navigate('/settings?tab=account');
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4">
        <MotionDiv
          className="absolute inset-0 bg-black/60"
          style={{ backdropFilter: 'blur(8px)' }}
          {...(!isPerformanceMode && {
            initial: { opacity: 0 },
            animate: { opacity: 1 },
            exit: { opacity: 0 }
          })}
          onClick={onClose}
        />

        <MotionDiv
          className="relative w-full max-w-lg rounded-2xl overflow-hidden"
          style={{
            background: `
              radial-gradient(circle at 30% 20%, color-mix(in srgb, #EF4444 15%, transparent) 0%, transparent 60%),
              linear-gradient(145deg, rgba(255,255,255,0.15), rgba(255,255,255,0.10)),
              rgba(11, 14, 23, 0.95)
            `,
            border: '2px solid color-mix(in srgb, #EF4444 30%, transparent)',
            boxShadow: `
              0 25px 80px rgba(0, 0, 0, 0.5),
              0 0 60px color-mix(in srgb, #EF4444 20%, transparent),
              inset 0 2px 0 rgba(255, 255, 255, 0.2)
            `,
            backdropFilter: 'blur(32px) saturate(180%)',
            WebkitBackdropFilter: 'blur(32px) saturate(180%)'
          }}
          {...(!isPerformanceMode && {
            initial: { opacity: 0, scale: 0.9, y: 20 },
            animate: { opacity: 1, scale: 1, y: 0 },
            exit: { opacity: 0, scale: 0.9, y: 20 },
            transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] }
          })}
        >
          <div className="p-8">
            <div className="flex items-start gap-4 mb-6">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0"
                style={{
                  background: `
                    radial-gradient(circle at 30% 30%, rgba(255,255,255,0.25) 0%, transparent 60%),
                    linear-gradient(135deg, color-mix(in srgb, #EF4444 40%, transparent), color-mix(in srgb, #DC2626 35%, transparent))
                  `,
                  border: '2px solid color-mix(in srgb, #EF4444 50%, transparent)',
                  boxShadow: `
                    0 0 30px color-mix(in srgb, #EF4444 35%, transparent),
                    inset 0 2px 0 rgba(255,255,255,0.3)
                  `
                }}
              >
                <SpatialIcon
                  Icon={ICONS.AlertCircle}
                  size={32}
                  color="rgba(255, 255, 255, 0.95)"
                  variant="pure"
                />
              </div>

              <div className="flex-1">
                <h2 className="text-2xl font-bold text-white mb-2">
                  Tokens Insuffisants
                </h2>
                <p className="text-white/70 text-base">
                  Vous n'avez pas assez de tokens pour continuer cette génération.
                </p>
              </div>

              <button
                onClick={() => {
                  click();
                  onClose();
                }}
                className="text-white/60 hover:text-white transition-colors p-2"
              >
                <SpatialIcon Icon={ICONS.X} size={24} />
              </button>
            </div>

            <div
              className="p-5 rounded-xl mb-6"
              style={{
                background: `
                  radial-gradient(circle at 30% 30%, color-mix(in srgb, #EF4444 10%, transparent) 0%, transparent 60%),
                  linear-gradient(145deg, rgba(255,255,255,0.08), rgba(255,255,255,0.04)),
                  rgba(11, 14, 23, 0.5)
                `,
                border: '2px solid color-mix(in srgb, #EF4444 25%, transparent)'
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-white/60 text-sm mb-1">Tokens Disponibles</p>
                  <p className="text-3xl font-bold text-white">
                    {availableTokens}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-white/60 text-sm mb-1">Tokens Requis</p>
                  <p className="text-3xl font-bold text-red-400">
                    {requiredTokens}
                  </p>
                </div>
              </div>

              <div
                className="h-3 rounded-full overflow-hidden"
                style={{
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid rgba(255, 255, 255, 0.1)'
                }}
              >
                <div
                  className="h-full bg-gradient-to-r from-red-500 to-red-600"
                  style={{
                    width: `${Math.min((availableTokens / requiredTokens) * 100, 100)}%`,
                    transition: 'width 0.5s ease'
                  }}
                />
              </div>

              <p className="text-white/50 text-xs mt-2 text-center">
                Il vous manque {requiredTokens - availableTokens} tokens
              </p>
            </div>

            <div
              className="p-4 rounded-lg mb-6"
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.2)'
              }}
            >
              <div className="flex items-start gap-3">
                <SpatialIcon
                  Icon={ICONS.Lightbulb}
                  size={18}
                  className="text-red-400 mt-0.5"
                  style={{ filter: 'drop-shadow(0 0 6px #EF4444)' }}
                />
                <div className="text-left">
                  <h5 className="text-red-300 font-semibold text-sm mb-1">Solution</h5>
                  <p className="text-white/70 text-sm">
                    Passez à un abonnement supérieur pour obtenir plus de tokens mensuels et débloquer toutes les fonctionnalités de la Forge Nutritionnelle.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleGoToSubscription}
                className="w-full px-6 py-4 rounded-xl font-semibold transition-all duration-300 group"
                style={{
                  background: `
                    linear-gradient(135deg,
                      color-mix(in srgb, #EF4444 75%, transparent),
                      color-mix(in srgb, #DC2626 60%, transparent)
                    )
                  `,
                  border: '2px solid color-mix(in srgb, #EF4444 50%, transparent)',
                  boxShadow: `
                    0 10px 30px color-mix(in srgb, #EF4444 35%, transparent),
                    inset 0 2px 0 rgba(255,255,255,0.4)
                  `,
                  color: 'white'
                }}
                onMouseEnter={(e) => {
                  if (!isPerformanceMode && window.matchMedia('(hover: hover)').matches) {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = `
                      0 14px 40px color-mix(in srgb, #EF4444 45%, transparent),
                      inset 0 2px 0 rgba(255,255,255,0.5)
                    `;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isPerformanceMode && window.matchMedia('(hover: hover)').matches) {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = `
                      0 10px 30px color-mix(in srgb, #EF4444 35%, transparent),
                      inset 0 2px 0 rgba(255,255,255,0.4)
                    `;
                  }
                }}
              >
                <div className="flex items-center justify-center gap-2">
                  <SpatialIcon Icon={ICONS.Zap} size={20} color="white" variant="pure" />
                  <span>Améliorer mon Abonnement</span>
                </div>
              </button>

              <button
                onClick={() => {
                  click();
                  onClose();
                }}
                className="w-full px-6 py-3 rounded-xl font-medium transition-all duration-300"
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '2px solid rgba(255, 255, 255, 0.1)',
                  color: 'white'
                }}
                onMouseEnter={(e) => {
                  if (!isPerformanceMode && window.matchMedia('(hover: hover)').matches) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isPerformanceMode && window.matchMedia('(hover: hover)').matches) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  }
                }}
              >
                Peut-être Plus Tard
              </button>
            </div>
          </div>
        </MotionDiv>
      </div>
    </AnimatePresence>
  );
};

export default LowTokensModal;
