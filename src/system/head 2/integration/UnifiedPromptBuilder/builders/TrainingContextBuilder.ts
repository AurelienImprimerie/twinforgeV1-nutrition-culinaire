import type { UserKnowledge } from '../../../types';

export class TrainingContextBuilder {
  buildTrainingContext(user: UserKnowledge): string[] {
    const parts: string[] = [];

    if (!user.training.hasData) {
      return parts;
    }

    parts.push('\n### ENTRAÎNEMENT');

    if (user.training.lastSessionDate) {
      parts.push(`Dernière séance: ${new Date(user.training.lastSessionDate).toLocaleDateString('fr-FR')}`);
    }

    if (user.training.avgRPE > 0) {
      parts.push(`RPE moyen: ${user.training.avgRPE.toFixed(1)}/10`);
    }

    if (user.training.weeklyVolume > 0) {
      parts.push(`Volume hebdomadaire: ${user.training.weeklyVolume} exercices`);
    }

    if (user.training.recentSessions.length > 0) {
      const completedCount = user.training.recentSessions.filter(s => s.completed).length;
      parts.push(`Séances récentes: ${completedCount}/${user.training.recentSessions.length} complétées`);

      const lastSessions = user.training.recentSessions.slice(0, 2);
      lastSessions.forEach((session, idx) => {
        const date = new Date(session.date).toLocaleDateString('fr-FR', { weekday: 'short', month: 'short', day: 'numeric' });
        const statusEmoji = session.completed ? '✅' : '🕒';
        parts.push(`\n${statusEmoji} Séance ${idx + 1}: ${session.sessionName || session.discipline} - ${date}`);
        parts.push(`   Durée: ${session.duration}min | Exercices: ${session.exerciseCount} | RPE: ${session.avgRPE || session.expectedRpe || 'N/A'}`);

        if (session.exercises && session.exercises.length > 0) {
          parts.push(`   Exercices:`);
          session.exercises.slice(0, 3).forEach(ex => {
            const loadStr = Array.isArray(ex.load)
              ? ex.load.join('/')
              : ex.load
              ? `${ex.load}kg`
              : 'poids de corps';
            parts.push(`     • ${ex.name}: ${ex.sets} x ${ex.reps} @ ${loadStr}`);
            if (ex.muscleGroups && ex.muscleGroups.length > 0) {
              parts.push(`       Muscles: ${ex.muscleGroups.slice(0, 2).join(', ')}`);
            }
          });

          if (session.exercises.length > 3) {
            parts.push(`     ... et ${session.exercises.length - 3} autres exercices`);
          }
        }
      });
    }

    if (user.training.personalRecords && user.training.personalRecords.length > 0) {
      parts.push(`\nRecords personnels: ${user.training.personalRecords.length} établis`);
    }

    if (user.training.activeGoals && user.training.activeGoals.length > 0) {
      parts.push(`\nObjectifs actifs: ${user.training.activeGoals.length}`);
      user.training.activeGoals.slice(0, 2).forEach(goal => {
        const progress = goal.currentValue && goal.targetValue
          ? Math.round((goal.currentValue / goal.targetValue) * 100)
          : 0;
        parts.push(`  - ${goal.title}: ${progress}% (${goal.currentValue || 0}/${goal.targetValue} ${goal.unit})`);
      });
    }

    return parts;
  }
}
