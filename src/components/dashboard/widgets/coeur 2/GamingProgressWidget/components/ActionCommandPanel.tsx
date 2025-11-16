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
  {
    id: 'body-scan-3d',
    label: 'Scanner Corporel 3D',
    icon: 'Scan',
    xp: 0,
    route: '/body-scan',
    description: 'Twin numérique : Analyse morphologique complète et projections corporelles',
    color: '#F59E0B',
    glowColor: '#FBBF24',
    isPrimary: false,
    badges: [
      { label: '1 fois par semaine', type: 'count' }
    ]
  },
];

export default function ActionCommandPanel() {
  const navigate = useNavigate();
  const { profile } = useUserStore();
  const { performanceMode } = usePerformanceMode();
  const { data: completedActions = [] } = useTodaysCompletedActions();

  const isActionCompleted = (actionId: string) => {
    return completedActions.some(action => action.action_id === actionId && action.is_first_of_day);
  };

  const getOccurrenceCount = (actionId: string) => {
    return completedActions.filter(action => action.action_id === actionId).length;
  };

  const handleAction = (action: ActionButton) => {
    // Navigation only - tracking will happen after actual completion
    navigate(action.route);
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
    <div id="gaming-actions-widget" className="space-y-5">
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

      {/* Daily Actions - Priority */}
      <div className="grid grid-cols-1 gap-3">
        {filteredDailyActions.map((action, index) => {
          const isCompleted = isActionCompleted(action.id);

          return (
            <motion.button
              key={action.id}
              onClick={() => handleAction(action)}
              className="w-full glass-card p-4 rounded-xl relative overflow-hidden group text-left"
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
                `
              }}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
            >
              {performanceMode === 'premium' && (
                <motion.div
                  className="absolute inset-0"
                  style={{
                    background: `linear-gradient(90deg, ${action.color}05, ${action.color}12, ${action.color}05)`
                  }}
                  animate={{ x: ['-100%', '100%'] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                />
              )}

              <div className="relative flex items-center gap-4">
                <div className="relative flex-shrink-0">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
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
                          className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5 rounded-full flex items-center justify-center border-2 border-white/20"
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
                      className="flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-bold"
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
            Actions pour forger votre corps et progresser
          </span>
        </div>
      </div>

      {/* Secondary Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {SECONDARY_ACTIONS.map((action, index) => (
          <motion.button
            key={action.id}
            onClick={() => handleAction(action)}
            className="glass-card p-4 rounded-xl relative overflow-hidden group text-left"
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
              `
            }}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: 0.15 + index * 0.05 }}
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="relative space-y-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
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
