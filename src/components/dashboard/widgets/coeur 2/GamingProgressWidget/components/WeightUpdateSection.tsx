import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SpatialIcon from '@/ui/icons/SpatialIcon';
import { ICONS } from '@/ui/icons/registry';
import WidgetHeader from '../../../shared/WidgetHeader';

interface WeightUpdateSectionProps {
  weight: number;
  currentWeight?: number;
  hasActiveAbsence?: boolean;
  pendingXp?: number;
  isReconciling?: boolean;
  onIncrement: (amount: number) => void;
  onSubmit: () => void;
  onWeightChange?: (weight: number) => void;
}

export default function WeightUpdateSection({
  weight,
  currentWeight,
  hasActiveAbsence = false,
  pendingXp = 0,
  isReconciling = false,
  onIncrement,
  onSubmit,
  onWeightChange
}: WeightUpdateSectionProps) {
  const navigate = useNavigate();
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const isChanged = weight !== currentWeight;

  const handleSubmitClick = () => {
    if (isChanged && !isReconciling) {
      setShowConfirmModal(true);
    }
  };

  const handleConfirmSubmit = () => {
    setShowConfirmModal(false);
    onSubmit();
  };

  const handleCancelSubmit = () => {
    setShowConfirmModal(false);
  };

  return (
    <div className="space-y-5">
      {/* Divider - Weekly Actions */}
      <div className="relative py-2">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-white/10" />
        </div>
        <div className="relative flex justify-center">
          <span className="px-3 text-xs text-white/40 bg-gradient-to-r from-transparent via-black/20 to-transparent">
            À faire chaque semaine
          </span>
        </div>
      </div>

      <div
        id="weight-update-section"
        className="glass-card-premium rounded-3xl p-6 sm:p-8 space-y-6 relative overflow-hidden"
        style={{
          background: `
            radial-gradient(circle at 30% 30%, rgba(247, 147, 30, 0.15) 0%, transparent 50%),
            radial-gradient(circle at 70% 70%, rgba(251, 191, 36, 0.12) 0%, transparent 50%),
            rgba(255, 255, 255, 0.03)
          `,
          backdropFilter: 'blur(20px) saturate(150%)',
          WebkitBackdropFilter: 'blur(20px) saturate(150%)',
          border: '1px solid rgba(247, 147, 30, 0.3)',
          boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.1)'
        }}
      >
        {/* Widget Header avec badge points */}
        <WidgetHeader
          icon="Scale"
          mainColor="#F7931E"
          glowColor="#FBBF24"
          title="Mise à jour Poids"
          subtitle={hasActiveAbsence ? `Débloque ${pendingXp} points en attente` : 'Gagne 30 points par mise à jour'}
          animationType="glow"
          badge={hasActiveAbsence && pendingXp > 0 && !isReconciling ? {
            label: `${pendingXp} pts`,
            color: '#FB923C'
          } : undefined}
        />

      <div className="flex flex-col items-stretch gap-3">
        <div className="flex items-center gap-3">
          {/* Bouton -0.1 kg */}
          <button
            onClick={() => onIncrement(-0.1)}
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-white/10 hover:bg-white/20 active:bg-white/30 flex items-center justify-center transition-all flex-shrink-0 border border-white/10"
            title="-0.1 kg"
          >
            <SpatialIcon name="Minus" size={24} color="white" />
          </button>

          {/* Affichage du poids (non-éditable) */}
          <div className="flex-1 glass-card rounded-xl py-4 sm:py-6 px-4 text-center border border-orange-500/20 min-h-[100px] sm:min-h-[110px] md:min-h-[120px] flex flex-col items-center justify-center">
            <div
              className="font-black text-white leading-none"
              style={{
                fontSize: 'clamp(2.5rem, 8vw, 3.5rem)',
                fontWeight: '900',
                letterSpacing: '-0.02em'
              }}
            >
              {weight.toFixed(1)}
            </div>
            <p className="text-xs sm:text-sm text-white/60 font-semibold mt-1.5 sm:mt-2">kg</p>
          </div>

          {/* Bouton +0.1 kg */}
          <button
            onClick={() => onIncrement(0.1)}
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-white/10 hover:bg-white/20 active:bg-white/30 flex items-center justify-center transition-all flex-shrink-0 border border-white/10"
            title="+0.1 kg"
          >
            <SpatialIcon name="Plus" size={24} color="white" />
          </button>
        </div>

        {/* Bouton Valider le poids */}
        <motion.button
          onClick={handleSubmitClick}
          disabled={!isChanged || isReconciling}
          className="w-full px-6 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-yellow-500 text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed shadow-lg relative overflow-hidden"
          style={{
            boxShadow: isChanged ? '0 4px 20px rgba(247, 147, 30, 0.4)' : 'none'
          }}
          whileHover={{ scale: isChanged && !isReconciling ? 1.02 : 1 }}
          whileTap={{ scale: isChanged && !isReconciling ? 0.98 : 1 }}
        >
          {isReconciling && (
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
              animate={{ x: ['-200%', '200%'] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
            />
          )}
          <div className="relative flex items-center justify-center gap-2">
            {isReconciling ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                >
                  <SpatialIcon Icon={ICONS.Loader2} size={18} color="white" />
                </motion.div>
                <span>Calcul en cours...</span>
              </>
            ) : (
              <>
                <SpatialIcon name="Check" size={18} color="white" />
                <span>{hasActiveAbsence ? 'Débloquer points' : 'Valider'}</span>
              </>
            )}
          </div>
        </motion.button>

        {/* Séparateur */}
      </div>
    </div>

      {/* Modal de confirmation */}
      <AnimatePresence>
        {showConfirmModal && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9998]"
              onClick={handleCancelSubmit}
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-md z-[9999]"
            >
              <div className="glass-card rounded-2xl p-6 border border-orange-500/30 bg-gradient-to-br from-orange-500/20 to-yellow-500/10">
                {/* Icône */}
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-orange-500/30 to-yellow-500/30 flex items-center justify-center border-2 border-orange-500/40">
                  <SpatialIcon name="AlertTriangle" size={32} color="#F7931E" />
                </div>

                {/* Titre */}
                <h3 className="text-xl font-bold text-white text-center mb-2">
                  Confirmer votre poids
                </h3>

                {/* Message */}
                <div className="space-y-3 mb-6">
                  <p className="text-white/90 text-center text-base">
                    Vous êtes sur le point de valider :
                  </p>
                  <div className="glass-card rounded-xl p-4 border border-orange-500/30 bg-orange-500/10">
                    <p className="text-center">
                      <span className="text-white/70 text-sm">Nouveau poids :</span>
                      <br />
                      <span className="text-4xl font-black text-white">{weight.toFixed(1)}</span>
                      <span className="text-white/60 text-lg ml-2">kg</span>
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-orange-500/5 border border-orange-500/20">
                    <div className="flex items-start gap-3">
                      <SpatialIcon name="Info" size={20} color="#F7931E" className="flex-shrink-0 mt-0.5" />
                      <p className="text-white/80 text-sm leading-relaxed">
                        <strong className="text-orange-400">Important :</strong> Votre poids est essentiel pour le bon fonctionnement de l'application. Il influence vos projections, recommandations nutritionnelles, calculs caloriques et programmes d'entraînement.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Boutons */}
                <div className="flex gap-3">
                  <button
                    onClick={handleCancelSubmit}
                    className="flex-1 px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold transition-all"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleConfirmSubmit}
                    className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white font-bold transition-all shadow-lg"
                    style={{
                      boxShadow: '0 4px 20px rgba(247, 147, 30, 0.4)'
                    }}
                  >
                    Confirmer
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
