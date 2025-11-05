import type { Recipe } from '../../../domain/recipe';

export type MealPlanGenerationStep =
  | 'configuration'
  | 'generating'
  | 'validation';

export interface MealPlanGenerationStepData {
  id: MealPlanGenerationStep;
  title: string;
  subtitle: string;
  icon: keyof typeof import('../../../ui/icons/registry').ICONS;
  color: string;
  startProgress: number;
}

export interface MealPlan {
  id: string;
  title: string;
  weekNumber: number;
  startDate: string;
  endDate: string;
  days: MealPlanDay[];
  aiExplanation?: string;
  nutritionalSummary?: any;
  batchCookingEnabled: boolean;
  status: 'loading' | 'ready';
}

export interface MealPlanDay {
  date: string;
  dayIndex: number;
  meals: Meal[];
  dailyCalories?: number;
  dailyMacros?: any;
}

export interface DetailedRecipe {
  id: string;
  title: string;
  prepTimeMin?: number;
  cookTimeMin?: number;
  imageUrl?: string;
  ingredients: Array<{
    name: string;
    quantity: string;
    unit: string;
  }>;
  instructions: Array<{
    step: number;
    instruction: string;
    timeMin?: number;
    equipment?: string;
  }>;
  tips: string[];
  variations: string[];
  difficulty: 'facile' | 'moyen' | 'difficile';
  servings: number;
  nutritionalInfo: {
    kcal: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
  };
  dietaryTags: string[];
  imageSignature: string;
  status: 'loading' | 'ready';
}

export interface Meal {
  id: string;
  type: string;
  name: string;
  description?: string;
  ingredients?: string[]; // BASE data: simple strings from meal-plan-generator
  prepTime?: number;
  cookTime?: number;
  calories?: number;
  imageUrl?: string;
  imageStatus?: string;
  recipeGenerated: boolean; // false until recipe-detail-generator responds
  detailedRecipe?: DetailedRecipe | null; // enriched data from recipe-detail-generator
  status: 'loading' | 'ready';
}

export interface MealPlanGenerationConfig {
  selectedInventoryId: string | null;
  weekCount: number;
  batchCooking: boolean;
}

export interface MealPlanGenerationPipelineState {
  // Pipeline state
  currentStep: MealPlanGenerationStep;
  isActive: boolean;
  currentSessionId: string | null;

  // Configuration
  config: MealPlanGenerationConfig;

  // Progress state
  simulatedOverallProgress: number;
  lastStateUpdate: number;
  receivedDaysCount: number;
  totalDaysToGenerate: number;
  enrichedMealsCount: number; // Meals enriched by recipe-detail-generator
  totalMealsToEnrich: number; // Total meals to enrich

  // Data state
  mealPlanCandidates: MealPlan[];

  // Loading states
  loadingState: 'idle' | 'generating' | 'streaming' | 'enriching' | 'saving';
  loadingMessage: string;

  // Steps configuration
  steps: MealPlanGenerationStepData[];

  // Actions
  startPipeline: () => void;
  goToStep: (step: MealPlanGenerationStep) => void;
  setConfig: (config: Partial<MealPlanGenerationConfig>) => void;
  generateMealPlans: () => Promise<void>;
  saveMealPlans: (withRecipes: boolean) => Promise<void>;
  discardMealPlans: () => void;
  resetPipeline: () => void;
  setLoadingState: (state: 'idle' | 'generating' | 'streaming' | 'enriching' | 'saving') => void;
  updateMealWithDetailedRecipe: (planId: string, mealId: string, detailedRecipe: DetailedRecipe) => void;
  updateMealPlanStatus: (planId: string, status: 'loading' | 'ready') => void;
  updateMealStatus: (planId: string, mealId: string, status: 'loading' | 'ready', recipe?: Recipe) => void;
  updateMealImageUrl: (recipeId: string, imageUrl: string) => void;

  // Progress persistence actions
  loadProgressFromDatabase: () => Promise<boolean>;
  clearSavedProgress: () => Promise<void>;
}
