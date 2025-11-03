/**
 * Request Validation - chat-ai
 * Sprint 2 Phase 3.2
 *
 * RÈGLE CRITIQUE: Validation des messages utilisateur UNIQUEMENT.
 * NE TOUCHE PAS aux system prompts ou à la logique des modes.
 */

import { validateChatRequest } from '../_shared/validation/chat.ts';

/**
 * Validate chat AI request
 * Simple wrapper around unified validation
 */
export function validateChatAIRequest(request: any): string | null {
  const result = validateChatRequest(request);

  if (!result.isValid) {
    return result.errors.join('; ');
  }

  return null;
}

/**
 * Sanitize and prepare request data for AI processing
 */
export function sanitizeChatAIRequest(request: any): {
  messages: any[];
  mode: string;
  contextData: any | null;
  stream: boolean;
} {
  // Validation should be done first with validateChatAIRequest()
  const result = validateChatRequest(request);

  if (!result.isValid) {
    throw new Error('Request must be validated before sanitization');
  }

  return result.sanitized!;
}
