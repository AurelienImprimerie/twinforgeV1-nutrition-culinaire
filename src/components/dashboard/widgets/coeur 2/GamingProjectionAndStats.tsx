/**
 * GamingProjectionAndStats - Composant Unifié Projection + Stats
 *
 * Combine la projection de progression et les statistiques visuelles
 * dans un composant harmonisé pour l'onglet Coeur de la Forge
 */

import { motion } from 'framer-motion';
import SpatialIcon from '@/ui/icons/SpatialIcon';
import PredictionTimeline from './GamingProgressWidget/components/PredictionTimeline';
import { CONFIDENCE_COLORS } from './GamingProgressWidget/types';
import WidgetHeader from '../shared/WidgetHeader';

interface Projection {
  days30: any;
  days60: any;
  days90: any;
}

interface UniversalPredictionData {
  confidence: 'high' | 'medium' | 'low';
  predictions: Projection;
  message: string;
  encouragement: string;
  averageDailyXp: number;
  trend: 'increasing' | 'decreasing' | 'stable';
}

interface BodyProjection {
  projections: Projection;
  message: string;
  motivationalMessage: string;
  targetWeight?: number;
}

interface GamingProjectionAndStatsProps {
  prediction?: UniversalPredictionData;
  bodyProjection?: BodyProjection;
  futureLevelTitles: Record<number, string>;
}

export default function GamingProjectionAndStats({
  prediction,
  bodyProjection,
  futureLevelTitles
}: GamingProjectionAndStatsProps) {
  if (!prediction || !prediction.predictions) return null;

  const confidenceColor = CONFIDENCE_COLORS[prediction.confidence];

  const timelineEntries = [
    { days: 30, dataXp: prediction.predictions.days30, dataBody: bodyProjection?.projections?.days30, color: '#F7931E' },
    { days: 60, dataXp: prediction.predictions.days60, dataBody: bodyProjection?.projections?.days60, color: '#FBBF24' },
    { days: 90, dataXp: prediction.predictions.days90, dataBody: bodyProjection?.projections?.days90, color: '#F59E0B' },
  ];

  return (
    <motion.div
      className="glass-card-premium p-6 sm:p-8 rounded-3xl space-y-6 relative overflow-hidden"
      style={{
        background: `
          radial-gradient(circle at 30% 30%, rgba(251, 146, 60, 0.15) 0%, transparent 50%),
          radial-gradient(circle at 70% 70%, rgba(245, 158, 11, 0.12) 0%, transparent 50%),
          rgba(255, 255, 255, 0.03)
        `,
        backdropFilter: 'blur(20px) saturate(150%)',
        WebkitBackdropFilter: 'blur(20px) saturate(150%)',
        border: '1px solid rgba(251, 146, 60, 0.3)',
        boxShadow: `inset 0 1px 0 rgba(255, 255, 255, 0.1)`
      }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
    >
      {/* Widget Header */}
      <WidgetHeader
        icon="TrendingUp"
        mainColor="#F7931E"
        glowColor="#FBBF24"
        title="Projection de Progression"
        subtitle="Évolution estimée sur 90 jours"
        animationType="glow"
        badge={{
          label: confidenceColor.text,
          color: confidenceColor.bg
        }}
      />

      {/* Projection Section */}
      <div className="space-y-4">
        {/* Message */}
        <div className="text-center px-4">
          <p className="text-base font-normal text-white/90">
            {bodyProjection ? bodyProjection.message : prediction.message}
          </p>
        </div>

        {/* Prediction Timeline */}
        <PredictionTimeline
          entries={timelineEntries}
          futureLevelTitles={futureLevelTitles}
          targetWeight={bodyProjection?.targetWeight}
        />

        {/* Motivational Message */}
        <div className="w-full pt-4 border-t border-white/10">
          <p className="text-sm text-white/90 italic">
            💡 {bodyProjection ? bodyProjection.motivationalMessage : prediction.encouragement}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
