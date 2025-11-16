import type { BrainContext } from '../../../types';
import { TrainingContextBuilder } from './TrainingContextBuilder';
import { NutritionContextBuilder } from './NutritionContextBuilder';
import { EnergyContextBuilder } from './EnergyContextBuilder';
import { BodyScanContextBuilder } from './BodyScanContextBuilder';
import { TemporalContextBuilder } from './TemporalContextBuilder';

export class UserKnowledgeSummaryBuilder {
  private trainingBuilder = new TrainingContextBuilder();
  private nutritionBuilder = new NutritionContextBuilder();
  private energyBuilder = new EnergyContextBuilder();
  private bodyScanBuilder = new BodyScanContextBuilder();
  private temporalBuilder = new TemporalContextBuilder();

  buildUserKnowledgeSummary(context: BrainContext): string {
    const user = context.user;
    const parts: string[] = [];

    if (user.profile.displayName) {
      parts.push(`Nom: ${user.profile.displayName}`);
    }
    if (user.profile.age) {
      parts.push(`Âge: ${user.profile.age} ans`);
    }
    if (user.profile.weight && user.profile.height) {
      const bmi = (user.profile.weight / Math.pow(user.profile.height / 100, 2)).toFixed(1);
      parts.push(`Morphologie: ${user.profile.height}cm, ${user.profile.weight}kg (IMC: ${bmi})`);
    }
    if (user.profile.objectives.length > 0) {
      parts.push(`Objectifs: ${user.profile.objectives.join(', ')}`);
    }
    if (user.profile.preferredDisciplines.length > 0) {
      parts.push(`Disciplines préférées: ${user.profile.preferredDisciplines.join(', ')}`);
    }
    if (user.profile.level) {
      parts.push(`Niveau: ${user.profile.level}`);
    }

    parts.push(...this.trainingBuilder.buildTrainingContext(user));

    if (user.equipment.locations.length > 0) {
      parts.push('\n### ÉQUIPEMENT');
      parts.push(`Lieux d'entraînement: ${user.equipment.locations.length}`);
      parts.push(`Équipements disponibles: ${user.equipment.availableEquipment.length} types`);
      if (user.equipment.defaultLocationId) {
        const defaultLoc = user.equipment.locations.find(l => l.id === user.equipment.defaultLocationId);
        if (defaultLoc) {
          parts.push(`Lieu par défaut: ${defaultLoc.name}`);
        }
      }
    }

    parts.push(...this.nutritionBuilder.buildNutritionContext(user));

    if (user.fasting.hasData) {
      parts.push('\n### JEÛNE INTERMITTENT');
      if (user.fasting.currentSession) {
        parts.push(`Jeûne en cours: ${user.fasting.currentSession.actualDuration}h/${user.fasting.currentSession.targetDuration}h (${user.fasting.currentSession.protocol})`);
      }
      if (user.fasting.totalSessionsCompleted > 0) {
        parts.push(`Sessions complétées: ${user.fasting.totalSessionsCompleted}`);
      }
      if (user.fasting.averageFastingDuration > 0) {
        parts.push(`Durée moyenne: ${user.fasting.averageFastingDuration}h`);
      }
      if (user.fasting.preferredProtocol) {
        parts.push(`Protocole préféré: ${user.fasting.preferredProtocol}`);
      }
    }

    parts.push(...this.bodyScanBuilder.buildBodyScanContext(user));
    parts.push(...this.energyBuilder.buildEnergyContext(user));
    parts.push(...this.temporalBuilder.buildTemporalContext(user));

    // Absence data
    if (user.absence && user.absence.hasData) {
      parts.push('\n### ABSENCE ET RÉCONCILIATION');

      if (user.absence.hasActiveAbsence && user.absence.currentAbsence) {
        parts.push(`⚠️ ABSENCE ACTIVE: ${user.absence.currentAbsence.daysAbsent} jours`);
        parts.push(`   Date début: ${new Date(user.absence.currentAbsence.startDate).toLocaleDateString('fr-FR')}`);
        parts.push(`   XP estimé: ${user.absence.currentAbsence.estimatedXp} points`);
      }

      if (user.absence.pendingRewards.totalPendingXp > 0) {
        parts.push(`💎 XP EN ATTENTE: ${user.absence.pendingRewards.totalPendingXp} points (${user.absence.pendingRewards.rewardsCount} récompense(s))`);

        if (user.absence.pendingRewards.expiringRewardsCount > 0) {
          parts.push(`   ⚠️ ${user.absence.pendingRewards.expiringRewardsCount} récompense(s) expire(nt) dans les 7 prochains jours`);
        }

        if (user.absence.pendingRewards.oldestRewardDate) {
          const daysPending = Math.floor(
            (Date.now() - new Date(user.absence.pendingRewards.oldestRewardDate).getTime()) / (24 * 60 * 60 * 1000)
          );
          parts.push(`   Plus ancien: ${daysPending} jour(s)`);
        }
      }

      if (user.absence.recentReconciliation && user.absence.recentReconciliation.hasRecent) {
        const recon = user.absence.recentReconciliation;
        parts.push(`✅ RÉCONCILIATION RÉCENTE (${new Date(recon.reconciliationDate!).toLocaleDateString('fr-FR')})`);
        parts.push(`   Delta poids: ${recon.weightDelta > 0 ? '+' : ''}${recon.weightDelta.toFixed(1)}kg`);
        parts.push(`   XP attribué: ${recon.awardedXp} points`);
        parts.push(`   Score cohérence: ${(recon.coherenceScore * 100).toFixed(0)}%`);

        if (recon.wasPositiveProgress) {
          parts.push(`   ✨ Progrès positif détecté`);
        }
      }

      if (user.absence.absenceHistory.totalAbsences90Days > 0) {
        const history = user.absence.absenceHistory;
        parts.push(`📊 HISTORIQUE (90 jours): ${history.totalAbsences90Days} absence(s)`);
        parts.push(`   Durée moyenne: ${history.averageAbsenceDuration} jour(s)`);
        parts.push(`   Plus longue: ${history.longestAbsence} jour(s)`);
      }

      if (user.absence.recoveryStatus) {
        const recovery = user.absence.recoveryStatus;
        const alerts: string[] = [];

        if (recovery.needsWeightUpdate) {
          alerts.push(`poids (${recovery.daysSinceLastWeight}j)`);
        }
        if (recovery.needsBodyScan) {
          alerts.push(`body scan (${recovery.daysSinceLastScan || '?'}j)`);
        }

        if (alerts.length > 0) {
          parts.push(`🔔 MISES À JOUR RECOMMANDÉES: ${alerts.join(', ')}`);
        }
      }
    }

    return parts.join('\n');
  }
}
