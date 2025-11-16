/**
 * GamificationSkeleton
 * Skeleton loading avec shimmer effect pour le widget de gamification
 */

import { motion } from 'framer-motion';

export default function GamificationSkeleton() {
  return (
    <div className="glass-card-premium p-8 rounded-3xl space-y-6 relative overflow-hidden">
      {/* Shimmer overlay */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent)',
        }}
        animate={{
          x: ['-100%', '200%'],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: 'linear',
        }}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-white/10 animate-pulse" />
          <div className="space-y-2">
            <div className="h-6 w-32 bg-white/10 rounded-lg animate-pulse" />
            <div className="h-4 w-24 bg-white/10 rounded-lg animate-pulse" />
          </div>
        </div>
        <div className="text-right space-y-2">
          <div className="h-8 w-20 bg-white/10 rounded-lg animate-pulse ml-auto" />
          <div className="h-3 w-16 bg-white/10 rounded-lg animate-pulse ml-auto" />
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="h-4 w-24 bg-white/10 rounded-lg animate-pulse" />
          <div className="h-4 w-16 bg-white/10 rounded-lg animate-pulse" />
        </div>
        <div className="h-4 bg-white/10 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-purple-500/30 to-pink-500/30"
            animate={{
              width: ['0%', '60%', '0%'],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="glass-card rounded-xl p-4 space-y-3">
            <div className="h-3 w-16 bg-white/10 rounded-lg animate-pulse" />
            <div className="h-6 w-12 bg-white/10 rounded-lg animate-pulse" />
            <div className="h-3 w-20 bg-white/10 rounded-lg animate-pulse" />
          </div>
        ))}
      </div>

      {/* Prediction section */}
      <div className="glass-card rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-lg bg-white/10 animate-pulse" />
          <div className="h-4 w-32 bg-white/10 rounded-lg animate-pulse" />
        </div>
        <div className="space-y-2">
          <div className="h-5 w-3/4 bg-white/10 rounded-lg animate-pulse" />
          <div className="h-4 w-1/2 bg-white/10 rounded-lg animate-pulse" />
        </div>
      </div>
    </div>
  );
}
