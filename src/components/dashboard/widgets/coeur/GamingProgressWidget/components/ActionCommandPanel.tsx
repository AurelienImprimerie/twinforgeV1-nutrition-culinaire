/**
 * ActionCommandPanel - Panneau de Commandes d'Actions Gaming
 *
 * Affiche les boutons d'actions principaux pour le suivi quotidien et les forges
 * Hiérarchie:
 * 1. Actions Quotidiennes (Priorité Haute): Scanner repas, Logger activité, Logger jeûne
 * 2. Actions Secondaires: Forge Culinaire, Training Live, Scanner Corporel 3D
 */

import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import SpatialIcon from '@/ui/icons/SpatialIcon';
import { usePerformanceMode } from '@/system/context/PerformanceModeContext';
import { useUserStore } from '@/system/store/userStore';
import { useTodaysCompletedActions } from '@/hooks/coeur/useDailyActionsTracking';
import { useWeeklyActions } from '@/hooks/coeur/useWeeklyActions';
import '@/styles/components/dashboard/gaming-cta-effects.css';

interface ActionButton {
  id: string;
  label: string;
  icon: string;
  xp: number;
  route: string;
  description: string;
  color: string;
  glowColor: string;
  isPrimary: boolean;
  isDaily?: boolean;
  badges?: Array<{ label: string; type: 'xp' | 'count' }>;
}

const DAILY_ACTIONS: ActionButton[] = [
  {
    id: 'meal-scan',
    label: 'Scanner un Repas',
    icon: 'UtensilsCrossed',
    xp: 25,
    route: '/meals/scan',
    description: 'Track tes calories automatiquement',
    color: '#F59E0B',
    glowColor: '#FBBF24',
    isPrimary: true,
    isDaily: true
  },
  {
    id: 'activity-log',
    label: 'Logger une Activité',
    icon: 'Activity',
    xp: 20,
    route: '/activity/input',
    description: 'Mesure ton déficit calorique',
    color: '#F97316',
    glowColor: '#FB923C',
    isPrimary: true,
    isDaily: true
  },
  {
    id: 'fasting-log',
    label: 'Logger un Jeûne',
    icon: 'Timer',
    xp: 0,
    route: '/fasting/input',
    description: '25-50 pts',
    color: '#F7931E',
    glowColor: '#FBBF24',
    isPrimary: true,
    isDaily: true
  },
];

const SECONDARY_ACTIONS: ActionButton[] = [
  {
    id: 'culinary-forge',
    label: 'Forge Culinaire',
    icon: 'ChefHat',
    xp: 0,
    route: '/fridge',
    description: 'Scanner de Frigo, Recettes, Plans alimentaires & Listes de Courses',
    color: '#FBBF24',
    glowColor: '#FCD34D',
    isPrimary: false,
    badges: [
      { label: '15-50 pts', type: 'xp' },
      { label: '4 actions', type: 'count' }
    ]
  },
  {
    id: 'training-live',
    label: 'Training Live',
    icon: 'Dumbbell',
    xp: 0,
    route: '/training',
    description: '5 coaches IA spécialisés: Force, Endurance, Functional, Calisthenics, Competitions',
    color: '#F97316',
    glowColor: '#FB923C',
    isPrimary: false,
    badges: [
      { label: '+60 pts', type: 'xp' }
    ]
  },
];

const ACTION_TOUR_TARGETS: Record<string, string> = {
  'culinary-forge': 'culinary-forge',
  'training-live': 'training-forge'
};

export default function ActionCommandPanel() {
  const navigate = useNavigate();
  const { profile } = useUserStore();
  const { performanceMode } = usePerformanceMode();
  const { data: completedActions = [] } = useTodaysCompletedActions();
  const { availability, isLoading: weeklyActionsLoading } = useWeeklyActions();

  const isActionCompleted = (actionId: string) => {
    return completedActions.some(action => action.action_id === actionId && action.is_first_of_day);
  };

  const getOccurrenceCount = (actionId: string) => {
    return completedActions.filter(action => action.action_id === actionId).length;
  };

  const handleAction = (action: ActionButton, event: React.MouseEvent<HTMLButtonElement>) => {
    // Create ripple effect at click position
    if (performanceMode !== 'low') {
      createRipple(event);
    }

    // Navigation only - tracking will happen after actual completion
    navigate(action.route);
  };

  const createRipple = (event: React.MouseEvent<HTMLButtonElement>) => {
    const button = event.currentTarget;
    const rect = button.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;

    const ripple = document.createElement('span');
    ripple.className = 'gaming-cta-ripple';
    ripple.style.width = ripple.style.height = `${size}px`;
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;

    button.appendChild(ripple);

    setTimeout(() => {
      ripple.remove();
    }, 600);
  };

  const handleWeightUpdateClick = () => {
    // Smooth scroll to weight update section
    const weightSection = document.getElementById('weight-update-section');
    if (weightSection) {
      // Add slight delay to ensure DOM is ready
      setTimeout(() => {
        weightSection.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });

        // Add temporary highlight effect
        weightSection.style.transition = 'box-shadow 0.3s ease';
        weightSection.style.boxShadow = '0 0 0 3px rgba(247, 147, 30, 0.5), 0 0 20px rgba(247, 147, 30, 0.3)';

        setTimeout(() => {
          weightSection.style.boxShadow = '';
        }, 2000);
      }, 100);
    }
  };

  // Filter fasting for non-fat_loss objectives
  const filteredDailyActions = DAILY_ACTIONS.filter(action => {
    if (action.id === 'fasting-log' && profile?.objective !== 'fat_loss') {
      return false;
    }
    return true;
  });

  const completedDailyCount = filteredDailyActions.filter(action => isActionCompleted(action.id)).length;
  const totalDailyCount = filteredDailyActions.length;

  // Total actions completed today (all actions)
  const totalActionsToday = completedActions.length;

  return (
    <div
      id="gaming-actions-widget"
      data-tour-target="gaming-actions"
      data-performance-mode={performanceMode}
      className="space-y-5"
    >
      {/* Divider - Daily Actions Priority */}
      <div className="relative py-2">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-white/10" />
        </div>
        <div className="relative flex justify-between items-center px-3 bg-gradient-to-r from-transparent via-black/20 to-transparent">
          <span className="text-xs text-white/40">Actions Prioritaires du Jour</span>
          <div className="flex items-center gap-1.5">
            <SpatialIcon name="Trophy" size={14} color="#F7931E" />
            <span className="text-xs font-bold text-orange-400">{totalActionsToday}</span>
          </div>
        </div>
      </div>

      {/* Weekly Actions - Body Scan & Weight Update */}
      {(availability?.bodyScanAvailable || availability?.weightUpdateAvailable) && (
        <div className="grid grid-cols-1 gap-3 mb-3">
          {/* Body Scan Button - Always visible when available */}
          {availability?.bodyScanAvailable && (
            <motion.button
              onClick={(e) => {
                if (performanceMode !== 'low') createRipple(e);
                navigate('/body-scan');
              }}
              className="gaming-cta-button gaming-cta-weekly-available w-full glass-card p-4 rounded-xl relative overflow-hidden group text-left"
              style={{
                background: `
                  linear-gradient(135deg, #F7931E20 0%, #F7931E10 50%, rgba(0, 0, 0, 0.3) 100%),
                  radial-gradient(circle at 30% 30%, #F7931E15 0%, transparent 50%),
                  rgba(255, 255, 255, 0.03)
                `,
                backdropFilter: 'blur(20px) saturate(150%)',
                WebkitBackdropFilter: 'blur(20px) saturate(150%)',
                border: '1px solid #F7931E40',
                boxShadow: `
                  0 4px 16px #F7931E30,
                  0 2px 8px rgba(0, 0, 0, 0.4),
                  inset 0 1px 0 rgba(255, 255, 255, 0.2),
                  inset 0 -1px 0 rgba(0, 0, 0, 0.3)
                `,
                '--action-color': '#F7931E',
                '--action-color-alpha-70': 'rgba(247, 147, 30, 0.7)',
                '--action-color-alpha-60': 'rgba(247, 147, 30, 0.6)',
                '--action-color-alpha-40': 'rgba(247, 147, 30, 0.4)',
                '--action-color-alpha-30': 'rgba(247, 147, 30, 0.3)',
                '--action-color-alpha-20': 'rgba(247, 147, 30, 0.2)',
                '--action-color-alpha-10': 'rgba(247, 147, 30, 0.1)',
                '--action-color-alpha-0': 'rgba(247, 147, 30, 0)',
              } as React.CSSProperties}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="gaming-cta-shimmer" />
              <div className="gaming-cta-hover-glow" />

              <div className="relative flex items-center gap-4">
                <div className="relative flex-shrink-0">
                  <div
                    className="gaming-cta-icon w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{
                      background: 'linear-gradient(135deg, #F7931E30, #F7931E20)',
                      border: '1px solid #F7931E40',
                      boxShadow: '0 0 12px #F7931E30'
                    }}
                  >
                    <SpatialIcon
                      name="Scan"
                      size={24}
                      color="#F7931E"
                      glowColor="#FBBF24"
                      variant="pure"
                    />
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h4 className="font-bold text-white text-sm">Scanner Corporel</h4>
                    <div
                      className="gaming-cta-badge flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-bold"
                      style={{
                        background: '#F7931E20',
                        color: '#F7931E',
                        border: '1px solid #F7931E30'
                      }}
                    >
                      +25 pts
                    </div>
                  </div>
                  <p className="text-xs text-white/70">Scanner ton corps en 3D</p>
                </div>
              </div>
            </motion.button>
          )}

          {/* Weight Update Button - Only visible when available and not empty state */}
          {availability?.weightUpdateAvailable && profile?.weight_kg && (
            <motion.button
              onClick={(e) => {
                if (performanceMode !== 'low') createRipple(e);
                handleWeightUpdateClick();
              }}
              className="gaming-cta-button gaming-cta-weekly-available w-full glass-card p-4 rounded-xl relative overflow-hidden group text-left"
              style={{
                background: `
                  linear-gradient(135deg, #F7931E20 0%, #F7931E10 50%, rgba(0, 0, 0, 0.3) 100%),
                  radial-gradient(circle at 30% 30%, #F7931E15 0%, transparent 50%),
                  rgba(255, 255, 255, 0.03)
                `,
                backdropFilter: 'blur(20px) saturate(150%)',
                WebkitBackdropFilter: 'blur(20px) saturate(150%)',
                border: '1px solid #F7931E40',
                boxShadow: `
                  0 4px 16px #F7931E30,
                  0 2px 8px rgba(0, 0, 0, 0.4),
                  inset 0 1px 0 rgba(255, 255, 255, 0.2),
                  inset 0 -1px 0 rgba(0, 0, 0, 0.3)
                `,
                '--action-color': '#F7931E',
                '--action-color-alpha-70': 'rgba(247, 147, 30, 0.7)',
                '--action-color-alpha-60': 'rgba(247, 147, 30, 0.6)',
                '--action-color-alpha-40': 'rgba(247, 147, 30, 0.4)',
                '--action-color-alpha-30': 'rgba(247, 147, 30, 0.3)',
                '--action-color-alpha-20': 'rgba(247, 147, 30, 0.2)',
                '--action-color-alpha-10': 'rgba(247, 147, 30, 0.1)',
                '--action-color-alpha-0': 'rgba(247, 147, 30, 0)',
              } as React.CSSProperties}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: 0.05 }}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="gaming-cta-shimmer" />
              <div className="gaming-cta-hover-glow" />

              <div className="relative flex items-center gap-4">
                <div className="relative flex-shrink-0">
                  <div
                    className="gaming-cta-icon w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{
                      background: 'linear-gradient(135deg, #F7931E30, #F7931E20)',
                      border: '1px solid #F7931E40',
                      boxShadow: '0 0 12px #F7931E30'
                    }}
                  >
                    <SpatialIcon
                      name="Scale"
                      size={24}
                      color="#F7931E"
                      glowColor="#FBBF24"
                      variant="pure"
                    />
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h4 className="font-bold text-white text-sm">Mise à jour Poids</h4>
                    <div
                      className="gaming-cta-badge flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-bold"
                      style={{
                        background: '#F7931E20',
                        color: '#F7931E',
                        border: '1px solid #F7931E30'
                      }}
                    >
                      +15 pts
                    </div>
                  </div>
                  <p className="text-xs text-white/70">Mettre à jour ton poids hebdo</p>
                </div>
              </div>
            </motion.button>
          )}
        </div>
      )}

      {/* Daily Actions - Priority */}
      <div className="grid grid-cols-1 gap-3">
        {filteredDailyActions.map((action, index) => {
          const isCompleted = isActionCompleted(action.id);

          return (
            <motion.button
              key={action.id}
              onClick={(e) => handleAction(action, e)}
              className="gaming-cta-button gaming-cta-priority w-full glass-card p-4 rounded-xl relative overflow-hidden group text-left"
              style={{
                background: `
                  linear-gradient(135deg, ${action.color}20 0%, ${action.color}10 50%, rgba(0, 0, 0, 0.3) 100%),
                  radial-gradient(circle at 30% 30%, ${action.color}15 0%, transparent 50%),
                  rgba(255, 255, 255, 0.03)
                `,
                backdropFilter: 'blur(20px) saturate(150%)',
                WebkitBackdropFilter: 'blur(20px) saturate(150%)',
                border: `1px solid ${action.color}40`,
                boxShadow: `
                  0 4px 16px ${action.color}30,
                  0 2px 8px rgba(0, 0, 0, 0.4),
                  inset 0 1px 0 rgba(255, 255, 255, 0.2),
                  inset 0 -1px 0 rgba(0, 0, 0, 0.3)
                `,
                '--action-color': action.color,
                '--action-color-alpha-60': `${action.color}99`,
                '--action-color-alpha-50': `${action.color}80`,
                '--action-color-alpha-40': `${action.color}66`,
                '--action-color-alpha-30': `${action.color}4D`,
                '--action-color-alpha-25': `${action.color}40`,
                '--action-color-alpha-20': `${action.color}33`,
                '--action-color-alpha-15': `${action.color}26`,
                '--action-color-alpha-12': `${action.color}1F`,
                '--action-color-alpha-10': `${action.color}1A`,
                '--action-color-alpha-0': `${action.color}00`,
              } as React.CSSProperties}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="gaming-cta-shimmer" />
              <div className="gaming-cta-particles" />
              <div className="gaming-cta-hover-glow" />
              {performanceMode === 'premium' && (
                <>
                  <div className="gaming-cta-spark" style={{ top: '20%', left: '10%' }} />
                  <div className="gaming-cta-spark" style={{ top: '30%', right: '15%' }} />
                  <div className="gaming-cta-spark" style={{ bottom: '25%', left: '20%' }} />
                </>
              )}

              <div className="relative flex items-center gap-4">
                <div className="relative flex-shrink-0">
                  <div
                    className="gaming-cta-icon w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{
                      background: `linear-gradient(135deg, ${action.color}30, ${action.color}20)`,
                      border: `1px solid ${action.color}40`,
                      boxShadow: `0 0 12px ${action.color}30`
                    }}
                  >
                    <SpatialIcon
                      name={action.icon as any}
                      size={24}
                      color={action.color}
                      glowColor={action.glowColor}
                      variant="pure"
                    />
                  </div>
                  {(() => {
                    const occurrences = getOccurrenceCount(action.id);
                    if (occurrences > 0) {
                      return (
                        <motion.div
                          className="gaming-cta-occurrence absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5 rounded-full flex items-center justify-center border-2 border-white/20"
                          style={{
                            background: `linear-gradient(135deg, ${action.color}, ${action.glowColor})`
                          }}
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: 'spring', stiffness: 300 }}
                        >
                          <span className="text-xs font-bold text-white">{occurrences}x</span>
                        </motion.div>
                      );
                    }
                    return null;
                  })()}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h4 className="font-bold text-white text-sm">{action.label}</h4>
                    <div
                      className="gaming-cta-badge flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-bold"
                      style={{
                        background: `${action.color}20`,
                        color: action.color,
                        border: `1px solid ${action.color}30`
                      }}
                    >
                      {action.xp > 0 ? `+${action.xp} pts` : action.description}
                    </div>
                  </div>
                  <p className="text-xs text-white/70">{action.xp > 0 ? action.description : 'Maximise ton métabolisme'}</p>
                  {(() => {
                    const occurrences = getOccurrenceCount(action.id);
                    if (occurrences > 0) {
                      const messages = [
                        'Scanner ton prochain repas !',
                        'Continue ta série !',
                        'Excellent suivi aujourd\'hui !',
                        'Tu es sur une lancée !',
                        'Impressionnant !'
                      ];
                      const messageIndex = Math.min(occurrences - 1, messages.length - 1);
                      return (
                        <motion.div
                          className="mt-2 flex items-center gap-1.5"
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                        >
                          <SpatialIcon name="Sparkles" size={12} color={action.color} />
                          <span className="text-xs font-semibold" style={{ color: action.color }}>
                            {messages[messageIndex]}
                          </span>
                        </motion.div>
                      );
                    }
                    return null;
                  })()}
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Divider */}
      <div className="relative py-2">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-white/10" />
        </div>
        <div className="relative flex justify-center">
          <span className="px-3 text-xs text-white/40 bg-gradient-to-r from-transparent via-black/20 to-transparent">
            Forges de Progression
          </span>
        </div>
      </div>

      {/* Secondary Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {SECONDARY_ACTIONS.map((action, index) => (
          <motion.button
            key={action.id}
            data-tour-target={ACTION_TOUR_TARGETS[action.id]}
            onClick={(e) => handleAction(action, e)}
            className="gaming-cta-button gaming-cta-secondary glass-card p-4 rounded-xl relative overflow-hidden group text-left"
            style={{
              background: `
                linear-gradient(135deg, ${action.color}18 0%, ${action.color}08 50%, rgba(0, 0, 0, 0.25) 100%),
                radial-gradient(circle at 30% 30%, ${action.color}12 0%, transparent 50%),
                rgba(255, 255, 255, 0.03)
              `,
              backdropFilter: 'blur(20px) saturate(150%)',
              WebkitBackdropFilter: 'blur(20px) saturate(150%)',
              border: `1px solid ${action.color}35`,
              boxShadow: `
                0 3px 12px ${action.color}25,
                0 1px 6px rgba(0, 0, 0, 0.3),
                inset 0 1px 0 rgba(255, 255, 255, 0.15),
                inset 0 -1px 0 rgba(0, 0, 0, 0.2)
              `,
              '--action-color': action.color,
              '--action-color-alpha-30': `${action.color}4D`,
              '--action-color-alpha-25': `${action.color}40`,
              '--action-color-alpha-20': `${action.color}33`,
              '--action-color-alpha-15': `${action.color}26`,
              '--action-color-alpha-10': `${action.color}1A`,
            } as React.CSSProperties}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: 0.15 + index * 0.05 }}
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="gaming-cta-hover-glow" />
            <div className="relative space-y-3">
              <div
                className="gaming-cta-icon w-10 h-10 rounded-lg flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, ${action.color}25, ${action.color}15)`,
                  border: `1px solid ${action.color}30`
                }}
              >
                <SpatialIcon
                  name={action.icon as any}
                  size={20}
                  color={action.color}
                  glowColor={action.glowColor}
                  variant="pure"
                />
              </div>
              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <h4 className="font-bold text-white text-sm">{action.label}</h4>
                  {action.xp > 0 && (
                    <div
                      className="flex-shrink-0 px-1.5 py-0.5 rounded text-xs font-bold"
                      style={{
                        background: `${action.color}15`,
                        color: action.color
                      }}
                    >
                      +{action.xp} pts
                    </div>
                  )}
                </div>
                <p className="text-xs text-white/60 mb-2">{action.description}</p>
                {action.badges && action.badges.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    {action.badges.map((badge, idx) => (
                      <div
                        key={idx}
                        className="px-2 py-1 rounded-md text-xs font-semibold"
                        style={{
                          background: `${action.color}20`,
                          color: action.color,
                          border: `1px solid ${action.color}40`
                        }}
                      >
                        {badge.label}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
