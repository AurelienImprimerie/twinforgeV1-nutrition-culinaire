import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/system/supabase/client';
import { transformationPredictionService } from '@/services/dashboard/coeur/TransformationPredictionService';
import type {
  TransformationPrediction,
  PredictionMilestone
} from '@/services/dashboard/coeur/TransformationPredictionService';

export function useActivePrediction() {
  const { data: session } = useQuery({
    queryKey: ['session'],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    }
  });

  return useQuery({
    queryKey: ['active-prediction', session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) throw new Error('No user');
      return transformationPredictionService.getActivePrediction(session.user.id);
    },
    enabled: !!session?.user?.id,
    staleTime: 15 * 60 * 1000,
    refetchInterval: false,
    refetchOnWindowFocus: false
  });
}

export function usePredictionHistory(limit: number = 10) {
  const { data: session } = useQuery({
    queryKey: ['session'],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    }
  });

  return useQuery({
    queryKey: ['prediction-history', session?.user?.id, limit],
    queryFn: async () => {
      if (!session?.user?.id) throw new Error('No user');
      return transformationPredictionService.getPredictionHistory(session.user.id, limit);
    },
    enabled: !!session?.user?.id,
    staleTime: 10 * 60 * 1000
  });
}

export function usePredictionMilestones(predictionId?: string) {
  return useQuery({
    queryKey: ['prediction-milestones', predictionId],
    queryFn: async () => {
      if (!predictionId) return [];
      return transformationPredictionService.getPredictionMilestones(predictionId);
    },
    enabled: !!predictionId,
    staleTime: 5 * 60 * 1000
  });
}

export function useGeneratePrediction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.data.session?.user?.id) throw new Error('No user');

      return transformationPredictionService.generatePrediction(session.data.session.user.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-prediction'] });
      queryClient.invalidateQueries({ queryKey: ['prediction-history'] });
      queryClient.invalidateQueries({ queryKey: ['prediction-milestones'] });
    }
  });
}

export function useUpdateMilestoneStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      currentWeight,
      targetWeight
    }: {
      currentWeight: number;
      targetWeight: number;
    }) => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.data.session?.user?.id) throw new Error('No user');

      return transformationPredictionService.updateMilestoneStatus(
        session.data.session.user.id,
        currentWeight,
        targetWeight
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prediction-milestones'] });
      queryClient.invalidateQueries({ queryKey: ['active-prediction'] });
    }
  });
}
