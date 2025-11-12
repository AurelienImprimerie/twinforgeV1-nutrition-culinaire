// src/app/pages/Meals/components/MealPhotoCaptureStep/EmptyBarcodeState.tsx
/**
 * Empty Barcode State Component
 * Displays the initial state for barcode scanning with action buttons
 */

import React from 'react';
import { motion } from 'framer-motion';
import GlassCard from '../../../../../ui/cards/GlassCard';
import SpatialIcon from '../../../../../ui/icons/SpatialIcon';
import { ICONS } from '../../../../../ui/icons/registry';
import PipelineGamingHint from '../../../../../components/dashboard/PipelineGamingHint';

interface EmptyBarcodeStateProps {
  onBarcodeClick: () => void;
  onBarcodeImageUpload: () => void;
}

const EmptyBarcodeState: React.FC<EmptyBarcodeStateProps> = ({
  onBarcodeClick,
  onBarcodeImageUpload
}) => {
  return (
    <div className="mt-6">
      <GlassCard
        className="p-6 rounded-3xl"
        style={{
          background: `
            radial-gradient(circle at 30% 20%, rgba(99, 102, 241, 0.15) 0%, transparent 60%),
            radial-gradient(circle at 70% 80%, rgba(79, 70, 229, 0.1) 0%, transparent 50%),
            rgba(17, 24, 39, 0.95)
          `,
          borderColor: 'rgba(99, 102, 241, 0.4)',
          borderWidth: '2px',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          boxShadow: `
            0 20px 60px rgba(0, 0, 0, 0.3),
            0 0 40px rgba(99, 102, 241, 0.2),
            inset 0 2px 0 rgba(255, 255, 255, 0.15),
            inset 0 -2px 0 rgba(0, 0, 0, 0.1)
          `
        }}
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: `
                  radial-gradient(circle at 30% 30%, rgba(255,255,255,0.25) 0%, transparent 60%),
                  linear-gradient(135deg, rgba(99, 102, 241, 0.45), rgba(79, 70, 229, 0.35))
                `,
                border: '2px solid rgba(99, 102, 241, 0.6)',
                boxShadow: `
                  0 0 20px rgba(99, 102, 241, 0.6),
                  0 0 40px rgba(99, 102, 241, 0.3),
                  inset 0 2px 0 rgba(255,255,255,0.35),
                  inset 0 -2px 0 rgba(0,0,0,0.2)
                `
              }}
            >
              <SpatialIcon
                Icon={ICONS.ScanBarcode}
                size={18}
                style={{
                  color: '#fff',
                  filter: 'drop-shadow(0 2px 8px rgba(99, 102, 241, 0.9)) drop-shadow(0 0 4px rgba(255,255,255,0.5))'
                }}
              />
            </div>
            <h4
              className="text-white font-bold text-base"
              style={{
                textShadow: '0 2px 8px rgba(99, 102, 241, 0.4), 0 0 4px rgba(0,0,0,0.3)'
              }}
            >
              Scan Code-Barre
            </h4>
          </div>
          <div
            className="flex items-center gap-2 px-3 py-1.5"
            style={{
              background: `linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(37, 99, 235, 0.15))`,
              border: '2px solid rgba(59, 130, 246, 0.4)',
              borderRadius: '16px',
              backdropFilter: 'blur(12px) saturate(130%)',
              boxShadow: `
                0 4px 16px rgba(59, 130, 246, 0.25),
                0 0 24px rgba(59, 130, 246, 0.15),
                inset 0 1px 0 rgba(255,255,255,0.2)
              `
            }}
          >
            <motion.div
              className="w-2 h-2 rounded-full"
              style={{
                backgroundColor: '#3B82F6',
                boxShadow: '0 0 10px #3B82F6'
              }}
              animate={{
                scale: [1, 1.3, 1],
                opacity: [0.7, 1, 0.7]
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
            <span
              className="text-xs font-semibold"
              style={{
                color: '#fff',
                textShadow: '0 1px 4px rgba(0,0,0,0.3)'
              }}
            >
              En attente
            </span>
          </div>
        </div>

        <div className="space-y-4">
          <div
            className="relative aspect-[4/3] rounded-2xl overflow-visible"
            style={{
              background: `
                radial-gradient(circle at 40% 30%, rgba(99, 102, 241, 0.15) 0%, transparent 60%),
                radial-gradient(circle at 60% 70%, rgba(79, 70, 229, 0.1) 0%, transparent 50%),
                linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(79, 70, 229, 0.08))
              `,
              border: '2px dashed rgba(99, 102, 241, 0.4)',
              backdropFilter: 'blur(12px) saturate(130%)',
              WebkitBackdropFilter: 'blur(12px) saturate(130%)'
            }}
          >
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center space-y-4">
                <div
                  className="w-24 h-24 mx-auto rounded-full flex items-center justify-center relative"
                  style={{
                    background: `
                      radial-gradient(circle at 30% 30%, rgba(255,255,255,0.15) 0%, transparent 60%),
                      linear-gradient(135deg, rgba(99, 102, 241, 0.25), rgba(79, 70, 229, 0.35))
                    `,
                    border: '2px solid rgba(99, 102, 241, 0.5)',
                    boxShadow: '0 0 30px rgba(99, 102, 241, 0.4)'
                  }}
                >
                  <SpatialIcon
                    Icon={ICONS.ScanBarcode}
                    size={48}
                    className="text-indigo-400"
                    style={{
                      filter: 'drop-shadow(0 2px 8px rgba(99, 102, 241, 0.5))'
                    }}
                  />
                </div>
                <div>
                  <h5 className="text-white font-semibold mb-2 text-base md:text-lg">
                    Scan Rapide
                  </h5>
                  <p className="text-indigo-200 text-xs md:text-sm leading-relaxed max-w-full sm:max-w-xs mx-auto px-2 sm:px-0">
                    Scannez le code-barre pour une analyse instantanée du produit
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={onBarcodeClick}
              className="w-full btn-glass--primary touch-feedback-css"
              style={{
                background: `linear-gradient(135deg, rgba(99, 102, 241, 0.8), rgba(79, 70, 229, 0.6))`,
                backdropFilter: 'blur(20px) saturate(160%)',
                boxShadow: `
                  0 12px 40px rgba(99, 102, 241, 0.4),
                  0 0 60px rgba(99, 102, 241, 0.3),
                  inset 0 3px 0 rgba(255,255,255,0.3),
                  inset 0 -3px 0 rgba(0,0,0,0.2)
                `,
                border: '2px solid rgba(99, 102, 241, 0.6)',
                padding: '1rem'
              }}
            >
              <div className="relative flex flex-col items-center justify-center gap-2">
                <SpatialIcon
                  Icon={ICONS.Camera}
                  size={28}
                  className="text-white"
                  style={{
                    filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.3))'
                  }}
                />
                <span className="font-bold text-base">
                  Scanner avec Caméra
                </span>
              </div>
            </button>

            <button
              onClick={onBarcodeImageUpload}
              className="w-full btn-glass touch-feedback-css"
              style={{
                background: `linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(79, 70, 229, 0.12))`,
                backdropFilter: 'blur(20px) saturate(140%)',
                boxShadow: `
                  0 8px 32px rgba(99, 102, 241, 0.2),
                  0 0 40px rgba(99, 102, 241, 0.12),
                  inset 0 2px 0 rgba(255,255,255,0.12)
                `,
                border: '2px solid rgba(99, 102, 241, 0.35)',
                padding: '1rem'
              }}
            >
              <div className="relative flex flex-col items-center justify-center gap-2">
                <SpatialIcon
                  Icon={ICONS.Image}
                  size={24}
                  className="text-indigo-300"
                  style={{
                    filter: 'drop-shadow(0 2px 8px rgba(99, 102, 241, 0.5))'
                  }}
                />
                <span className="font-bold text-sm text-indigo-200">
                  Choisir depuis Galerie
                </span>
              </div>
            </button>

            {/* Gaming Hint - Centré */}
            <div className="mt-4 flex justify-center">
              <PipelineGamingHint
                points={25}
                forgeName="Forge Nutritionnelle"
                message="Scannez un code-barre pour gagner des points"
              />
            </div>
          </div>
        </div>
      </GlassCard>
    </div>
  );
};

export default EmptyBarcodeState;
