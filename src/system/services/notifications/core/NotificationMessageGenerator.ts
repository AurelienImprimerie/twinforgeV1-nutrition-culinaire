/**
 * Notification Message Generator
 * Centralized message generation for all training notifications
 * Consolidates message logic from all step*CoachMessages config files
 */

import type { TrainingNotificationContext } from './TrainingNotificationService';

type MessageTemplate = string | ((context?: TrainingNotificationContext) => string);

interface MessageTemplateConfig {
  templates: MessageTemplate[];
}

/**
 * Interpolate context variables into message template
 */
function interpolate(template: string, context?: TrainingNotificationContext): string {
  if (!context) return template;

  return template
    .replace(/{exerciseName}/g, context.exerciseName || '')
    .replace(/{exerciseVariant}/g, context.exerciseVariant || '')
    .replace(/{currentSet}/g, context.currentSet?.toString() || '')
    .replace(/{totalSets}/g, context.totalSets?.toString() || '')
    .replace(/{sets}/g, (context as any).sets?.toString() || '')
    .replace(/{reps}/g, (context as any).reps?.toString() || '')
    .replace(/{load}/g, context.load?.toString() || '')
    .replace(/{oldLoad}/g, context.oldLoad?.toString() || '')
    .replace(/{newLoad}/g, context.newLoad?.toString() || '')
    .replace(/{loadAdjustment}/g, context.loadAdjustment?.toString() || '')
    .replace(/{loadIncrement}/g, context.loadIncrement?.toString() || '')
    .replace(/{restTime}/g, context.restTime?.toString() || '')
    .replace(/{nextExerciseName}/g, context.nextExerciseName || '')
    .replace(/{nextExerciseVariant}/g, context.nextExerciseVariant || '')
    .replace(/{newExerciseName}/g, (context as any).newExerciseName || '')
    .replace(/{substitutionName}/g, context.substitutionName || '')
    .replace(/{customName}/g, (context as any).customName || '')
    .replace(/{rpe}/g, context.rpe?.toString() || '')
    .replace(/{discipline}/g, context.discipline || '')
    .replace(/{percentComplete}/g, (context as any).percentComplete?.toString() || '')
    .replace(/{badge}/g, (context as any).badge || '')
    .replace(/{compliancePercent}/g, (context as any).compliancePercent?.toString() || '')
    .replace(/{prescribedZones}/g, (context as any).prescribedZones || '')
    .replace(/{effortScore}/g, (context as any).effortScore?.toString() || '')
    .replace(/{dataQuality}/g, (context as any).dataQuality || '')
    .replace(/{recoveryScore}/g, (context as any).recoveryScore?.toString() || '')
    .replace(/{deviceName}/g, (context as any).deviceName || '')
    .replace(/{estimatedRecoveryHours}/g, (context as any).estimatedRecoveryHours?.toString() || '')
    .replace(/{hrv}/g, (context as any).hrv?.toString() || '')
    .replace(/{restingHR}/g, (context as any).restingHR?.toString() || '')
    .replace(/{sleepHours}/g, (context as any).sleepHours?.toString() || '')
    .replace(/{blockName}/g, (context as any).blockName || '')
    .replace(/{targetZone}/g, (context as any).targetZone || '')
    .replace(/{zone}/g, (context as any).zone || '')
    .replace(/{zoneLabel}/g, (context as any).zoneLabel || '')
    .replace(/{intervalNumber}/g, (context as any).intervalNumber?.toString() || '')
    .replace(/{totalIntervals}/g, (context as any).totalIntervals?.toString() || '')
    .replace(/{blocksCompleted}/g, (context as any).blocksCompleted?.toString() || '')
    .replace(/{totalDuration}/g, (context as any).totalDuration?.toString() || '')
    .replace(/{cue}/g, (context as any).cue || '');
}

/**
 * Get random message from template config
 */
function getRandomMessage(config: MessageTemplateConfig, context?: TrainingNotificationContext): string {
  const randomIndex = Math.floor(Math.random() * config.templates.length);
  const template = config.templates[randomIndex];

  if (typeof template === 'function') {
    return template(context);
  }

  return interpolate(template, context);
}

/**
 * Message templates organized by notification ID
 */
const MESSAGE_TEMPLATES: Record<string, MessageTemplateConfig> = {
  // ==================== STEP 1: Preparer ====================
  'step1-time-short': {
    templates: [
      'Séance express ! On va à l\'essentiel 💨',
      'Mode rapide activé ! Efficacité maximale ⚡',
      'Format court : intensité concentrée 🎯'
    ]
  },
  'step1-time-long': {
    templates: [
      'Belle séance longue en perspective ! 💪',
      'On prend le temps de bien faire les choses 🎯',
      'Programme complet aujourd\'hui ! 🔥'
    ]
  },
  'step1-energy-high': {
    templates: [
      'Super forme ! On va te challenger ! 💪',
      'Plein d\'énergie ! Prêt pour une séance intense ? 🔥',
      'Tu as la pêche ! Profites-en ! ⚡'
    ]
  },
  'step1-energy-moderate': {
    templates: [
      'Énergie correcte ! Programme adapté 👍',
      'Forme moyenne, séance équilibrée 🎯',
      'On ajuste l\'intensité à ton niveau 💫'
    ]
  },
  'step1-energy-low': {
    templates: [
      'Petit coup de mou ? On y va en douceur 😊',
      'Écoute ton corps, séance modérée aujourd\'hui 🌿',
      'Pas de rush, qualité avant tout 💚'
    ]
  },
  'step1-location-selected': {
    templates: [
      'Lieu sélectionné ! Tu vas tout déchirer ! 🔥',
      'C\'est parti pour ta séance ! 💪',
      'Lieu validé ! Let\'s go ! ⚡'
    ]
  },
  'step1-fatigue-checked': {
    templates: [
      'Fatigue notée. On adapte la séance 😊',
      'Récupération en priorité, intensité ajustée 💤',
      'Ton corps a besoin de récup, je gère ! 🌙'
    ]
  },
  'step1-pain-checked': {
    templates: [
      '⚠️ Douleur signalée. Exercices adaptés !',
      '⚠️ On évite la zone douloureuse. Sécurité first !',
      '⚠️ Séance modifiée pour respecter ta douleur.'
    ]
  },

  // ==================== STEP 2: Activer ====================
  'step2-generation-start': {
    templates: [
      'Je crée ton plan personnalisé ! 🎯',
      'Génération en cours... 💪',
      'Préparation de ta séance ! ⚡'
    ]
  },
  'step2-generation-analyzing': {
    templates: [
      'Analyse de ton profil en cours... 🔍',
      'J\'étudie tes capacités... 📊',
      'Évaluation de tes besoins... 🎯'
    ]
  },
  'step2-generation-selecting': {
    templates: [
      'Sélection des exercices adaptés... 💪',
      'Choix des mouvements optimaux... ⚡',
      'Composition de ta séance... 🔥'
    ]
  },
  'step2-generation-calculating': {
    templates: [
      'Calcul des charges et volumes... 📈',
      'Ajustement de l\'intensité... 🎯',
      'Optimisation du plan... 💡'
    ]
  },
  'step2-generation-complete': {
    templates: [
      'Ton plan est prêt ! Check-le ! 🎉',
      'Programme généré avec succès ! 💪',
      'Séance personnalisée ready ! 🔥'
    ]
  },
  'step2-welcome-intro': {
    templates: [
      'Voici ta séance personnalisée ! 💪',
      'Ton plan d\'entraînement est prêt ! 🔥',
      'Let\'s go ! Découvre ta séance ! ⚡'
    ]
  },
  'step2-welcome-help': {
    templates: [
      'N\'hésite pas à ajuster si besoin ! 🎛️',
      'Tu peux modifier les exercices ! 🔄',
      'Personnalise ton plan à ta guise ! ✨'
    ]
  },
  'step2-sets-increased': {
    templates: [
      '{exerciseName} : {sets} séries ! Volume augmenté ! 📈',
      '+1 série sur {exerciseName} ! Tu gères ! 💪',
      'Plus de séries = plus de gains ! 🔥'
    ]
  },
  'step2-sets-decreased': {
    templates: [
      '{exerciseName} : {sets} séries. Intensité préservée ! 🎯',
      'Moins de séries, plus de qualité ! 💎',
      'Volume ajusté pour {exerciseName} ! ✓'
    ]
  },
  'step2-reps-increased': {
    templates: [
      '{exerciseName} : {reps} reps ! Challenge accepté ! 💪',
      '+{reps} répétitions ! Tu vas cartonner ! 🔥',
      'Volume élevé sur {exerciseName} ! 📈'
    ]
  },
  'step2-reps-decreased': {
    templates: [
      '{exerciseName} : {reps} reps. Focus qualité ! 🎯',
      'Reps ajustées pour {exerciseName} ! ✓',
      'Moins de reps, plus d\'intensité ! 💎'
    ]
  },
  'step2-load-increased': {
    templates: [
      '{exerciseName} : {newLoad}kg ! Tu progresses ! 💪',
      'Charge augmentée à {newLoad}kg ! 🔥',
      '+{loadAdjustment}kg sur {exerciseName} ! Top ! 📈'
    ]
  },
  'step2-load-decreased': {
    templates: [
      '{exerciseName} : {newLoad}kg. Technique parfaite ! 🎯',
      'Charge ajustée à {newLoad}kg ! 💎',
      'Moins lourd = meilleure exécution ! ✓'
    ]
  },
  'step2-alternative-selected': {
    templates: [
      'Alternative choisie : {substitutionName} ! 🔄',
      'Changement validé : {substitutionName} ! ✓',
      'Nouvel exercice : {substitutionName} ! 💪'
    ]
  },
  'step2-exercise-regenerating': {
    templates: [
      'Régénération de {exerciseName}... ⚡',
      'Je cherche une meilleure option... 🔍',
      'Remplacement en cours... 🔄'
    ]
  },
  'step2-exercise-regenerated': {
    templates: [
      '{newExerciseName} remplace {exerciseName} ! ✓',
      'Nouvel exercice trouvé : {newExerciseName} ! 💪',
      'Changement effectué ! 🔄'
    ]
  },
  'step2-exercise-error': {
    templates: [
      'Erreur sur {exerciseName}. Réessaye ! ⚠️',
      'Problème détecté. Ajuste et recommence ! 🔧',
      'Oups ! Vérifie {exerciseName} ! ⚠️'
    ]
  },
  'step2-draft-saved': {
    templates: [
      'Brouillon "{customName}" sauvegardé ! 💾',
      'Ta séance est en sécurité ! ✓',
      'Sauvegarde effectuée ! 🎯'
    ]
  },
  'step2-regeneration-started': {
    templates: [
      'Régénération du plan en cours... ⚡',
      'Nouvelle séance en préparation... 🔄',
      'Recalcul en cours... 💫'
    ]
  },
  'step2-regeneration-complete': {
    templates: [
      'Nouvelle séance prête ! 🎉',
      'Plan régénéré avec succès ! 💪',
      'C\'est reparti ! 🔥'
    ]
  },
  'step2-endurance-intensity-increased': {
    templates: [
      '{exerciseName} : intensité augmentée ! 🔥',
      'Plus difficile : {substitutionName} ! 💪',
      'Challenge relevé ! 📈'
    ]
  },
  'step2-endurance-intensity-decreased': {
    templates: [
      '{exerciseName} : intensité réduite ! ✓',
      'Ajustement : {substitutionName} ! 🎯',
      'On adapte l\'effort ! 💎'
    ]
  },
  'step2-endurance-adjustment-limit': {
    templates: [
      '{exerciseName} : limite atteinte ! ⚠️',
      'Impossible d\'ajuster davantage ! 🔒',
      'Valeurs min/max atteintes ! ⚠️'
    ]
  },

  // ==================== STEP 3: Seance ====================
  'step3-arrival': {
    templates: [
      'Prêt à donner le meilleur de toi ? 💪',
      'C\'est parti pour une séance intense !',
      'On va tout déchirer ensemble ! 🔥'
    ]
  },
  'step3-warmup-start': {
    templates: [
      'Commence par l\'échauffement ! 🔥',
      'Mobilité d\'abord ! 💪',
      'Préparons tes articulations ! ⚡'
    ]
  },
  'step3-warmup-complete': {
    templates: [
      'Échauffement terminé ! Tu es prêt ! 🔥',
      'Parfait ! On attaque ! 💪',
      'Top ! Passons aux choses sérieuses ! ⚡'
    ]
  },
  'step3-new-exercise': {
    templates: [
      '{exerciseName} ! Tu vas cartonner ! 💪',
      '{exerciseName} - Montre ce que tu sais faire !',
      'C\'est parti pour {exerciseName} ! 🔥'
    ]
  },
  'step3-set-complete': {
    templates: [
      'Excellente série ! Continue ! 🎯',
      'Bien joué ! 💪',
      'Parfait ! Respire et prépare la suite !',
      'Top ! Garde cette intensité ! 🔥'
    ]
  },
  'step3-rest-tip-1': {
    templates: [
      'Prochaine série : {newLoad}kg. Tu gères ! 💪',
      '{newLoad}kg arrive ! C\'est la progression ! 📈',
      'Série suivante : {newLoad}kg. Focus ! 🎯'
    ]
  },
  'step3-exercise-complete': {
    templates: [
      'Exercice terminé ! Tu déchires ! 🔥',
      'Excellent travail ! 💪',
      'Top performance ! On enchaîne ! 💥'
    ]
  },

  // ==================== STEP 4: Adapter ====================
  'step4-arrival-welcome': {
    templates: [
      'Bravo ! Séance terminée ! 💪',
      'Excellent travail ! Analysons ça ! 🎯',
      'Top ! Découvre tes résultats ! 🔥'
    ]
  },
  'step4-analysis-ready': {
    templates: [
      'Analyse de ta performance... 📊',
      'Je regarde ce que tu as accompli... 🔍',
      'Calcul de tes métriques... ⚡'
    ]
  },
  'step4-insights-highlight': {
    templates: [
      'Insights personnalisés en préparation ! 💡',
      'Je prépare ton analyse détaillée... 🔍',
      'Découvre ce que tu as accompli ! 🎯'
    ]
  },
  'step4-analysis-started': {
    templates: [
      'Analyse démarrée ! 🚀',
      'C\'est parti pour l\'analyse ! 📊',
      'Traitement de tes données... ⚡'
    ]
  },
  'step4-analysis-progress': {
    templates: [
      'Analyse en cours... {percentComplete}% ! 📈',
      'Traitement... {percentComplete}% ! ⚡',
      'Presque fini ! {percentComplete}% ! 🔍'
    ]
  },
  'step4-analysis-complete': {
    templates: [
      'Analyse terminée ! Check tes résultats ! 🎉',
      'Tout est prêt ! Découvre ton bilan ! 💪',
      'Résultats disponibles ! 🔥'
    ]
  },
  'step4-zone-compliance-achievement': {
    templates: [
      '{badge}\n\n{compliancePercent}% dans les zones {prescribedZones} ! 🎯',
      'Bravo ! {badge} débloqué ! 🏆',
      'Excellent respect des zones ! {badge} ! 💪'
    ]
  },
  'step4-wearable-data-achievement': {
    templates: [
      '📊 Score d\'effort : {effortScore}/100 ! Qualité {dataQuality} ! 💪',
      'Données wearable excellentes ! {effortScore}/100 ! 🎯',
      'Top qualité : {effortScore}/100 ({dataQuality}) ! 🔥'
    ]
  },

  // ==================== STEP 5: Avancer ====================
  'step5-arrival-welcome': {
    templates: [
      'Découvre tes recommandations ! 📈',
      'Prêt pour la suite ? 💪',
      'Allons plus loin ensemble ! 🔥'
    ]
  },
  'step5-recommendation-ready': {
    templates: [
      'Tes recommandations sont prêtes ! 🎯',
      'Plan de progression calculé ! 📊',
      'Insights personnalisés disponibles ! 💡'
    ]
  },
  'step5-recovery-optimal': {
    templates: [
      'Récupération optimale ! Tu peux y aller ! 💪',
      'Ton corps est prêt ! 🔥',
      'Parfait timing pour t\'entraîner ! ⚡'
    ]
  },
  'step5-action-accepted': {
    templates: [
      'Action validée ! C\'est noté ! ✓',
      'Parfait ! On avance ! 💪',
      'Top ! Continue comme ça ! 🎯'
    ]
  },
  'step5-progression-insight': {
    templates: [
      'Tu progresses ! Continue comme ça ! 📈',
      'Belle évolution ! 💪',
      'Tes efforts payent ! 🔥'
    ]
  },
  'step5-wearable-recovery-guidance': {
    templates: [
      'Récupération : {recoveryScore}/100 ({deviceName}) ! 📊',
      'Guidance récupération disponible ! 💡',
      'Analyse de tes métriques de repos ! 🌙'
    ]
  },
  'step5-wearable-metrics-insights': {
    templates: [
      '📊 Analyse détaillée de tes métriques ! 💡',
      'HRV, FC repos, sommeil : tout est là ! 🎯',
      'Insights wearable personnalisés ! 🔍'
    ]
  },

  // ==================== ENDURANCE ====================
  'endurance-analysis-started': {
    templates: [
      '🧠 Analyse de ta performance en cours...',
      '📊 Calcul de tes métriques personnalisées...',
      '⚡ Traitement de tes données...'
    ]
  },
  'endurance-analysis-progress-25': {
    templates: [
      '✨ Analyse à 25% - Évaluation de l\'endurance...',
      '🔍 Premier quart analysé...',
      '📊 25% complété !'
    ]
  },
  'endurance-analysis-progress-50': {
    templates: [
      '🎯 À mi-chemin ! Analyse de l\'intensité...',
      '⚡ 50% - On continue !',
      '📈 Moitié analysée !'
    ]
  },
  'endurance-analysis-progress-75': {
    templates: [
      '🔥 Presque terminé ! Calcul des recommandations...',
      '💪 75% - Dernière ligne droite !',
      '✨ Presque fini !'
    ]
  },
  'endurance-analysis-complete': {
    templates: [
      '✅ Analyse complète ! Découvre tes résultats détaillés ci-dessous.',
      '🎉 Résultats prêts ! Scroll pour voir ton analyse personnalisée.',
      '💪 Analyse terminée ! Tes métriques sont disponibles.'
    ]
  },
  'endurance-session-start': {
    templates: [
      'C\'est parti pour ta séance de {discipline} ! 🏃',
      'Allons-y ! Concentre-toi sur ton allure et ta respiration.',
      'Séance lancée ! Garde une intensité régulière au début.'
    ]
  },
  'endurance-session-paused': {
    templates: [
      'Séance en pause. Reprends dès que tu es prêt !',
      'Pause activée. Respire bien ! 💚',
      'En pause. Prends ton temps ! 🌟'
    ]
  },
  'endurance-session-resumed': {
    templates: [
      'C\'est reparti ! Concentre-toi sur ta respiration.',
      'Reprise ! Let\'s go ! 💪',
      'On repart ! Retrouve ton rythme ! ⚡'
    ]
  },
  'endurance-halfway-point': {
    templates: [
      'Tu es à mi-chemin ! Continue, tu gères ! 💪',
      '50% de la séance ! Tu es dans le rythme.',
      'Moitié faite ! L\'autre moitié sera facile maintenant.'
    ]
  },
  'endurance-final-stretch': {
    templates: [
      'Dernière ligne droite ! Tu y es presque ! 🏁',
      'Plus que quelques minutes ! Termine en force !',
      'C\'est bientôt fini ! Garde ton allure.'
    ]
  },
  'endurance-session-complete': {
    templates: [
      'Séance terminée ! Bravo, tu as tout donné ! 🎉',
      'Excellent travail ! {blocksCompleted} blocs réalisés avec succès.',
      'Félicitations ! Séance complétée ! 💪'
    ]
  },
  'endurance-block-start': {
    templates: [
      'Début du bloc : {blockName} - Zone {targetZone}',
      'Nouveau bloc ! Passe en zone {targetZone} progressivement.',
      '{blockName} - Maintiens-toi en {targetZone} 💪'
    ]
  },
  'endurance-block-complete': {
    templates: [
      'Bloc "{blockName}" terminé ! Bien joué ! ✅',
      'Excellent ! Tu as complété {blockName}.',
      '{blockName} fait ! Continue comme ça 🎯'
    ]
  },
  'endurance-zone-change': {
    templates: [
      'Passage en {zone} - {zoneLabel}',
      'Ajuste ton allure pour atteindre {zone}',
      'Nouvelle zone : {zone} - {zoneLabel}'
    ]
  },
  'endurance-interval-work': {
    templates: [
      'Intervalle {intervalNumber}/{totalIntervals} - En {targetZone} ! 🔥',
      'C\'est parti pour l\'effort n°{intervalNumber} ! Donne tout !',
      'Intervalle {intervalNumber} - Zone {targetZone}. Tu gères !'
    ]
  },
  'endurance-interval-rest': {
    templates: [
      'Récup active ! Respire bien, prépare le prochain effort.',
      'Temps de récup - Ralentis progressivement 💚',
      'Récupération {intervalNumber}/{totalIntervals} - Relâche les épaules.'
    ]
  },
  'endurance-encouragement': {
    templates: [
      'Continue comme ça, tu gères parfaitement ! 👏',
      'Excellente tenue ! Garde le rythme.',
      'Tu es dans la zone ! Reste concentré.',
      'Bien joué ! Tu maintiens l\'allure.',
      'Beau boulot ! Continue ainsi.'
    ]
  },
  'endurance-technique-reminder': {
    templates: [
      '💡 Rappel : {cue}',
      '🎯 Technique : {cue}',
      '✨ Pense à : {cue}'
    ]
  },

  // ==================== DEFAULT ====================
  'default': {
    templates: [
      'Notification',
      'Info'
    ]
  }
};

/**
 * Generate notification message for given ID and context
 */
export function generateNotificationMessage(
  id: string,
  context?: TrainingNotificationContext
): string {
  const config = MESSAGE_TEMPLATES[id] || MESSAGE_TEMPLATES['default'];
  return getRandomMessage(config, context);
}

/**
 * Check if notification ID has custom messages
 */
export function hasCustomMessages(id: string): boolean {
  return id in MESSAGE_TEMPLATES;
}

/**
 * Get all available notification IDs
 */
export function getAllNotificationIds(): string[] {
  return Object.keys(MESSAGE_TEMPLATES);
}
