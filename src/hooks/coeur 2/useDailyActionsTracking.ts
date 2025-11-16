import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/system/supabase/client';
import { useEffect } from 'react';

export interface DailyAction {
  action_id: string;
  completed_at: string;
  xp_earned: number;
  occurrence_number?: number;
  is_first_of_day?: boolean;
}

export interface ActionCompletionResult {
  action_id: string;
  was_newly_completed: boolean;
  xp_awarded: number;
  occurrence_number: number;
  is_first_of_day: boolean;
  total_occurrences_today: number;
}

export interface DailyActionStats {
  action_id: string;
  first_completed_at: string;
  total_occurrences: number;
  xp_earned_total: number;
  is_completed_today: boolean;
}

export interface ActionComboStatus {
  combo_name: string;
  combo_achieved: boolean;
  actions_completed: number;
  actions_required: number;
}

/**
 * Hook to get today's completed actions with realtime updates
 */
export function useTodaysCompletedActions() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['daily-actions', 'today'],
    queryFn: async (): Promise<DailyAction[]> => {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        console.warn('User not authenticated, returning empty actions');
        return [];
      }

      // Use RPC function instead of direct table query
      // This ensures we always get the correct schema regardless of migration state
      const { data, error } = await supabase.rpc('get_todays_completed_actions');

      if (error) {
        console.error('Error fetching today\'s completed actions:', error);

        // Fallback: Try direct query without new columns for backward compatibility
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('daily_actions_completion')
          .select('action_id, completed_at, xp_earned')
          .eq('user_id', user.id)
          .eq('action_date', new Date().toISOString().split('T')[0])
          .order('completed_at', { ascending: true });

        if (fallbackError) {
          console.error('Fallback query also failed:', fallbackError);
          return [];
        }

        // Map to expected format with default values for missing fields
        return (fallbackData || []).map(action => ({
          ...action,
          occurrence_number: 1,
          is_first_of_day: true
        }));
      }

      return data || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];

    const channel = supabase
      .channel('daily-actions-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'daily_actions_completion',
          filter: `action_date=eq.${today}`,
        },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['daily-actions', 'today'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
}

/**
 * Hook to mark an action as completed
 */
export function useMarkActionCompleted() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      actionId,
      xpEarned = 0,
    }: {
      actionId: string;
      xpEarned?: number;
    }): Promise<ActionCompletionResult> => {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('User not authenticated');
      }

      // Use the new database function that supports multiple occurrences
      const { data, error } = await supabase.rpc('mark_daily_action_completed_v2', {
        p_action_id: actionId,
        p_xp_earned: xpEarned,
      });

      if (error) {
        throw error;
      }

      if (!data || data.length === 0) {
        throw new Error('No result returned from marking action as completed');
      }

      const result = data[0];
      return {
        action_id: result.action_id,
        was_newly_completed: result.was_newly_completed,
        xp_awarded: result.xp_awarded,
        occurrence_number: result.occurrence_number,
        is_first_of_day: result.is_first_of_day,
        total_occurrences_today: result.total_occurrences_today,
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['daily-actions', 'today'] });

      if (result.xp_awarded > 0) {
        queryClient.invalidateQueries({ queryKey: ['gamification'] });
        queryClient.invalidateQueries({ queryKey: ['gamification-progress'] });
      }
    },
  });
}

/**
 * Hook to check if a specific action is completed today (at least once)
 */
export function useIsActionCompletedToday(actionId: string) {
  const { data: completedActions = [] } = useTodaysCompletedActions();

  return completedActions.some(action => action.action_id === actionId);
}

/**
 * Hook to get the number of occurrences for a specific action today
 */
export function useActionOccurrenceCount(actionId: string) {
  const { data: completedActions = [] } = useTodaysCompletedActions();

  return completedActions.filter(action => action.action_id === actionId).length;
}

/**
 * Hook to get detailed stats for all actions today
 */
export function useDailyActionStats() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['daily-actions', 'stats', 'today'],
    queryFn: async (): Promise<DailyActionStats[]> => {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        console.warn('User not authenticated, returning empty stats');
        return [];
      }

      const { data, error } = await supabase.rpc('get_daily_action_stats');

      if (error) {
        console.error('Error fetching daily action stats:', error);
        return [];
      }

      return data || [];
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Realtime updates
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];

    const channel = supabase
      .channel('daily-actions-stats-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'daily_actions_completion',
          filter: `action_date=eq.${today}`,
        },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['daily-actions', 'stats', 'today'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
}

/**
 * Hook to check combo status
 */
export function useActionCombo(actionIds: string[]) {
  const query = useQuery({
    queryKey: ['daily-actions', 'combo', actionIds.join(',')],
    queryFn: async (): Promise<ActionComboStatus | null> => {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        return null;
      }

      const { data, error } = await supabase.rpc('check_action_combo', {
        p_action_ids: actionIds,
      });

      if (error) {
        console.error('Error checking action combo:', error);
        return null;
      }

      return data && data.length > 0 ? data[0] : null;
    },
    enabled: actionIds.length > 0,
    staleTime: 1 * 60 * 1000, // 1 minute
  });

  return query;
}

/**
 * Hook to get completion stats for today
 */
export function useTodayCompletionStats() {
  const { data: completedActions = [] } = useTodaysCompletedActions();

  const totalCompleted = completedActions.length;
  const totalXpEarned = completedActions.reduce((sum, action) => sum + action.xp_earned, 0);

  return {
    totalCompleted,
    totalXpEarned,
    completedActions,
  };
}
