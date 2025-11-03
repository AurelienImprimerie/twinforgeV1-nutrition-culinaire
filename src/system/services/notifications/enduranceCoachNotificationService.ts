/**
 * Endurance Coach Notification Service
 * Manages contextual notifications during endurance training sessions
 */

import { useUnifiedCoachStore } from '../../store/unifiedCoachStore';
import type { TrainingNotificationContext } from '../../../domain/trainingCoachNotification';
import logger from '../../../lib/utils/logger';

export class EnduranceCoachNotificationService {
  private sessionId: string | null = null;
  private analysisInProgress: boolean = false;

  initialize(sessionId: string): void {
    this.sessionId = sessionId;
    this.analysisInProgress = false;
    logger.info('ENDURANCE_COACH_NOTIFICATIONS', 'Service initialized', { sessionId });
  }

  cleanup(): void {
    this.sessionId = null;
    this.analysisInProgress = false;
    logger.info('ENDURANCE_COACH_NOTIFICATIONS', 'Service cleaned up');
  }

  setAnalysisInProgress(inProgress: boolean): void {
    this.analysisInProgress = inProgress;
    logger.info('ENDURANCE_COACH_NOTIFICATIONS', 'Analysis status changed', { inProgress });
  }

  private pushNotification(message: string, context?: TrainingNotificationContext, priority: 'high' | 'medium' | 'low' = 'medium'): void {
    if (!this.sessionId) return;

    useUnifiedCoachStore.getState().showNotification(
      'step3-new-exercise',
      message,
      'motivation',
      priority,
      7000,
      '#FF6B35',
      context
    );
  }

  onAnalysisStarted(): void {
    if (!this.sessionId) return;

    this.setAnalysisInProgress(true);

    const messages = [
      '🧠 Analyse de ta performance en cours...',
      '📊 Calcul de tes métriques personnalisées...',
      '⚡ Traitement de tes données...',
    ];

    this.pushNotification(
      messages[Math.floor(Math.random() * messages.length)],
      {},
      'low'
    );
  }

  onAnalysisProgress(progress: number): void {
    if (!this.sessionId || !this.analysisInProgress) return;

    if (progress === 25) {
      this.pushNotification('✨ Analyse à 25% - Évaluation de l\'endurance...', {}, 'low');
    } else if (progress === 50) {
      this.pushNotification('🎯 À mi-chemin ! Analyse de l\'intensité...', {}, 'low');
    } else if (progress === 75) {
      this.pushNotification('🔥 Presque terminé ! Calcul des recommandations...', {}, 'low');
    }
  }

  onAnalysisComplete(): void {
    if (!this.sessionId) return;

    this.setAnalysisInProgress(false);

    const messages = [
      '✅ Analyse complète ! Découvre tes résultats détaillés ci-dessous.',
      '🎉 Résultats prêts ! Scroll pour voir ton analyse personnalisée.',
      '💪 Analyse terminée ! Tes métriques sont disponibles.',
    ];

    this.pushNotification(
      messages[Math.floor(Math.random() * messages.length)],
      {},
      'high'
    );
  }

  onSessionStart(discipline: string): void {
    if (!this.sessionId) return;

    const messages = [
      `C'est parti pour ta séance de ${discipline} ! 🏃`,
      `Allons-y ! Concentre-toi sur ton allure et ta respiration.`,
      `Séance lancée ! Garde une intensité régulière au début.`,
    ];

    this.pushNotification(
      messages[Math.floor(Math.random() * messages.length)],
      { discipline }
    );
  }

  onBlockStart(blockName: string, targetZone: string, context?: TrainingNotificationContext): void {
    if (!this.sessionId) return;

    const messages = [
      `Début du bloc : ${blockName} - Zone ${targetZone}`,
      `Nouveau bloc ! Passe en zone ${targetZone} progressivement.`,
      `${blockName} - Maintiens-toi en ${targetZone} 💪`,
    ];

    this.pushNotification(
      messages[Math.floor(Math.random() * messages.length)],
      { blockName, targetZone, ...context }
    );
  }

  onZoneChange(newZone: string, zoneLabel: string): void {
    if (!this.sessionId) return;

    const messages = [
      `Passage en ${newZone} - ${zoneLabel}`,
      `Ajuste ton allure pour atteindre ${newZone}`,
      `Nouvelle zone : ${newZone} - ${zoneLabel}`,
    ];

    this.pushNotification(
      messages[Math.floor(Math.random() * messages.length)],
      { zone: newZone, zoneLabel }
    );
  }

  onIntervalWork(intervalNumber: number, totalIntervals: number, targetZone: string): void {
    if (!this.sessionId) return;

    const messages = [
      `Intervalle ${intervalNumber}/${totalIntervals} - En ${targetZone} ! 🔥`,
      `C'est parti pour l'effort n°${intervalNumber} ! Donne tout !`,
      `Intervalle ${intervalNumber} - Zone ${targetZone}. Tu gères !`,
    ];

    this.pushNotification(
      messages[Math.floor(Math.random() * messages.length)],
      { intervalNumber, totalIntervals, targetZone }
    );
  }

  onIntervalRest(intervalNumber: number, totalIntervals: number): void {
    if (!this.sessionId) return;

    const messages = [
      `Récup active ! Respire bien, prépare le prochain effort.`,
      `Temps de récup - Ralentis progressivement 💚`,
      `Récupération ${intervalNumber}/${totalIntervals} - Relâche les épaules.`,
    ];

    this.pushNotification(
      messages[Math.floor(Math.random() * messages.length)],
      { intervalNumber, totalIntervals }
    );
  }

  onBlockComplete(blockName: string, context?: TrainingNotificationContext): void {
    if (!this.sessionId) return;

    const messages = [
      `Bloc "${blockName}" terminé ! Bien joué ! ✅`,
      `Excellent ! Tu as complété ${blockName}.`,
      `${blockName} fait ! Continue comme ça 🎯`,
    ];

    this.pushNotification(
      messages[Math.floor(Math.random() * messages.length)],
      { blockName, ...context }
    );
  }

  onSessionPaused(): void {
    if (!this.sessionId) return;

    this.pushNotification(
      `Séance en pause. Reprends dès que tu es prêt !`,
      {}
    );
  }

  onSessionResumed(): void {
    if (!this.sessionId) return;

    this.pushNotification(
      `C'est reparti ! Concentre-toi sur ta respiration.`,
      {}
    );
  }

  onHalfwayPoint(): void {
    if (!this.sessionId) return;

    const messages = [
      `Tu es à mi-chemin ! Continue, tu gères ! 💪`,
      `50% de la séance ! Tu es dans le rythme.`,
      `Moitié faite ! L'autre moitié sera facile maintenant.`,
    ];

    this.pushNotification(
      messages[Math.floor(Math.random() * messages.length)],
      {}
    );
  }

  onFinalStretch(): void {
    if (!this.sessionId) return;

    const messages = [
      `Dernière ligne droite ! Tu y es presque ! 🏁`,
      `Plus que quelques minutes ! Termine en force !`,
      `C'est bientôt fini ! Garde ton allure.`,
    ];

    this.pushNotification(
      messages[Math.floor(Math.random() * messages.length)],
      {}
    );
  }

  onSessionComplete(totalDuration: number, blocksCompleted: number): void {
    if (!this.sessionId) return;

    const messages = [
      `Séance terminée ! Bravo, tu as tout donné ! 🎉`,
      `Excellent travail ! ${blocksCompleted} blocs réalisés avec succès.`,
      `Félicitations ! Séance complétée en ${Math.round(totalDuration / 60)}min.`,
    ];

    this.pushNotification(
      messages[Math.floor(Math.random() * messages.length)],
      { totalDuration, blocksCompleted }
    );
  }

  onEncouragement(): void {
    if (!this.sessionId) return;

    const messages = [
      `Continue comme ça, tu gères parfaitement ! 👏`,
      `Excellente tenue ! Garde le rythme.`,
      `Tu es dans la zone ! Reste concentré.`,
      `Bien joué ! Tu maintiens l'allure.`,
      `Beau boulot ! Continue ainsi.`,
    ];

    this.pushNotification(
      messages[Math.floor(Math.random() * messages.length)],
      {}
    );
  }

  onTechniqueReminder(cue: string): void {
    if (!this.sessionId) return;

    this.pushNotification(
      `💡 Rappel : ${cue}`,
      { cue }
    );
  }
}

export const enduranceCoachNotificationService = new EnduranceCoachNotificationService();
