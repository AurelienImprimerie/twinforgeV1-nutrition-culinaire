import React from 'react';
import { motion } from 'framer-motion';
import { usePerformanceMode } from '../../../../system/context/PerformanceModeContext';
import GlassCard from '../../../../ui/cards/GlassCard';
import SpatialIcon from '../../../../ui/icons/SpatialIcon';
import { ICONS } from '../../../../ui/icons/registry';

// Hook responsive SSR-safe pour détecter mobile
function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = React.useState(false);
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const onChange = (e: MediaQueryListEvent | MediaQueryList) =>
      setIsMobile('matches' in e ? e.matches : (e as MediaQueryList).matches);
    onChange(mql);
    if ('addEventListener' in mql) mql.addEventListener('change', onChange as (e: MediaQueryListEvent) => void);
    else mql.addListener(onChange as (this: MediaQueryList, ev: MediaQueryListEvent) => void);
    return () => {
      if ('removeEventListener' in mql) mql.removeEventListener('change', onChange as (e: MediaQueryListEvent) => void);
      else mql.removeListener(onChange as (this: MediaQueryList, ev: MediaQueryListEvent) => void);
    };
  }, [breakpoint]);
  return isMobile;
}

interface LoadingAnalysisCardProps {
  simulatedLoadingStep: number;
  simulatedScanProgress: number;
  loadingMessage: string;
}

/**
 * Loading Analysis Card - Carte d'Analyse IA Dynamique
 * Composant dédié pour l'affichage de l'état de chargement avec animations
 */
const LoadingAnalysisCard: React.FC<LoadingAnalysisCardProps> = ({
  simulatedLoadingStep,
  simulatedScanProgress,
  loadingMessage
}) => {
  const isMobile = useIsMobile();
  const { isPerformanceMode } = usePerformanceMode();
  const MotionDiv = isPerformanceMode ? 'div' : motion.div;
  
  // Étapes de chargement détaillées pour l'Atelier de Recettes
  const loadingSteps = [
    { message: 'Initialisation de l\'analyse IA...', duration: 5000, icon: 'Zap' },
    { message: 'Traitement des images avec GPT-4o...', duration: 40000, icon: 'Eye' },
    { message: 'Détection des ingrédients...', duration: 15000, icon: 'Search' },
    { message: 'Normalisation de l\'inventaire...', duration: 10000, icon: 'CheckCircle' }
  ];

  return (
    <MotionDiv
      {...(!isPerformanceMode && {
        initial: { opacity: 0, y: 30, scale: 0.95 },
        animate: { opacity: 1, y: 0, scale: 1 },
        transition: { duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }
      })}
    >
      <GlassCard
        className="p-8 text-center relative overflow-hidden"
        style={isPerformanceMode ? {
          background: 'linear-gradient(145deg, color-mix(in srgb, var(--color-fridge-primary) 20%, #1e293b), color-mix(in srgb, var(--color-fridge-primary) 10%, #0f172a))',
          borderColor: 'color-mix(in srgb, var(--color-fridge-primary) 40%, transparent)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
          minHeight: '400px'
        } : {
          background: `
            radial-gradient(circle at 30% 20%, color-mix(in srgb, var(--color-fridge-primary) 18%, transparent) 0%, transparent 60%),
            radial-gradient(circle at 70% 80%, color-mix(in srgb, var(--color-plasma-cyan) 15%, transparent) 0%, transparent 50%),
            radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--brand-primary) 12%, transparent) 0%, transparent 70%),
            var(--glass-opacity)
          `,
          borderColor: 'color-mix(in srgb, var(--color-fridge-primary) 35%, transparent)',
          boxShadow: `
            0 25px 80px rgba(0, 0, 0, 0.4),
            0 0 60px color-mix(in srgb, var(--color-fridge-primary) 30%, transparent),
            0 0 120px color-mix(in srgb, var(--color-plasma-cyan) 20%, transparent),
            inset 0 3px 0 rgba(255, 255, 255, 0.25),
            inset 0 -2px 0 rgba(0, 0, 0, 0.15)
          `,
          backdropFilter: 'blur(32px) saturate(180%)',
          WebkitBackdropFilter: 'blur(32px) saturate(180%)',
          minHeight: '400px'
        }}
      >
        {/* Grille de Scan Animée en Arrière-Plan */}
        <div 
          className="absolute inset-0 pointer-events-none opacity-20 fridge-grid-pulse"
          style={{
            background: `
              linear-gradient(90deg, transparent 0%, color-mix(in srgb, var(--color-plasma-cyan) 30%, transparent) 1px, transparent 2px),
              linear-gradient(0deg, transparent 0%, color-mix(in srgb, var(--color-plasma-cyan) 30%, transparent) 1px, transparent 2px)
            `,
            backgroundSize: '40px 40px'
          }}
        />

        {/* Ligne de Scan Verticale - Désactivée en performance mode */}
        {!isPerformanceMode && (
          <motion.div
            className="absolute top-0 left-0 w-1 h-full pointer-events-none fridge-scan-analysis-line"
            style={{
              background: `linear-gradient(180deg,
                transparent 0%,
                color-mix(in srgb, var(--color-plasma-cyan) 80%, transparent) 30%,
                color-mix(in srgb, var(--color-plasma-cyan) 100%, transparent) 50%,
                color-mix(in srgb, var(--color-plasma-cyan) 80%, transparent) 70%,
                transparent 100%
              )`,
              boxShadow: `0 0 20px color-mix(in srgb, var(--color-plasma-cyan) 80%, transparent)`
            }}
          />
        )}

        {/* Particules de Données Flottantes - Désactivées en performance mode */}
        {!isPerformanceMode && [...Array(8)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 rounded-full pointer-events-none fridge-data-particle"
            style={{
              background: i % 2 === 0 ? 'var(--color-fridge-primary)' : 'var(--color-plasma-cyan)',
              boxShadow: `0 0 12px ${i % 2 === 0 ? 'var(--color-fridge-primary)' : 'var(--color-plasma-cyan)'}`,
              left: `${15 + (i * 12)}%`,
              top: `${20 + (i % 3) * 25}%`
            }}
          />
        ))}

        <div className="relative z-10 space-y-8">
          {/* Icône Principale avec Halo Dynamique */}
          <div className="relative">
            <MotionDiv
              className="w-32 h-32 mx-auto rounded-full flex items-center justify-center relative fridge-ai-focus"
              style={isPerformanceMode ? {
                background: 'linear-gradient(135deg, color-mix(in srgb, var(--color-fridge-primary) 45%, #1e293b), color-mix(in srgb, var(--color-plasma-cyan) 30%, #0f172a))',
                border: `4px solid color-mix(in srgb, var(--color-fridge-primary) 80%, transparent)`,
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)'
              } : {
                background: `
                  radial-gradient(circle at 30% 30%, rgba(255,255,255,0.3) 0%, transparent 60%),
                  radial-gradient(circle at 70% 70%, color-mix(in srgb, var(--color-fridge-primary) 25%, transparent) 0%, transparent 50%),
                  linear-gradient(135deg, color-mix(in srgb, var(--color-fridge-primary) 50%, transparent), color-mix(in srgb, var(--color-plasma-cyan) 40%, transparent))
                `,
                border: `4px solid color-mix(in srgb, var(--color-fridge-primary) 80%, transparent)`,
                backdropFilter: 'blur(24px) saturate(180%)',
                WebkitBackdropFilter: 'blur(24px) saturate(180%)'
              }}
            >
              <MotionDiv
                {...(!isPerformanceMode && {
                  animate: {
                    rotate: [0, 360],
                    scale: [1, 1.1, 1]
                  },
                  transition: {
                    duration: isMobile ? 6 : 3,
                    repeat: Infinity,
                    ease: "linear"
                  }
                })}
              >
                <SpatialIcon 
                  Icon={ICONS[loadingSteps[simulatedLoadingStep]?.icon as keyof typeof ICONS] || ICONS.Camera}
                  size={56} 
                  style={{ 
                    color: 'var(--color-fridge-primary)',
                    filter: `
                      drop-shadow(0 0 20px color-mix(in srgb, var(--color-fridge-primary) 90%, transparent))
                      drop-shadow(0 0 40px color-mix(in srgb, var(--color-fridge-primary) 70%, transparent))
                      drop-shadow(0 0 60px color-mix(in srgb, var(--color-plasma-cyan) 50%, transparent))
                    `
                  }}
                  variant="pure"
                />
              </MotionDiv>

              {/* Anneaux de Pulsation Multiples - Désactivés en performance mode */}
              {!isPerformanceMode && (
                <>
                  <motion.div
                className="absolute inset-0 rounded-full border-2"
                style={{ borderColor: 'color-mix(in srgb, var(--color-fridge-primary) 60%, transparent)' }}
                animate={{ 
                  scale: [1, 1.4, 1],
                  opacity: [0.8, 0, 0.8]
                }}
                transition={{ 
                  duration: 2, 
                  repeat: Infinity,
                  ease: "easeOut"
                }}
              />
              <motion.div
                className="absolute inset-0 rounded-full border-2"
                style={{ borderColor: 'color-mix(in srgb, var(--color-plasma-cyan) 50%, transparent)' }}
                animate={{ 
                  scale: [1, 1.6, 1],
                  opacity: [0.6, 0, 0.6]
                }}
                transition={{ 
                  duration: 2.5, 
                  repeat: Infinity,
                  ease: "easeOut",
                  delay: 0.5
                }}
              />
              <motion.div
                className="absolute inset-0 rounded-full border-2"
                style={{ borderColor: 'color-mix(in srgb, var(--brand-primary) 40%, transparent)' }}
                animate={{ 
                  scale: [1, 1.8, 1],
                  opacity: [0.4, 0, 0.4]
                }}
                transition={{ 
                  duration: 3, 
                  repeat: Infinity,
                  ease: "easeOut",
                  delay: 1
                }}
              />
                </>
              )}
            </MotionDiv>
          </div>
          
          {/* Titre et Message Dynamiques */}
          <div className="space-y-4">
            <h3
              className="text-3xl font-bold text-white"
              style={{
                textShadow: `0 0 20px color-mix(in srgb, var(--color-fridge-primary) 60%, transparent)`
              }}
            >
              Forge Spatiale Active
            </h3>
            
            <p
              className="text-white/90 text-xl"
            >
              {loadingSteps[simulatedLoadingStep]?.message || loadingMessage}
            </p>

            {/* Barre de Progression Globale */}
            <div className="max-w-md mx-auto space-y-3">
              <div className="flex justify-between text-sm text-white/70">
                <span>Progression de l'analyse</span>
                <span>{Math.round(simulatedScanProgress)}%</span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-3 overflow-hidden">
                <motion.div
                  className="h-3 rounded-full relative overflow-hidden"
                  style={{
                    background: `linear-gradient(90deg, 
                      var(--color-fridge-primary), 
                      var(--color-plasma-cyan), 
                      var(--brand-primary)
                    )`,
                    boxShadow: `
                      0 0 16px color-mix(in srgb, var(--color-fridge-primary) 70%, transparent),
                      inset 0 1px 0 rgba(255,255,255,0.4)
                    `,
                    width: `${simulatedScanProgress}%`
                  }}
                  initial={{ width: 0 }}
                  animate={{ width: `${simulatedScanProgress}%` }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                >
                  {/* Shimmer Effect - Désactivé en performance mode */}
                  {!isPerformanceMode && (
                    <div
                      className="absolute inset-0 rounded-full fridge-spatial-shimmer"
                      style={{
                        background: `linear-gradient(90deg,
                          transparent 0%,
                          rgba(255,255,255,0.6) 50%,
                          transparent 100%
                        )`
                      }}
                    />
                  )}
                </motion.div>
              </div>
            </div>
          </div>

          {/* Étapes de Traitement Détaillées */}
          <div className="space-y-3 max-w-lg mx-auto">
            <h4 className="text-white/80 font-semibold text-lg mb-4 flex items-center gap-2">
              <SpatialIcon Icon={ICONS.Zap} size={16} style={{ color: 'var(--color-plasma-cyan)' }} />
              Processus d'Analyse de la Forge
            </h4>
            
            <div className="space-y-2">
              {loadingSteps.map((step, index) => {
                const isActive = index === simulatedLoadingStep;
                const isCompleted = index < simulatedLoadingStep;
                const isPending = index > simulatedLoadingStep;
                
                return (
                  <MotionDiv
                    key={index}
                    className="flex items-center gap-3 p-3 rounded-xl transition-all duration-300"
                    style={{
                      background: isActive 
                        ? `color-mix(in srgb, var(--color-fridge-primary) 15%, transparent)`
                        : isCompleted 
                        ? `color-mix(in srgb, var(--color-plasma-cyan) 10%, transparent)`
                        : 'rgba(255, 255, 255, 0.05)',
                      border: isActive 
                        ? `2px solid color-mix(in srgb, var(--color-fridge-primary) 40%, transparent)`
                        : isCompleted 
                        ? `1px solid color-mix(in srgb, var(--color-plasma-cyan) 30%, transparent)`
                        : '1px solid rgba(255, 255, 255, 0.1)',
                      boxShadow: isActive 
                        ? `0 0 20px color-mix(in srgb, var(--color-fridge-primary) 30%, transparent)`
                        : 'none'
                    }}
                    {...(!isPerformanceMode && {
                      initial: { opacity: 0, x: -20 },
                      animate: { opacity: 1, x: 0 },
                      transition: { duration: 0.4, delay: index * 0.1 }
                    })}
                  >
                    {/* Indicateur d'État */}
                    <div 
                      className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{
                        background: isActive 
                          ? `color-mix(in srgb, var(--color-fridge-primary) 25%, transparent)`
                          : isCompleted 
                          ? `color-mix(in srgb, var(--color-plasma-cyan) 20%, transparent)`
                          : 'rgba(255, 255, 255, 0.1)',
                        border: isActive 
                          ? `2px solid color-mix(in srgb, var(--color-fridge-primary) 50%, transparent)`
                        : isCompleted 
                        ? `1px solid color-mix(in srgb, var(--color-plasma-cyan) 40%, transparent)`
                          : '1px solid rgba(255, 255, 255, 0.2)'
                      }}
                    >
                      {isCompleted ? (
                        <SpatialIcon
                          Icon={ICONS.Check} 
                          size={14} 
                          style={{ color: 'var(--color-plasma-cyan)' }} 
                        />
                      ) : isActive ? (
                        isPerformanceMode ? (
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ background: 'var(--color-fridge-primary)' }}
                          />
                        ) : (
                          <motion.div
                            className="w-3 h-3 rounded-full"
                            style={{ background: 'var(--color-fridge-primary)' }}
                            animate={{
                              scale: [1, 1.3, 1],
                              opacity: [0.8, 1, 0.8]
                            }}
                            transition={{
                              duration: 1,
                              repeat: Infinity
                            }}
                          />
                        )
                      ) : (
                        <span 
                          className="text-xs font-bold text-white/60"
                        >
                          {index + 1}
                        </span>
                      )}
                    </div>
                    
                    {/* Texte de l'Étape */}
                    <div className="flex-1 text-left">
                      <span 
                        className={`text-sm font-medium ${
                          isActive ? 'text-white' : 
                          isCompleted ? 'text-white/90' : 
                          'text-white/60'
                        }`}
                      >
                        {step.message}
                      </span>
                    </div>
                    
                    {/* Icône de l'Étape */}
                    <SpatialIcon 
                      Icon={ICONS[step.icon as keyof typeof ICONS]} 
                      size={16} 
                      style={{ 
                        color: isActive 
                          ? 'var(--color-fridge-primary)' 
                          : isCompleted 
                          ? 'var(--color-plasma-cyan)' 
                          : 'rgba(255, 255, 255, 0.4)'
                      }}
                    />
                  </MotionDiv>
                );
              })}
            </div>
          </div>

          {/* Indicateur de Temps Estimé */}
          <MotionDiv
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full"
            style={isPerformanceMode ? {
              background: 'color-mix(in srgb, var(--color-plasma-cyan) 15%, #1e293b)',
              border: '1px solid color-mix(in srgb, var(--color-plasma-cyan) 30%, transparent)'
            } : {
              background: 'color-mix(in srgb, var(--color-plasma-cyan) 10%, transparent)',
              border: '1px solid color-mix(in srgb, var(--color-plasma-cyan) 25%, transparent)',
              backdropFilter: 'blur(12px) saturate(140%)'
            }}
            {...(!isPerformanceMode && {
              animate: {
                scale: [1, 1.02, 1],
                opacity: [0.8, 1, 0.8]
              },
              transition: {
                duration: 2,
                repeat: Infinity
              }
            })}
          >
            <MotionDiv
              className="w-2 h-2 rounded-full"
              style={{ background: 'var(--color-plasma-cyan)' }}
              {...(!isPerformanceMode && {
                animate: {
                  scale: [1, 1.2, 1],
                  opacity: [0.6, 1, 0.6]
                },
                transition: {
                  duration: 1,
                  repeat: Infinity
                }
              })}
            />
            <span className="text-cyan-300 text-sm font-medium">
              Analyse de la Forge en cours... (~60-75 secondes)
            </span>
          </MotionDiv>
        </div>
      </GlassCard>
    </MotionDiv>
  );
};

export default LoadingAnalysisCard;