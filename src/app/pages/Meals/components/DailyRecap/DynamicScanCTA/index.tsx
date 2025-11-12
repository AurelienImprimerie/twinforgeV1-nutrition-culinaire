import React from 'react';
import { useReducedMotion, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import GlassCard from '@/ui/cards/GlassCard';
import SpatialIcon from '@/ui/icons/SpatialIcon';
import { ICONS } from '@/ui/icons/registry';
import { useFeedback } from '@/hooks/useFeedback';
import { usePerformanceMode } from '@/system/context/PerformanceModeContext';
import GamingPointsBadge from '@/components/dashboard/GamingPointsBadge';
import { analyzeNutritionalContext } from './contextAnalysis';
import { generateDynamicMessage, generateContextualMetrics } from './messageGenerator';
import {
  calculateUrgencyConfig,
  generateUrgencyStyles,
  generateIconStyles,
  generateButtonStyles,
  shouldShowParticles,
  getParticleCount
} from './urgencyCalculator';

interface DynamicScanCTAProps {
  todayStats: {
    totalCalories: number;
    mealsCount: number;
    lastMealTime: Date | null;
    macros: { proteins: number; carbs: number; fats: number; fiber: number };
  };
  profile: any;
  calorieStatus: {
    status: string;
    message: string;
    color: string;
    priority: 'low' | 'medium' | 'high';
    recommendation: string;
  };
  calorieTargetAnalysis: {
    target: number;
    bmr: number;
    tdee: number;
    adjustedForObjective: number;
    objectiveType: 'maintenance' | 'deficit' | 'surplus';
  };
}

/**
 * Dynamic Scan CTA - CTA Intelligent et Contextuel
 * Composant dynamique qui s'adapte au contexte nutritionnel de l'utilisateur
 */
const DynamicScanCTA: React.FC<DynamicScanCTAProps> = ({
  todayStats,
  profile,
  calorieStatus,
  calorieTargetAnalysis,
}) => {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const { isPerformanceMode } = usePerformanceMode();
  const { click, success, successMajor } = useFeedback();

  // Conditional motion components
  const MotionDiv = isPerformanceMode ? 'div' : motion.div;

  // Analyser le contexte nutritionnel
  const context = React.useMemo(() => {
    return analyzeNutritionalContext(todayStats, profile, calorieStatus, calorieTargetAnalysis);
  }, [todayStats, profile, calorieStatus, calorieTargetAnalysis]);

  // Générer le message dynamique
  const message = React.useMemo(() => {
    return generateDynamicMessage(context);
  }, [context]);

  // Calculer la configuration d'urgence
  const urgencyConfig = React.useMemo(() => {
    return calculateUrgencyConfig(context);
  }, [context]);

  // Générer les métriques contextuelles
  const contextualMetrics = React.useMemo(() => {
    return generateContextualMetrics(context);
  }, [context]);

  // Gérer le clic avec audio feedback adapté
  const handleScanMeal = () => {
    // Audio feedback selon l'urgence
    if (urgencyConfig.audioFeedback === 'successMajor') {
      successMajor();
    } else if (urgencyConfig.audioFeedback === 'success') {
      success();
    } else {
      click();
    }
    
    navigate('/meals/scan');
  };

  // Styles dynamiques
  const cardStyles = generateUrgencyStyles(urgencyConfig);
  const iconStyles = generateIconStyles(urgencyConfig);
  const buttonStyles = generateButtonStyles(urgencyConfig);

  return (
    <div className="dynamic-scan-cta meal-capture-enter">
      <GlassCard
        className="p-6 md:p-8 pb-8 md:pb-10 text-center relative overflow-hidden cursor-pointer"
        onClick={handleScanMeal}
        interactive
        style={cardStyles}
      >
        {/* Carrés aux 4 coins - Toujours visibles, optimisés selon le mode performance */}
        <div className="training-hero-corners" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <MotionDiv
              key={i}
              className="corner-particle"
              style={{
                position: 'absolute',
                width: '12px',
                height: '12px',
                borderRadius: '2px',
                background: isPerformanceMode
                  ? 'linear-gradient(135deg, #10B981, rgba(16, 185, 129, 0.8))'
                  : `linear-gradient(135deg, ${urgencyConfig.color}, rgba(255, 255, 255, 0.8))`,
                boxShadow: isPerformanceMode
                  ? '0 0 20px #10B981'
                  : `0 0 20px ${urgencyConfig.color}`,
                top: i < 2 ? '12px' : 'auto',
                bottom: i >= 2 ? '12px' : 'auto',
                left: i % 2 === 0 ? '12px' : 'auto',
                right: i % 2 === 1 ? '12px' : 'auto',
                willChange: isPerformanceMode ? 'auto' : 'transform, opacity'
              }}
              {...(!isPerformanceMode && {
                initial: {
                  rotate: i % 2 === 0 ? 45 : -45
                },
                animate: {
                  scale: [1, 1.3, 1],
                  opacity: [0.6, 1, 0.6],
                  rotate: i % 2 === 0 ? [45, 60, 45] : [-45, -60, -45]
                },
                transition: {
                  duration: 3,
                  repeat: Infinity,
                  delay: i * 0.2,
                  ease: [0.4, 0, 0.2, 1]
                }
              })}
            />
          ))}
        </div>

        {/* Halo de Forge Dynamique - Animation Pulse Permanente */}
        {!isPerformanceMode && !reduceMotion && (
          <div
            className="absolute inset-0 rounded-inherit pointer-events-none urgent-forge-glow-css"
            style={{
              background: `radial-gradient(circle at center, color-mix(in srgb, ${urgencyConfig.color} 8%, transparent) 0%, transparent 70%)`,
              filter: 'blur(20px)',
              transform: 'scale(1.2)',
              zIndex: -1
            }}
          />
        )}

        <div className="relative z-10 space-y-4 md:space-y-6">
          {/* Icône Principale Dynamique avec Particules Jaillissantes */}
          <div className="relative flex flex-col items-center gap-3">
            <div
              className={`w-20 h-20 md:w-24 md:h-24 mx-auto rounded-full flex items-center justify-center relative ${
                !isPerformanceMode && !reduceMotion ? 'icon-breathing-css' : ''
              }`}
              style={iconStyles}
            >
              <SpatialIcon
                Icon={ICONS[urgencyConfig.icon as keyof typeof ICONS]}
                size={40}
                style={{ color: urgencyConfig.color }}
              />

              {/* Particules de Forge Jaillissantes - Style Forge Énergétique */}
              {!isPerformanceMode && !reduceMotion &&
                [...Array(6)].map((_, i) => {
                  const angle = (i * 360) / 6;
                  const radius = 60;
                  const x = Math.cos((angle * Math.PI) / 180) * radius;
                  const y = Math.sin((angle * Math.PI) / 180) * radius;

                  return (
                    <div
                      key={i}
                      className={`absolute w-2 h-2 rounded-full dynamic-particle-css dynamic-particle-css--${i + 1}`}
                      style={{
                        background: urgencyConfig.color,
                        boxShadow: `0 0 12px color-mix(in srgb, ${urgencyConfig.color} 70%, transparent)`,
                        '--particle-x': `${x * 0.4}px`,
                        '--particle-y': `${y * 0.4}px`,
                        '--particle-x-end': `${x}px`,
                        '--particle-y-end': `${y}px`
                      } as React.CSSProperties}
                    />
                  );
                })
              }
            </div>

            {/* Gaming Badge - Sous l'icône */}
            <GamingPointsBadge
              points={25}
              forgeName="Forge Nutritionnelle"
              size="small"
              animated={!isPerformanceMode}
            />
          </div>

          {/* Contenu Textuel Dynamique */}
          <div className="space-y-2 md:space-y-3">
            <h2 className="text-2xl md:text-3xl font-bold text-white">
              {message.title}
            </h2>
            <p className="text-white/80 text-base md:text-lg leading-relaxed max-w-md mx-auto">
              {message.subtitle}
            </p>

            {/* Encouragement contextuel */}
            {message.encouragement && (
              <p className="text-white/60 text-sm italic">
                {message.encouragement}
              </p>
            )}
          </div>

          {/* Bouton Principal Dynamique - Placé avant les métriques */}
          <div className="flex justify-center">
            <button
              onClick={handleScanMeal}
              className={`px-6 md:px-8 py-3 md:py-4 text-lg md:text-xl font-bold relative overflow-hidden rounded-full ${
                urgencyConfig.animation === 'pulse' && !isPerformanceMode && !reduceMotion ? 'btn-breathing-css' : ''
              }`}
              style={buttonStyles}
            >
              <div className="flex items-center justify-center gap-3">
                <SpatialIcon
                  Icon={ICONS[urgencyConfig.icon as keyof typeof ICONS]}
                  size={24}
                  className="text-white"
                />
                <span>{message.buttonText}</span>
              </div>

              {/* Shimmer Effect pour urgence normale */}
              {urgencyConfig.priority === 'medium' && !isPerformanceMode && !reduceMotion && (
                <div
                  className="absolute inset-0 rounded-inherit pointer-events-none dynamic-shimmer-css"
                  style={{
                    background: `linear-gradient(90deg,
                      transparent 0%,
                      rgba(255,255,255,0.3) 50%,
                      transparent 100%
                    )`
                  }}
                />
              )}
            </button>
          </div>

          {/* Métriques Contextuelles - Placées après le bouton */}
          {contextualMetrics.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
              {contextualMetrics.map((metric, index) => (
                <div
                  key={index}
                  className="px-3 py-1.5 rounded-full metric-badge-enter"
                  style={{
                    background: `color-mix(in srgb, ${urgencyConfig.color} 15%, transparent)`,
                    border: `1px solid color-mix(in srgb, ${urgencyConfig.color} 25%, transparent)`,
                    color: urgencyConfig.color,
                    ...(isPerformanceMode ? {} : { backdropFilter: 'blur(8px) saturate(120%)' }),
                    animationDelay: `${index * 0.1}s`
                  }}
                >
                  <span className="font-medium">{metric}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </GlassCard>
    </div>
  );
};

export default DynamicScanCTA;