/**
 * GamingProgressWidget V3 - Orchestrator
 *
 * Main orchestrator for gaming progress widget - coordinates all modules
 */

import { motion } from 'framer-motion';
import { usePerformanceMode } from '@/system/context/PerformanceModeContext';
import { useUserStore } from '@/system/store/userStore';
import GamificationSkeleton from '../GamificationSkeleton';
import EmptyGamificationState from '../../empty-states/EmptyGamificationState';
import WidgetHeader from '../../shared/WidgetHeader';
import WeightValidationModal from '../WeightValidationModal';
import SpatialIcon from '@/ui/icons/SpatialIcon';

import { useGamingData } from './hooks/useGamingData';
import { useWeightUpdate } from './hooks/useWeightUpdate';
import { calculateStreakMultiplier } from './utils/multipliers';
import { CONFIDENCE_COLORS } from './types';

import CelebrationEffect from './components/CelebrationEffect';
import LevelProgressBar from './components/LevelProgressBar';
import WeightUpdateSection from './components/WeightUpdateSection';
import ActionCommandPanel from './components/ActionCommandPanel';
import AbsenceCoachingMessages from '@/components/absence/AbsenceCoachingMessages';
import type { CoachMessage } from '@/services/dashboard/coeur/absence/AbsenceRecoveryCoachingService';

interface GamingProgressWidgetProps {
  onReconciliationSuccess?: (messages: CoachMessage[]) => void;
}

export default function GamingProgressWidget({ onReconciliationSuccess }: GamingProgressWidgetProps = {}) {
  const { performanceMode } = usePerformanceMode();
  const { profile } = useUserStore();

  const {
    gamification,
    gamificationLoading,
    prediction,
    bodyProjection,
    weightHistory,
    levelInfo,
    futureLevelTitles,
    levelProgress
  } = useGamingData();

  const {
    weight,
    showValidationModal,
    validationResult,
    showCelebration,
    coachMessages,
    hasActiveAbsence,
    pendingXp,
    isReconciling,
    handleIncrement,
    handleWeightChange,
    handleWeightSubmit,
    closeValidationModal,
    confirmWeightUpdate
  } = useWeightUpdate(weightHistory, onReconciliationSuccess);

  // Loading state
  if (gamificationLoading || !gamification) {
    return <GamificationSkeleton />;
  }

  // Empty state
  if (
    gamification.totalXpEarned === 0 ||
    (!prediction && gamification.totalXpEarned < 50) ||
    (prediction && prediction.confidence === 'low' && prediction.averageDailyXp === 0)
  ) {
    return <EmptyGamificationState />;
  }

  const streakMultiplier = calculateStreakMultiplier(gamification.currentStreakDays);
  const confidenceColor = prediction ? CONFIDENCE_COLORS[prediction.confidence] : CONFIDENCE_COLORS.low;

  return (
    <motion.div
      className="glass-card-premium p-6 sm:p-8 rounded-3xl space-y-6 relative overflow-hidden"
      style={{
        background: `
          radial-gradient(circle at 30% 30%, rgba(247, 147, 30, 0.3) 0%, transparent 50%),
          radial-gradient(circle at 70% 70%, rgba(251, 191, 36, 0.25) 0%, transparent 50%),
          rgba(247, 147, 30, 0.05)
        `,
        backdropFilter: 'blur(20px) saturate(150%)',
        WebkitBackdropFilter: 'blur(20px) saturate(150%)',
        border: '2px solid rgba(247, 147, 30, 0.4)',
        boxShadow: `inset 0 1px 0 rgba(255, 255, 255, 0.15)`
      }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Animated Background Glow */}
      {performanceMode === 'premium' && (
        <>
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-orange-500/10 via-yellow-500/10 to-orange-500/10"
            animate={{ x: ['-100%', '200%'] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
          />
          <motion.div
            className="absolute top-0 right-0 w-32 h-32 bg-orange-500/20 rounded-full blur-3xl"
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.5, 0.3]
            }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute bottom-0 left-0 w-40 h-40 bg-yellow-500/20 rounded-full blur-3xl"
            animate={{
              scale: [1.2, 1, 1.2],
              opacity: [0.5, 0.3, 0.5]
            }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
          />
        </>
      )}

      {/* Celebration Effect */}
      <CelebrationEffect show={showCelebration} performanceMode={performanceMode} />

      {/* Widget Header - Gaming Focus */}
      <div className="space-y-6">
        {/* Niveau Hero Section */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-3">
            <div
              className="w-2 h-2 rounded-full animate-pulse"
              style={{ backgroundColor: '#F7931E' }}
              title="Données en temps réel"
            />
            <span className="text-sm text-white/60 font-medium capitalize">
              {new Date().toLocaleDateString('fr-FR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long'
              })}
            </span>
          </div>

          {/* Niveau principal avec icône améliorée */}
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-3">
              <motion.div
                className="relative w-24 h-24 flex items-center justify-center"
                animate={
                  performanceMode !== 'low'
                    ? {
                        scale: [1, 1.05, 1],
                        rotate: [0, 5, 0, -5, 0],
                      }
                    : {}
                }
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              >
                {/* Cercles de fond animés */}
                {performanceMode !== 'low' && (
                  <>
                    <motion.div
                      className="absolute inset-0 rounded-full blur-xl"
                      style={{
                        background: 'radial-gradient(circle, rgba(247, 147, 30, 0.3), rgba(251, 191, 36, 0.2))',
                      }}
                      animate={{
                        scale: [1, 1.2, 1],
                        opacity: [0.3, 0.5, 0.3],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: 'easeInOut',
                      }}
                    />
                    <motion.div
                      className="absolute inset-0 rounded-full blur-2xl"
                      style={{
                        background: 'radial-gradient(circle, rgba(251, 191, 36, 0.2), transparent)',
                      }}
                      animate={{
                        scale: [1.2, 1, 1.2],
                        opacity: [0.5, 0.3, 0.5],
                      }}
                      transition={{
                        duration: 2.5,
                        repeat: Infinity,
                        ease: 'easeInOut',
                        delay: 0.5,
                      }}
                    />
                  </>
                )}

                {/* Icône principale */}
                <div
                  className="relative w-20 h-20 rounded-3xl flex items-center justify-center backdrop-blur-sm"
                  style={{
                    background: 'linear-gradient(135deg, rgba(247, 147, 30, 0.4), rgba(247, 147, 30, 0.2))',
                    border: '2px solid rgba(247, 147, 30, 0.5)',
                    boxShadow: '0 0 40px rgba(247, 147, 30, 0.4)',
                  }}
                >
                  <SpatialIcon name="Hammer" size={40} color="#F7931E" glowColor="#FBBF24" variant="pure" />
                </div>

                {/* Étoiles flottantes */}
                {performanceMode !== 'low' && (
                  <>
                    {[...Array(3)].map((_, i) => (
                      <motion.div
                        key={i}
                        className="absolute w-3 h-3"
                        style={{
                          left: `${20 + i * 30}%`,
                          top: `${10 + i * 20}%`,
                        }}
                        animate={{
                          y: [0, -20, 0],
                          opacity: [0, 1, 0],
                          scale: [0, 1, 0],
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          delay: i * 0.4,
                          ease: 'easeInOut',
                        }}
                      >
                        <SpatialIcon name="Sparkles" size={12} color="#FBBF24" />
                      </motion.div>
                    ))}
                  </>
                )}
              </motion.div>
            </div>
            <h2 className="text-4xl sm:text-5xl font-black text-white tracking-tight">
              {levelInfo.title}
            </h2>
            <div
              className="inline-block px-6 py-2 rounded-full"
              style={{
                background: 'linear-gradient(135deg, rgba(247, 147, 30, 0.3), rgba(251, 191, 36, 0.2))',
                border: '2px solid rgba(247, 147, 30, 0.4)'
              }}
            >
              <span className="text-2xl font-black text-orange-400">Niveau {gamification.currentLevel}</span>
            </div>
          </div>
        </div>

        {/* Gaming Stats - Points et Série */}
        <div className="grid grid-cols-2 gap-4">
          {/* Points Total */}
          <div
            className="glass-card rounded-2xl p-5 border-2 text-center"
            style={{
              background: 'linear-gradient(135deg, rgba(247, 147, 30, 0.15), rgba(251, 191, 36, 0.1))',
              borderColor: 'rgba(247, 147, 30, 0.4)',
              boxShadow: '0 8px 32px rgba(247, 147, 30, 0.2)'
            }}
          >
            <div className="flex items-center justify-center gap-2 mb-2">
              <SpatialIcon name="Zap" size={20} color="#F7931E" />
              <span className="text-sm text-white/70 font-semibold">Points</span>
            </div>
            <p className="text-4xl font-black text-white mb-1">
              {gamification.totalXpEarned.toLocaleString()}
            </p>
            <p className="text-xs text-orange-400 font-medium">Total accumulé</p>
          </div>

          {/* Streak */}
          {gamification.currentStreakDays > 0 && (
            <div
              className="glass-card rounded-2xl p-5 border-2 text-center"
              style={{
                background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.15), rgba(249, 115, 22, 0.1))',
                borderColor: 'rgba(249, 115, 22, 0.4)',
                boxShadow: '0 8px 32px rgba(249, 115, 22, 0.2)'
              }}
            >
              <div className="flex items-center justify-center gap-2 mb-2">
                <SpatialIcon name="Flame" size={20} color="#F97316" />
                <span className="text-sm text-white/70 font-semibold">Série</span>
              </div>
              <p className="text-4xl font-black text-white mb-1">
                {gamification.currentStreakDays}
              </p>
              <p className="text-xs text-orange-400 font-medium">
                jour{gamification.currentStreakDays > 1 ? 's' : ''} conscutifs
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Level Progress */}
      <LevelProgressBar
        levelProgress={levelProgress}
        xpToNextLevel={gamification.xpToNextLevel}
        performanceMode={performanceMode}
      />

      {/* Action Command Panel */}
      <ActionCommandPanel />

      {/* Weight Update Section */}
      <WeightUpdateSection
        weight={weight}
        currentWeight={profile?.weight_kg}
        hasActiveAbsence={hasActiveAbsence}
        pendingXp={pendingXp}
        isReconciling={isReconciling}
        onIncrement={handleIncrement}
        onWeightChange={handleWeightChange}
        onSubmit={handleWeightSubmit}
      />

      {/* Absence Coaching Messages - Displayed after reconciliation */}
      {coachMessages.length > 0 && (
        <div className="mt-4">
          <AbsenceCoachingMessages messages={coachMessages} />
        </div>
      )}

      {/* Weight Validation Modal */}
      {validationResult && (
        <WeightValidationModal
          isOpen={showValidationModal}
          onClose={closeValidationModal}
          onConfirm={confirmWeightUpdate}
          validation={validationResult}
          currentWeight={profile?.weight_kg || 70}
          newWeight={weight}
        />
      )}
    </motion.div>
  );
}
