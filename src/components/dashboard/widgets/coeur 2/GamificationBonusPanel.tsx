/**
 * GamificationBonusPanel - Sprint 4
 *
 * Affiche les bonus XP actifs, progression vers bonus, et historique
 */

import { useQuery } from '@tanstack/react-query';
import { Clock, Trophy, TrendingUp, Star, Award, Calendar } from 'lucide-react';
import { bonusXpCalculator } from '@/services/dashboard/coeur';
import { useUserStore } from '@/system/store/userStore';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface BonusProgressProps {
  rule: any;
  currentProgress: number;
  requiredProgress: number;
  message: string;
  eligible: boolean;
}

const BonusProgressCard = ({ rule, currentProgress, requiredProgress, message, eligible }: BonusProgressProps) => {
  const progressPercentage = Math.min((currentProgress / requiredProgress) * 100, 100);

  return (
    <div className="glass-card p-4 hover:glass-card-hover transition-all">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-lg ${eligible ? 'bg-green-500/20' : 'bg-blue-500/20'}`}>
            {eligible ? <Trophy className="w-5 h-5 text-green-400" /> : <Star className="w-5 h-5 text-blue-400" />}
          </div>
          <div>
            <h4 className="font-medium text-white">{rule.rule_name}</h4>
            <p className="text-sm text-gray-400">{rule.description}</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-amber-400">+{rule.xp_reward} points</div>
          <div className="text-xs text-gray-400 capitalize">{rule.period}</div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">{message}</span>
          <span className={`font-medium ${eligible ? 'text-green-400' : 'text-blue-400'}`}>
            {progressPercentage.toFixed(0)}%
          </span>
        </div>
        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${
              eligible
                ? 'bg-gradient-to-r from-green-500 to-emerald-400'
                : 'bg-gradient-to-r from-blue-500 to-cyan-400'
            }`}
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
        {eligible && (
          <div className="flex items-center gap-2 text-green-400 text-sm font-medium mt-2">
            <Award className="w-4 h-4" />
            <span>Éligible ! Bonus attribué automatiquement</span>
          </div>
        )}
      </div>
    </div>
  );
};

const BonusHistoryItem = ({ bonus }: { bonus: any }) => {
  const awardedDate = new Date(bonus.awarded_at);
  const timeAgo = formatDistanceToNow(awardedDate, { addSuffix: true, locale: fr });

  return (
    <div className="flex items-center justify-between p-3 glass-card-subtle hover:glass-card-hover transition-all">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-amber-500/20">
          <Trophy className="w-4 h-4 text-amber-400" />
        </div>
        <div>
          <div className="font-medium text-white text-sm">{bonus.rule_name}</div>
          <div className="text-xs text-gray-400">
            {new Date(bonus.period_start).toLocaleDateString('fr-FR')} -{' '}
            {new Date(bonus.period_end).toLocaleDateString('fr-FR')}
          </div>
        </div>
      </div>
      <div className="text-right">
        <div className="text-amber-400 font-bold">+{bonus.xp_awarded} points</div>
        <div className="text-xs text-gray-500">{timeAgo}</div>
      </div>
    </div>
  );
};

export const GamificationBonusPanel = () => {
  const userId = useUserStore((state) => state.user?.id);

  const { data: dailyBonuses, isLoading: dailyLoading } = useQuery({
    queryKey: ['bonus-progress', 'daily', userId],
    queryFn: async () => {
      if (!userId) return [];

      const rules = await bonusXpCalculator.getActiveRules('daily');
      const today = new Date();
      const startDate = today.toISOString().split('T')[0];
      const endDate = startDate;

      const bonuses = await Promise.all(
        rules.map((rule) => bonusXpCalculator.calculateBonusProgress(userId, rule, startDate, endDate))
      );

      return bonuses;
    },
    enabled: !!userId,
    refetchInterval: 60000,
  });

  const { data: weeklyBonuses, isLoading: weeklyLoading } = useQuery({
    queryKey: ['bonus-progress', 'weekly', userId],
    queryFn: async () => {
      if (!userId) return [];

      const rules = await bonusXpCalculator.getActiveRules('weekly');
      const today = new Date();
      const weekStart = new Date(today);
      weekStart.setDate(weekStart.getDate() - 7);
      const startDate = weekStart.toISOString().split('T')[0];
      const endDate = today.toISOString().split('T')[0];

      const bonuses = await Promise.all(
        rules.map((rule) => bonusXpCalculator.calculateBonusProgress(userId, rule, startDate, endDate))
      );

      return bonuses;
    },
    enabled: !!userId,
    refetchInterval: 300000,
  });

  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ['bonus-history', userId],
    queryFn: async () => {
      if (!userId) return [];
      return bonusXpCalculator.getBonusHistory(userId, 10);
    },
    enabled: !!userId,
    refetchInterval: 300000,
  });

  if (!userId) {
    return null;
  }

  const isLoading = dailyLoading || weeklyLoading || historyLoading;

  if (isLoading) {
    return (
      <div className="glass-card p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-700 rounded w-1/3" />
          <div className="h-20 bg-gray-700 rounded" />
          <div className="h-20 bg-gray-700 rounded" />
        </div>
      </div>
    );
  }

  const eligibleDaily = dailyBonuses?.filter((b) => b.eligible) || [];
  const eligibleWeekly = weeklyBonuses?.filter((b) => b.eligible) || [];
  const totalEligibleXp =
    eligibleDaily.reduce((sum, b) => sum + b.rule.xp_reward, 0) +
    eligibleWeekly.reduce((sum, b) => sum + b.rule.xp_reward, 0);

  return (
    <div className="space-y-6">
      {totalEligibleXp > 0 && (
        <div className="glass-card p-6 bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-amber-500/20">
          <div className="flex items-center gap-4">
            <div className="p-4 rounded-xl bg-amber-500/20">
              <Award className="w-8 h-8 text-amber-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-white mb-1">Bonus Points Disponibles</h3>
              <p className="text-gray-300">
                Vous êtes éligible pour <span className="text-amber-400 font-bold">+{totalEligibleXp} points</span> de
                bonus
              </p>
            </div>
            <TrendingUp className="w-6 h-6 text-amber-400" />
          </div>
        </div>
      )}

      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-blue-400" />
          <h3 className="text-lg font-bold text-white">Bonus Quotidiens</h3>
        </div>

        {!dailyBonuses || dailyBonuses.length === 0 ? (
          <p className="text-gray-400 text-sm">Aucun bonus quotidien configuré</p>
        ) : (
          <div className="space-y-3">
            {dailyBonuses.map((bonus, idx) => (
              <BonusProgressCard
                key={idx}
                rule={bonus.rule}
                currentProgress={bonus.currentProgress}
                requiredProgress={bonus.requiredProgress}
                message={bonus.message}
                eligible={bonus.eligible}
              />
            ))}
          </div>
        )}
      </div>

      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-5 h-5 text-purple-400" />
          <h3 className="text-lg font-bold text-white">Bonus Hebdomadaires</h3>
        </div>

        {!weeklyBonuses || weeklyBonuses.length === 0 ? (
          <p className="text-gray-400 text-sm">Aucun bonus hebdomadaire configuré</p>
        ) : (
          <div className="space-y-3">
            {weeklyBonuses.map((bonus, idx) => (
              <BonusProgressCard
                key={idx}
                rule={bonus.rule}
                currentProgress={bonus.currentProgress}
                requiredProgress={bonus.requiredProgress}
                message={bonus.message}
                eligible={bonus.eligible}
              />
            ))}
          </div>
        )}
      </div>

      {history && history.length > 0 && (
        <div className="glass-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="w-5 h-5 text-amber-400" />
            <h3 className="text-lg font-bold text-white">Historique des Bonus</h3>
          </div>
          <div className="space-y-2">
            {history.map((bonus) => (
              <BonusHistoryItem key={bonus.id} bonus={bonus} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
