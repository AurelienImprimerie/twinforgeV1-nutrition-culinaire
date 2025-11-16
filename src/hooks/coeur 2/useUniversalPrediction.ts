import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/system/supabase/client';
import { gamificationUniversalPredictionService } from '@/services/dashboard/coeur';
import type { UniversalPrediction } from '@/services/dashboard/coeur';

export function useUniversalPrediction() {
  const { data: session } = useQuery({
    queryKey: ['session'],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    },
  });

  return useQuery<UniversalPrediction | null>({
    queryKey: ['universal-prediction', session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) throw new Error('No user');
      return gamificationUniversalPredictionService.calculateUniversalPrediction(session.user.id);
    },
    enabled: !!session?.user?.id,
    staleTime: 10 * 60 * 1000, // 10 minutes
    refetchInterval: false,
    refetchOnWindowFocus: false,
  });
}
