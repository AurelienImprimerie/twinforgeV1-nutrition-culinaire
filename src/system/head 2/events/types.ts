/**
 * Event Types - Training and System Events
 * Defines all events that can be emitted by the Head System
 */

export type EventType =
  // Training Session Events
  | 'session:started'
  | 'session:paused'
  | 'session:resumed'
  | 'session:completed'
  | 'session:abandoned'

  // Exercise Events
  | 'exercise:started'
  | 'exercise:completed'
  | 'exercise:skipped'

  // Set Events
  | 'set:started'
  | 'set:completed'
  | 'set:failed'

  // Rest Events
  | 'rest:started'
  | 'rest:ended'
  | 'rest:skipped'

  // Performance Events
  | 'rpe:reported'
  | 'load:adjusted'
  | 'reps:adjusted'
  | 'pain:reported'
  | 'fatigue:reported'

  // Milestone Events
  | 'record:achieved'
  | 'milestone:reached'

  // User Interaction Events
  | 'question:asked'
  | 'feedback:provided'
  | 'motivation:requested'

  // Culinary Events - Meal Plans
  | 'meal-plan:created'
  | 'meal-plan:started'
  | 'meal-plan:completed'
  | 'meal-plan:archived'
  | 'meal-plan:generation-started'
  | 'meal-plan:generation-completed'

  // Culinary Events - Shopping Lists
  | 'shopping-list:created'
  | 'shopping-list:item-checked'
  | 'shopping-list:item-unchecked'
  | 'shopping-list:completed'
  | 'shopping-list:archived'

  // Culinary Events - Fridge Scans
  | 'fridge-scan:started'
  | 'fridge-scan:photo-captured'
  | 'fridge-scan:analysis-completed'
  | 'fridge-scan:inventory-edited'
  | 'fridge-scan:recipe-generated'
  | 'fridge-scan:completed'

  // Culinary Events - Meals
  | 'meal:scanned'
  | 'meal:logged'
  | 'meal:updated'
  | 'meal:deleted'

  // System Events
  | 'context:refreshed'
  | 'data:synced';

export interface BaseEvent {
  type: EventType;
  timestamp: number;
  userId: string;
  sessionId?: string;
}

export interface SessionStartedEvent extends BaseEvent {
  type: 'session:started';
  discipline: string;
  totalExercises: number;
  expectedDuration: number;
}

export interface SessionCompletedEvent extends BaseEvent {
  type: 'session:completed';
  duration: number;
  exercisesCompleted: number;
  totalSets: number;
  averageRPE?: number;
}

export interface ExerciseStartedEvent extends BaseEvent {
  type: 'exercise:started';
  exerciseName: string;
  exerciseIndex: number;
  totalExercises: number;
  load?: number;
  targetReps: string;
  totalSets: number;
}

export interface ExerciseCompletedEvent extends BaseEvent {
  type: 'exercise:completed';
  exerciseName: string;
  exerciseIndex: number;
  setsCompleted: number;
  averageRPE?: number;
}

export interface SetStartedEvent extends BaseEvent {
  type: 'set:started';
  exerciseName: string;
  setNumber: number;
  totalSets: number;
  load?: number;
  targetReps: string;
}

export interface SetCompletedEvent extends BaseEvent {
  type: 'set:completed';
  exerciseName: string;
  setNumber: number;
  totalSets: number;
  load?: number;
  actualReps: number | string;
  rpe?: number;
  notes?: string;
}

export interface RestStartedEvent extends BaseEvent {
  type: 'rest:started';
  exerciseName: string;
  setNumber: number;
  duration: number;
}

export interface RestEndedEvent extends BaseEvent {
  type: 'rest:ended';
  exerciseName: string;
  setNumber: number;
  actualDuration: number;
}

export interface RPEReportedEvent extends BaseEvent {
  type: 'rpe:reported';
  exerciseName: string;
  setNumber: number;
  rpe: number;
  load?: number;
}

export interface LoadAdjustedEvent extends BaseEvent {
  type: 'load:adjusted';
  exerciseName: string;
  previousLoad: number;
  newLoad: number;
  reason: 'too_easy' | 'too_hard' | 'pain' | 'user_choice';
}

export interface PainReportedEvent extends BaseEvent {
  type: 'pain:reported';
  exerciseName: string;
  setNumber?: number;
  painLevel: number;
  location: string;
  description?: string;
}

export interface RecordAchievedEvent extends BaseEvent {
  type: 'record:achieved';
  exerciseName: string;
  recordType: 'weight' | 'reps' | 'volume';
  previousValue: number | string;
  newValue: number | string;
}

export interface QuestionAskedEvent extends BaseEvent {
  type: 'question:asked';
  question: string;
  context: 'training' | 'nutrition' | 'general';
  exerciseName?: string;
}

export interface FeedbackProvidedEvent extends BaseEvent {
  type: 'feedback:provided';
  feedbackType: 'positive' | 'negative' | 'neutral';
  message: string;
  context?: string;
}

// ============================================
// Culinary Event Types
// ============================================

export interface MealPlanCreatedEvent extends BaseEvent {
  type: 'meal-plan:created';
  mealPlanId: string;
  title: string;
  weekNumber: number;
  startDate: string;
  endDate: string;
}

export interface MealPlanCompletedEvent extends BaseEvent {
  type: 'meal-plan:completed';
  mealPlanId: string;
  title: string;
  daysCompleted: number;
}

export interface ShoppingListCreatedEvent extends BaseEvent {
  type: 'shopping-list:created';
  shoppingListId: string;
  title: string;
  totalItems: number;
  estimatedBudgetCents: number;
}

export interface ShoppingListItemCheckedEvent extends BaseEvent {
  type: 'shopping-list:item-checked';
  shoppingListId: string;
  itemId: string;
  itemName: string;
  completionPercentage: number;
}

export interface ShoppingListCompletedEvent extends BaseEvent {
  type: 'shopping-list:completed';
  shoppingListId: string;
  title: string;
  totalItems: number;
  completedCount: number;
}

export interface FridgeScanStartedEvent extends BaseEvent {
  type: 'fridge-scan:started';
  sessionId: string;
}

export interface FridgeScanCompletedEvent extends BaseEvent {
  type: 'fridge-scan:completed';
  sessionId: string;
  totalItemsDetected: number;
  recipesGenerated: number;
}

export interface FridgeScanRecipeGeneratedEvent extends BaseEvent {
  type: 'fridge-scan:recipe-generated';
  sessionId: string;
  recipeTitle: string;
  cuisine: string;
  matchScore?: number;
}

export interface MealScannedEvent extends BaseEvent {
  type: 'meal:scanned';
  mealId: string;
  mealName: string;
  calories: number;
  protein: number;
  mealType: string;
}

export type CulinaryEvent =
  | MealPlanCreatedEvent
  | MealPlanCompletedEvent
  | ShoppingListCreatedEvent
  | ShoppingListItemCheckedEvent
  | ShoppingListCompletedEvent
  | FridgeScanStartedEvent
  | FridgeScanCompletedEvent
  | FridgeScanRecipeGeneratedEvent
  | MealScannedEvent;

export type TrainingEvent =
  | SessionStartedEvent
  | SessionCompletedEvent
  | ExerciseStartedEvent
  | ExerciseCompletedEvent
  | SetStartedEvent
  | SetCompletedEvent
  | RestStartedEvent
  | RestEndedEvent
  | RPEReportedEvent
  | LoadAdjustedEvent
  | PainReportedEvent
  | RecordAchievedEvent
  | QuestionAskedEvent
  | FeedbackProvidedEvent;

export type HeadEvent = TrainingEvent | CulinaryEvent;

export type EventListener<T extends HeadEvent = HeadEvent> = (event: T) => void | Promise<void>;

export interface EventSubscription {
  unsubscribe: () => void;
}
