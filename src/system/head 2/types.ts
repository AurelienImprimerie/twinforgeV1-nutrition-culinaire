/**
 * Head System - Core Types
 * Central type definitions for the brain system
 */

// ============================================
// Core Brain Types
// ============================================

export type ForgeType = 'training' | 'nutrition' | 'fasting' | 'body-scan' | 'equipment' | 'energy' | 'temporal';

export type ActivityState =
  | 'idle'
  | 'navigation'
  | 'training-active'
  | 'training-rest'
  | 'post-training'
  | 'meal-scan'
  | 'fridge-scan'
  | 'body-scan'
  | 'profile-editing';

export interface AppContext {
  currentRoute: string;
  previousRoute: string | null;
  pageContext: PageContext;
  activityState: ActivityState;
  timestamp: number;
}

export interface PageContext {
  type: 'home' | 'training' | 'profile' | 'settings' | 'other';
  subContext?: string; // e.g., 'pipeline-step-3', 'profile-health-tab'
  parameters?: Record<string, any>;
}

// ============================================
// User Knowledge Types
// ============================================

export interface UserKnowledge {
  profile: ProfileKnowledge;
  training: TrainingKnowledge;
  equipment: EquipmentKnowledge;
  nutrition: NutritionKnowledge;
  fasting: FastingKnowledge;
  bodyScan: BodyScanKnowledge;
  energy: EnergyKnowledge;
  temporal: TemporalKnowledge;
  gamification: GamificationKnowledge;
  prediction: PredictionKnowledge;
  calorieBalance: CalorieBalanceKnowledge;
  absence?: AbsenceKnowledge;
  today: TodayData | null;
  lastUpdated: Record<ForgeType, number>;
  completeness: Record<ForgeType, number>; // 0-100%
}

export interface ProfileKnowledge {
  // Core Identity
  userId: string;
  displayName?: string;
  fullName?: string;
  email?: string;

  // Physical Attributes
  age?: number;
  sex?: 'male' | 'female' | 'other';
  birthdate?: string; // ISO date
  height?: number; // height_cm
  weight?: number; // weight_kg
  targetWeight?: number; // target_weight_kg
  bodyFatPerc?: number; // body_fat_perc

  // Objectives & Activity
  objectives: string[]; // Legacy support
  objective?: 'fat_loss' | 'recomp' | 'muscle_gain'; // New structured field
  activityLevel?: 'sedentary' | 'light' | 'moderate' | 'active' | 'athlete';
  jobCategory?: 'office' | 'field' | 'shift' | 'manual' | 'student' | 'other';

  // Training Preferences
  preferredDisciplines: string[];
  defaultDiscipline?: string;
  level?: string; // Legacy support
  equipment?: string[]; // Legacy support

  // Localization
  country?: string;
  language?: string;
  preferredLanguage?: 'fr' | 'en';

  // Body Scan Status (for coaching awareness)
  hasCompletedBodyScan?: boolean;

  // Metadata
  createdAt?: string;
  updatedAt?: string;
}

export interface TrainingKnowledge {
  recentSessions: TrainingSessionSummary[];
  currentLoads: Record<string, number>; // exerciseName -> currentLoad
  exercisePreferences: ExercisePreference[];
  progressionPatterns: ProgressionPattern[];
  avgRPE: number;
  weeklyVolume: number;
  lastSessionDate: string | null;
  personalRecords: PersonalRecord[];
  activeGoals: TrainingGoal[];
  hasData: boolean;
}

export interface PersonalRecord {
  exerciseName: string;
  load: number;
  reps: number;
  date: string;
  discipline: string;
}

export interface TrainingGoal {
  id: string;
  title: string;
  targetValue: number;
  currentValue: number;
  unit: string;
  deadline: string | null;
  isActive: boolean;
}

export interface TrainingExerciseDetail {
  id: string;
  name: string;
  sets: number;
  reps: number | string;
  load?: number | number[];
  rest: number;
  muscleGroups: string[];
  coachTips?: string[];
  executionCues?: string[];
}

export interface TrainingSessionSummary {
  sessionId: string;
  date: string;
  discipline: string;
  exerciseCount: number;
  duration: number;
  completed: boolean;
  avgRPE?: number;
  exercises?: TrainingExerciseDetail[]; // Detailed exercises from prescription
  sessionName?: string;
  expectedRpe?: number;
}

export interface ExercisePreference {
  exerciseName: string;
  enjoymentScore: number; // 1-5
  frequencyLast30Days: number;
  avgLoad: number;
}

export interface ProgressionPattern {
  exerciseName: string;
  trend: 'increasing' | 'stable' | 'decreasing';
  loadProgression: number; // % change over last month
  volumeProgression: number;
}

export interface EquipmentKnowledge {
  locations: TrainingLocation[];
  availableEquipment: string[];
  defaultLocationId: string | null;
  lastScanDate: string | null;
}

export interface TrainingLocation {
  id: string;
  name: string;
  type: string;
  equipment: string[];
}

export interface AITrendAnalysesKnowledge {
  trends: Array<{
    pattern: string;
    description: string;
    impact: 'positive' | 'negative' | 'neutral';
    confidence: number;
    recommendations: string[];
  }>;
  strategicAdvice: Array<{
    category: 'nutrition' | 'timing' | 'balance' | 'goals';
    advice: string;
    priority: 'low' | 'medium' | 'high';
    timeframe: 'immediate' | 'short_term' | 'long_term';
  }>;
  mealClassifications: Array<{
    meal_id: string;
    classification: 'balanced' | 'protein_rich' | 'needs_improvement' | 'excellent';
    reasoning: string;
    score: number;
  }>;
  lastAnalysisDate: string | null;
  analysisPeriod: '7_days' | '30_days';
  hasData: boolean;
}

export interface NutritionKnowledge {
  recentMeals: MealSummary[];
  mealPlans: MealPlanKnowledge;
  shoppingLists: ShoppingListKnowledge;
  fridgeScans: FridgeScanKnowledge;
  aiTrends: AITrendAnalysesKnowledge;
  scanFrequency: number;
  lastScanDate: string | null;
  averageCalories: number;
  averageProtein: number;
  dietaryPreferences: string[];
  culinaryPreferences: {
    favoriteCuisines: string[];
    cookingSkillLevel: string;
    mealPrepTime: { weekday: number; weekend: number };
  };
  hasData: boolean;
}

export interface MealItem {
  name: string;
  category: string;
  calories: number;
  proteins: number;
  carbs: number;
  fats: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
  portion_size?: string;
  confidence?: number;
}

export interface MealSummary {
  id: string;
  name: string;
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  mealType: string;
  items: MealItem[];
  photoUrl: string | null;
}

export interface RecipeDetailed {
  title: string;
  recipe: string;
  ingredients: string[];
  calories_est: number;
  prep_time_min: number;
  cook_time_min: number;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  date: string;
}

export interface MealPlanSummary {
  id: string;
  sessionId: string | null;
  title: string;
  weekNumber: number;
  startDate: string;
  endDate: string;
  status: 'draft' | 'active' | 'completed' | 'archived';
  isArchived: boolean;
  batchCookingEnabled: boolean;
  aiExplanation: string | null;
  nutritionalSummary: {
    totalCalories?: number;
    totalProtein?: number;
    totalCarbs?: number;
    totalFats?: number;
    averageCaloriesPerDay?: number;
  };
  planData: any; // Full meal plan JSON structure
  recipes: RecipeDetailed[]; // Extracted recipes from plan_data
  inventorySessionId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MealPlanKnowledge {
  activePlans: MealPlanSummary[];
  recentPlans: MealPlanSummary[];
  currentWeekPlan: MealPlanSummary | null;
  totalPlansGenerated: number;
  totalPlansCompleted: number;
  lastPlanDate: string | null;
  averageWeeklyPlans: number;
  hasActivePlan: boolean;
  hasData: boolean;
}

export interface ShoppingListItem {
  id: string;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  itemName: string;
  quantity: string;
  priority: 'low' | 'medium' | 'high';
  isChecked: boolean;
  estimatedPriceCents: number;
  createdAt: string;
  updatedAt: string;
}

export interface ShoppingListSummary {
  id: string;
  sessionId: string | null;
  title: string;
  status: 'draft' | 'active' | 'completed' | 'archived';
  isArchived: boolean;
  totalItems: number;
  completedCount: number;
  estimatedBudgetCents: number;
  advice: string | null;
  items: ShoppingListItem[];
  mealPlanId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ShoppingListKnowledge {
  activeList: ShoppingListSummary | null;
  recentLists: ShoppingListSummary[];
  totalListsGenerated: number;
  totalListsCompleted: number;
  lastListDate: string | null;
  averageItemsPerList: number;
  averageCompletionRate: number;
  totalBudgetSpent: number;
  hasActiveList: boolean;
  hasData: boolean;
}

export interface FridgeInventoryItem {
  id: string;
  name: string;
  label: string;
  category: string;
  quantity: string;
  estimatedQuantity?: string;
  expirationDate?: string;
  confidence?: number;
}

export interface FridgeScanSessionDetailed {
  sessionId: string;
  userId: string;
  stage: 'photo' | 'analyze' | 'complement' | 'validation' | 'generating_recipes' | 'recipes';
  completed: boolean;
  capturedPhotos: Array<{
    url: string;
    timestamp: string;
  }>;
  rawDetectedItems: FridgeInventoryItem[];
  userEditedInventory: FridgeInventoryItem[];
  suggestedComplementaryItems: FridgeInventoryItem[];
  recipeCandidates: Array<{
    id: string;
    title: string;
    cuisine: string;
    cookingTime: number;
    difficulty: string;
    ingredients: string[];
    matchScore?: number;
  }>;
  selectedRecipes: string[];
  mealPlan: any | null;
  metadata: any;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
}

export interface FridgeScanKnowledge {
  currentSession: FridgeScanSessionDetailed | null;
  recentSessions: FridgeScanSessionDetailed[];
  currentInventory: FridgeInventoryItem[];
  totalItemsInFridge: number;
  lastScanDate: string | null;
  totalScansCompleted: number;
  averageItemsPerScan: number;
  generatedRecipes: Array<{
    id: string;
    title: string;
    cuisine: string;
    cookingTime: number;
    difficulty: string;
    createdAt: string;
  }>;
  hasActiveSession: boolean;
  hasInventory: boolean;
  hasData: boolean;
}

export interface FastingKnowledge {
  recentSessions: FastingSessionSummary[];
  currentSession: FastingSessionSummary | null;
  averageFastingDuration: number;
  totalSessionsCompleted: number;
  preferredProtocol: string | null;
  lastSessionDate: string | null;
  hasData: boolean;
}

export interface FastingSessionSummary {
  id: string;
  startTime: string;
  endTime: string | null;
  targetDuration: number;
  actualDuration: number | null;
  protocol: string;
  status: 'in_progress' | 'completed' | 'cancelled';
  quality?: number;
}

export interface BodyScanKnowledge {
  recentScans: BodyScanSummary[];
  lastScanDate: string | null;
  latestMeasurements: BodyMeasurements | null;
  progressionTrend: 'improving' | 'stable' | 'declining' | null;
  morphologyInsights: MorphologyInsightsKnowledge;
  hasData: boolean;
}

export interface BodyScanSummary {
  id: string;
  scanDate: string;
  scanType: string;
  measurements: BodyMeasurements;
  morphValues?: Record<string, number>;
  limbMasses?: Record<string, number>;
  skinTone?: any;
  resolvedGender?: 'male' | 'female';
  avatarVersion?: string;
}

export interface BodyMeasurements {
  weight?: number;
  bodyFat?: number;
  muscleMass?: number;
  waist?: number;
  chest?: number;
  arms?: number;
  legs?: number;
}

// ============================================
// Morphology Insights Types (AI-Generated)
// ============================================

export interface MorphologyInsightsKnowledge {
  latestInsights: MorphInsight[];
  recentInsights: MorphInsightSummary[];
  lastInsightDate: string | null;
  summary: MorphInsightsSummary | null;
  totalInsightsGenerated: number;
  aiModelsUsed: string[];
  hasData: boolean;
}

export interface MorphInsight {
  id: string;
  title: string;
  description: string;
  type: 'recommendation' | 'observation' | 'achievement' | 'goal_progress';
  category: 'morphology' | 'fitness' | 'nutrition' | 'health' | 'goals';
  priority: 'high' | 'medium' | 'low';
  value?: string;
  icon: string;
  color: string;
  confidence: number;
  actionable?: {
    action: string;
    description: string;
  };
}

export interface MorphInsightSummary {
  scanId: string;
  userId: string;
  generatedAt: string;
  insightsCount: number;
  highPriorityCount: number;
  aiModel: string;
  confidence: number;
}

export interface MorphInsightsSummary {
  morphology_score: number;
  goal_alignment: number;
  health_indicators: number;
  recommendations_count: number;
}

export interface EnergyKnowledge {
  recentActivities: BiometricActivity[];
  connectedDevices: ConnectedDevice[];
  activityAnalyses: ActivityAnalysisKnowledge;
  hasWearableConnected: boolean;
  biometrics: {
    hrResting: number | null;
    hrMax: number | null;
    hrAvg: number | null;
    hrvAvg: number | null;
    vo2maxEstimated: number | null;
  };
  recoveryScore: number;
  fatigueScore: number;
  trainingLoad7d: number;
  lastActivityDate: string | null;
  hasData: boolean;
}

export interface ConnectedDevice {
  id: string;
  userId: string;
  provider: string;
  providerUserId: string;
  deviceType: string;
  deviceName: string;
  isActive: boolean;
  status: string;
  scopes: string[];
  lastSyncDate: string | null;
  metadata: any;
  connectedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface ActivityAnalysisKnowledge {
  recentAnalyses: ActivityAnalysisJob[];
  analysisByType: {
    activityAnalysis: ActivityAnalysisJob[];
    trendAnalysis: ActivityAnalysisJob[];
    transcription: ActivityAnalysisJob[];
  };
  lastAnalysisDate: string | null;
  analysisCount: number;
  successRate: number;
  averageProcessingTime: number;
  cachedAnalysesCount: number;
  hasData: boolean;
}

export interface ActivityAnalysisJob {
  id: string;
  userId: string;
  analysisType: 'activity_analysis' | 'trend_analysis' | 'activity_transcription';
  requestPayload: any;
  resultPayload: any;
  inputHash: string;
  status: 'processing' | 'completed' | 'failed';
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BiometricActivity {
  id: string;
  userId: string;
  timestamp: string;
  createdAt: string;
  discipline: string;
  duration: number;
  distance: number | null;
  caloriesBurned: number;
  notes: string | null;
  intensity: string | null;
  hrAvg: number | null;
  hrMax: number | null;
  hrMin: number | null;
  hrRestingPre: number | null;
  hrRecovery1Min: number | null;
  hrZone1Minutes: number | null;
  hrZone2Minutes: number | null;
  hrZone3Minutes: number | null;
  hrZone4Minutes: number | null;
  hrZone5Minutes: number | null;
  hrvPreActivity: number | null;
  hrvPostActivity: number | null;
  hrvAvgOvernight: number | null;
  vo2maxEstimated: number | null;
  trainingLoadScore: number | null;
  recoveryScore: number | null;
  fatigueLevel: number | null;
  efficiencyScore: number | null;
  avgPace: string | null;
  avgSpeedKmh: number | null;
  elevationGainMeters: number | null;
  elevationLossMeters: number | null;
  avgCadenceRpm: number | null;
  maxCadenceRpm: number | null;
  avgPowerWatts: number | null;
  maxPowerWatts: number | null;
  normalizedPower: number | null;
  sleepQualityScore: number | null;
  sleepDurationHours: number | null;
  stressLevelPre: number | null;
  bodyBatteryPre: number | null;
  wearableDeviceId: string | null;
  wearableActivityId: string | null;
  wearableSyncedAt: string | null;
  dataCompletenessScore: number | null;
  gpsAccuracyMeters: number | null;
  sensorQualityScore: number | null;
  weatherConditions: any | null;
  perceivedEffort: number | null;
}

export interface TemporalKnowledge {
  trainingPatterns: TrainingPattern[];
  availabilityWindows: AvailabilityWindow[];
  optimalTrainingTimes: Array<{
    dayOfWeek: number;
    timeOfDay: 'morning' | 'afternoon' | 'evening';
    score: number;
  }>;
  restDayPatterns: {
    preferredRestDays: number[];
    averageRestDaysBetweenSessions: number;
  };
  weeklyFrequency: number;
  preferredTimeOfDay: 'morning' | 'afternoon' | 'evening' | null;
  averageSessionDuration: number;
  consistencyScore: number;
  hasData: boolean;
}

export interface TrainingPattern {
  dayOfWeek: number;
  timeOfDay: 'morning' | 'afternoon' | 'evening';
  frequency: number;
  discipline: string;
  completionRate: number;
}

export interface AvailabilityWindow {
  dayOfWeek: number;
  startHour: number;
  endHour: number;
  label: string;
  isPreferred: boolean;
}

export interface GamificationKnowledge {
  currentLevel: number;
  currentXp: number;
  xpToNextLevel: number;
  totalXpEarned: number;
  levelUpCount: number;
  currentStreakDays: number;
  longestStreakDays: number;
  lastActivityDate: string | null;
  lastLevelUpAt: string | null;

  currentLevelInfo: {
    name: string;
    description: string | null;
    color: string;
    isMajorMilestone: boolean;
  } | null;

  nextLevelInfo: {
    name: string;
    xpRequired: number;
  } | null;

  recentXpEvents: Array<{
    eventType: string;
    eventCategory: string;
    finalXp: number;
    multiplier: number;
    eventDate: string;
  }>;

  xpStats: {
    last7Days: number;
    last30Days: number;
    averagePerDay: number;
    topCategory: string | null;
  };

  weightHistory: Array<{
    weight: number;
    delta: number | null;
    isMilestone: boolean;
    date: string;
  }>;

  hasData: boolean;
}

export interface PredictionKnowledge {
  hasPrediction: boolean;
  activePrediction: {
    predictedDate: string;
    confidenceScore: number;
    daysToTarget: number;
    weeklyTrend: number;
    weightToGo: number;
    scenarios: {
      optimistic: string;
      pessimistic: string;
    };
  } | null;
  milestones: Array<{
    type: string;
    weight: number;
    predictedDate: string;
    status: string;
    varianceDays: number;
  }>;
  influenceFactors: {
    activityScore: number;
    consistencyScore: number;
    caloricBalanceScore: number;
    overallScore: number;
  } | null;
  recommendations: string[];
  predictionHistory: {
    totalPredictions: number;
    averageConfidence: number;
    lastPredictionDate: string | null;
  };
  hasData: boolean;
}

export interface CalorieBalanceKnowledge {
  caloriesIn: number;
  caloriesOut: number;
  caloriesBalance: number;
  dailyTarget: number;
  remainingCalories: number;
  percentageOfTarget: number;
  calorieBreakdown: {
    meals: number;
    snacks: number;
    drinks: number;
  };
  activityBreakdown: {
    bmr: number;
    training: number;
    activities: number;
    neat: number;
  };
  macros: {
    protein: number;
    carbs: number;
    fat: number;
  };
  status: 'deficit' | 'maintenance' | 'surplus';
  lastMealTime: string | null;
  lastActivityTime: string | null;
  hasData: boolean;
}

// ============================================
// Absence & Reconciliation Types
// ============================================

export interface AbsenceKnowledge {
  hasActiveAbsence: boolean;
  currentAbsence: {
    daysAbsent: number;
    startDate: string;
    status: string;
    estimatedXp: number;
  } | null;

  pendingRewards: {
    totalPendingXp: number;
    rewardsCount: number;
    oldestRewardDate: string | null;
    expiringRewardsCount: number;
  };

  recentReconciliation: {
    hasRecent: boolean;
    reconciliationDate: string | null;
    weightDelta: number;
    awardedXp: number;
    coherenceScore: number;
    wasPositiveProgress: boolean;
  } | null;

  absenceHistory: {
    totalAbsences90Days: number;
    averageAbsenceDuration: number;
    longestAbsence: number;
    lastAbsenceDate: string | null;
  };

  recoveryStatus: {
    needsWeightUpdate: boolean;
    needsBodyScan: boolean;
    needsAvatarUpdate: boolean;
    daysSinceLastWeight: number;
    daysSinceLastScan: number | null;
  };

  hasData: boolean;
}

// ============================================
// Session Awareness Types
// ============================================

export interface SessionAwareness {
  isActive: boolean;
  sessionType: 'training' | 'nutrition' | 'fasting' | 'body-scan' | null;
  trainingSession?: TrainingSessionContext;
  timestamp: number;
}

export interface TrainingSessionContext {
  sessionId: string;
  currentExerciseIndex: number;
  totalExercises: number;
  currentExercise?: ExerciseContext;
  nextExercise?: ExerciseContext;
  currentSet: number;
  totalSets: number;
  isResting: boolean;
  restTimeRemaining: number;
  sessionTimeElapsed: number;
  lastRPE?: number;
  discipline: string;
}

export interface ExerciseContext {
  name: string;
  variant?: string;
  load?: number;
  reps: string;
  sets: number;
  rest: number;
  coachTips?: string[];
  muscleGroups?: string[];
}

// ============================================
// Brain Context Types
// ============================================

export interface BrainContext {
  user: UserKnowledge;
  app: AppContext;
  session: SessionAwareness;
  missingData: MissingDataReport;
  todayData?: TodayData | null;
  timestamp: number;
  cacheKey: string;
}

export interface TodayData {
  trainingSessions: TodayTrainingSession[];
  meals: TodayMeal[];
  fastingSession: TodayFastingSession | null;
  bodyScans: TodayBodyScan[];
  hasTraining: boolean;
  hasNutrition: boolean;
  hasFasting: boolean;
  hasBodyScan: boolean;
  totalActivities: number;
}

export interface TodayTrainingSession {
  id: string;
  discipline: string;
  startTime: string;
  endTime: string | null;
  status: 'planned' | 'in_progress' | 'completed';
  exerciseCount: number;
}

export interface TodayMeal {
  id: string;
  name: string;
  mealType: string;
  consumedAt: string;
  calories: number;
  protein: number;
}

export interface TodayFastingSession {
  id: string;
  startTime: string;
  targetDuration: number;
  currentDuration: number;
  status: 'in_progress' | 'completed';
}

export interface TodayBodyScan {
  id: string;
  scanType: string;
  scanTime: string;
}

export interface MissingDataReport {
  hasIncompletProfile: boolean;
  missingForges: ForgeType[];
  suggestions: ProactiveSuggestion[];
  priority: 'high' | 'medium' | 'low';
}

export interface ProactiveSuggestion {
  id: string;
  forge: ForgeType;
  action: string;
  message: string;
  priority: number;
  reason: string;
  timing: 'now' | 'after-training' | 'morning' | 'evening' | 'weekly';
}

// ============================================
// Prompt Building Types
// ============================================

export interface PromptEnrichment {
  systemPromptAdditions: string[];
  contextualInstructions: string[];
  userKnowledgeSummary: string;
  currentActivityContext: string;
  suggestedResponseStyle: ResponseStyle;
}

export interface ResponseStyle {
  length: 'ultra-short' | 'short' | 'medium' | 'detailed';
  tone: 'motivational' | 'technical' | 'informative' | 'conversational';
  formality: 'casual' | 'professional';
  emoji: boolean;
}

// ============================================
// Forge Module Interface
// ============================================

export interface IForgeModule {
  forgeType: ForgeType;

  /**
   * Collect data for this forge
   */
  collectData(userId: string): Promise<any>;

  /**
   * Get context summary for prompts
   */
  getContextSummary(data: any): string;

  /**
   * Detect missing or incomplete data
   */
  detectMissingData(data: any): MissingDataReport;

  /**
   * Get enrichment for prompts
   */
  getPromptEnrichment(data: any, context: AppContext): PromptEnrichment;

  /**
   * Check if data is fresh
   */
  isDataFresh(lastUpdate: number): boolean;
}

// ============================================
// Feedback Types
// ============================================

export interface TrainingFeedbackRecord {
  id: string;
  sessionId: string;
  userId: string;
  exerciseName?: string;
  setNumber?: number;
  category: FeedbackCategory;
  isKeyMoment: boolean;
  message: string;
  context: FeedbackContext;
  timestamp: number;
}

export type FeedbackCategory =
  | 'motivation'
  | 'technique'
  | 'difficulty'
  | 'pain'
  | 'progression'
  | 'question'
  | 'general';

export interface FeedbackContext {
  exerciseIndex: number;
  exerciseName: string;
  setNumber: number;
  load: number;
  rpe?: number;
  timeElapsed: number;
}

// ============================================
// Cache Types
// ============================================

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  key: string;
}

export interface CacheInvalidationRule {
  forge: ForgeType;
  events: string[]; // Supabase table names or event types
  ttl: number; // milliseconds
}

// ============================================
// Sync Types
// ============================================

export interface SyncEvent {
  type: 'insert' | 'update' | 'delete';
  table: string;
  userId: string;
  recordId: string;
  timestamp: number;
  affectedForges: ForgeType[];
}

export interface SyncStatus {
  isHealthy: boolean;
  lastSync: number;
  failedAttempts: number;
  affectedForges: ForgeType[];
}

// ============================================
// Monitoring Types
// ============================================

export interface PerformanceMetrics {
  dataCollectionLatency: number;
  contextBuildingLatency: number;
  promptGenerationLatency: number;
  cacheHitRate: number;
  totalLatency: number;
}

export interface HealthStatus {
  brain: 'healthy' | 'degraded' | 'down';
  supabase: 'connected' | 'disconnected';
  cache: 'fresh' | 'stale';
  lastCheck: number;
}

// ============================================
// Event System Types
// ============================================

export type { EventType, TrainingEvent, EventListener, EventSubscription } from './events/types';

// ============================================
// Conversation Memory Types
// ============================================

export interface ConversationMessage {
  id: string;
  userId: string;
  sessionId?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  messageType: 'text' | 'voice' | 'system';
  context?: {
    currentRoute?: string;
    activityState?: string;
    sessionType?: string;
    exerciseName?: string;
    setNumber?: number;
  };
  metadata?: Record<string, any>;
  timestamp: number;
  createdAt: string;
}

export interface ConversationSummary {
  totalMessages: number;
  textMessages: number;
  voiceMessages: number;
  systemMessages: number;
  firstMessageAt?: string;
  lastMessageAt?: string;
}
