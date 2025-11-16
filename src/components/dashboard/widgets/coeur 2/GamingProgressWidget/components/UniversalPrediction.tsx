import { motion } from 'framer-motion';
import SpatialIcon from '@/ui/icons/SpatialIcon';
import PredictionTimeline from './PredictionTimeline';
import { CONFIDENCE_COLORS } from '../types';

interface UniversalPredictionProps {
  prediction: any;
  bodyProjection: any;
  futureLevelTitles: Record<number, string>;
}

export default function UniversalPrediction({ prediction, bodyProjection, futureLevelTitles }: UniversalPredictionProps) {
  if (!prediction) return null;

  const confidenceColor = CONFIDENCE_COLORS[prediction.confidence];

  const timelineEntries = [
    { days: 30, dataXp: prediction.predictions.days30, dataBody: bodyProjection?.projections.days30, color: '#F7931E' },
    { days: 60, dataXp: prediction.predictions.days60, dataBody: bodyProjection?.projections.days60, color: '#FBBF24' },
    { days: 90, dataXp: prediction.predictions.days90, dataBody: bodyProjection?.projections.days90, color: '#F59E0B' },
  ];

  return (
    <motion.div
      className="glass-card rounded-2xl p-6 bg-gradient-to-br from-orange-500/10 to-yellow-500/5 border border-orange-500/20 relative overflow-hidden"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
    >
      <div className="flex justify-end mb-3">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl backdrop-blur-sm"
          style={{
            background: `${confidenceColor.bg}20`,
            border: `1px solid ${confidenceColor.bg}40`,
          }}
        >
          <div className="flex gap-1">
            {[1, 2, 3].map(i => (
              <div
                key={i}
                className="w-1.5 h-4 rounded-full"
                style={{
                  backgroundColor: i <= (prediction.confidence === 'high' ? 3 : prediction.confidence === 'medium' ? 2 : 1)
                    ? confidenceColor.bg
                    : 'rgba(255, 255, 255, 0.2)',
                }}
              />
            ))}
          </div>
          <span className="text-xs font-bold" style={{ color: confidenceColor.bg }}>
            {confidenceColor.text}
          </span>
        </div>
      </div>

      <div className="flex items-start gap-4 mb-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500/30 to-yellow-500/30 flex items-center justify-center border border-orange-500/40 flex-shrink-0">
          <SpatialIcon name="TrendingUp" size={24} color="#F7931E" />
        </div>

        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-bold text-white mb-2">Projection de Progression</h4>
          <p className="text-base font-normal text-white/90">
            {bodyProjection ? bodyProjection.message : prediction.message}
          </p>
        </div>
      </div>

      <PredictionTimeline
        entries={timelineEntries}
        futureLevelTitles={futureLevelTitles}
        targetWeight={bodyProjection?.targetWeight}
      />

      <div className="w-full mt-4 pt-4 border-t border-white/10">
        <p className="text-sm text-white/90 italic">
          💡 {bodyProjection ? bodyProjection.motivationalMessage : prediction.encouragement}
        </p>
      </div>
    </motion.div>
  );
}
