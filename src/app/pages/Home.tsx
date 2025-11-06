// src/app/pages/Home.tsx
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import GlassCard from '../../ui/cards/GlassCard';
import SpatialIcon from '../../ui/icons/SpatialIcon';
import { ICONS } from '../../ui/icons/registry';
import { Link } from '../nav/Link';
import { useUserStore } from '../../system/store/userStore';
import PageHeader from '../../ui/page/PageHeader';
import { useToast } from '../../ui/components/ToastProvider';
import { useWelcomeTokensToast, useHideFastingForBulking } from '@/hooks';

const Home: React.FC = () => {
  const { profile } = useUserStore();
  const { showToast } = useToast();
  const hideFastingForBulking = useHideFastingForBulking();

  useWelcomeTokensToast();

  return (
    <div className="space-y-6 w-full max-w-none">
      <PageHeader
        icon="Home"
        title="Cœur de la Forge"
        subtitle="Votre hub central pour forger votre bien-être quotidien"
        circuit="home"
        iconColor="#F7931E"
      />
      
      {/* Carburant du Jour - Layout adaptatif selon objectif */}
      <motion.div
        className={hideFastingForBulking ? "grid grid-cols-1 lg:grid-cols-2 gap-6" : "grid grid-cols-1 lg:grid-cols-3 gap-6"}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <Link to="/profile" className="w-full">
          <GlassCard
            className="w-full text-center p-8 hover:scale-105 transition-transform"
            interactive
            style={{
              background: `
                radial-gradient(circle at 30% 20%, color-mix(in srgb, #60A5FA 12%, transparent) 0%, transparent 60%),
                radial-gradient(circle at 70% 80%, color-mix(in srgb, var(--brand-primary) 8%, transparent) 0%, transparent 50%),
                var(--glass-opacity)
              `,
              borderColor: 'color-mix(in srgb, #60A5FA 25%, transparent)',
              boxShadow: `
                0 12px 40px rgba(0, 0, 0, 0.25),
                0 0 30px color-mix(in srgb, #60A5FA 15%, transparent),
                inset 0 2px 0 rgba(255, 255, 255, 0.15)
              `,
              backdropFilter: 'blur(20px) saturate(150%)'
            }}
          >
            <div
              className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
              style={{
                background: `
                  radial-gradient(circle at 30% 30%, rgba(255,255,255,0.2) 0%, transparent 60%),
                  linear-gradient(135deg, color-mix(in srgb, #60A5FA 35%, transparent), color-mix(in srgb, #60A5FA 25%, transparent))
                `,
                border: '2px solid color-mix(in srgb, #60A5FA 50%, transparent)',
                boxShadow: '0 0 30px color-mix(in srgb, #60A5FA 40%, transparent)'
              }}
            >
              <SpatialIcon Icon={ICONS.User} size={24} style={{ color: '#60A5FA' }} variant="pure" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Profil</h3>
            <p className="text-white/70 text-sm">
              Gérer votre profil utilisateur
            </p>
          </GlassCard>
        </Link>

        {/* Section Activité - Toujours visible */}
        <Link to="/activity" className="w-full">
          <GlassCard
            className="w-full text-center p-8 hover:scale-105 transition-transform"
            interactive
            style={{
              background: `
                radial-gradient(circle at 30% 20%, color-mix(in srgb, #3B82F6 12%, transparent) 0%, transparent 60%),
                radial-gradient(circle at 70% 80%, color-mix(in srgb, #2563EB 8%, transparent) 0%, transparent 50%),
                var(--glass-opacity)
              `,
              borderColor: 'color-mix(in srgb, #3B82F6 25%, transparent)',
              boxShadow: `
                0 12px 40px rgba(0, 0, 0, 0.25),
                0 0 30px color-mix(in srgb, #3B82F6 15%, transparent),
                inset 0 2px 0 rgba(255, 255, 255, 0.15)
              `,
              backdropFilter: 'blur(20px) saturate(150%)'
            }}
          >
            <div
              className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
              style={{
                background: `
                  radial-gradient(circle at 30% 30%, rgba(255,255,255,0.2) 0%, transparent 60%),
                  linear-gradient(135deg, color-mix(in srgb, #3B82F6 35%, transparent), color-mix(in srgb, #3B82F6 25%, transparent))
                `,
                border: '2px solid color-mix(in srgb, #3B82F6 50%, transparent)',
                boxShadow: '0 0 30px color-mix(in srgb, #3B82F6 40%, transparent)'
              }}
            >
              <SpatialIcon Icon={ICONS.Activity} size={24} style={{ color: '#3B82F6' }} variant="pure" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Forge Énergétique</h3>
            <p className="text-white/70 text-sm">
              Suivez votre activité physique quotidienne
            </p>
          </GlassCard>
        </Link>

        {/* Section Santé - Toujours visible */}
        <Link to="/vital" className="w-full">
          <GlassCard
            className="w-full text-center p-8 hover:scale-105 transition-transform"
            interactive
            style={{
              background: `
                radial-gradient(circle at 30% 20%, color-mix(in srgb, #EF4444 12%, transparent) 0%, transparent 60%),
                radial-gradient(circle at 70% 80%, color-mix(in srgb, #DC2626 8%, transparent) 0%, transparent 50%),
                var(--glass-opacity)
              `,
              borderColor: 'color-mix(in srgb, #EF4444 25%, transparent)',
              boxShadow: `
                0 12px 40px rgba(0, 0, 0, 0.25),
                0 0 30px color-mix(in srgb, #EF4444 15%, transparent),
                inset 0 2px 0 rgba(255, 255, 255, 0.15)
              `,
              backdropFilter: 'blur(20px) saturate(150%)'
            }}
          >
            <div
              className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
              style={{
                background: `
                  radial-gradient(circle at 30% 30%, rgba(255,255,255,0.2) 0%, transparent 60%),
                  linear-gradient(135deg, color-mix(in srgb, #EF4444 35%, transparent), color-mix(in srgb, #EF4444 25%, transparent))
                `,
                border: '2px solid color-mix(in srgb, #EF4444 50%, transparent)',
                boxShadow: '0 0 30px color-mix(in srgb, #EF4444 40%, transparent)'
              }}
            >
              <SpatialIcon Icon={ICONS.HeartPulse} size={24} style={{ color: '#EF4444' }} variant="pure" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Forge Vitale</h3>
            <p className="text-white/70 text-sm">
              Médecine préventive et analyses de santé
            </p>
          </GlassCard>
        </Link>

        {/* Section Jeûne - Masqué en prise de masse */}
        {!hideFastingForBulking && (
          <>
            <Link to="/fasting" className="w-full">
              <GlassCard
                className="w-full text-center p-8 hover:scale-105 transition-transform"
                interactive
                style={{
                  background: `
                    radial-gradient(circle at 30% 20%, color-mix(in srgb, #F59E0B 12%, transparent) 0%, transparent 60%),
                    radial-gradient(circle at 70% 80%, color-mix(in srgb, #EF4444 8%, transparent) 0%, transparent 50%),
                    var(--glass-opacity)
                  `,
                  borderColor: 'color-mix(in srgb, #F59E0B 25%, transparent)',
                  boxShadow: `
                    0 12px 40px rgba(0, 0, 0, 0.25),
                    0 0 30px color-mix(in srgb, #F59E0B 15%, transparent),
                    inset 0 2px 0 rgba(255, 255, 255, 0.15)
                  `,
                  backdropFilter: 'blur(20px) saturate(150%)'
                }}
              >
                <div
                  className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
                  style={{
                    background: `
                      radial-gradient(circle at 30% 30%, rgba(255,255,255,0.2) 0%, transparent 60%),
                      linear-gradient(135deg, color-mix(in srgb, #F59E0B 35%, transparent), color-mix(in srgb, #F59E0B 25%, transparent))
                    `,
                    border: '2px solid color-mix(in srgb, #F59E0B 50%, transparent)',
                    boxShadow: '0 0 30px color-mix(in srgb, #F59E0B 40%, transparent)'
                  }}
                >
                  <SpatialIcon Icon={ICONS.Timer} size={24} style={{ color: '#F59E0B' }} variant="pure" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Forge du Temps</h3>
                <p className="text-white/70 text-sm">
                  Maîtrisez votre jeûne intermittent avec précision
                </p>
              </GlassCard>
            </Link>

            <Link to="/fasting/input" className="w-full">
              <GlassCard
                className="w-full text-center p-8 hover:scale-105 transition-transform"
                interactive
                style={{
                  background: `
                    radial-gradient(circle at 30% 20%, color-mix(in srgb, #10B981 12%, transparent) 0%, transparent 60%),
                    radial-gradient(circle at 70% 80%, color-mix(in srgb, #22C55E 8%, transparent) 0%, transparent 50%),
                    var(--glass-opacity)
                  `,
                  borderColor: 'color-mix(in srgb, #10B981 25%, transparent)',
                  boxShadow: `
                    0 12px 40px rgba(0, 0, 0, 0.25),
                    0 0 30px color-mix(in srgb, #10B981 15%, transparent),
                    inset 0 2px 0 rgba(255, 255, 255, 0.15)
                  `,
                  backdropFilter: 'blur(20px) saturate(150%)'
                }}
              >
                <div
                  className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
                  style={{
                    background: `
                      radial-gradient(circle at 30% 30%, rgba(255,255,255,0.2) 0%, transparent 60%),
                      linear-gradient(135deg, color-mix(in srgb, #10B981 35%, transparent), color-mix(in srgb, #10B981 25%, transparent))
                    `,
                    border: '2px solid color-mix(in srgb, #10B981 50%, transparent)',
                    boxShadow: '0 0 30px color-mix(in srgb, #10B981 40%, transparent)'
                  }}
                >
                  <SpatialIcon Icon={ICONS.Timer} size={24} style={{ color: '#10B981' }} variant="pure" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Tracker Suivi du Jeûne</h3>
                <p className="text-white/70 text-sm">
                  Démarrez et suivez vos sessions de jeûne
                </p>
              </GlassCard>
            </Link>
          </>
        )}
      </motion.div>

      {/* Deuxième ligne - Tracker Activité et Forge Vitale en prise de masse */}
      {hideFastingForBulking && (
        <motion.div
          className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
        >
          <Link to="/activity#daily" className="w-full">
            <GlassCard
              className="w-full text-center p-8 hover:scale-105 transition-transform"
              interactive
              style={{
                background: `
                  radial-gradient(circle at 30% 20%, color-mix(in srgb, #3B82F6 12%, transparent) 0%, transparent 60%),
                  radial-gradient(circle at 70% 80%, color-mix(in srgb, #2563EB 8%, transparent) 0%, transparent 50%),
                  var(--glass-opacity)
                `,
                borderColor: 'color-mix(in srgb, #3B82F6 25%, transparent)',
                boxShadow: `
                  0 12px 40px rgba(0, 0, 0, 0.25),
                  0 0 30px color-mix(in srgb, #3B82F6 15%, transparent),
                  inset 0 2px 0 rgba(255, 255, 255, 0.15)
                `,
                backdropFilter: 'blur(20px) saturate(150%)'
              }}
            >
              <div
                className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
                style={{
                  background: `
                    radial-gradient(circle at 30% 30%, rgba(255,255,255,0.2) 0%, transparent 60%),
                    linear-gradient(135deg, color-mix(in srgb, #3B82F6 35%, transparent), color-mix(in srgb, #3B82F6 25%, transparent))
                  `,
                  border: '2px solid color-mix(in srgb, #3B82F6 50%, transparent)',
                  boxShadow: '0 0 30px color-mix(in srgb, #3B82F6 40%, transparent)'
                }}
              >
                <SpatialIcon Icon={ICONS.Activity} size={24} style={{ color: '#3B82F6' }} variant="pure" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Tracker d'Activités</h3>
              <p className="text-white/70 text-sm">
                Enregistrez et suivez vos activités quotidiennes
              </p>
            </GlassCard>
          </Link>

          <Link to="/vital#dossier" className="w-full">
            <GlassCard
              className="w-full text-center p-8 hover:scale-105 transition-transform"
              interactive
              style={{
                background: `
                  radial-gradient(circle at 30% 20%, color-mix(in srgb, #EF4444 12%, transparent) 0%, transparent 60%),
                  radial-gradient(circle at 70% 80%, color-mix(in srgb, #DC2626 8%, transparent) 0%, transparent 50%),
                  var(--glass-opacity)
                `,
                borderColor: 'color-mix(in srgb, #EF4444 25%, transparent)',
                boxShadow: `
                  0 12px 40px rgba(0, 0, 0, 0.25),
                  0 0 30px color-mix(in srgb, #EF4444 15%, transparent),
                  inset 0 2px 0 rgba(255, 255, 255, 0.15)
                `,
                backdropFilter: 'blur(20px) saturate(150%)'
              }}
            >
              <div
                className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
                style={{
                  background: `
                    radial-gradient(circle at 30% 30%, rgba(255,255,255,0.2) 0%, transparent 60%),
                    linear-gradient(135deg, color-mix(in srgb, #EF4444 35%, transparent), color-mix(in srgb, #EF4444 25%, transparent))
                  `,
                  border: '2px solid color-mix(in srgb, #EF4444 50%, transparent)',
                  boxShadow: '0 0 30px color-mix(in srgb, #EF4444 40%, transparent)'
                }}
              >
                <SpatialIcon Icon={ICONS.HeartPulse} size={24} style={{ color: '#EF4444' }} variant="pure" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Dossier Médical</h3>
              <p className="text-white/70 text-sm">
                Accédez à votre dossier de santé complet
              </p>
            </GlassCard>
          </Link>
        </motion.div>
      )}

      {/* Outils de Forge */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <h2 className="text-white font-bold text-xl mb-4 flex items-center gap-3">
          <div 
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{
              background: `
                radial-gradient(circle at 30% 30%, rgba(255,255,255,0.15) 0%, transparent 60%),
                linear-gradient(135deg, color-mix(in srgb, #F59E0B 30%, transparent), color-mix(in srgb, #F59E0B 20%, transparent))
              `,
              border: '2px solid color-mix(in srgb, #F59E0B 40%, transparent)',
              boxShadow: '0 0 20px color-mix(in srgb, #F59E0B 30%, transparent)'
            }}
          >
            <SpatialIcon Icon={ICONS.Hammer} size={14} style={{ color: '#F59E0B' }} variant="pure" />
          </div>
          Outils de Forge
        </h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Link to="/fridge" className="w-full">
            <GlassCard 
              className="w-full text-center p-8 hover:scale-105 transition-transform" 
              interactive
              style={{
                background: `
                  radial-gradient(circle at 30% 20%, color-mix(in srgb, #EC4899 8%, transparent) 0%, transparent 60%),
                  radial-gradient(circle at 70% 80%, color-mix(in srgb, #06B6D4 6%, transparent) 0%, transparent 50%),
                  var(--glass-opacity)
                `,
                borderColor: 'color-mix(in srgb, #EC4899 20%, transparent)',
                boxShadow: `
                  0 8px 32px rgba(0, 0, 0, 0.2),
                  0 0 20px color-mix(in srgb, #EC4899 12%, transparent),
                  inset 0 1px 0 rgba(255, 255, 255, 0.12)
                `,
                backdropFilter: 'blur(16px) saturate(140%)',
                opacity: 0.8
              }}
            >
              <div 
                className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
                style={{
                  background: `
                    radial-gradient(circle at 30% 30%, rgba(255,255,255,0.2) 0%, transparent 60%),
                    linear-gradient(135deg, color-mix(in srgb, #EC4899 35%, transparent), color-mix(in srgb, #EC4899 25%, transparent))
                  `,
                  border: '2px solid color-mix(in srgb, #EC4899 50%, transparent)',
                  boxShadow: '0 0 30px color-mix(in srgb, #EC4899 40%, transparent)'
                }}
              >
                <SpatialIcon Icon={ICONS.Refrigerator} size={20} style={{ color: '#EC4899' }} variant="pure" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Atelier de Recettes</h3>
              <p className="text-white/70 text-sm">
                Vos recettes personnalisées
              </p>
            </GlassCard>
          </Link>
          
          <Link to="/fridge/scan" className="w-full">
            <GlassCard 
              className="w-full text-center p-8 hover:scale-105 transition-transform" 
              interactive
              style={{
                background: `
                  radial-gradient(circle at 30% 20%, color-mix(in srgb, #22C55E 8%, transparent) 0%, transparent 60%),
                  radial-gradient(circle at 70% 80%, color-mix(in srgb, #10B981 6%, transparent) 0%, transparent 50%),
                  var(--glass-opacity)
                `,
                borderColor: 'color-mix(in srgb, #22C55E 20%, transparent)',
                boxShadow: `
                  0 8px 32px rgba(0, 0, 0, 0.2),
                  0 0 20px color-mix(in srgb, #22C55E 12%, transparent),
                  inset 0 1px 0 rgba(255, 255, 255, 0.12)
                `,
                backdropFilter: 'blur(16px) saturate(140%)'
              }}
            >
              <div 
                className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
                style={{
                  background: `
                    radial-gradient(circle at 30% 30%, rgba(255,255,255,0.2) 0%, transparent 60%),
                    linear-gradient(135deg, color-mix(in srgb, #22C55E 35%, transparent), color-mix(in srgb, #22C55E 25%, transparent))
                  `,
                  border: '2px solid color-mix(in srgb, #22C55E 50%, transparent)',
                  boxShadow: '0 0 30px color-mix(in srgb, #22C55E 40%, transparent)'
                }}
              >
                <SpatialIcon Icon={ICONS.Camera} size={20} style={{ color: '#22C55E' }} variant="pure" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Scanner de Frigo</h3>
              <p className="text-white/70 text-sm">
                Générez des recettes depuis vos ingrédients
              </p>
            </GlassCard>
          </Link>
          
          <div className="w-full">
            <GlassCard 
              className="w-full text-center p-8 hover:scale-105 transition-transform" 
              interactive
              style={{
                background: `
                  radial-gradient(circle at 30% 20%, color-mix(in srgb, #A855F7 8%, transparent) 0%, transparent 60%),
                  radial-gradient(circle at 70% 80%, color-mix(in srgb, #9333EA 6%, transparent) 0%, transparent 50%),
                  var(--glass-opacity)
                `,
                borderColor: 'color-mix(in srgb, #A855F7 20%, transparent)',
                boxShadow: `
                  0 8px 32px rgba(0, 0, 0, 0.2),
                  0 0 20px color-mix(in srgb, #A855F7 12%, transparent),
                  inset 0 1px 0 rgba(255, 255, 255, 0.12)
                `,
                backdropFilter: 'blur(16px) saturate(140%)',
                opacity: 0.8
              }}
            >
              <div 
                className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
                style={{
                  background: `
                    radial-gradient(circle at 30% 30%, rgba(255,255,255,0.2) 0%, transparent 60%),
                    linear-gradient(135deg, color-mix(in srgb, #A855F7 35%, transparent), color-mix(in srgb, #A855F7 25%, transparent))
                  `,
                  border: '2px solid color-mix(in srgb, #A855F7 50%, transparent)',
                  boxShadow: '0 0 30px color-mix(in srgb, #A855F7 40%, transparent)'
                }}
              >
                <SpatialIcon Icon={ICONS.Target} size={20} style={{ color: '#A855F7' }} variant="pure" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Atelier de Training</h3>
              <p className="text-white/70 text-sm">
                Générateur de Training personnalisé
              </p>
            </GlassCard>
          </div>
        </div>
      </motion.div>
      
      {/* Statut de la Forge */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <div className="w-full">
          <GlassCard 
            className="w-full p-6"
            style={{
              background: `
                radial-gradient(circle at 30% 20%, color-mix(in srgb, var(--color-plasma-cyan) 8%, transparent) 0%, transparent 60%),
                radial-gradient(circle at 70% 80%, color-mix(in srgb, var(--brand-primary) 6%, transparent) 0%, transparent 50%),
                var(--glass-opacity)
              `,
              borderColor: 'color-mix(in srgb, var(--color-plasma-cyan) 20%, transparent)',
              boxShadow: `
                0 8px 32px rgba(0, 0, 0, 0.2),
                0 0 20px color-mix(in srgb, var(--color-plasma-cyan) 12%, transparent),
                inset 0 1px 0 rgba(255, 255, 255, 0.12)
              `,
              backdropFilter: 'blur(16px) saturate(140%)'
            }}
          >
            <div className="flex items-start gap-3">
              <div 
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1"
                style={{
                  background: `
                    radial-gradient(circle at 30% 30%, rgba(255,255,255,0.15) 0%, transparent 60%),
                    linear-gradient(135deg, color-mix(in srgb, var(--color-plasma-cyan) 30%, transparent), color-mix(in srgb, var(--color-plasma-cyan) 20%, transparent))
                  `,
                  border: '2px solid color-mix(in srgb, var(--color-plasma-cyan) 40%, transparent)',
                  boxShadow: '0 0 16px color-mix(in srgb, var(--color-plasma-cyan) 30%, transparent)'
                }}
              >
                <SpatialIcon Icon={ICONS.Info} size={12} style={{ color: 'var(--color-plasma-cyan)' }} variant="pure" />
              </div>
              <div>
                <h4 className="text-white font-semibold mb-2">Forge Spatiale TwinForge</h4>
                <p className="text-white/70 text-sm leading-relaxed">
                  Votre forge personnelle pour optimiser votre bien-être. Scannez vos repas, 
                  suivez votre activité, gérez votre jeûne et analysez votre corps avec TwinForge.
                  Forgez votre corps, raffinez votre esprit avec nos systèmes d'analyse avancés.
                </p>
              </div>
            </div>
          </GlassCard>
        </div>
      </motion.div>
    </div>
  );
};

export default Home;