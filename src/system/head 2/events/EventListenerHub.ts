/**
 * EventListenerHub - Central Event Management for Training System
 * Provides event emission and listener registration for all training events
 */

import logger from '../../../lib/utils/logger';
import type {
  EventType,
  TrainingEvent,
  EventListener,
  EventSubscription,
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
  FeedbackProvidedEvent,
} from './types';

export class EventListenerHub {
  private listeners: Map<EventType, Set<EventListener>> = new Map();
  private globalListeners: Set<EventListener> = new Set();
  private eventHistory: TrainingEvent[] = [];
  private maxHistorySize = 100;
  private isEnabled = true;

  constructor() {
    logger.info('EVENT_LISTENER_HUB', 'EventListenerHub initialized');
  }

  /**
   * Subscribe to a specific event type
   */
  on<T extends TrainingEvent>(
    eventType: EventType,
    listener: EventListener<T>
  ): EventSubscription {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }

    const listeners = this.listeners.get(eventType)!;
    listeners.add(listener as EventListener);

    logger.debug('EVENT_LISTENER_HUB', 'Listener registered', {
      eventType,
      listenerCount: listeners.size,
    });

    return {
      unsubscribe: () => {
        listeners.delete(listener as EventListener);
        if (listeners.size === 0) {
          this.listeners.delete(eventType);
        }
        logger.debug('EVENT_LISTENER_HUB', 'Listener unsubscribed', {
          eventType,
          remainingListeners: listeners.size,
        });
      },
    };
  }

  /**
   * Subscribe to all events (global listener)
   */
  onAll(listener: EventListener): EventSubscription {
    this.globalListeners.add(listener);

    logger.debug('EVENT_LISTENER_HUB', 'Global listener registered', {
      totalGlobalListeners: this.globalListeners.size,
    });

    return {
      unsubscribe: () => {
        this.globalListeners.delete(listener);
        logger.debug('EVENT_LISTENER_HUB', 'Global listener unsubscribed', {
          remainingGlobalListeners: this.globalListeners.size,
        });
      },
    };
  }

  /**
   * Emit an event to all registered listeners
   */
  async emit(event: TrainingEvent): Promise<void> {
    if (!this.isEnabled) {
      logger.debug('EVENT_LISTENER_HUB', 'Event emission disabled', {
        eventType: event.type,
      });
      return;
    }

    // Add to history
    this.addToHistory(event);

    // Get specific listeners for this event type
    const specificListeners = this.listeners.get(event.type) || new Set();
    const allListeners = [...specificListeners, ...this.globalListeners];

    if (allListeners.length === 0) {
      logger.debug('EVENT_LISTENER_HUB', 'No listeners for event', {
        eventType: event.type,
      });
      return;
    }

    logger.debug('EVENT_LISTENER_HUB', 'Emitting event', {
      eventType: event.type,
      listenerCount: allListeners.length,
      timestamp: event.timestamp,
    });

    // Execute all listeners
    const promises = allListeners.map(async (listener) => {
      try {
        await listener(event);
      } catch (error) {
        logger.error('EVENT_LISTENER_HUB', 'Listener execution failed', {
          eventType: event.type,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    await Promise.all(promises);
  }

  /**
   * Emit session started event
   */
  async emitSessionStarted(
    data: Omit<SessionStartedEvent, 'type' | 'timestamp'>
  ): Promise<void> {
    await this.emit({
      type: 'session:started',
      timestamp: Date.now(),
      ...data,
    });
  }

  /**
   * Emit session completed event
   */
  async emitSessionCompleted(
    data: Omit<SessionCompletedEvent, 'type' | 'timestamp'>
  ): Promise<void> {
    await this.emit({
      type: 'session:completed',
      timestamp: Date.now(),
      ...data,
    });
  }

  /**
   * Emit exercise started event
   */
  async emitExerciseStarted(
    data: Omit<ExerciseStartedEvent, 'type' | 'timestamp'>
  ): Promise<void> {
    await this.emit({
      type: 'exercise:started',
      timestamp: Date.now(),
      ...data,
    });
  }

  /**
   * Emit exercise completed event
   */
  async emitExerciseCompleted(
    data: Omit<ExerciseCompletedEvent, 'type' | 'timestamp'>
  ): Promise<void> {
    await this.emit({
      type: 'exercise:completed',
      timestamp: Date.now(),
      ...data,
    });
  }

  /**
   * Emit set started event
   */
  async emitSetStarted(
    data: Omit<SetStartedEvent, 'type' | 'timestamp'>
  ): Promise<void> {
    await this.emit({
      type: 'set:started',
      timestamp: Date.now(),
      ...data,
    });
  }

  /**
   * Emit set completed event
   */
  async emitSetCompleted(
    data: Omit<SetCompletedEvent, 'type' | 'timestamp'>
  ): Promise<void> {
    await this.emit({
      type: 'set:completed',
      timestamp: Date.now(),
      ...data,
    });
  }

  /**
   * Emit rest started event
   */
  async emitRestStarted(
    data: Omit<RestStartedEvent, 'type' | 'timestamp'>
  ): Promise<void> {
    await this.emit({
      type: 'rest:started',
      timestamp: Date.now(),
      ...data,
    });
  }

  /**
   * Emit rest ended event
   */
  async emitRestEnded(
    data: Omit<RestEndedEvent, 'type' | 'timestamp'>
  ): Promise<void> {
    await this.emit({
      type: 'rest:ended',
      timestamp: Date.now(),
      ...data,
    });
  }

  /**
   * Emit RPE reported event
   */
  async emitRPEReported(
    data: Omit<RPEReportedEvent, 'type' | 'timestamp'>
  ): Promise<void> {
    await this.emit({
      type: 'rpe:reported',
      timestamp: Date.now(),
      ...data,
    });
  }

  /**
   * Emit load adjusted event
   */
  async emitLoadAdjusted(
    data: Omit<LoadAdjustedEvent, 'type' | 'timestamp'>
  ): Promise<void> {
    await this.emit({
      type: 'load:adjusted',
      timestamp: Date.now(),
      ...data,
    });
  }

  /**
   * Emit pain reported event
   */
  async emitPainReported(
    data: Omit<PainReportedEvent, 'type' | 'timestamp'>
  ): Promise<void> {
    await this.emit({
      type: 'pain:reported',
      timestamp: Date.now(),
      ...data,
    });
  }

  /**
   * Emit record achieved event
   */
  async emitRecordAchieved(
    data: Omit<RecordAchievedEvent, 'type' | 'timestamp'>
  ): Promise<void> {
    await this.emit({
      type: 'record:achieved',
      timestamp: Date.now(),
      ...data,
    });
  }

  /**
   * Emit question asked event
   */
  async emitQuestionAsked(
    data: Omit<QuestionAskedEvent, 'type' | 'timestamp'>
  ): Promise<void> {
    await this.emit({
      type: 'question:asked',
      timestamp: Date.now(),
      ...data,
    });
  }

  /**
   * Emit feedback provided event
   */
  async emitFeedbackProvided(
    data: Omit<FeedbackProvidedEvent, 'type' | 'timestamp'>
  ): Promise<void> {
    await this.emit({
      type: 'feedback:provided',
      timestamp: Date.now(),
      ...data,
    });
  }

  /**
   * Get recent event history
   */
  getHistory(limit?: number): TrainingEvent[] {
    const events = [...this.eventHistory];
    return limit ? events.slice(-limit) : events;
  }

  /**
   * Get events of a specific type from history
   */
  getEventsByType(eventType: EventType, limit?: number): TrainingEvent[] {
    const events = this.eventHistory.filter((e) => e.type === eventType);
    return limit ? events.slice(-limit) : events;
  }

  /**
   * Get events for a specific session from history
   */
  getSessionEvents(sessionId: string): TrainingEvent[] {
    return this.eventHistory.filter((e) => e.sessionId === sessionId);
  }

  /**
   * Clear event history
   */
  clearHistory(): void {
    this.eventHistory = [];
    logger.debug('EVENT_LISTENER_HUB', 'Event history cleared');
  }

  /**
   * Enable/disable event emission
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    logger.info('EVENT_LISTENER_HUB', `Event emission ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Remove all listeners
   */
  removeAllListeners(): void {
    this.listeners.clear();
    this.globalListeners.clear();
    logger.info('EVENT_LISTENER_HUB', 'All listeners removed');
  }

  /**
   * Get current listener count
   */
  getListenerCount(): { specific: number; global: number; total: number } {
    let specificCount = 0;
    this.listeners.forEach((listeners) => {
      specificCount += listeners.size;
    });

    return {
      specific: specificCount,
      global: this.globalListeners.size,
      total: specificCount + this.globalListeners.size,
    };
  }

  /**
   * Cleanup
   */
  cleanup(): void {
    this.removeAllListeners();
    this.clearHistory();
    logger.info('EVENT_LISTENER_HUB', 'Cleanup complete');
  }

  /**
   * Add event to history (internal)
   */
  private addToHistory(event: TrainingEvent): void {
    this.eventHistory.push(event);

    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory = this.eventHistory.slice(-this.maxHistorySize);
    }
  }
}

// Export singleton instance
export const eventListenerHub = new EventListenerHub();
