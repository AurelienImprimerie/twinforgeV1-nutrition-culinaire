/**
 * Shopping List Generation Pipeline Store
 * Manages the 3-step shopping list generation flow
 */

import { create } from 'zustand';
import { supabase } from '../../supabase/client';
import logger from '../../../lib/utils/logger';
import {
  ShoppingListGenerationStep,
  LoadingState,
  ShoppingListConfig,
  ShoppingListCandidate,
  BudgetEstimation
} from './types';
import {
  SHOPPING_LIST_GENERATION_STEPS,
  LOADING_MESSAGES,
  REGION_PRICE_COEFFICIENTS,
  REGION_NAMES
} from './constants';

interface ShoppingListGenerationPipelineState {
  // Pipeline state
  currentStep: ShoppingListGenerationStep;
  isActive: boolean;
  currentSessionId: string | null;

  // Configuration
  config: ShoppingListConfig;

  // Loading state
  loadingState: LoadingState;
  loadingMessage: string;
  simulatedOverallProgress: number;
  progressInterval: NodeJS.Timeout | null;

  // Generated shopping list
  shoppingListCandidate: ShoppingListCandidate | null;

  // Steps metadata
  steps: typeof SHOPPING_LIST_GENERATION_STEPS;

  // Actions
  startPipeline: () => void;
  resetPipeline: () => void;
  setConfig: (config: Partial<ShoppingListConfig>) => void;
  generateShoppingList: () => Promise<void>;
  saveShoppingList: () => Promise<void>;
  discardShoppingList: () => void;
  startSimulatedProgress: (type: 'generating' | 'saving') => void;
  stopSimulatedProgress: () => void;
}

const getRegionCoefficient = (countryCode?: string): { coefficient: number; region: string } => {
  const code = countryCode?.toUpperCase() || 'FR';
  return {
    coefficient: REGION_PRICE_COEFFICIENTS[code] || 1.00,
    region: REGION_NAMES[code] || 'France métropolitaine'
  };
};

export const useShoppingListGenerationPipeline = create<ShoppingListGenerationPipelineState>((set, get) => ({
  // Initial state
  currentStep: 'configuration',
  isActive: false,
  currentSessionId: null,

  config: {
    selectedMealPlanId: null,
    generationMode: 'user_only'
  },

  loadingState: 'idle',
  loadingMessage: '',
  simulatedOverallProgress: 0,
  progressInterval: null,

  shoppingListCandidate: null,

  steps: SHOPPING_LIST_GENERATION_STEPS,

  // Start pipeline
  startPipeline: () => {
    const sessionId = `shopping-list-gen-${Date.now()}`;

    logger.info('SHOPPING_LIST_PIPELINE', 'Starting pipeline', { sessionId });

    set({
      isActive: true,
      currentSessionId: sessionId,
      currentStep: 'configuration',
      loadingState: 'idle',
      shoppingListCandidate: null
    });
  },

  // Reset pipeline
  resetPipeline: () => {
    const state = get();

    if (state.progressInterval) {
      clearInterval(state.progressInterval);
    }

    logger.info('SHOPPING_LIST_PIPELINE', 'Resetting pipeline');

    set({
      isActive: false,
      currentSessionId: null,
      currentStep: 'configuration',
      config: {
        selectedMealPlanId: null,
        generationMode: 'user_only'
      },
      loadingState: 'idle',
      loadingMessage: '',
      simulatedOverallProgress: 0,
      progressInterval: null,
      shoppingListCandidate: null
    });
  },

  // Update configuration
  setConfig: (newConfig) => {
    set((state) => ({
      config: {
        ...state.config,
        ...newConfig
      }
    }));
  },

  // Start simulated progress
  startSimulatedProgress: (type) => {
    const state = get();

    if (state.progressInterval) {
      clearInterval(state.progressInterval);
    }

    const messages = LOADING_MESSAGES[type];
    let messageIndex = 0;

    set({
      simulatedOverallProgress: 0,
      loadingMessage: messages[0].title
    });

    const totalDuration = 30000;
    const messageDuration = totalDuration / messages.length;
    const progressIncrement = 95 / messages.length;

    const interval = setInterval(() => {
      const currentState = get();
      const newProgress = Math.min(95, (messageIndex + 1) * progressIncrement);

      set({
        simulatedOverallProgress: newProgress,
        loadingMessage: messages[messageIndex]?.title || messages[messages.length - 1].title
      });

      messageIndex++;

      if (messageIndex >= messages.length) {
        messageIndex = messages.length - 1;
      }
    }, messageDuration);

    set({ progressInterval: interval });
  },

  // Stop simulated progress
  stopSimulatedProgress: () => {
    const state = get();

    if (state.progressInterval) {
      clearInterval(state.progressInterval);
      set({
        progressInterval: null,
        simulatedOverallProgress: 100
      });
    }
  },

  // Generate shopping list
  generateShoppingList: async () => {
    const state = get();
    const { config, currentSessionId } = state;

    if (!config.selectedMealPlanId) {
      throw new Error('No meal plan selected');
    }

    logger.info('SHOPPING_LIST_PIPELINE', 'Starting generation', {
      sessionId: currentSessionId,
      config
    });

    try {
      set({
        currentStep: 'generating',
        loadingState: 'generating'
      });

      // Start progress simulation
      get().startSimulatedProgress('generating');

      // Get current user and profile
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Fetch user profile for region-based pricing
      const { data: profile } = await supabase
        .from('user_profile')
        .select('country')
        .eq('user_id', user.id)
        .maybeSingle();

      const { coefficient, region } = getRegionCoefficient(profile?.country);

      logger.info('SHOPPING_LIST_PIPELINE', 'Region pricing info', {
        region,
        coefficient,
        country: profile?.country
      });

      // Call the shopping-list-generator Edge Function
      const { data, error } = await supabase.functions.invoke('shopping-list-generator', {
        body: {
          user_id: user.id,
          meal_plan_id: config.selectedMealPlanId,
          generation_mode: config.generationMode,
          region_coefficient: coefficient
        }
      });

      if (error) {
        logger.error('SHOPPING_LIST_PIPELINE', 'Edge function error', { error });
        throw error;
      }

      if (!data || !data.shopping_list) {
        logger.error('SHOPPING_LIST_PIPELINE', 'Invalid response', { data });
        throw new Error('Invalid response from shopping list generator');
      }

      // Transform response with region pricing
      const categories = (data.shopping_list || []).map((cat: any) => ({
        id: cat.id || `category-${Date.now()}-${Math.random()}`,
        name: cat.category || cat.name || 'Unknown Category',
        icon: cat.icon || 'Package',
        color: cat.color || '#fb923c',
        estimatedTotal: (cat.estimatedTotal || 0) * coefficient,
        items: (cat.items || []).map((item: any) => ({
          id: item.id || `item-${Date.now()}-${Math.random()}`,
          name: item.name || 'Unknown Item',
          quantity: item.quantity || '1',
          estimatedPrice: (item.estimatedPrice || 0) * coefficient,
          priority: item.priority || 'medium',
          isChecked: false
        }))
      }));

      const totalItems = categories.reduce((total, cat) => total + cat.items.length, 0);
      const totalEstimatedCost = categories.reduce((total, cat) => total + cat.estimatedTotal, 0);

      const budgetEstimation: BudgetEstimation = {
        minTotal: (data.budget_estimation?.minTotal || 0) * coefficient,
        maxTotal: (data.budget_estimation?.maxTotal || 0) * coefficient,
        averageTotal: (data.budget_estimation?.averageTotal || 0) * coefficient,
        byCategory: data.budget_estimation?.byCategory || {},
        region,
        coefficient
      };

      const shoppingListCandidate: ShoppingListCandidate = {
        id: data.shopping_list?.id || `list-${Date.now()}`,
        name: data.shopping_list?.name || 'Liste de Courses',
        generationMode: config.generationMode,
        totalItems,
        totalEstimatedCost,
        categories,
        suggestions: data.suggestions || [],
        advice: data.advice || [],
        budgetEstimation,
        createdAt: new Date().toISOString()
      };

      // Stop progress and move to validation
      get().stopSimulatedProgress();

      set({
        shoppingListCandidate,
        currentStep: 'validation',
        loadingState: 'idle',
        loadingMessage: 'Liste générée avec succès !'
      });

      logger.info('SHOPPING_LIST_PIPELINE', 'Generation completed', {
        sessionId: currentSessionId,
        totalItems,
        totalEstimatedCost,
        region,
        coefficient
      });

    } catch (error) {
      logger.error('SHOPPING_LIST_PIPELINE', 'Generation failed', { error });

      get().stopSimulatedProgress();

      set({
        loadingState: 'error',
        loadingMessage: 'Erreur lors de la génération'
      });

      throw error;
    }
  },

  // Save shopping list
  saveShoppingList: async () => {
    const state = get();
    const { shoppingListCandidate, currentSessionId } = state;

    if (!shoppingListCandidate) {
      throw new Error('No shopping list to save');
    }

    logger.info('SHOPPING_LIST_PIPELINE', 'Saving shopping list', {
      sessionId: currentSessionId
    });

    try {
      set({ loadingState: 'saving' });

      get().startSimulatedProgress('saving');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Insert shopping list into database
      const { data: savedList, error: listError } = await supabase
        .from('shopping_lists')
        .insert({
          user_id: user.id,
          name: shoppingListCandidate.name,
          generation_mode: shoppingListCandidate.generationMode,
          meal_plan_id: state.config.selectedMealPlanId,
          total_items: shoppingListCandidate.totalItems,
          total_estimated_cost: shoppingListCandidate.totalEstimatedCost,
          budget_estimation: shoppingListCandidate.budgetEstimation,
          suggestions: shoppingListCandidate.suggestions,
          advice: shoppingListCandidate.advice
        })
        .select()
        .single();

      if (listError) {
        logger.error('SHOPPING_LIST_PIPELINE', 'Failed to save list', { error: listError });
        throw listError;
      }

      // Insert all items
      const itemsToInsert = shoppingListCandidate.categories.flatMap(category =>
        category.items.map(item => ({
          shopping_list_id: savedList.id,
          category_name: category.name,
          category_icon: category.icon,
          category_color: category.color,
          item_name: item.name,
          quantity: item.quantity,
          estimated_price: item.estimatedPrice,
          priority: item.priority,
          is_checked: false
        }))
      );

      const { error: itemsError } = await supabase
        .from('shopping_list_items')
        .insert(itemsToInsert);

      if (itemsError) {
        logger.error('SHOPPING_LIST_PIPELINE', 'Failed to save items', { error: itemsError });
        throw itemsError;
      }

      get().stopSimulatedProgress();

      set({
        loadingState: 'idle',
        loadingMessage: 'Liste sauvegardée avec succès !'
      });

      logger.info('SHOPPING_LIST_PIPELINE', 'Shopping list saved successfully', {
        listId: savedList.id,
        itemCount: itemsToInsert.length
      });

    } catch (error) {
      logger.error('SHOPPING_LIST_PIPELINE', 'Failed to save shopping list', { error });

      get().stopSimulatedProgress();

      set({
        loadingState: 'error',
        loadingMessage: 'Erreur lors de la sauvegarde'
      });

      throw error;
    }
  },

  // Discard shopping list
  discardShoppingList: () => {
    logger.info('SHOPPING_LIST_PIPELINE', 'Discarding shopping list');

    set({
      shoppingListCandidate: null,
      currentStep: 'configuration',
      loadingState: 'idle',
      loadingMessage: ''
    });
  }
}));
