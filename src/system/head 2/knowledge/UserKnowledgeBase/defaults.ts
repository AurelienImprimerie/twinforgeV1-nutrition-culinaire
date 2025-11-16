import type {
  ProfileKnowledge,
  TrainingKnowledge,
  EquipmentKnowledge,
  NutritionKnowledge,
  FastingKnowledge,
  BodyScanKnowledge,
  EnergyKnowledge,
  TemporalKnowledge,
  GamificationKnowledge,
  PredictionKnowledge
} from '../../types';
import type { BreastfeedingKnowledge } from '../collectors/BreastfeedingDataCollector';

export function getDefaultProfileKnowledge(userId: string): ProfileKnowledge {
  return {
    userId,
    displayName: undefined,
    fullName: undefined,
    email: undefined,
    age: undefined,
    sex: undefined,
    birthdate: undefined,
    height: undefined,
    weight: undefined,
    targetWeight: undefined,
    bodyFatPerc: undefined,
    objectives: [],
    objective: undefined,
    activityLevel: undefined,
    jobCategory: undefined,
    preferredDisciplines: [],
    defaultDiscipline: undefined,
    level: undefined,
    equipment: [],
    country: undefined,
    language: undefined,
    preferredLanguage: undefined,
    hasCompletedBodyScan: false,
    createdAt: undefined,
    updatedAt: undefined
  };
}

export function getDefaultTrainingKnowledge(): TrainingKnowledge {
  return {
    recentSessions: [],
    currentLoads: {},
    exercisePreferences: [],
    progressionPatterns: [],
    avgRPE: 0,
    weeklyVolume: 0,
    lastSessionDate: null
  };
}

export function getDefaultEquipmentKnowledge(): EquipmentKnowledge {
  return {
    locations: [],
    availableEquipment: [],
    defaultLocationId: null,
    lastScanDate: null
  };
}

export function getDefaultNutritionKnowledge(): NutritionKnowledge {
  return {
    recentMeals: [],
    mealPlans: {
      activePlans: [],
      recentPlans: [],
      currentWeekPlan: null,
      totalPlansGenerated: 0,
      totalPlansCompleted: 0,
      lastPlanDate: null,
      averageWeeklyPlans: 0,
      hasActivePlan: false,
      hasData: false
    },
    shoppingLists: {
      activeList: null,
      recentLists: [],
      totalListsGenerated: 0,
      totalListsCompleted: 0,
      lastListDate: null,
      averageItemsPerList: 0,
      averageCompletionRate: 0,
      totalBudgetSpent: 0,
      hasActiveList: false,
      hasData: false
    },
    fridgeScans: {
      currentSession: null,
      recentSessions: [],
      currentInventory: [],
      totalItemsInFridge: 0,
      lastScanDate: null,
      totalScansCompleted: 0,
      averageItemsPerScan: 0,
      generatedRecipes: [],
      hasActiveSession: false,
      hasInventory: false,
      hasData: false
    },
    scanFrequency: 0,
    lastScanDate: null,
    averageCalories: 0,
    averageProtein: 0,
    dietaryPreferences: [],
    culinaryPreferences: {
      favoriteCuisines: [],
      cookingSkillLevel: 'intermediate',
      mealPrepTime: { weekday: 30, weekend: 60 }
    },
    hasData: false
  };
}

export function getDefaultFastingKnowledge(): FastingKnowledge {
  return {
    recentSessions: [],
    currentSession: null,
    averageFastingDuration: 0,
    totalSessionsCompleted: 0,
    preferredProtocol: null,
    lastSessionDate: null,
    hasData: false
  };
}

export function getDefaultBodyScanKnowledge(): BodyScanKnowledge {
  return {
    recentScans: [],
    lastScanDate: null,
    latestMeasurements: null,
    progressionTrend: null,
    hasData: false
  };
}

export function getDefaultEnergyKnowledge(): EnergyKnowledge {
  return {
    recentActivities: [],
    connectedDevices: [],
    hasWearableConnected: false,
    biometrics: {
      hrResting: null,
      hrMax: null,
      hrAvg: null,
      hrvAvg: null,
      vo2maxEstimated: null
    },
    recoveryScore: 50,
    fatigueScore: 50,
    trainingLoad7d: 0,
    lastActivityDate: null,
    hasData: false
  };
}

export function getDefaultTemporalKnowledge(): TemporalKnowledge {
  return {
    trainingPatterns: [],
    availabilityWindows: [],
    optimalTrainingTimes: [],
    restDayPatterns: {
      preferredRestDays: [],
      averageRestDaysBetweenSessions: 0
    },
    weeklyFrequency: 0,
    preferredTimeOfDay: null,
    averageSessionDuration: 0,
    consistencyScore: 0,
    hasData: false
  };
}

export function getDefaultBreastfeedingKnowledge(): BreastfeedingKnowledge {
  return {
    hasData: false,
    isBreastfeeding: false,
    breastfeedingType: null,
    babyAgeMonths: null,
    startDate: null,
    durationMonths: null,
    nutritionalNeeds: {
      extraCalories: 0,
      extraProtein: 0,
      calciumNeed: 1000,
      ironNeed: 18,
      omega3Need: 250,
      waterIntake: 2.0,
    },
    recommendations: {
      priorityFoods: [],
      limitedFoods: [],
      avoidFoods: [],
      mealFrequency: 'Standard',
    },
    notes: null,
  };
}

export function getDefaultGamificationKnowledge(): GamificationKnowledge {
  return {
    currentLevel: 1,
    currentXp: 0,
    xpToNextLevel: 100,
    totalXpEarned: 0,
    levelUpCount: 0,
    currentStreakDays: 0,
    longestStreakDays: 0,
    lastActivityDate: null,
    lastLevelUpAt: null,
    currentLevelInfo: null,
    nextLevelInfo: null,
    recentXpEvents: [],
    xpStats: {
      last7Days: 0,
      last30Days: 0,
      averagePerDay: 0,
      topCategory: null
    },
    weightHistory: [],
    hasData: false
  };
}

export function getDefaultPredictionKnowledge(): PredictionKnowledge {
  return {
    hasPrediction: false,
    activePrediction: null,
    milestones: [],
    influenceFactors: null,
    recommendations: [],
    predictionHistory: {
      totalPredictions: 0,
      averageConfidence: 0,
      lastPredictionDate: null
    },
    hasData: false
  };
}
