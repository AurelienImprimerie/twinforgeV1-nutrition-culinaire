/**
 * GamingActionsWidget V2.0 - Actions Quotidiennes + Actions CTA avec indicateurs de points
 * Nouvelle architecture:
 * 1. Section Actions Quotidiennes (must-do daily)
 * 2. Actions de Progression
 * 3. Actions de Tracking
 */

import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import SpatialIcon from '@/ui/icons/SpatialIcon';
import { ConditionalMotion } from '@/lib/motion';
import { usePerformanceMode } from '@/system/context/PerformanceModeContext';
import { useTodaysCompletedActions } from '@/hooks/coeur/useDailyActionsTracking';
import { useUserStore } from '@/system/store/userStore';
import { GamingSounds } from '@/audio';

interface ActionButton {
  id: string;
  label: string;
  icon: string;
  xp: number;
  route: string;
  category: 'daily' | 'progression' | 'tracking';
  description: string;
  benefit1: string;
  benefit2: string;
  glowColor?: string;
}

const ACTIONS: ActionButton[] = [
  // Actions Quotidiennes (Must-Do Daily)
  {
    id: 'meal-scan',
    label: 'Scanner un Repas',
    icon: 'UtensilsCrossed',
    xp: 25,
    route: '/fridge',
    category: 'daily',
    description: '',
    benefit1: 'Track tes calories automatiquement pour rester dans ta cible.',
    benefit2: 'Analyse nutritionnelle avancée instantanée de ton assiette.',
    glowColor: '#F59E0B'
  },
  {
    id: 'activity-log',
    label: 'Logger une Activité',
    icon: 'Activity',
    xp: 20,
    route: '/activity/input',
    category: 'daily',
    description: '',
    benefit1: 'Mesure ton déficit calorique précisément chaque jour.',
    benefit2: 'Active le multiplicateur de série pour booster tes points.',
    glowColor: '#F97316'
  },
  {
    id: 'fasting-log',
    label: 'Logger un Jeûne',
    icon: 'Timer',
    xp: 0,
    route: '/fasting/input',
    category: 'daily',
    description: '25-50 pts selon durée',
    benefit1: 'Maximise ton métabolisme et ton déficit calorique.',
    benefit2: 'Gagne des bonus points pour chaque heure de jeûne complétée.',
    glowColor: '#F7931E'
  },

  // Actions de Progression (40-60 points)
  {
    id: 'training-live',
    label: 'Entraînement Live',
    icon: 'Dumbbell',
    xp: 60,
    route: '/training',
    category: 'progression',
    description: 'Points maximum',
    benefit1: '5 coaches IA spécialisés: Force, Endurance, Functional, Calisthenics, Competitions.',
    benefit2: 'Génération personnalisée en temps réel avec coach vocal et détection équipement.',
    glowColor: '#F97316'
  },
  {
    id: 'meal-plan',
    label: 'Plan Alimentaire',
    icon: 'ClipboardList',
    xp: 50,
    route: '/meals',
    category: 'progression',
    description: 'Planification hebdo',
    benefit1: 'Planifie ta semaine nutrition en quelques secondes.',
    benefit2: 'Atteins tes macros chaque jour sans effort mental.',
    glowColor: '#FBBF24'
  },
  {
    id: 'recipe-generation',
    label: 'Créer une Recette',
    icon: 'ChefHat',
    xp: 40,
    route: '/fridge',
    category: 'progression',
    description: 'Cuisine optimisée',
    benefit1: 'Transforme tes ingrédients en recettes macro-friendly.',
    benefit2: 'Diversifie ton alimentation tout en restant aligné.',
    glowColor: '#F59E0B'
  },
  {
    id: 'shopping-list',
    label: 'Liste de Courses',
    icon: 'ShoppingCart',
    xp: 40,
    route: '/meals',
    category: 'progression',
    description: 'Smart shopping',
    benefit1: 'Génère ta liste optimisée selon ton plan alimentaire.',
    benefit2: 'Économise du temps et évite les achats inutiles.',
    glowColor: '#FBBF24'
  },

  // Actions de Tracking (30 points)
  {
    id: 'fridge-scan',
    label: 'Scanner mon Frigo',
    icon: 'Refrigerator',
    xp: 15,
    route: '/fridge',
    category: 'tracking',
    description: 'Inventaire food',
    benefit1: 'Identifie les aliments disponibles instantanément.',
    benefit2: 'Évite le gaspillage et optimise tes courses.',
    glowColor: '#F59E0B'
  }
];

interface GamingActionsWidgetProps {
  showOnlyCategory?: 'daily' | 'progression' | 'tracking' | null;
}

export default function GamingActionsWidget({ showOnlyCategory = null }: GamingActionsWidgetProps = {}) {
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
    // Play action sound based on category
    GamingSounds.actionCompleted(action.category, false);

    // Navigation only - tracking will happen after actual completion
    navigate(action.route);
  };

  // Filter out fasting for users not in fat_loss
  const filteredActions = ACTIONS.filter(action => {
    if (action.id === 'fasting-log' && profile?.objective !== 'fat_loss') {
      return false;
    }
    return true;
  });

  const getCategoryTitle = (category: ActionButton['category']) => {
    switch (category) {
      case 'daily':
        return 'Forges Suivi Quotidien';
      case 'progression':
        return 'Actions pour forger votre corps et progresser';
      case 'tracking':
        return 'Registre de Traçage';
    }
  };

  const getCategoryIcon = (category: ActionButton['category']) => {
    switch (category) {
      case 'daily':
        return { name: 'Zap' as const, color: '#F7931E', glowColor: '#FBBF24' };
      case 'progression':
        return { name: 'Rocket' as const, color: '#F97316', glowColor: '#FB923C' };
      case 'tracking':
        return { name: 'BarChart3' as const, color: '#F59E0B', glowColor: '#FBBF24' };
    }
  };

  const getCategoryDescription = (category: ActionButton['category']) => {
    switch (category) {
      case 'daily':
        return 'Complète chaque action pour maintenir ta série active';
      case 'progression':
        return 'Planifie et optimise ta stratégie nutrition & training';
      case 'tracking':
        return 'Analyse et mesure tes progrès avec précision';
    }
  };

  const groupedActions = filteredActions.reduce((acc, action) => {
    if (!acc[action.category]) {
      acc[action.category] = [];
    }
    acc[action.category].push(action);
    return acc;
  }, {} as Record<ActionButton['category'], ActionButton[]>);

  // Count completed daily actions
  const dailyActions = groupedActions['daily'] || [];
  const completedDailyCount = dailyActions.filter(action => isActionCompleted(action.id)).length;
  const totalDailyCount = dailyActions.length;
  const totalDailyActionsToday = completedActions.filter(action => {
    return dailyActions.some(da => da.id === action.action_id);
  }).length;

  // Check for combo (multiple daily actions completed)
  const previousDailyCount = React.useRef(totalDailyActionsToday);
  React.useEffect(() => {
    if (totalDailyActionsToday > previousDailyCount.current && totalDailyActionsToday >= 2) {
      // Play combo sound for multiple completions
      GamingSounds.comboActivated(totalDailyActionsToday);
    }

    // Check for perfect day (all daily actions completed)
    if (completedDailyCount === totalDailyCount && totalDailyCount > 0 && completedDailyCount > previousDailyCount.current) {
      setTimeout(() => {
        GamingSounds.perfectDay();
      }, 500);
    }

    previousDailyCount.current = totalDailyActionsToday;
  }, [totalDailyActionsToday, completedDailyCount, totalDailyCount]);

  return (
    <div className="space-y-6">
      {(['daily', 'progression', 'tracking'] as const).map((category, categoryIndex) => {
        // Filter by category if specified
        if (showOnlyCategory && category !== showOnlyCategory) return null;

        const actions = groupedActions[category];
        if (!actions || actions.length === 0) return null;

        const isDailyCategory = category === 'daily';

        return (
          <ConditionalMotion
            key={category}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: categoryIndex * 0.1 }}
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3 px-2">
                <div>
                  <h3 className="text-xl font-bold text-white">{getCategoryTitle(category)}</h3>
                  <p className="text-sm text-white/60">{getCategoryDescription(category)}</p>
                </div>

                {/* Progress counter for daily actions */}
                {isDailyCategory && (
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <div className="flex items-center gap-1.5">
                        <SpatialIcon name="Trophy" size={18} color="#F7931E" />
                        <p className="text-2xl font-black text-orange-400">{totalDailyActionsToday}</p>
                      </div>
                      <p className="text-xs text-white/60">actions effectuées</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3">
                {actions.map((action, index) => {
                  const isCompleted = isActionCompleted(action.id);
                  const isDailyAction = action.category === 'daily';
                  const occurrences = getOccurrenceCount(action.id);
                  
                  return (
                    <ConditionalMotion
                      key={action.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.3, delay: categoryIndex * 0.1 + index * 0.05 }}
                      whileHover={{ scale: 1.02, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <button
                        onClick={() => handleAction(action)}
                        className="w-full glass-card p-5 rounded-xl relative overflow-hidden group text-left"
                        style={{
                          background: `
                            linear-gradient(135deg, ${action.glowColor || '#F7931E'}20 0%, ${action.glowColor || '#F7931E'}10 50%, rgba(0, 0, 0, 0.3) 100%),
                            radial-gradient(circle at 30% 30%, ${action.glowColor || '#F7931E'}12 0%, transparent 50%),
                            rgba(255, 255, 255, 0.03)
                          `,
                          backdropFilter: 'blur(20px) saturate(150%)',
                          WebkitBackdropFilter: 'blur(20px) saturate(150%)',
                          border: `1px solid ${action.glowColor || '#F7931E'}35`,
                          boxShadow: `
                            0 4px 16px ${action.glowColor || '#F7931E'}25,
                            0 2px 8px rgba(0, 0, 0, 0.4),
                            inset 0 1px 0 rgba(255, 255, 255, 0.2),
                            inset 0 -1px 0 rgba(0, 0, 0, 0.3)
                          `
                        }}
                      >
                        {/* Animated glow */}
                        {performanceMode === 'premium' && (
                          <motion.div
                            className="absolute inset-0"
                            style={{
                              background: `linear-gradient(90deg, ${action.glowColor}05, ${action.glowColor}10, ${action.glowColor}05)`
                            }}
                            animate={{ x: ['-100%', '100%'] }}
                            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                          />
                        )}

                        {/* Glow effect on hover */}
                        <div className="absolute inset-0 bg-gradient-to-br from-white/0 via-white/5 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                        <div className="relative flex items-start gap-4">
                          {/* Icon with completion badge */}
                          <div className="relative flex-shrink-0">
                            <div
                              className="w-14 h-14 rounded-xl flex items-center justify-center relative"
                              style={{
                                background: `linear-gradient(135deg, ${action.glowColor || '#A855F7'}30, ${action.glowColor || '#A855F7'}20)`,
                                border: `1px solid ${action.glowColor || '#A855F7'}40`,
                                boxShadow: `0 0 12px ${action.glowColor || '#A855F7'}30`
                              }}
                            >
                              {performanceMode !== 'low' && (
                                <motion.div
                                  className="absolute inset-0 rounded-xl"
                                  style={{
                                    background: `linear-gradient(135deg, ${action.glowColor || '#A855F7'}20, transparent)`,
                                  }}
                                  animate={{
                                    opacity: [0.3, 0.6, 0.3],
                                  }}
                                  transition={{
                                    duration: 2,
                                    repeat: Infinity,
                                    ease: 'easeInOut',
                                  }}
                                />
                              )}
                              <SpatialIcon
                                name={action.icon as any}
                                size={28}
                                color={action.glowColor}
                                glowColor={action.glowColor}
                                variant="pure"
                              />
                            </div>
                            {occurrences > 0 && (
                              <motion.div
                                className="absolute -top-1 -right-1 min-w-[24px] h-6 px-2 rounded-full flex items-center justify-center border-2 border-white/20"
                                style={{
                                  background: `linear-gradient(135deg, ${action.glowColor || '#A855F7'}, ${action.glowColor || '#A855F7'}DD)`
                                }}
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: 'spring', stiffness: 300 }}
                              >
                                <span className="text-xs font-bold text-white">{occurrences}x</span>
                              </motion.div>
                            )}
                          </div>

                          {/* Content */}
                          <div className="flex-1 text-left min-w-0">
                            <div className="flex items-start justify-between gap-3 mb-2">
                              <div className="flex-1">
                                <h4 className="font-bold text-white">
                                  {action.label}
                                </h4>
                                {action.description && (
                                  <p className="text-xs text-white/50">
                                    {action.description}
                                  </p>
                                )}
                              </div>

                              {/* Points Badge */}
                              {(action.xp > 0 || action.description) && (
                                <div
                                  className="flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-bold"
                                  style={{
                                    background: `${action.glowColor || '#A855F7'}20`,
                                    color: action.glowColor || '#A855F7',
                                    border: `1px solid ${action.glowColor || '#A855F7'}30`
                                  }}
                                >
                                  {action.xp > 0 ? `+${action.xp} points` : action.description}
                                </div>
                              )}
                            </div>

                            {/* Benefits */}
                            <div className="mt-2">
                              <p className="text-xs text-white/70 leading-relaxed">
                                {action.benefit1}
                              </p>
                            </div>

                            {/* Occurrence status with encouragement */}
                            {isDailyAction && occurrences > 0 && (
                              <motion.div
                                className="mt-3 px-3 py-1.5 rounded-lg border flex items-center gap-2"
                                style={{
                                  background: `${action.glowColor}20`,
                                  borderColor: `${action.glowColor}30`
                                }}
                                initial={{ opacity: 0, y: -5 }}
                                animate={{ opacity: 1, y: 0 }}
                              >
                                <SpatialIcon name="Sparkles" size={14} color={action.glowColor} />
                                <span className="text-xs font-semibold" style={{ color: action.glowColor }}>
                                  {occurrences === 1 && 'Continue ta série !'}
                                  {occurrences === 2 && 'Excellent suivi !'}
                                  {occurrences >= 3 && 'Incroyable engagement !'}
                                </span>
                              </motion.div>
                            )}
                          </div>
                        </div>
                      </button>
                    </ConditionalMotion>
                  );
                })}
              </div>
            </div>
          </ConditionalMotion>
        );
      })}
    </div>
  );
}
