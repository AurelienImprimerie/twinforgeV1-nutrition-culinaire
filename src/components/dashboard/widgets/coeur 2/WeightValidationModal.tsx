import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import SpatialIcon from '@/ui/icons/SpatialIcon';
import { ICONS } from '@/ui/icons/registry';

interface ValidationResult {
  isValid: boolean;
  warnings: string[];
  changePercentage: number;
  estimatedBodyFat?: number;
  isExtreme?: boolean;
}

interface WeightValidationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  validation: ValidationResult;
  currentWeight: number;
  newWeight: number;
}

export default function WeightValidationModal({
  isOpen,
  onClose,
  onConfirm,
  validation,
  currentWeight,
  newWeight
}: WeightValidationModalProps) {
  if (!isOpen) return null;

  const weightDiff = newWeight - currentWeight;
  const isGain = weightDiff > 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <div className="fixed inset-0 flex items-center justify-center z-[9999] p-4">
            <motion.div
              className="glass-card-premium rounded-3xl p-6 max-w-md w-full"
              style={{
                background: 'rgba(15, 23, 42, 0.95)',
                backdropFilter: 'blur(20px)',
                border: '2px solid rgba(247, 147, 30, 0.3)',
                boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5)'
              }}
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ duration: 0.3 }}
            >
              <div className="text-center mb-6">
                <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${validation.isValid ? 'bg-gradient-to-br from-green-500/20 to-emerald-600/20 border-2 border-green-500/40' : 'bg-gradient-to-br from-orange-500/20 to-amber-600/20 border-2 border-orange-500/40'}`}>
                  <SpatialIcon Icon={validation.isValid ? ICONS.CheckCircle : ICONS.AlertTriangle} size={32} style={{ color: validation.isValid ? '#10B981' : '#F59E0B' }} />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">{validation.isValid ? 'Validation du poids' : 'Attention requise'}</h3>
                <p className="text-white/70">{validation.isValid ? 'Confirmer cette mise à jour' : 'Changement inhabituel détecté'}</p>
              </div>
              <div className="rounded-2xl p-4 mb-6" style={{ background: 'linear-gradient(135deg, rgba(247, 147, 30, 0.1), rgba(251, 191, 36, 0.05))', border: '1px solid rgba(247, 147, 30, 0.3)' }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-center flex-1">
                    <p className="text-sm text-white/60 mb-1">Poids actuel</p>
                    <p className="text-2xl font-bold text-white">{currentWeight} kg</p>
                  </div>
                  <div className="flex items-center justify-center px-4"><SpatialIcon Icon={ICONS.ArrowRight} size={24} style={{ color: '#F7931E' }} /></div>
                  <div className="text-center flex-1">
                    <p className="text-sm text-white/60 mb-1">Nouveau poids</p>
                    <p className="text-2xl font-bold text-white">{newWeight} kg</p>
                  </div>
                </div>
                <div className="text-center">
                  <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-bold ${isGain ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'}`}>{isGain ? '+' : ''}{weightDiff.toFixed(1)} kg ({Math.abs(validation.changePercentage).toFixed(1)}%)</span>
                </div>
              </div>
              {validation.warnings.length > 0 && (
                <div className="space-y-2 mb-6">
                  {validation.warnings.map((warning, index) => (
                    <div key={index} className="flex items-start gap-3 p-3 rounded-xl" style={{ background: 'rgba(251, 191, 36, 0.1)', border: '1px solid rgba(251, 191, 36, 0.3)' }}>
                      <SpatialIcon Icon={ICONS.AlertCircle} size={20} style={{ color: '#FBBF24', marginTop: 2 }} />
                      <p className="text-sm text-white/80 flex-1">{warning}</p>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-3">
                <button onClick={onClose} className="flex-1 px-6 py-3 rounded-xl font-bold text-white/80 hover:text-white transition-all" style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)' }}>Annuler</button>
                <button onClick={() => { onConfirm(); onClose(); }} className="flex-1 px-6 py-3 rounded-xl font-bold text-white transition-all hover:scale-105" style={{ background: 'linear-gradient(135deg, #F7931E, #FBBF24)', boxShadow: '0 8px 24px rgba(247, 147, 30, 0.4)' }}>Confirmer</button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
