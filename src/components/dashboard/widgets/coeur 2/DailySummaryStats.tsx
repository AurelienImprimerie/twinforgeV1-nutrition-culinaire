/**
 * DailySummaryStats - Glass Card avec 3 Résumés Quotidiens
 *
 * Affiche les statistiques quotidiennes de progression gaming:
 * - Points Quotidien moyens avec tendance
 * - Multiplicateur de série
 * - Record de plus longue série
 */

import { motion } from 'framer-motion';
import SpatialIcon from '@/ui/icons/SpatialIcon';
import WidgetHeader from '../shared/WidgetHeader';

interface DailySummaryStatsProps {
  averageDailyXp: number;
  trendDirection: 'increasing' | 'decreasing' | 'stable';
  streakMultiplier: number;
  currentStreakDays: number;
  longestStreakDays: number;
}

interface StatCardProps {
  icon: string;
  iconColor: string;
  label: string;
  value: string | number;
  subtext: string;
  subtextColor?: string;
}

const StatCard = ({ icon, iconColor, label, value, subtext, subtextColor = '#FB923C' }: StatCardProps) => (
  <motion.div
    className="glass-card rounded-xl p-3 sm:p-4 hover:bg-white/10 transition-all group"
    whileHover={{ scale: 1.02, y: -2 }}
  >
    <div className="flex items-center gap-2 mb-2 sm:mb-3">
      <SpatialIcon name={icon as any} size={16} color={iconColor} />
      <p className="text-xs sm:text-sm font-semibold text-white/80">{label}</p>
    </div>
    <p className="text-2xl sm:text-3xl font-black text-white mb-1">{value}</p>
    <p className="text-xs font-medium" style={{ color: subtextColor }}>{subtext}</p>
  </motion.div>
);

export default function DailySummaryStats({
  averageDailyXp,
  trendDirection,
  streakMultiplier,
  currentStreakDays,
  longestStreakDays
}: DailySummaryStatsProps) {
  const trendText = trendDirection === 'increasing' ? '↗ En hausse' :
    trendDirection === 'decreasing' ? '↘ En baisse' : '→ Stable';

  // Calcul des statistiques supplémentaires
  const weeklyXpAverage = Math.round(averageDailyXp * 7);
  const completionRate = currentStreakDays > 0 ? Math.min(100, Math.round((currentStreakDays / 7) * 100)) : 0;
  const bestDay = currentStreakDays > 0 ? 'Aujourd\'hui' : 'Aucun';

  return (
    <motion.div
      className="glass-card-premium p-6 sm:p-8 rounded-3xl space-y-6 relative overflow-hidden"
      style={{
        background: `
          radial-gradient(circle at 30% 30%, rgba(251, 191, 36, 0.15) 0%, transparent 50%),
          radial-gradient(circle at 70% 70%, rgba(245, 158, 11, 0.12) 0%, transparent 50%),
          rgba(255, 255, 255, 0.03)
        `,
        backdropFilter: 'blur(20px) saturate(150%)',
        WebkitBackdropFilter: 'blur(20px) saturate(150%)',
        border: '1px solid rgba(251, 191, 36, 0.3)',
        boxShadow: `
          inset 0 1px 0 rgba(255, 255, 255, 0.1),
          0 4px 16px rgba(251, 191, 36, 0.15)
        `
      }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
    >
      {/* Widget Header */}
      <WidgetHeader
        icon="BarChart3"
        mainColor="#F7931E"
        glowColor="#FBBF24"
        title="Résumé Quotidien"
        subtitle="Statistiques de progression"
        animationType="pulse"
      />

      {/* Stats Grid - 6 statistiques */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        <StatCard
          icon="TrendingUp"
          iconColor="#10B981"
          label="Points Quotidien"
          value={Math.round(averageDailyXp)}
          subtext={trendText}
          subtextColor="#10B981"
        />

        <StatCard
          icon="Flame"
          iconColor="#F97316"
          label="Multiplicateur"
          value={`×${streakMultiplier.toFixed(1)}`}
          subtext={`${currentStreakDays} jour${currentStreakDays > 1 ? 's' : ''} série`}
          subtextColor="#F97316"
        />

        <StatCard
          icon="Award"
          iconColor="#F7931E"
          label="Record Série"
          value={longestStreakDays}
          subtext="Plus longue série"
          subtextColor="#F7931E"
        />

        <StatCard
          icon="CalendarDays"
          iconColor="#FBBF24"
          label="Points Hebdo"
          value={weeklyXpAverage}
          subtext="Moyenne 7 jours"
          subtextColor="#FBBF24"
        />

        <StatCard
          icon="Target"
          iconColor="#06B6D4"
          label="Taux Actions"
          value={`${completionRate}%`}
          subtext="Complétion semaine"
          subtextColor="#06B6D4"
        />

        <StatCard
          icon="Star"
          iconColor="#F59E0B"
          label="Meilleur Jour"
          value={bestDay}
          subtext="Série active"
          subtextColor="#F59E0B"
        />
      </div>
    </motion.div>
  );
}
