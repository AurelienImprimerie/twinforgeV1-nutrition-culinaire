import { useState, useEffect } from 'react';
import { useGamificationProgress, useWeightUpdateHistory, useCurrentLevelTitle } from '@/hooks/coeur/useGamification';
import { useUniversalPrediction } from '@/hooks/coeur/useUniversalPrediction';
import { useBodyProjection } from '@/hooks/useBodyProjection';
import { gamificationService } from '@/services/dashboard/coeur';

export function useGamingData() {
  const [futureLevelTitles, setFutureLevelTitles] = useState<Record<number, string>>({});

  const { data: gamification, isLoading: gamificationLoading } = useGamificationProgress();
  const { data: prediction, isLoading: predictionLoading, error: predictionError } = useUniversalPrediction();
  const { data: bodyProjection, isLoading: bodyProjectionLoading } = useBodyProjection();
  const { data: weightHistory } = useWeightUpdateHistory(5);
  const levelInfo = useCurrentLevelTitle();

  // Load future level titles for predictions
  useEffect(() => {
    const loadFutureTitles = async () => {
      if (!prediction) return;

      const titles: Record<number, string> = {};
      const levels = [
        prediction.predictions.days30.estimatedLevel,
        prediction.predictions.days60.estimatedLevel,
        prediction.predictions.days90.estimatedLevel
      ];

      for (const level of levels) {
        try {
          const milestone = await gamificationService.getLevelMilestone(level);
          if (milestone) {
            titles[level] = milestone.milestoneName;
          }
        } catch (error) {
          titles[level] = `Niveau ${level}`;
        }
      }

      setFutureLevelTitles(titles);
    };

    loadFutureTitles();
  }, [prediction]);

  const levelProgress = gamification && gamification.xpToNextLevel > 0
    ? ((gamification.currentXp / (gamification.currentXp + gamification.xpToNextLevel)) * 100)
    : 0;

  return {
    gamification,
    gamificationLoading,
    prediction,
    predictionLoading,
    predictionError,
    bodyProjection,
    bodyProjectionLoading,
    weightHistory,
    levelInfo,
    futureLevelTitles,
    levelProgress
  };
}
