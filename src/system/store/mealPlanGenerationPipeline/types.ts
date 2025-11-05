import type { Recipe } from '../../../domain/recipe';

export type MealPlanGenerationStep =
  | 'configuration'
  | 'generating'
  | 'validation'
  | 'recipe_details_generating'
  | 'recipe_details_validation';

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

export interface Meal {
  id: string;
  type: string;
  name: string;
  description?: string;
  ingredients?: any[];
  prepTime?: number;
  cookTime?: number;
  calories?: number;
  nutritionalInfo?: any;
  imageUrl?: string;
  imageStatus?: string;
  recipeGenerated: boolean;
  recipeId?: string;
  detailedRecipe?: any;
  recipe?: Recipe;
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
  processedRecipesCount: number;
  totalRecipesToGenerate: number;

  // Data state
  mealPlanCandidates: MealPlan[];

  // Loading states
  loadingState: 'idle' | 'generating' | 'streaming' | 'generating_recipes' | 'streaming_recipes' | 'saving';
  loadingMessage: string;

  // Steps configuration
  steps: MealPlanGenerationStepData[];

  // Actions
  startPipeline: () => void;
  goToStep: (step: MealPlanGenerationStep) => void;
  setConfig: (config: Partial<MealPlanGenerationConfig>) => void;
  generateMealPlans: () => Promise<void>;
  generateDetailedRecipes: () => Promise<void>;
  saveMealPlans: (withRecipes: boolean) => Promise<void>;
  discardMealPlans: () => void;
  resetPipeline: () => void;
  setLoadingState: (state: 'idle' | 'generating' | 'streaming' | 'generating_recipes' | 'streaming_recipes' | 'saving') => void;
  updateMealPlanStatus: (planId: string, status: 'loading' | 'ready') => void;
  updateMealStatus: (planId: string, mealId: string, status: 'loading' | 'ready', recipe?: Recipe) => void;
  updateMealImageUrl: (recipeId: string, imageUrl: string) => void;

  // Progress persistence actions
  loadProgressFromDatabase: () => Promise<boolean>;
  clearSavedProgress: () => Promise<void>;
}
