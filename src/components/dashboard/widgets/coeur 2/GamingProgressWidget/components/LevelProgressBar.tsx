import { motion } from 'framer-motion';

interface LevelProgressBarProps {
  levelProgress: number;
  xpToNextLevel: number;
  performanceMode: string;
}

export default function LevelProgressBar({ levelProgress, xpToNextLevel, performanceMode }: LevelProgressBarProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm sm:text-base font-bold text-white">
          Prochain niveau
        </h4>
        <span className="text-sm font-bold text-orange-400">
          {xpToNextLevel} pt
        </span>
      </div>

      <div className="h-5 bg-white/10 rounded-full overflow-hidden relative border-2 border-white/20 shadow-lg">
        <motion.div
          className="h-full bg-gradient-to-r from-orange-500 via-yellow-500 to-orange-500 rounded-full relative"
          initial={{ width: 0 }}
          animate={{ width: `${levelProgress}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
          style={{
            boxShadow: '0 0 20px rgba(247, 147, 30, 0.6), inset 0 2px 0 rgba(255, 255, 255, 0.3)'
          }}
        >
          {performanceMode !== 'low' && (
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
              animate={{
                x: ['-100%', '200%'],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'linear',
              }}
            />
          )}
        </motion.div>
      </div>

      {/* Divider after progress bar */}
      <div className="relative py-1">
        <div className="w-full border-t border-white/10" />
      </div>
    </div>
  );
}
