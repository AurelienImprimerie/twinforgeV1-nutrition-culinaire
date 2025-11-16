import { motion } from 'framer-motion';
import SpatialIcon from '@/ui/icons/SpatialIcon';

interface StatsGridProps {
  averageDailyXp: number;
  trendDirection: 'increasing' | 'decreasing' | 'stable';
  streakMultiplier: number;
  currentStreakDays: number;
  longestStreakDays: number;
}

export default function StatsGrid({
  averageDailyXp,
  trendDirection,
  streakMultiplier,
  currentStreakDays,
  longestStreakDays
}: StatsGridProps) {
  const trendText = trendDirection === 'increasing' ? '↗ En hausse' :
    trendDirection === 'decreasing' ? '↘ En baisse' : '→ Stable';

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
      <motion.div
        className="glass-card rounded-xl p-4 hover:bg-white/10 transition-all group col-span-2 sm:col-span-1"
        whileHover={{ scale: 1.02, y: -2 }}
      >
        <div className="flex items-center gap-2 mb-3">
          <SpatialIcon name="TrendingUp" size={18} color="#10B981" />
          <p className="text-xs sm:text-sm font-semibold text-white/80">Points Quotidien</p>
        </div>
        <p className="text-3xl sm:text-2xl font-black text-white mb-1">{Math.round(averageDailyXp)}</p>
        <p className="text-xs text-green-400 font-medium">{trendText}</p>
      </motion.div>

      <motion.div
        className="glass-card rounded-xl p-4 hover:bg-white/10 transition-all group"
        whileHover={{ scale: 1.02, y: -2 }}
      >
        <div className="flex items-center gap-2 mb-3">
          <SpatialIcon name="Flame" size={18} color="#F97316" />
          <p className="text-xs sm:text-sm font-semibold text-white/80">Multiplicateur</p>
        </div>
        <p className="text-3xl sm:text-2xl font-black text-white mb-1">×{streakMultiplier.toFixed(1)}</p>
        <p className="text-xs text-orange-400 font-medium">
          {currentStreakDays} jour{currentStreakDays > 1 ? 's' : ''} série
        </p>
      </motion.div>

      <motion.div
        className="glass-card rounded-xl p-4 hover:bg-white/10 transition-all group"
        whileHover={{ scale: 1.02, y: -2 }}
      >
        <div className="flex items-center gap-2 mb-3">
          <SpatialIcon name="Award" size={18} color="#F7931E" />
          <p className="text-xs sm:text-sm font-semibold text-white/80">Record</p>
        </div>
        <p className="text-3xl sm:text-2xl font-black text-white mb-1">{longestStreakDays}</p>
        <p className="text-xs text-orange-400 font-medium">Plus longue série</p>
      </motion.div>
    </div>
  );
}
