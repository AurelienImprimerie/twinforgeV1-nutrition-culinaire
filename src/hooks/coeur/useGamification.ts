import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/system/supabase/client';
import { gamificationService } from '@/services/dashboard/coeur';
import type {
  GamificationProgress,
  XpEvent,
  LevelMilestone,
  WeightUpdate,
  XpAwardResult
} from '@/services/dashboard/coeur';

export function useGamificationProgress() {
  const { data: session } = useQuery({
    queryKey: ['session'],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    }
  });

  return useQuery({
    queryKey: ['gamification-progress', session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) throw new Error('No user');

      try {
        let progress = await gamificationService.getUserProgress(session.user.id);

        if (!progress) {
          progress = await gamificationService.initializeUserProgress(session.user.id);
        }

        return progress;
      } catch (error: any) {
        if (error?.code === 'PGRST204' || error?.code === 'PGRST205' || error?.message?.includes('relation') || error?.message?.includes('does not exist')) {
          return null;
        }
        throw error;
      }
    },
    enabled: !!session?.user?.id,
    staleTime: 0,
    refetchInterval: false,
    refetchOnWindowFocus: true,
    retry: false
  });
}

export function useRecentXpEvents(limit: number = 20) {
  const { data: session } = useQuery({
    queryKey: ['session'],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    }
  });

  return useQuery({
    queryKey: ['xp-events', session?.user?.id, limit],
    queryFn: async () => {
      if (!session?.user?.id) throw new Error('No user');
      return gamificationService.getRecentXpEvents(session.user.id, limit);
    },
    enabled: !!session?.user?.id,
    staleTime: 1 * 60 * 1000
  });
}

export function useLevelMilestone(level?: number) {
  return useQuery({
    queryKey: ['level-milestone', level],
    queryFn: async () => {
      if (!level) return null;
      return gamificationService.getLevelMilestone(level);
    },
    enabled: !!level,
    staleTime: 60 * 60 * 1000
  });
}

/**
 * Hook to get level milestone with gendered title and description
 * Automatically uses the user's gender to return appropriate content
 */
export function useLevelMilestoneForUser(level?: number) {
  const { data: session } = useQuery({
    queryKey: ['session'],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    }
  });

  return useQuery({
    queryKey: ['level-milestone-gendered', session?.user?.id, level],
    queryFn: async () => {
      if (!level || !session?.user?.id) return null;
      return gamificationService.getLevelMilestoneForUser(session.user.id, level);
    },
    enabled: !!level && !!session?.user?.id,
    staleTime: 60 * 60 * 1000
  });
}

export function useCurrentLevelTitle() {
  const { data: gamification } = useGamificationProgress();
  const { data: milestone } = useLevelMilestoneForUser(gamification?.currentLevel);

  return {
    title: milestone?.milestoneName || `Niveau ${gamification?.currentLevel || 1}`,
    description: milestone?.milestoneDescription || '',
    level: gamification?.currentLevel || 1
  };
}

export function useAllLevelMilestones() {
  return useQuery({
    queryKey: ['all-level-milestones'],
    queryFn: () => gamificationService.getAllLevelMilestones(),
    staleTime: 60 * 60 * 1000
  });
}

/**
 * Hook to get all level milestones with gendered titles and descriptions
 * Automatically uses the user's gender to return appropriate content
 */
export function useAllLevelMilestonesForUser() {
  const { data: session } = useQuery({
    queryKey: ['session'],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    }
  });

  return useQuery({
    queryKey: ['all-level-milestones-gendered', session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return [];
      return gamificationService.getAllLevelMilestonesForUser(session.user.id);
    },
    enabled: !!session?.user?.id,
    staleTime: 60 * 60 * 1000
  });
}

export function useWeightUpdateHistory(limit: number = 10) {
  const { data: session } = useQuery({
    queryKey: ['session'],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    }
  });

  return useQuery({
    queryKey: ['weight-update-history', session?.user?.id, limit],
    queryFn: async () => {
      if (!session?.user?.id) throw new Error('No user');
      return gamificationService.getWeightUpdateHistory(session.user.id, limit);
    },
    enabled: !!session?.user?.id,
    staleTime: 2 * 60 * 1000
  });
}

export function useXpStats(days: number = 30) {
  const { data: session } = useQuery({
    queryKey: ['session'],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    }
  });

  return useQuery({
    queryKey: ['xp-stats', session?.user?.id, days],
    queryFn: async () => {
      if (!session?.user?.id) throw new Error('No user');
      return gamificationService.getXpStats(session.user.id, days);
    },
    enabled: !!session?.user?.id,
    staleTime: 10 * 60 * 1000
  });
}

export function useUpdateWeight() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      newWeight,
      updatedFrom,
      objective
    }: {
      newWeight: number;
      updatedFrom: 'dashboard_gaming' | 'profile' | 'body_scan';
      objective?: 'fat_loss' | 'muscle_gain' | 'recomp';
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) throw new Error('No user');

      return gamificationService.updateWeight(
        session.user.id,
        newWeight,
        updatedFrom,
        objective
      );
    },
    onSuccess: async (data) => {
      // Mark action as completed in daily_actions_completion
      try {
        await supabase.rpc('mark_daily_action_completed_v2', {
          p_action_id: 'weight-update-weekly',
          p_xp_earned: data.xpResult.xpAwarded,
        });
      } catch (error) {
        console.warn('Failed to mark weight update action as completed:', error);
      }

      // Invalidate React Query caches
      queryClient.refetchQueries({ queryKey: ['gamification-progress'], type: 'active' });
      queryClient.refetchQueries({ queryKey: ['xp-events'], type: 'active' });
      queryClient.invalidateQueries({ queryKey: ['weight-update-history'] });
      queryClient.invalidateQueries({ queryKey: ['xp-stats'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['body-scan'] });
      queryClient.refetchQueries({ queryKey: ['daily-actions'], type: 'active' });
      queryClient.refetchQueries({ queryKey: ['weekly-actions-availability'], type: 'active' });

      // CRITICAL: Manually refresh userStore profile to sync with database
      const { useUserStore } = await import('@/system/store/userStore');
      const { fetchProfile } = useUserStore.getState();
      await fetchProfile();
    }
  });
}

export function useAwardMealScanXp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (mealData?: Record<string, any>) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) throw new Error('No user');

      return gamificationService.awardMealScanXp(session.user.id, mealData);
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['gamification-progress'], type: 'active' });
      queryClient.refetchQueries({ queryKey: ['xp-events'], type: 'active' });
    }
  });
}

export function useAwardCalorieGoalMetXp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (calorieData: Record<string, any>) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) throw new Error('No user');

      return gamificationService.awardCalorieGoalMetXp(session.user.id, calorieData);
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['gamification-progress'], type: 'active' });
      queryClient.refetchQueries({ queryKey: ['xp-events'], type: 'active' });
    }
  });
}

export function useAwardTrainingSessionXp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sessionData: Record<string, any>) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) throw new Error('No user');

      return gamificationService.awardTrainingSessionXp(session.user.id, sessionData);
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['gamification-progress'], type: 'active' });
      queryClient.refetchQueries({ queryKey: ['xp-events'], type: 'active' });
    }
  });
}

export function useAwardBodyScanXp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (scanData?: Record<string, any>) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) throw new Error('No user');

      // Award XP for body scan
      const result = await gamificationService.awardBodyScanXp(session.user.id, scanData);

      // Mark action as completed in daily_actions_completion
      try {
        await supabase.rpc('mark_daily_action_completed_v2', {
          p_action_id: 'body-scan',
          p_xp_earned: result.xpAwarded,
        });
      } catch (error) {
        console.warn('Failed to mark body scan action as completed:', error);
      }

      return result;
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['gamification-progress'], type: 'active' });
      queryClient.refetchQueries({ queryKey: ['xp-events'], type: 'active' });
      queryClient.refetchQueries({ queryKey: ['daily-actions'], type: 'active' });
      queryClient.refetchQueries({ queryKey: ['weekly-actions-availability'], type: 'active' });
    }
  });
}

export function useAwardFastingProtocolXp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (fastingData: Record<string, any>) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) throw new Error('No user');

      return gamificationService.awardFastingProtocolXp(session.user.id, fastingData);
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['gamification-progress'], type: 'active' });
      queryClient.refetchQueries({ queryKey: ['xp-events'], type: 'active' });
    }
  });
}

export function useAwardWearableSyncXp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) throw new Error('No user');

      return gamificationService.awardWearableSyncXp(session.user.id);
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['gamification-progress'], type: 'active' });
      queryClient.refetchQueries({ queryKey: ['xp-events'], type: 'active' });
    }
  });
}

export function useAwardActivityXp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (activityData: {
      activityId: string;
      type: string;
      duration: number;
      calories: number;
      intensity: string;
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) throw new Error('No user');

      const XP_AMOUNT = 20;

      return gamificationService.awardXp(
        session.user.id,
        'activity_logged',
        'training',
        XP_AMOUNT,
        {
          activity_id: activityData.activityId,
          activity_type: activityData.type,
          duration_min: activityData.duration,
          calories_est: activityData.calories,
          intensity: activityData.intensity
        }
      );
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['gamification-progress'], type: 'active' });
      queryClient.refetchQueries({ queryKey: ['xp-events'], type: 'active' });
      queryClient.refetchQueries({ queryKey: ['daily-actions'], type: 'active' });
    }
  });
}
