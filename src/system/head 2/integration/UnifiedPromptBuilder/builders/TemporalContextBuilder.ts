import type { UserKnowledge } from '../../../types';

export class TemporalContextBuilder {
  buildTemporalContext(user: UserKnowledge): string[] {
    const parts: string[] = [];

    if (!user.temporal || !user.temporal.hasData) {
      return parts;
    }

    parts.push('\n### ⏰ PATTERNS TEMPORELS & PLANIFICATION');

    if (user.temporal.weeklyFrequency > 0) {
      const frequencyStatus = user.temporal.weeklyFrequency >= 5 ? '(très actif)' :
                              user.temporal.weeklyFrequency >= 3 ? '(bon rythme)' :
                              user.temporal.weeklyFrequency >= 2 ? '(modéré)' : '(à augmenter)';
      parts.push(`📊 Fréquence hebdomadaire: ${user.temporal.weeklyFrequency} séances/semaine ${frequencyStatus}`);
    }

    if (user.temporal.preferredTimeOfDay) {
      const timeMap = { morning: 'matin', afternoon: 'après-midi', evening: 'soir' };
      const timeEmoji = { morning: '🌅', afternoon: '☀️', evening: '🌙' };
      parts.push(`${timeEmoji[user.temporal.preferredTimeOfDay]} Horaire préféré: ${timeMap[user.temporal.preferredTimeOfDay]}`);
    }

    if (user.temporal.averageSessionDuration > 0) {
      const durationStatus = user.temporal.averageSessionDuration >= 60 ? '(séances complètes)' :
                             user.temporal.averageSessionDuration >= 45 ? '(durée optimale)' : '(séances courtes)';
      parts.push(`⏱️ Durée moyenne séance: ${user.temporal.averageSessionDuration} min ${durationStatus}`);
    }

    if (user.temporal.consistencyScore > 0) {
      const consistencyEmoji = user.temporal.consistencyScore >= 70 ? '🏆' :
                               user.temporal.consistencyScore >= 50 ? '💪' : '📈';
      const consistencyText = user.temporal.consistencyScore >= 70 ? 'excellente - continue!' :
                              user.temporal.consistencyScore >= 50 ? 'bonne - maintiens le cap' : 'à améliorer - reste régulier';
      parts.push(`${consistencyEmoji} Consistance: ${user.temporal.consistencyScore}/100 (${consistencyText})`);
    }

    if (user.temporal.trainingPatterns.length > 0) {
      const topPattern = user.temporal.trainingPatterns[0];
      const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
      const timeMap = { morning: 'matin', afternoon: 'après-midi', evening: 'soir' };
      parts.push(`📅 Pattern principal: ${dayNames[topPattern.dayOfWeek]} ${timeMap[topPattern.timeOfDay]} (${topPattern.frequency}x)`);

      const now = new Date();
      const currentDay = now.getDay();
      const currentHour = now.getHours();

      if (topPattern.dayOfWeek === currentDay) {
        const isOptimalTime = (topPattern.timeOfDay === 'morning' && currentHour >= 6 && currentHour < 12) ||
                             (topPattern.timeOfDay === 'afternoon' && currentHour >= 12 && currentHour < 17) ||
                             (topPattern.timeOfDay === 'evening' && currentHour >= 17 && currentHour < 22);
        if (isOptimalTime) {
          parts.push('⏰ SUGGESTION: C\'est ton créneau habituel - bon moment pour t\'entraîner!');
        }
      }
    }

    if (user.temporal.restDayPatterns.preferredRestDays.length > 0) {
      const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
      const restDays = user.temporal.restDayPatterns.preferredRestDays
        .map(d => dayNames[d])
        .join(', ');
      parts.push(`😴 Jours de repos habituels: ${restDays}`);
    }

    if (user.temporal.optimalTrainingTimes && user.temporal.optimalTrainingTimes.length > 0) {
      parts.push('\n🎯 Créneaux optimaux détectés:');
      user.temporal.optimalTrainingTimes.slice(0, 3).forEach((optimal, idx) => {
        const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
        const timeMap = { morning: 'matin', afternoon: 'après-midi', evening: 'soir' };
        parts.push(`  ${idx + 1}. ${dayNames[optimal.dayOfWeek]} ${timeMap[optimal.timeOfDay]} (score: ${optimal.score})`);
      });
    }

    return parts;
  }
}
