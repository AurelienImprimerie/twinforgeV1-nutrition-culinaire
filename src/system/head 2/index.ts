/**
 * Head System - Main Exports
 * Central intelligence hub for the application
 */

export { brainCore } from './core/BrainCore';
export { UnifiedPromptBuilder } from './integration/UnifiedPromptBuilder';
export { FeedbackRecorder } from './integration/FeedbackRecorder';
export { chatIntegration } from './integration/ChatIntegration';
export { realtimeIntegration } from './integration/RealtimeIntegration';
export { TrainingContextProvider, useTrainingContext } from './integration/TrainingContextProvider';
export { eventListenerHub } from './events';
export { conversationMemoryManager } from './memory';

export type {
  BrainContext,
  UserKnowledge,
  AppContext,
  SessionAwareness,
  TrainingSessionContext,
  ForgeType,
  IForgeModule,
  MissingDataReport,
  ProactiveSuggestion,
  PromptEnrichment,
  ResponseStyle,
  EventType,
  TrainingEvent,
  EventListener,
  EventSubscription,
  ConversationMessage,
  ConversationSummary
} from './types';

export type {
  SessionStartedEvent,
  SessionCompletedEvent,
  ExerciseStartedEvent,
  ExerciseCompletedEvent,
  SetStartedEvent,
  SetCompletedEvent,
  RestStartedEvent,
  RestEndedEvent,
  RPEReportedEvent,
  LoadAdjustedEvent,
  PainReportedEvent,
  RecordAchievedEvent,
  QuestionAskedEvent,
  FeedbackProvidedEvent
} from './events/types';
