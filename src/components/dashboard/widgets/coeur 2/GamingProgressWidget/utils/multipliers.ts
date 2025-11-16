import { STREAK_MULTIPLIERS } from '../types';

export function calculateStreakMultiplier(streakDays: number): number {
  if (streakDays >= 30) return STREAK_MULTIPLIERS.threshold30;
  if (streakDays >= 14) return STREAK_MULTIPLIERS.threshold14;
  if (streakDays >= 7) return STREAK_MULTIPLIERS.threshold7;
  if (streakDays >= 3) return STREAK_MULTIPLIERS.threshold3;
  return STREAK_MULTIPLIERS.default;
}
