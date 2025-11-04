import type { StateCreator } from 'zustand';
import type { MealPlanGenerationPipelineState, MealPlanGenerationStep } from '../types';
import { MEAL_PLAN_GENERATION_STEPS } from '../constants';
import logger from '../../../../lib/utils/logger';

export interface NavigationActions {
  startPipeline: () => void;
  goToStep: (step: MealPlanGenerationStep) => void;
  resetPipeline: () => void;
}

export const createNavigationActions = (
  set: StateCreator<MealPlanGenerationPipelineState>['setState'],
  get: StateCreator<MealPlanGenerationPipelineState>['getState']
): NavigationActions => ({
  startPipeline: () => {
    const sessionId = crypto.randomUUID();

    set({
      isActive: true,
      currentStep: 'configuration',
      currentSessionId: sessionId,
      simulatedOverallProgress: 0,
      mealPlanCandidates: [],
      loadingState: 'idle',
      loadingMessage: ''
    });

    logger.info('MEAL_PLAN_GENERATION_PIPELINE', 'Pipeline started', {
      sessionId,
      timestamp: new Date().toISOString()
    });
  },

  goToStep: (step: MealPlanGenerationStep) => {
    const stepData = MEAL_PLAN_GENERATION_STEPS.find(s => s.id === step);

    if (!stepData) {
      logger.error('MEAL_PLAN_GENERATION_PIPELINE', 'Invalid step', { step });
      return;
    }

    set({
      currentStep: step,
      simulatedOverallProgress: stepData.startProgress
    });

    logger.info('MEAL_PLAN_GENERATION_PIPELINE', 'Step changed', {
      newStep: step,
      sessionId: get().currentSessionId,
      timestamp: new Date().toISOString()
    });
  },

  resetPipeline: () => {
    const state = get();

    set({
      isActive: false,
      currentStep: 'configuration',
      currentSessionId: null,
      simulatedOverallProgress: 0,
      mealPlanCandidates: [],
      loadingState: 'idle',
      loadingMessage: '',
      config: {
        selectedInventoryId: null,
        weekCount: 1,
        batchCooking: false
      }
    });

    logger.info('MEAL_PLAN_GENERATION_PIPELINE', 'Pipeline reset', {
      previousSessionId: state.currentSessionId,
      timestamp: new Date().toISOString()
    });
  }
});
