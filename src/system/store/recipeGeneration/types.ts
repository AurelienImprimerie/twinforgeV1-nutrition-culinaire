import type { Recipe } from '../../../domain/recipe';

export type RecipeGenerationStep = 'configuration' | 'generating' | 'validation';

export interface RecipeGenerationStepData {
  id: RecipeGenerationStep;
  title: string;
  subtitle: string;
  icon: keyof typeof import('../../../ui/icons/registry').ICONS;
  color: string;
  startProgress: number;
}

export interface RecipeGenerationConfig {
  selectedInventoryId: string | null;
  recipeCount: number;
}

export interface RecipeGenerationPipelineState {
  // Pipeline state
  currentStep: RecipeGenerationStep;
  isActive: boolean;
  currentSessionId: string | null;

  // Configuration
  config: RecipeGenerationConfig;

  // Progress state
  simulatedOverallProgress: number;

  // Data state
  recipeCandidates: Recipe[];

  // Loading states
  loadingState: 'idle' | 'generating' | 'streaming';
  loadingMessage: string;

  // Steps configuration
  steps: RecipeGenerationStepData[];

  // Actions
  startPipeline: () => void;
  goToStep: (step: RecipeGenerationStep) => void;
  setConfig: (config: Partial<RecipeGenerationConfig>) => void;
  generateRecipes: () => Promise<void>;
  saveRecipes: () => Promise<void>;
  discardRecipes: () => void;
  resetPipeline: () => void;
  setLoadingState: (state: 'idle' | 'generating' | 'streaming') => void;
  updateRecipeImageUrlInCandidates: (
    recipeId: string,
    imageUrl?: string,
    isGeneratingImage?: boolean,
    imageGenerationError?: boolean
  ) => void;
}
