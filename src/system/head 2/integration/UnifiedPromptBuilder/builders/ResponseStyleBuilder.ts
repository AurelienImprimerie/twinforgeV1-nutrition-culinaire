import type { BrainContext, ResponseStyle } from '../../../types';

export class ResponseStyleBuilder {
  /**
   * Determine appropriate response style based on context
   */
  determineResponseStyle(context: BrainContext): ResponseStyle {
    if (
      context.session.isActive &&
      context.session.trainingSession &&
      !context.session.trainingSession.isResting
    ) {
      return {
        length: 'ultra-short',
        tone: 'motivational',
        formality: 'casual',
        emoji: true
      };
    }

    if (
      context.session.isActive &&
      context.session.trainingSession &&
      context.session.trainingSession.isResting
    ) {
      return {
        length: 'short',
        tone: 'motivational',
        formality: 'casual',
        emoji: true
      };
    }

    return {
      length: 'medium',
      tone: 'conversational',
      formality: 'casual',
      emoji: false
    };
  }

  /**
   * Format response style for prompt
   */
  formatResponseStyle(style: ResponseStyle): string {
    const lengthMap = {
      'ultra-short': '5-15 mots maximum',
      'short': '1-2 phrases courtes',
      'medium': '2-4 phrases',
      'detailed': 'Réponse détaillée'
    };

    const toneMap = {
      'motivational': 'Motivant et énergique',
      'technical': 'Technique et précis',
      'informative': 'Informatif et pédagogue',
      'conversational': 'Naturel et conversationnel'
    };

    return `Longueur: ${lengthMap[style.length]}\nTone: ${toneMap[style.tone]}\nÉmojis: ${style.emoji ? 'Oui' : 'Non'}`;
  }
}
