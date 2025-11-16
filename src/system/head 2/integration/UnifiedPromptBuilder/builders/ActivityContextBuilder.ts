import type { BrainContext, TodayData } from '../../../types';

export class ActivityContextBuilder {
  buildActivityContext(context: BrainContext): string {
    const parts: string[] = [];

    parts.push(`Page actuelle: ${context.app.pageContext.type}`);
    if (context.app.pageContext.subContext) {
      parts.push(`Sous-contexte: ${context.app.pageContext.subContext}`);
    }
    parts.push(`État d'activité: ${context.app.activityState}`);

    if (context.session.isActive) {
      parts.push(`Session active: ${context.session.sessionType}`);
    }

    const todayData = context.todayData;
    if (todayData) {
      parts.push('\n### ACTIVITÉS DU JOUR');

      if (todayData.hasTraining) {
        parts.push(`Entraînements: ${todayData.trainingSessions.length}`);
        todayData.trainingSessions.forEach(session => {
          parts.push(`  - ${session.discipline} (${session.status}, ${session.exerciseCount} exercices)`);
        });
      }

      if (todayData.hasNutrition) {
        const totalCalories = todayData.meals.reduce((sum, m) => sum + m.calories, 0);
        const totalProtein = todayData.meals.reduce((sum, m) => sum + m.protein, 0);
        parts.push(`Nutrition: ${todayData.meals.length} repas (${Math.round(totalCalories)} kcal, ${Math.round(totalProtein)}g protéines)`);
      }

      if (todayData.hasFasting && todayData.fastingSession) {
        parts.push(`Jeûne en cours: ${todayData.fastingSession.currentDuration}h/${todayData.fastingSession.targetDuration}h`);
      }

      if (todayData.hasBodyScan) {
        parts.push(`Scans corporels: ${todayData.bodyScans.length}`);
      }

      if (todayData.totalActivities === 0) {
        parts.push('Aucune activité enregistrée aujourd\'hui');
      }
    }

    return parts.join('\n');
  }
}
