import SpatialIcon from '@/ui/icons/SpatialIcon';

interface PredictionData {
  estimatedLevel: number;
  estimatedXp: number;
}

interface BodyProjectionData {
  estimatedWeight: number;
  weightChange: number;
  estimatedBodyFat?: number;
  estimatedMeasurements?: {
    waist?: number;
    chest?: number;
  };
  targetWeightReached?: boolean;
}

interface TimelineEntry {
  days: number;
  dataXp: PredictionData;
  dataBody?: BodyProjectionData;
  color: string;
}

interface PredictionTimelineProps {
  entries: TimelineEntry[];
  futureLevelTitles: Record<number, string>;
  targetWeight?: number;
}

export default function PredictionTimeline({ entries, futureLevelTitles, targetWeight }: PredictionTimelineProps) {
  return (
    <div className="w-full space-y-4">
      {entries.map(({ days, dataXp, dataBody, color }) => (
        <div
          key={days}
          className="glass-card rounded-2xl p-5 w-full border"
          style={{
            borderColor: `${color}40`,
            background: `linear-gradient(135deg, ${color}08 0%, transparent 100%)`
          }}
        >
          {/* Header avec période */}
          <div className="flex items-center gap-2 mb-4">
            <div
              className="px-3 py-1.5 rounded-full font-bold text-sm"
              style={{
                background: `${color}20`,
                color: color,
                border: `1px solid ${color}40`
              }}
            >
              Dans {days} jours
            </div>
          </div>

          {/* Gaming Info - Niveau et XP */}
          <div className="mb-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-white/60 text-sm font-medium">Niveau estimé</span>
              <div className="flex items-center gap-2">
                <div
                  className="px-3 py-1 rounded-full text-sm font-bold"
                  style={{
                    background: `${color}20`,
                    color: color,
                    border: `1px solid ${color}40`
                  }}
                >
                  Niveau {dataXp.estimatedLevel}
                </div>
              </div>
            </div>
            <div className="glass-card rounded-xl p-3 border border-white/10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-white/50">Titre</span>
                <span className="text-base font-black text-white">
                  {futureLevelTitles[dataXp.estimatedLevel] || `Niveau ${dataXp.estimatedLevel}`}
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min((dataXp.estimatedXp / 100) * 100, 100)}%`,
                    backgroundColor: color,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Body Projection */}
          {dataBody && (
            <div className="space-y-3 pt-3 border-t border-white/10">
              {/* Poids principal */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <SpatialIcon name="Scale" size={18} color={color} />
                  <span className="text-white/60 text-sm font-medium">Poids projeté</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black" style={{ color }}>
                    {dataBody.estimatedWeight}kg
                  </span>
                  <span
                    className="text-base font-bold px-2 py-0.5 rounded-lg"
                    style={{
                      color: dataBody.weightChange < 0 ? '#10B981' : '#F59E0B',
                      background: dataBody.weightChange < 0 ? '#10B98120' : '#F59E0B20'
                    }}
                  >
                    {dataBody.weightChange > 0 ? '+' : ''}{dataBody.weightChange.toFixed(1)}kg
                  </span>
                </div>
              </div>

              {/* Statistiques secondaires */}
              <div className="grid grid-cols-2 gap-3">
                {dataBody.estimatedBodyFat && (
                  <div className="glass-card rounded-xl p-3 border border-white/10">
                    <div className="flex items-center gap-2 mb-1">
                      <SpatialIcon name="Activity" size={14} color={color} />
                      <span className="text-xs text-white/50">Masse Grasse</span>
                    </div>
                    <span className="text-lg font-bold text-white">
                      {dataBody.estimatedBodyFat.toFixed(1)}%
                    </span>
                  </div>
                )}
                {dataBody.estimatedMeasurements?.waist && (
                  <div className="glass-card rounded-xl p-3 border border-white/10">
                    <div className="flex items-center gap-2 mb-1">
                      <SpatialIcon name="Circle" size={14} color={color} />
                      <span className="text-xs text-white/50">Tour de taille</span>
                    </div>
                    <span className="text-lg font-bold text-white">
                      {dataBody.estimatedMeasurements.waist.toFixed(0)}cm
                    </span>
                  </div>
                )}
                {dataBody.estimatedMeasurements?.chest && (
                  <div className="glass-card rounded-xl p-3 border border-white/10">
                    <div className="flex items-center gap-2 mb-1">
                      <SpatialIcon name="User" size={14} color={color} />
                      <span className="text-xs text-white/50">Tour de poitrine</span>
                    </div>
                    <span className="text-lg font-bold text-white">
                      {dataBody.estimatedMeasurements.chest.toFixed(0)}cm
                    </span>
                  </div>
                )}
              </div>

              {/* Objectif atteint */}
              {dataBody.targetWeightReached && targetWeight && (
                <div
                  className="flex items-center gap-2 px-4 py-3 rounded-xl mt-3"
                  style={{
                    background: `${color}20`,
                    border: `2px solid ${color}60`
                  }}
                >
                  <SpatialIcon name="Target" size={18} color={color} />
                  <span className="text-sm font-bold" style={{ color }}>
                    Objectif atteint: {targetWeight}kg ! 🎯
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
