import React from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import GlassCard from '../../../../../ui/cards/GlassCard';
import SpatialIcon from '../../../../../ui/icons/SpatialIcon';
import { ICONS } from '../../../../../ui/icons/registry';
import PipelineGamingHint from '../../../../../components/dashboard/PipelineGamingHint';

interface CaptureGuideProps {
  isValidating: boolean;
  onCameraClick: () => void;
  onGalleryClick: () => void;
  onBarcodeClick: () => void;
  onBarcodeImageUpload: () => void;
}

/**
 * Capture Guide Component - Guide de capture TwinForge
 * Interface de guidage pour la capture de photo de repas
 */
const CaptureGuide: React.FC<CaptureGuideProps> = ({
  isValidating,
  onCameraClick,
  onGalleryClick,
  onBarcodeClick,
  onBarcodeImageUpload,
}) => {
  const [showBarcodeOptions, setShowBarcodeOptions] = React.useState(false);

  React.useEffect(() => {
    console.log('CaptureGuide mounted, isValidating:', isValidating);
    console.log('CaptureGuide handlers:', { onCameraClick, onGalleryClick, onBarcodeClick });

    // DEBUG: Global click listener
    const globalClickHandler = (e: MouseEvent) => {
      console.log('🖱️ GLOBAL CLICK DETECTED:', {
        target: e.target,
        currentTarget: e.currentTarget,
        clientX: e.clientX,
        clientY: e.clientY,
        tagName: (e.target as HTMLElement)?.tagName,
        className: (e.target as HTMLElement)?.className
      });
    };

    document.addEventListener('click', globalClickHandler, true);

    return () => {
      document.removeEventListener('click', globalClickHandler, true);
    };
  }, []);

  React.useEffect(() => {
    console.log('isValidating changed:', isValidating);
  }, [isValidating]);

  console.log('🎨 CaptureGuide RENDER', { isValidating });

  return (
    <GlassCard
      interactive={false}
      className="p-6 relative glass-card--capture meal-capture-enter"
      style={{
        position: 'relative',
        zIndex: 10,
        background: `
          radial-gradient(circle at 30% 20%, rgba(16, 185, 129, 0.08) 0%, transparent 60%),
          radial-gradient(circle at 70% 80%, rgba(34, 197, 94, 0.06) 0%, transparent 50%),
          var(--glass-opacity)
        `,
        borderColor: 'rgba(16, 185, 129, 0.25)',
        boxShadow: `
          0 12px 40px rgba(0, 0, 0, 0.25),
          0 0 30px rgba(16, 185, 129, 0.12),
          inset 0 2px 0 rgba(255, 255, 255, 0.15)
        `
      }}
    >
      <div className="flex items-center justify-between mb-4">
        {/* Titre avec icône lumineuse */}
        <div className="flex items-center gap-3">
          {/* Icône sur fond coloré lumineux */}
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
                linear-gradient(135deg, rgba(16, 185, 129, 0.45), rgba(5, 150, 105, 0.35))
              `,
              border: '2px solid rgba(16, 185, 129, 0.6)',
              boxShadow: `
                0 0 20px rgba(16, 185, 129, 0.6),
                0 0 40px rgba(16, 185, 129, 0.3),
                inset 0 2px 0 rgba(255,255,255,0.35),
                inset 0 -2px 0 rgba(0,0,0,0.2)
              `
            }}
          >
            <SpatialIcon
              Icon={ICONS.Camera}
              size={18}
              style={{
                color: '#fff',
                filter: 'drop-shadow(0 2px 8px rgba(16, 185, 129, 0.9)) drop-shadow(0 0 4px rgba(255,255,255,0.5))'
              }}
            />
          </div>
          <h4
            className="text-white font-bold text-base"
            style={{
              textShadow: '0 2px 8px rgba(16, 185, 129, 0.4), 0 0 4px rgba(0,0,0,0.3)'
            }}
          >
            Photo de votre repas
          </h4>
        </div>

        {/* Joli bouton "En attente" */}
        <div
          className="flex items-center gap-2 px-3 py-1.5"
          style={{
            background: `
              linear-gradient(135deg,
                rgba(59, 130, 246, 0.2),
                rgba(37, 99, 235, 0.15)
              )
            `,
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
      
      <div className="space-y-6" style={{ position: 'relative', zIndex: 1 }}>
        {/* Guide Overlay */}
        <div 
          className="relative aspect-[4/3] rounded-xl overflow-visible meal-capture-guide"
          style={{
            background: `
              radial-gradient(circle at 40% 30%, rgba(16, 185, 129, 0.12) 0%, transparent 60%),
              radial-gradient(circle at 60% 70%, rgba(34, 197, 94, 0.08) 0%, transparent 50%),
              linear-gradient(135deg, rgba(16, 185, 129, 0.06), rgba(34, 197, 94, 0.04))
            `,
            border: '2px dashed rgba(16, 185, 129, 0.3)',
            backdropFilter: 'blur(8px) saturate(120%)'
          }}
        >
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ pointerEvents: 'none !important' } as React.CSSProperties}
          >
            <div className="text-center space-y-4">
              <div 
                className="w-24 h-24 mx-auto rounded-full flex items-center justify-center relative"
                style={{
                  background: `
                    radial-gradient(circle at 30% 30%, rgba(255,255,255,0.15) 0%, transparent 60%),
                    linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(34, 197, 94, 0.3))
                  `,
                  border: '2px solid rgba(16, 185, 129, 0.4)',
                  boxShadow: '0 0 30px rgba(16, 185, 129, 0.3)'
                }}
              >
                <SpatialIcon 
                  Icon={ICONS.Camera} 
                  size={48} 
                  className="text-green-400 icon-pulse-css"
                  style={{
                    filter: 'drop-shadow(0 2px 8px rgba(16, 185, 129, 0.4))'
                  }}
                />
                
                {/* Particules CSS simplifiées */}
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className={`absolute w-2 h-2 rounded-full bg-green-400 particle-css particle-css--${i + 1}`}
                    style={{
                      left: `${20 + i * 20}%`,
                      top: `${20 + (i % 2) * 60}%`,
                      boxShadow: '0 0 8px rgba(16, 185, 129, 0.6)',
                      '--particle-color': '#10B981'
                    }}
                  />
                ))}
              </div>
              <div>
                <h5 className="text-white font-semibold mb-2 text-base md:text-lg">
                  Forgez Votre Nutrition
                </h5>
                <p className="text-green-200 text-xs md:text-sm leading-relaxed max-w-full sm:max-w-xs mx-auto px-2 sm:px-0">
                  Capturez votre repas pour une analyse complète des nutriments et calories
                </p>
              </div>
            </div>
          </div>
        </div>
        
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('CaptureGuide: Camera button onClick fired', e);
            console.log('isValidating:', isValidating);
            console.log('Calling onCameraClick...');
            onCameraClick();
          }}
          onMouseDown={(e) => {
            console.log('Camera button mouseDown');
          }}
          onTouchStart={(e) => {
            console.log('Camera button touchStart');
          }}
          className="w-full btn-glass--primary touch-feedback-css"
          disabled={isValidating}
          type="button"
          style={{
            '--scan-primary': '#10B981',
            background: `
              linear-gradient(135deg, 
                rgba(16, 185, 129, 0.8), 
                rgba(34, 197, 94, 0.6)
              )
            `,
            backdropFilter: 'blur(20px) saturate(160%)',
            boxShadow: `
              0 12px 40px rgba(16, 185, 129, 0.4),
              0 0 60px rgba(16, 185, 129, 0.3),
              inset 0 3px 0 rgba(255,255,255,0.3),
              inset 0 -3px 0 rgba(0,0,0,0.2)
            `,
            border: '2px solid rgba(16, 185, 129, 0.6)'
          }}
        >
          <div className="relative flex items-center justify-center gap-3">
            <div className={isValidating ? 'icon-spin-css' : ''}>
              <SpatialIcon 
                Icon={isValidating ? ICONS.Loader2 : ICONS.Camera} 
                size={24} 
                className="text-white"
                style={{
                  filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.3))'
                }}
              />
            </div>
            <span className="font-bold text-lg">
              {isValidating ? 'Validation...' : 'Appareil photo'}
            </span>
          </div>
        </button>

        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('CaptureGuide: Gallery button onClick fired', e);
            console.log('isValidating:', isValidating);
            console.log('Calling onGalleryClick...');
            onGalleryClick();
          }}
          onMouseDown={(e) => {
            console.log('Gallery button mouseDown');
          }}
          onTouchStart={(e) => {
            console.log('Gallery button touchStart');
          }}
          className="w-full btn-glass btn-glass--secondary-nav touch-feedback-css"
          disabled={isValidating}
          type="button"
          style={{
            background: 'rgba(16, 185, 129, 0.08)',
            borderColor: 'rgba(16, 185, 129, 0.25)',
            backdropFilter: 'blur(12px) saturate(130%)',
            boxShadow: `
              0 4px 16px rgba(0, 0, 0, 0.15),
              0 0 20px rgba(16, 185, 129, 0.1),
              inset 0 1px 0 rgba(255, 255, 255, 0.15)
            `
          }}
        >
          <div className="flex items-center justify-center gap-2">
            <SpatialIcon Icon={ICONS.Image} size={18} />
            <span className="font-medium">Galerie</span>
          </div>
        </button>

        {/* Gaming Hint - Centré */}
        <div className="mt-4 flex justify-center">
          <PipelineGamingHint
            points={25}
            forgeName="Forge Nutritionnelle"
            message="Scannez votre repas pour gagner des points"
          />
        </div>
      </div>
    </GlassCard>
  );
};

export default CaptureGuide;