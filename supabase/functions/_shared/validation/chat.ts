/**
 * Chat Validation - Sprint 2 Phase 3.2
 *
 * Validation spécifique pour:
 * - chat-ai (multi-context AI chat)
 *
 * RÈGLE CRITIQUE: Valider UNIQUEMENT les messages utilisateur.
 * NE JAMAIS toucher aux system prompts ou à la logique des modes.
 */

import {
  validateTextInput,
  validateArray,
  ValidationResult
} from './index.ts';

/**
 * Valid chat modes
 */
const VALID_CHAT_MODES = [
  'training',
  'nutrition',
  'fasting',
  'general',
  'body-scan'
] as const;

export type ChatMode = typeof VALID_CHAT_MODES[number];

/**
 * Valid message roles
 */
const VALID_MESSAGE_ROLES = ['system', 'user', 'assistant'] as const;

export type MessageRole = typeof VALID_MESSAGE_ROLES[number];

/**
 * Validate chat mode
 */
export function validateChatMode(mode: any): ValidationResult {
  if (!mode) {
    return { isValid: false, error: 'Chat mode is required' };
  }

  if (typeof mode !== 'string') {
    return { isValid: false, error: 'Chat mode must be a string' };
  }

  if (!VALID_CHAT_MODES.includes(mode as ChatMode)) {
    return {
      isValid: false,
      error: `Invalid chat mode. Must be one of: ${VALID_CHAT_MODES.join(', ')}`
    };
  }

  return { isValid: true, sanitizedValue: mode };
}

/**
 * Validate message role
 */
export function validateMessageRole(role: any): ValidationResult {
  if (!role) {
    return { isValid: false, error: 'Message role is required' };
  }

  if (typeof role !== 'string') {
    return { isValid: false, error: 'Message role must be a string' };
  }

  if (!VALID_MESSAGE_ROLES.includes(role as MessageRole)) {
    return {
      isValid: false,
      error: `Invalid message role. Must be one of: ${VALID_MESSAGE_ROLES.join(', ')}`
    };
  }

  return { isValid: true, sanitizedValue: role };
}

/**
 * Validate single chat message
 */
export function validateChatMessage(message: any): ValidationResult {
  if (!message || typeof message !== 'object') {
    return { isValid: false, error: 'Message must be an object' };
  }

  // Validate role
  const roleResult = validateMessageRole(message.role);
  if (!roleResult.isValid) {
    return { isValid: false, error: `Role: ${roleResult.error}` };
  }

  // Validate content
  const contentResult = validateTextInput(
    message.content,
    10000, // Max 10k chars per message
    { required: true }
  );
  if (!contentResult.isValid) {
    return { isValid: false, error: `Content: ${contentResult.error}` };
  }

  return {
    isValid: true,
    sanitizedValue: {
      role: roleResult.sanitizedValue,
      content: contentResult.sanitizedValue
    }
  };
}

/**
 * Validate array of chat messages
 */
export function validateChatMessages(messages: any): ValidationResult {
  if (!messages) {
    return { isValid: false, error: 'Messages array is required' };
  }

  // Validate array structure (max 100 messages in history)
  const arrayResult = validateArray(messages, 1, 100);
  if (!arrayResult.isValid) {
    return arrayResult;
  }

  const messagesArray = arrayResult.sanitizedValue as any[];

  // Validate each message
  const sanitizedMessages: any[] = [];
  for (let i = 0; i < messagesArray.length; i++) {
    const messageResult = validateChatMessage(messagesArray[i]);
    if (!messageResult.isValid) {
      return {
        isValid: false,
        error: `Message ${i + 1}: ${messageResult.error}`
      };
    }
    sanitizedMessages.push(messageResult.sanitizedValue);
  }

  // Additional validation: Check message flow
  // Should alternate between user and assistant (system can be first)
  let hasUserMessage = false;
  for (const msg of sanitizedMessages) {
    if (msg.role === 'user') {
      hasUserMessage = true;
      break;
    }
  }

  if (!hasUserMessage) {
    return {
      isValid: false,
      error: 'Messages must contain at least one user message'
    };
  }

  return {
    isValid: true,
    sanitizedValue: sanitizedMessages
  };
}

/**
 * Validate context data (optional structured data for the AI)
 */
export function validateContextData(contextData: any): ValidationResult {
  if (!contextData) {
    return { isValid: true, sanitizedValue: null };
  }

  if (typeof contextData !== 'object') {
    return { isValid: false, error: 'Context data must be an object' };
  }

  // Context data is AI-specific, we just validate it's a safe object
  // No deep validation needed - AI will use what it needs

  // Basic size check to prevent abuse
  const jsonString = JSON.stringify(contextData);
  if (jsonString.length > 50000) { // 50KB max
    return {
      isValid: false,
      error: 'Context data too large (max 50KB)'
    };
  }

  return { isValid: true, sanitizedValue: contextData };
}

/**
 * Validate streaming preference
 */
export function validateStreamingPreference(stream: any): ValidationResult {
  if (stream === undefined || stream === null) {
    return { isValid: true, sanitizedValue: false }; // Default no streaming
  }

  if (typeof stream !== 'boolean') {
    return { isValid: false, error: 'Stream flag must be a boolean' };
  }

  return { isValid: true, sanitizedValue: stream };
}

/**
 * Helper: Validate complete chat request
 * Used by chat-ai function
 */
export function validateChatRequest(request: {
  messages?: any;
  mode?: any;
  contextData?: any;
  stream?: any;
}): {
  isValid: boolean;
  errors: string[];
  sanitized?: {
    messages: any[];
    mode: ChatMode;
    contextData: any | null;
    stream: boolean;
  };
} {
  const errors: string[] = [];

  // Validate messages
  const messagesResult = validateChatMessages(request.messages);
  if (!messagesResult.isValid) {
    errors.push(`Messages: ${messagesResult.error}`);
  }

  // Validate mode
  const modeResult = validateChatMode(request.mode);
  if (!modeResult.isValid) {
    errors.push(`Mode: ${modeResult.error}`);
  }

  // Validate context data (optional)
  const contextResult = validateContextData(request.contextData);
  if (!contextResult.isValid) {
    errors.push(`Context data: ${contextResult.error}`);
  }

  // Validate streaming preference
  const streamResult = validateStreamingPreference(request.stream);
  if (!streamResult.isValid) {
    errors.push(`Stream: ${streamResult.error}`);
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  return {
    isValid: true,
    errors: [],
    sanitized: {
      messages: messagesResult.sanitizedValue as any[],
      mode: modeResult.sanitizedValue as ChatMode,
      contextData: contextResult.sanitizedValue,
      stream: streamResult.sanitizedValue as boolean
    }
  };
}

/**
 * Sanitize user message content specifically
 * Removes potential prompt injection attempts
 */
export function sanitizeUserMessageContent(content: string): string {
  // Remove potential system prompt injection patterns
  const dangerousPatterns = [
    /ignore\s+(previous|all)\s+(instructions|prompts)/gi,
    /system\s*:/gi,
    /you\s+are\s+now/gi,
    /forget\s+everything/gi,
    /new\s+instructions/gi
  ];

  let sanitized = content;
  for (const pattern of dangerousPatterns) {
    sanitized = sanitized.replace(pattern, '[FILTERED]');
  }

  return sanitized;
}
