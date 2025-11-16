import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import SpatialIcon from '../icons/SpatialIcon';
import { ICONS } from '../icons/registry';
import { usePointsNotificationStore } from '../../system/store/pointsNotificationStore';
import { useFeedback } from '../../hooks';
import { success as successSound } from '../../audio/effects/statusSounds';
import { notif as notifSound } from '../../audio/effects/interactionSounds';
import { Haptics } from '../../utils/haptics';
import logger from '../../lib/utils/logger';

const PointsGainNotification: React.FC = () => {
  const { currentNotification, dismissCurrentNotification } = usePointsNotificationStore();
  const { success } = useFeedback();

  useEffect(() => {
    if (currentNotification) {
      logger.info('POINTS_NOTIFICATION', 'Displaying notification', {
        notificationId: currentNotification.id,
        actionLabel: currentNotification.actionLabel,
        pointsAwarded: currentNotification.pointsAwarded,
        type: currentNotification.type,
      });

      try {
        if (currentNotification.type === 'level-up' || currentNotification.type === 'milestone') {
          successSound();
          Haptics.success();
        } else {
          notifSound();
          Haptics.light();
        }
      } catch (error) {
        logger.warn('POINTS_NOTIFICATION', 'Failed to play feedback', {
          error: error instanceof Error ? error.message : 'Unknown error',
          notificationId: currentNotification.id,
        });
      }
    }
  }, [currentNotification]);

  if (!currentNotification) return null;

  const isMajor = currentNotification.type === 'level-up' || currentNotification.type === 'milestone';
  const Icon = ICONS[currentNotification.icon as keyof typeof ICONS] || ICONS.Star;

  const getBackgroundGradient = () => {
    const baseColor = currentNotification.color;
    return `linear-gradient(135deg,
      color-mix(in srgb, ${baseColor} 30%, rgba(11, 14, 23, 0.95)) 0%,
      color-mix(in srgb, ${baseColor} 15%, rgba(11, 14, 23, 0.95)) 100%
    )`;
  };

  const getBorderColor = () => {
    return `color-mix(in srgb, ${currentNotification.color} 50%, transparent)`;
  };

  const getGlowColor = () => {
    return `color-mix(in srgb, ${currentNotification.color} 40%, transparent)`;
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={currentNotification.id}
        initial={{ opacity: 0, y: 100, scale: 0.8 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 50, scale: 0.9 }}
        transition={{
          type: 'spring',
          stiffness: isMajor ? 200 : 300,
          damping: isMajor ? 18 : 25,
          mass: isMajor ? 1.2 : 1,
        }}
        className={`points-gain-notification ${isMajor ? 'points-gain-notification--major' : ''}`}
        style={{
          background: getBackgroundGradient(),
          borderColor: getBorderColor(),
          boxShadow: `
            0 8px 32px rgba(0, 0, 0, 0.4),
            0 0 24px ${getGlowColor()},
            inset 0 1px 0 rgba(255, 255, 255, 0.1)
          `,
        }}
      >
        <div className="points-gain-notification__content">
          <motion.div
            className="points-gain-notification__icon-container"
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{
              type: 'spring',
              stiffness: 260,
              damping: 20,
              delay: 0.1,
            }}
            style={{
              background: `radial-gradient(circle at 30% 30%,
                color-mix(in srgb, ${currentNotification.color} 40%, transparent) 0%,
                color-mix(in srgb, ${currentNotification.color} 20%, transparent) 100%
              )`,
              borderColor: getBorderColor(),
            }}
          >
            <SpatialIcon
              Icon={Icon}
              size={isMajor ? 32 : 24}
              style={{ color: currentNotification.color }}
            />
          </motion.div>

          <div className="points-gain-notification__text">
            <motion.div
              className="points-gain-notification__points"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{
                type: 'spring',
                stiffness: 300,
                damping: 20,
                delay: 0.15,
              }}
            >
              <span className="points-gain-notification__plus">+</span>
              <span className="points-gain-notification__amount">
                {currentNotification.pointsAwarded}
              </span>
              <span className="points-gain-notification__label">XP</span>
            </motion.div>

            <motion.p
              className="points-gain-notification__description"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.3 }}
            >
              {currentNotification.actionLabel}
            </motion.p>

            {isMajor && currentNotification.metadata && (
              <motion.div
                className="points-gain-notification__milestone"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25, duration: 0.3 }}
              >
                {currentNotification.type === 'level-up' && (
                  <div className="flex items-center gap-2">
                    <SpatialIcon Icon={ICONS.TrendingUp} size={16} className="text-emerald-400" />
                    <span className="text-emerald-400 font-semibold">
                      Niveau {currentNotification.metadata.newLevel} !
                    </span>
                  </div>
                )}
                {currentNotification.type === 'milestone' && currentNotification.metadata.milestoneName && (
                  <div className="flex items-center gap-2">
                    <SpatialIcon Icon={ICONS.Award} size={16} className="text-amber-400" />
                    <span className="text-amber-400 font-semibold">
                      {currentNotification.metadata.milestoneName}
                    </span>
                  </div>
                )}
              </motion.div>
            )}
          </div>

          <button
            onClick={dismissCurrentNotification}
            className="points-gain-notification__dismiss"
            aria-label="Fermer la notification"
          >
            <SpatialIcon Icon={ICONS.X} size={14} className="text-white/60 hover:text-white" />
          </button>
        </div>

        {!isMajor && (
          <motion.div
            className="points-gain-notification__progress-bar"
            initial={{ scaleX: 1 }}
            animate={{ scaleX: 0 }}
            transition={{ duration: (currentNotification.duration || 3500) / 1000, ease: 'linear' }}
            style={{
              background: `linear-gradient(90deg,
                ${currentNotification.color} 0%,
                color-mix(in srgb, ${currentNotification.color} 70%, transparent) 100%
              )`,
            }}
          />
        )}

        {isMajor && (
          <motion.div
            className="points-gain-notification__glow-pulse"
            animate={{
              opacity: [0.3, 0.6, 0.3],
              scale: [1, 1.1, 1],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            style={{
              background: `radial-gradient(circle, ${getGlowColor()} 0%, transparent 70%)`,
            }}
          />
        )}
      </motion.div>
    </AnimatePresence>
  );
};

export default PointsGainNotification;
