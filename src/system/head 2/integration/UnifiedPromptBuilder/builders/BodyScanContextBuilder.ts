import type { UserKnowledge } from '../../../types';

export class BodyScanContextBuilder {
  buildBodyScanContext(user: UserKnowledge): string[] {
    const parts: string[] = [];

    if (!user.bodyScan.hasData && !user.profile.hasCompletedBodyScan) {
      return parts;
    }

    parts.push('\n### COMPOSITION CORPORELLE');

    if (user.profile.hasCompletedBodyScan) {
      parts.push(`🎯 Scan corporel complet: Réalisé`);
    }

    if (user.bodyScan.recentScans.length > 0) {
      const lastScanDate = user.bodyScan.lastScanDate
        ? new Date(user.bodyScan.lastScanDate).toLocaleDateString('fr-FR')
        : 'N/A';
      parts.push(`📊 Scans récents: ${user.bodyScan.recentScans.length} (dernier: ${lastScanDate})`);
    }

    if (user.bodyScan.latestMeasurements) {
      const m = user.bodyScan.latestMeasurements;
      parts.push('📏 Mesures actuelles:');
      if (m.weight) {
        const weightDiff = user.profile.targetWeight
          ? (m.weight - user.profile.targetWeight).toFixed(1)
          : null;
        parts.push(`  - Poids: ${m.weight}kg${weightDiff ? ` (objectif: ${weightDiff > 0 ? '+' : ''}${weightDiff}kg)` : ''}`);
      }
      if (m.bodyFat) {
        const bfCategory = m.bodyFat < 10 ? 'très faible' :
                          m.bodyFat < 15 ? 'athlétique' :
                          m.bodyFat < 20 ? 'normal' :
                          m.bodyFat < 25 ? 'modéré' : 'élevé';
        parts.push(`  - Masse grasse: ${m.bodyFat}% (${bfCategory})`);
      }
      if (m.muscleMass) parts.push(`  - Masse musculaire: ${m.muscleMass}kg`);
      if (m.waist) parts.push(`  - Tour de taille: ${m.waist}cm`);
      if (m.chest) parts.push(`  - Tour de poitrine: ${m.chest}cm`);
      if (m.arms) parts.push(`  - Tour de bras: ${m.arms}cm`);
      if (m.legs) parts.push(`  - Tour de cuisses: ${m.legs}cm`);
    }

    if (user.bodyScan.progressionTrend) {
      const trendText = user.bodyScan.progressionTrend === 'improving' ? '📈 En amélioration (continue comme ça!)' :
                        user.bodyScan.progressionTrend === 'declining' ? '📉 En baisse (ajuste ton approche)' :
                        '➡️ Stable (maintiens le cap)';
      parts.push(`Tendance: ${trendText}`);
    }

    if (user.profile.objective) {
      const objectiveMap = {
        'fat_loss': 'Tu veux perdre du gras - focus cardio et déficit calorique',
        'muscle_gain': 'Tu veux prendre du muscle - focus force et surplus calorique',
        'recomp': 'Tu veux recomposer ton corps - équilibre force et cardio'
      };
      parts.push(`🎯 Objectif actuel: ${objectiveMap[user.profile.objective] || user.profile.objective}`);
    }

    if (user.bodyScan.morphologyInsights.hasData && user.bodyScan.morphologyInsights.latestInsights.length > 0) {
      parts.push('\n  🧠 Insights Morphologiques IA:');
      const insights = user.bodyScan.morphologyInsights;
      if (insights.summary) {
        const s = insights.summary;
        parts.push(`    • Scores: Morphologie ${(s.morphology_score * 100).toFixed(0)}%, Alignement Objectifs ${(s.goal_alignment * 100).toFixed(0)}%, Santé ${(s.health_indicators * 100).toFixed(0)}%`);
      }

      const highPriorityInsights = insights.latestInsights.filter(i => i.priority === 'high').slice(0, 3);
      if (highPriorityInsights.length > 0) {
        parts.push(`    • Insights prioritaires (${highPriorityInsights.length}):`);
        highPriorityInsights.forEach((insight, idx) => {
          const typeEmoji = insight.type === 'recommendation' ? '💡' :
                            insight.type === 'achievement' ? '🏆' :
                            insight.type === 'goal_progress' ? '🎯' : '📊';
          parts.push(`      ${idx + 1}. ${typeEmoji} ${insight.title}`);
          parts.push(`         ${insight.description.substring(0, 100)}${insight.description.length > 100 ? '...' : ''}`);
          if (insight.actionable) {
            parts.push(`         → Action: ${insight.actionable.action}`);
          }
        });
      }

      if (insights.aiModelsUsed.length > 0) {
        parts.push(`    • Modèle IA: ${insights.aiModelsUsed[0]}`);
      }
    }

    return parts;
  }
}
