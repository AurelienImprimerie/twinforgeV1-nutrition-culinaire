export interface StreakMultipliers {
  threshold30: number;
  threshold14: number;
  threshold7: number;
  threshold3: number;
  default: number;
}

export const STREAK_MULTIPLIERS: StreakMultipliers = {
  threshold30: 3.0,
  threshold14: 2.5,
  threshold7: 2.0,
  threshold3: 1.5,
  default: 1.0
};

export interface ConfidenceColor {
  bg: string;
  text: string;
}

export const CONFIDENCE_COLORS: Record<'low' | 'medium' | 'high', ConfidenceColor> = {
  low: { bg: '#EF4444', text: 'Faible' },
  medium: { bg: '#F59E0B', text: 'Moyen' },
  high: { bg: '#10B981', text: 'Élevé' }
};
