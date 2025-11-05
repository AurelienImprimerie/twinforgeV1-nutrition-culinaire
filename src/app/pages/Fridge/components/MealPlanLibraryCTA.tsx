import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { usePerformanceMode } from '../../../../system/context/PerformanceModeContext';
import GlassCard from '../../../../ui/cards/GlassCard';
import SpatialIcon from '../../../../ui/icons/SpatialIcon';
import { ICONS } from '../../../../ui/icons/registry';
import { useFeedback } from '../../../../hooks/useFeedback';

const MealPlanLibraryCTA: React.FC = () => {
  const navigate = useNavigate();
  const { click } = useFeedback();
  const { isPerformanceMode } = usePerformanceMode();

  const MotionDiv = isPerformanceMode ? 'div' : motion.div;

  const handleGenerateClick = () => {
    click();
    navigate('/meal-plan-generation');
  };

  return (
    <GlassCard
      className="relative overflow-hidden p-10 text-center"
      style={{
        background: `
          radial-gradient(circle at 30% 20%, color-mix(in srgb, #8B5CF6 20%, transparent) 0%, transparent 60%),
          radial-gradient(circle at 70% 80%, color-mix(in srgb, #A855F7 18%, transparent) 0%, transparent 50%),
          radial-gradient(circle at 50% 50%, color-mix(in srgb, #7C3AED 15%, transparent) 0%, transparent 70%),
          linear-gradient(145deg, rgba(255,255,255,0.15), rgba(255,255,255,0.10)),
          rgba(11, 14, 23, 0.85)
        `,
        borderColor: 'color-mix(in srgb, #8B5CF6 45%, transparent)',
        boxShadow: `
          0 20px 60px rgba(0, 0, 0, 0.35),
          0 0 40px color-mix(in srgb, #8B5CF6 30%, transparent),
          0 0 80px color-mix(in srgb, #A855F7 25%, transparent),
          inset 0 2px 0 rgba(255, 255, 255, 0.2)
        `,
        backdropFilter: 'blur(32px) saturate(170%)',
        WebkitBackdropFilter: 'blur(32px) saturate(170%)'
      }}
    >
      {/* Carrés Animés aux 4 Coins */}
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
              background: 'linear-gradient(135deg, #8B5CF6, rgba(168, 85, 247, 0.8))',
              boxShadow: '0 0 20px #8B5CF6',
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
                scale: [1, 1.2, 1],
                opacity: [0.6, 0.9, 0.6],
                rotate: i % 2 === 0 ? [45, 55, 45] : [-45, -55, -45]
              },
              transition: {
                duration: 3.5,
                repeat: Infinity,
                delay: i * 0.25,
                ease: [0.45, 0.05, 0.55, 0.95]
              }
            })}
          />
        ))}
      </div>

      <div className="relative z-10 space-y-8">
        {/* Conteneur Icône Principale */}
        <div className="relative inline-block">
          <MotionDiv
            className="w-28 h-28 mx-auto rounded-full flex items-center justify-center relative"
            style={{
              background: `
                radial-gradient(circle at 30% 30%, rgba(255,255,255,0.25) 0%, transparent 60%),
                radial-gradient(circle at 70% 70%, color-mix(in srgb, #8B5CF6 20%, transparent) 0%, transparent 50%),
                linear-gradient(135deg, color-mix(in srgb, #8B5CF6 40%, transparent), color-mix(in srgb, #A855F7 35%, transparent))
              `,
              border: '3px solid color-mix(in srgb, #8B5CF6 50%, transparent)',
              boxShadow: `
                0 0 30px color-mix(in srgb, #8B5CF6 40%, transparent),
                inset 0 2px 0 rgba(255,255,255,0.3)
              `,
              willChange: isPerformanceMode ? 'auto' : 'transform'
            }}
            {...(!isPerformanceMode && {
              animate: {
                scale: [1, 1.04, 1]
              },
              transition: { duration: 3, repeat: Infinity, ease: [0.45, 0.05, 0.55, 0.95] }
            })}
          >
            <SpatialIcon
              Icon={ICONS.Calendar}
              size={56}
              color="rgba(255, 255, 255, 0.95)"
              variant="pure"
            />
          </MotionDiv>
        </div>

        {/* Titre et Description */}
        <MotionDiv
          {...(!isPerformanceMode && {
            initial: { opacity: 0, y: 10 },
            animate: { opacity: 1, y: 0 },
            transition: { duration: 0.5, delay: 0.2 }
          })}
        >
          <h2
            className="text-3xl font-bold text-white mb-4"
            style={{
              textShadow: '0 0 25px color-mix(in srgb, #8B5CF6 50%, transparent)'
            }}
          >
            Générer Nouveaux Plans Alimentaires
          </h2>
          <p className="text-white/85 text-lg leading-relaxed max-w-2xl mx-auto">
            Créez des plans alimentaires hebdomadaires personnalisés basés sur votre inventaire.
            La Forge Nutritionnelle optimise vos repas pour la semaine entière.
          </p>
        </MotionDiv>

        {/* Bouton Principal avec Shimmer */}
        <MotionDiv
          {...(!isPerformanceMode && {
            initial: { opacity: 0, scale: 0.95 },
            animate: { opacity: 1, scale: 1 },
            transition: { duration: 0.5, delay: 0.3 }
          })}
        >
          <button
            onClick={handleGenerateClick}
            className="relative overflow-hidden px-12 py-5 text-xl font-bold rounded-2xl transition-all duration-300 group"
            style={{
              background: `
                linear-gradient(135deg,
                  color-mix(in srgb, #8B5CF6 85%, transparent),
                  color-mix(in srgb, #A855F7 70%, transparent),
                  color-mix(in srgb, #7C3AED 60%, transparent)
                )
              `,
              border: '2px solid color-mix(in srgb, #8B5CF6 60%, transparent)',
              boxShadow: `
                0 20px 50px color-mix(in srgb, #8B5CF6 45%, transparent),
                inset 0 3px 0 rgba(255,255,255,0.5)
              `,
              color: 'white'
            }}
            onMouseEnter={(e) => {
              if (!isPerformanceMode && window.matchMedia('(hover: hover)').matches) {
                e.currentTarget.style.transform = 'translateY(-3px) scale(1.03)';
                e.currentTarget.style.boxShadow = `
                  0 24px 60px color-mix(in srgb, #8B5CF6 55%, transparent),
                  inset 0 3px 0 rgba(255,255,255,0.6)
                `;
              }
            }}
            onMouseLeave={(e) => {
              if (!isPerformanceMode && window.matchMedia('(hover: hover)').matches) {
                e.currentTarget.style.transform = 'translateY(0) scale(1)';
                e.currentTarget.style.boxShadow = `
                  0 20px 50px color-mix(in srgb, #8B5CF6 45%, transparent),
                  inset 0 3px 0 rgba(255,255,255,0.5)
                `;
              }
            }}
          >
            {/* Shimmer Effect */}
            {!isPerformanceMode && (
              <motion.div
                className="absolute inset-0 rounded-2xl pointer-events-none"
                style={{
                  background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.5) 50%, transparent 100%)'
                }}
                animate={{ x: ['-200%', '200%'] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
              />
            )}

            <div className="flex items-center gap-3 relative z-10">
              <SpatialIcon Icon={ICONS.Sparkles} size={24} color="white" variant="pure" />
              <span>Lancer la Génération</span>
            </div>
          </button>
        </MotionDiv>

        {/* Statistiques Visuelles */}
        <MotionDiv
          {...(!isPerformanceMode && {
            initial: { opacity: 0 },
            animate: { opacity: 1 },
            transition: { delay: 0.5 }
          })}
          className="flex flex-wrap items-center justify-center gap-6 pt-4"
        >
          {[
            { icon: ICONS.Calendar, label: 'Plans Hebdomadaires', color: '#8B5CF6' },
            { icon: ICONS.Clock, label: 'Gain de Temps', color: '#A855F7' },
            { icon: ICONS.Target, label: 'Optimisé Nutrition', color: '#7C3AED' }
          ].map((stat, index) => (
            <MotionDiv
              key={index}
              className="flex items-center gap-2.5 px-5 py-2.5 rounded-full"
              style={{
                background: `color-mix(in srgb, ${stat.color} 18%, transparent)`,
                border: `2px solid color-mix(in srgb, ${stat.color} 35%, transparent)`,
                backdropFilter: 'blur(18px) saturate(150%)'
              }}
              {...(!isPerformanceMode && {
                whileHover: { scale: 1.05 },
                transition: { duration: 0.2 }
              })}
            >
              <SpatialIcon Icon={stat.icon} size={18} style={{ color: stat.color }} />
              <span className="text-white/90 text-sm font-semibold">{stat.label}</span>
            </MotionDiv>
          ))}
        </MotionDiv>
      </div>
    </GlassCard>
  );
};

export default MealPlanLibraryCTA;
