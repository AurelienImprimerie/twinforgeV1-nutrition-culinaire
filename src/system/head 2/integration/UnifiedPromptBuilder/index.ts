import type { BrainContext, PromptEnrichment, ResponseStyle } from '../../types';
import { UserKnowledgeSummaryBuilder } from './builders/UserKnowledgeSummaryBuilder';
import { ActivityContextBuilder } from './builders/ActivityContextBuilder';
import { ResponseStyleBuilder } from './builders/ResponseStyleBuilder';

export class UnifiedPromptBuilder {
  private userKnowledgeBuilder = new UserKnowledgeSummaryBuilder();
  private activityContextBuilder = new ActivityContextBuilder();
  private responseStyleBuilder = new ResponseStyleBuilder();

  buildSystemPrompt(context: BrainContext, basePrompt: string): string {
    const enrichment = this.buildEnrichment(context);

    const sections = [
      basePrompt,
      '',
      '## CONTEXTE UTILISATEUR',
      enrichment.userKnowledgeSummary,
      '',
      '## ACTIVITÉ ACTUELLE',
      enrichment.currentActivityContext,
      '',
      '## STYLE DE RÉPONSE',
      this.responseStyleBuilder.formatResponseStyle(enrichment.suggestedResponseStyle)
    ];

    if (enrichment.systemPromptAdditions.length > 0) {
      sections.push('', '## INSTRUCTIONS SUPPLÉMENTAIRES');
      sections.push(...enrichment.systemPromptAdditions);
    }

    return sections.join('\n');
  }

  private buildEnrichment(context: BrainContext): PromptEnrichment {
    const systemPromptAdditions: string[] = [];
    const contextualInstructions: string[] = [];

    if (context.session.isActive && context.session.trainingSession) {
      const training = context.session.trainingSession;

      const exerciseName = training.currentExercise?.name || 'inconnu';
      const exerciseLoad = training.currentExercise?.load ? `${training.currentExercise.load}kg` : 'poids de corps';
      const exerciseReps = training.currentExercise?.reps || '?';
      const exerciseSets = training.currentExercise?.sets || '?';

      contextualInstructions.push(
        `🔥 SÉANCE LIVE (${training.discipline}): ` +
        `Exercice ${training.currentExerciseIndex + 1}/${training.totalExercises} - ${exerciseName} ` +
        `(${exerciseLoad}, ${exerciseReps} reps × ${exerciseSets} séries), ` +
        `série ${training.currentSet}/${training.totalSets}`
      );

      if (training.isResting) {
        contextualInstructions.push(`⏸️ REPOS ACTIF: ${training.restTimeRemaining}s restantes avant prochaine série.`);
        systemPromptAdditions.push(
          '⏸️ PÉRIODE DE REPOS (15-30 mots):',
          '• Profite du repos pour donner conseils techniques',
          '• Explique la progression ou la logique de l\'exercice',
          '• Réponds aux questions en détail',
          '• Encourage pour la prochaine série',
          '• Rappelle les points techniques importants'
        );
      } else {
        contextualInstructions.push(`💪 EFFORT EN COURS: Série ${training.currentSet}/${training.totalSets} active.`);
        systemPromptAdditions.push(
          '💪 EFFORT ACTIF - ULTRA-COURT (5-15 mots MAX):',
          '• Motivation explosive et encouragement',
          '• Corrections techniques CRITIQUES uniquement',
          '• Alertes sécurité si nécessaire',
          '• PAS de détails, PAS d\'explications',
          '• Exemples: "Allez! Pousse!", "Dos droit!", "Expire!", "2 de plus!"'
        );
      }

      if (training.currentExercise) {
        systemPromptAdditions.push(
          `📋 EXERCICE ACTUEL: ${exerciseName}`,
          `   Charge: ${exerciseLoad}`,
          `   Répétitions: ${exerciseReps}`,
          `   Série: ${training.currentSet}/${exerciseSets}`,
          `   Temps écoulé: ${Math.floor(training.sessionTimeElapsed / 60)}min`
        );
      }
    }

    if (context.missingData.suggestions.length > 0) {
      const topSuggestion = context.missingData.suggestions[0];
      systemPromptAdditions.push(
        `Suggestion proactive disponible: ${topSuggestion.message}`
      );
    }

    const userKnowledgeSummary = this.userKnowledgeBuilder.buildUserKnowledgeSummary(context);
    const currentActivityContext = this.activityContextBuilder.buildActivityContext(context);
    const suggestedResponseStyle = this.responseStyleBuilder.determineResponseStyle(context);

    return {
      systemPromptAdditions,
      contextualInstructions,
      userKnowledgeSummary,
      currentActivityContext,
      suggestedResponseStyle
    };
  }
}
