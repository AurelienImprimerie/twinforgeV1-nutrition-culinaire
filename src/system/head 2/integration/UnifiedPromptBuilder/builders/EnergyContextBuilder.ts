import type { UserKnowledge } from '../../../types';

export class EnergyContextBuilder {
  buildEnergyContext(user: UserKnowledge): string[] {
    const parts: string[] = [];

    if (!user.energy || !user.energy.hasData) {
      return parts;
    }

    parts.push('\n### ⚡ ÉNERGIE & BIOMÉTRIE');

    if (user.energy.hasWearableConnected) {
      parts.push(`💪 Wearable connecté: ${user.energy.connectedDevices[0]?.deviceName || 'Oui'}`);
    }

    if (user.energy.biometrics.hrResting || user.energy.biometrics.hrMax) {
      parts.push('❤️ Fréquence cardiaque:');
      if (user.energy.biometrics.hrResting) {
        const hrRestingStatus = user.energy.biometrics.hrResting < 60 ? '(excellent)' :
                                user.energy.biometrics.hrResting < 70 ? '(bon)' : '(normal)';
        parts.push(`  - Repos: ${user.energy.biometrics.hrResting} bpm ${hrRestingStatus}`);
      }
      if (user.energy.biometrics.hrMax) {
        parts.push(`  - Max observée: ${user.energy.biometrics.hrMax} bpm`);
      }
      if (user.energy.biometrics.hrAvg) {
        parts.push(`  - Moyenne effort: ${user.energy.biometrics.hrAvg} bpm`);
      }
    }

    if (user.energy.biometrics.hrvAvg) {
      const hrvStatus = user.energy.biometrics.hrvAvg > 70 ? '(excellente récupération)' :
                       user.energy.biometrics.hrvAvg > 50 ? '(bonne récupération)' :
                       user.energy.biometrics.hrvAvg > 30 ? '(récupération moyenne)' : '(fatigue détectée)';
      parts.push(`🫀 HRV moyen: ${user.energy.biometrics.hrvAvg} ms ${hrvStatus}`);
    }

    if (user.energy.biometrics.vo2maxEstimated) {
      const vo2Status = user.energy.biometrics.vo2maxEstimated > 50 ? '(niveau excellent)' :
                       user.energy.biometrics.vo2maxEstimated > 40 ? '(niveau bon)' :
                       user.energy.biometrics.vo2maxEstimated > 30 ? '(niveau moyen)' : '(niveau à améliorer)';
      parts.push(`🏃 VO2max estimé: ${user.energy.biometrics.vo2maxEstimated} ml/kg/min ${vo2Status}`);
    }

    const recoveryEmoji = user.energy.recoveryScore >= 70 ? '💚' :
                          user.energy.recoveryScore >= 50 ? '🟡' : '🔴';
    const fatigueEmoji = user.energy.fatigueScore <= 30 ? '💚' :
                        user.energy.fatigueScore <= 60 ? '🟡' : '🔴';

    parts.push(`${recoveryEmoji} Score récupération: ${user.energy.recoveryScore}/100`);
    parts.push(`${fatigueEmoji} Score fatigue: ${user.energy.fatigueScore}/100`);

    if (user.energy.fatigueScore > 70) {
      parts.push('⚠️ ALERTE: Fatigue élevée détectée - recommande repos ou séance légère');
    } else if (user.energy.recoveryScore < 30) {
      parts.push('⚠️ ALERTE: Récupération faible - propose étirements ou mobilité');
    } else if (user.energy.recoveryScore >= 80 && user.energy.fatigueScore <= 30) {
      parts.push('✅ OPTIMAL: Forme excellente - parfait pour pousser intensité');
    }

    if (user.energy.trainingLoad7d > 0) {
      const loadStatus = user.energy.trainingLoad7d > 2000 ? 'très élevée' :
                        user.energy.trainingLoad7d > 1500 ? 'élevée' :
                        user.energy.trainingLoad7d > 1000 ? 'modérée' : 'légère';
      const loadEmoji = user.energy.trainingLoad7d > 2000 ? '🔥' :
                       user.energy.trainingLoad7d > 1000 ? '💪' : '📊';
      parts.push(`${loadEmoji} Charge d'entraînement 7j: ${user.energy.trainingLoad7d} (${loadStatus})`);

      if (user.energy.trainingLoad7d > 2500) {
        parts.push('⚠️ Charge très élevée - surveille les signes de surentraînement');
      }
    }

    if (user.energy.recentActivities.length > 0) {
      const lastActivityDate = user.energy.lastActivityDate
        ? new Date(user.energy.lastActivityDate).toLocaleDateString('fr-FR')
        : 'N/A';
      parts.push(`📱 Activités récentes: ${user.energy.recentActivities.length} (dernière: ${lastActivityDate})`);

      parts.push('\n🏃 Dernières activités enregistrées:');
      user.energy.recentActivities.slice(0, 5).forEach((activity, idx) => {
        const activityDate = new Date(activity.timestamp).toLocaleDateString('fr-FR', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        const statusEmoji = activity.wearableDeviceId ? '⌚' : '✍️';
        parts.push(`  ${idx + 1}. ${statusEmoji} ${activity.discipline} - ${activityDate}`);
        parts.push(`     Durée: ${activity.duration}min | Calories: ${activity.caloriesBurned} kcal`);

        if (activity.intensity) {
          const intensityMap = { low: 'Faible', medium: 'Modérée', high: 'Élevée', very_high: 'Très élevée' };
          parts.push(`     Intensité: ${intensityMap[activity.intensity] || activity.intensity}`);
        }

        if (activity.distance) {
          const distanceKm = (activity.distance / 1000).toFixed(2);
          parts.push(`     Distance: ${distanceKm} km`);
        }

        if (activity.hrAvg) {
          parts.push(`     FC moyenne: ${activity.hrAvg} bpm`);
          if (activity.hrMax) {
            parts.push(`     FC max: ${activity.hrMax} bpm`);
          }
        }

        if (activity.notes) {
          const notesPreview = activity.notes.length > 100
            ? activity.notes.substring(0, 100) + '...'
            : activity.notes;
          parts.push(`     Notes: ${notesPreview}`);
        }
      });
    }

    if (user.energy.activityAnalyses && user.energy.activityAnalyses.hasData) {
      parts.push('\n🤖 Analyses IA des Activités:');
      const analyses = user.energy.activityAnalyses;
      const lastAnalysisDate = analyses.lastAnalysisDate
        ? new Date(analyses.lastAnalysisDate).toLocaleDateString('fr-FR')
        : 'N/A';
      parts.push(`  • Analyses totales: ${analyses.analysisCount} (dernière: ${lastAnalysisDate})`);
      parts.push(`  • Taux de succès: ${analyses.successRate}%`);

      if (analyses.recentAnalyses.length > 0) {
        parts.push('\n  📊 Dernières analyses:');
        analyses.recentAnalyses.slice(0, 3).forEach((analysis, idx) => {
          const date = new Date(analysis.createdAt).toLocaleDateString('fr-FR');
          const typeMap = {
            activity_analysis: 'Analyse complète',
            trend_analysis: 'Analyse de tendance',
            activity_transcription: 'Transcription vocale'
          };
          parts.push(`    ${idx + 1}. ${typeMap[analysis.analysisType]} - ${date}`);

          if (analysis.resultPayload && analysis.status === 'completed') {
            if (analysis.resultPayload.insights) {
              const insights = Array.isArray(analysis.resultPayload.insights)
                ? analysis.resultPayload.insights.slice(0, 2).join(', ')
                : String(analysis.resultPayload.insights).substring(0, 100);
              parts.push(`       → ${insights}`);
            }
            if (analysis.resultPayload.recommendations) {
              const reco = Array.isArray(analysis.resultPayload.recommendations)
                ? analysis.resultPayload.recommendations[0]
                : String(analysis.resultPayload.recommendations).substring(0, 80);
              parts.push(`       💡 ${reco}`);
            }
          }
        });
      }
    }

    return parts;
  }
}
