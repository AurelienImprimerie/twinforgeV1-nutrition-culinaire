/**
 * useTransformationScore Hook
 * Fetches and manages transformation score with TanStack Query
 */

import { useQuery } from '@tanstack/react-query';
import { useUserStore } from '@/system/store/userStore';
import { TransformationScoreService } from '@/services/dashboard/coeur/TransformationScoreService';
import type { TransformationScore } from '@/services/dashboard/types';
import logger from '@/lib/utils/logger';

interface UseTransformationScoreOptions {
  enabled?: boolean;
  refetchInterval?: number | false;
}

export function useTransformationScore(options: UseTransformationScoreOptions = {}) {
  const { user } = useUserStore();
  const userId = user?.id;

  const {
    data: score,
    isLoading,
    error,
    refetch,
    isFetching
  } = useQuery<TransformationScore>({
    queryKey: ['transformation-score', userId],
    queryFn: async () => {
      if (!userId) {
        throw new Error('User ID is required');
      }

      logger.debug('USE_TRANSFORMATION_SCORE', 'Fetching transformation score', { userId });

      return await TransformationScoreService.calculateGlobalScore(userId);
    },
    enabled: !!userId && (options.enabled !== false),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchInterval: options.refetchInterval ?? false,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000)
  });

  const levelInfo = score ? TransformationScoreService.getLevelInfo(score.globalScore) : null;

  return {
    score,
    levelInfo,
    isLoading,
    isFetching,
    error,
    refetch,
    hasData: !!score
  };
}
