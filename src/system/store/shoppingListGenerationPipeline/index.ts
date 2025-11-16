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
      // Note: AI generation can take 2-3 minutes
      logger.info('SHOPPING_LIST_PIPELINE', '[API_CALL] Invoking shopping-list-generator edge function', {
        user_id: user.id,
        meal_plan_id: config.selectedMealPlanId,
        generation_mode: config.generationMode,
        region_coefficient: coefficient,
        note: 'AI generation may take 2-3 minutes'
      });

      const { data, error } = await supabase.functions.invoke('shopping-list-generator', {
        body: {
          user_id: user.id,
          meal_plan_id: config.selectedMealPlanId,
          generation_mode: config.generationMode,
          region_coefficient: coefficient
        }
      });

      logger.info('SHOPPING_LIST_PIPELINE', '[API_RESPONSE] Received response from edge function', {
        hasData: !!data,
        hasError: !!error,
        dataKeys: data ? Object.keys(data) : [],
        errorDetails: error ? JSON.stringify(error) : null
      });

      if (error) {
        logger.error('SHOPPING_LIST_PIPELINE', '[API_ERROR] Edge function error', {
          error,
          errorMessage: error.message,
          errorDetails: JSON.stringify(error)
        });
        throw error;
      }

      if (!data) {
        logger.error('SHOPPING_LIST_PIPELINE', '[API_ERROR] No data received from edge function');
        throw new Error('No data received from shopping list generator');
      }

      logger.debug('SHOPPING_LIST_PIPELINE', '[API_DATA] Raw response data', {
        shopping_list_type: Array.isArray(data.shopping_list) ? 'array' : typeof data.shopping_list,
        shopping_list_length: Array.isArray(data.shopping_list) ? data.shopping_list.length : 'N/A',
        has_suggestions: !!data.suggestions,
        has_advice: !!data.advice,
        has_budget: !!data.budget_estimation,
        raw_data: JSON.stringify(data, null, 2)
      });

      if (!data.shopping_list) {
        logger.error('SHOPPING_LIST_PIPELINE', '[API_ERROR] No shopping_list in response', {
          data,
          dataKeys: Object.keys(data)
        });
        throw new Error('Invalid response from shopping list generator: missing shopping_list');
      }

      if (!Array.isArray(data.shopping_list)) {
        logger.error('SHOPPING_LIST_PIPELINE', '[API_ERROR] shopping_list is not an array', {
          type: typeof data.shopping_list,
          value: data.shopping_list
        });
        throw new Error('Invalid response: shopping_list must be an array');
      }

      if (data.shopping_list.length === 0) {
        logger.error('SHOPPING_LIST_PIPELINE', '[API_ERROR] shopping_list is EMPTY array!');
        throw new Error('Shopping list is empty. Please try again.');
      }

      // Transform response with region pricing
      logger.info('SHOPPING_LIST_PIPELINE', '[TRANSFORM_START] Starting transformation', {
        categories_count: data.shopping_list.length,
        coefficient
      });

      const categories = (data.shopping_list || []).map((cat: any, catIndex: number) => {
        logger.debug('SHOPPING_LIST_PIPELINE', `[TRANSFORM_CAT_${catIndex}] Processing category`, {
          category_name: cat.category || cat.name,
          items_count: cat.items?.length || 0,
          has_estimatedTotal: !!cat.estimatedTotal
        });

        if (!cat.items || !Array.isArray(cat.items)) {
          logger.warn('SHOPPING_LIST_PIPELINE', `[TRANSFORM_WARNING] Category has no items array`, {
            category: cat.category || cat.name,
            items: cat.items
          });
        }

        if (cat.items?.length === 0) {
          logger.warn('SHOPPING_LIST_PIPELINE', `[TRANSFORM_WARNING] Category has ZERO items`, {
            category: cat.category || cat.name
          });
        }

        // Transform items (AI does not provide individual prices, only global budget)
        const categoryItems = (cat.items || []).map((item: any, itemIndex: number) => {
          logger.debug('SHOPPING_LIST_PIPELINE', `[TRANSFORM_ITEM_${catIndex}_${itemIndex}]`, {
            name: item.name,
            quantity: item.quantity,
            note: 'AI does not provide individual prices'
          });

          return {
            id: item.id || `item-${Date.now()}-${Math.random()}`,
            name: item.name || 'Unknown Item',
            quantity: item.quantity || '1',
            estimatedPrice: 0, // AI does not provide individual prices, only global budget
            priority: item.priority || 'medium',
            isChecked: false
          };
        });

        // Category total is 0 because AI doesn't provide item prices
        const categoryTotalCents = 0;

        return {
          id: cat.id || `category-${Date.now()}-${Math.random()}`,
          name: cat.category || cat.name || 'Unknown Category',
          icon: cat.icon || 'Package',
          color: cat.color || '#fb923c',
          estimatedTotal: categoryTotalCents, // Store in cents
          items: categoryItems
        };
      });

      const totalItems = categories.reduce((total, cat) => total + cat.items.length, 0);
      // Total cost is 0 because AI only provides global budget, not item prices
      const totalEstimatedCost = 0;

      logger.info('SHOPPING_LIST_PIPELINE', '[TRANSFORM_COMPLETE] Transformation completed', {
        total_categories: categories.length,
        total_items: totalItems,
        total_estimated_cost: totalEstimatedCost,
        note: 'Item prices are 0 - AI provides only global budget estimate',
        categories_summary: categories.map(cat => ({
          name: cat.name,
          items_count: cat.items.length,
          estimated_total: cat.estimatedTotal
        }))
      });

      if (totalItems === 0) {
        logger.error('SHOPPING_LIST_PIPELINE', '[TRANSFORM_ERROR] ZERO total items after transformation!');
        throw new Error('No items in shopping list after transformation');
      }

      // Parse budget estimation from API response
      const minCents = (data.budget_estimation?.minCents || 0) * coefficient;
      const maxCents = (data.budget_estimation?.maxCents || 0) * coefficient;
      const avgCents = (data.budget_estimation?.avgCents || 0) * coefficient;

      logger.info('SHOPPING_LIST_PIPELINE', '[BUDGET_PARSING] Budget from API', {
        api_minCents: data.budget_estimation?.minCents,
        api_maxCents: data.budget_estimation?.maxCents,
        api_avgCents: data.budget_estimation?.avgCents,
        coefficient,
        final_minCents: minCents,
        final_maxCents: maxCents,
        final_avgCents: avgCents,
        estimated_cost_string: data.budget_estimation?.estimated_cost
      });

      const budgetEstimation: BudgetEstimation = {
        minTotal: minCents,
        maxTotal: maxCents,
        averageTotal: avgCents,
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

      logger.info('SHOPPING_LIST_PIPELINE', '[CANDIDATE_CREATED] Shopping list candidate created', {
        id: shoppingListCandidate.id,
        name: shoppingListCandidate.name,
        totalItems: shoppingListCandidate.totalItems,
        totalEstimatedCost: shoppingListCandidate.totalEstimatedCost,
        categoriesCount: shoppingListCandidate.categories.length,
        suggestionsCount: shoppingListCandidate.suggestions?.length || 0,
        adviceCount: shoppingListCandidate.advice?.length || 0,
        full_candidate: JSON.stringify(shoppingListCandidate, null, 2)
      });

      // Stop progress and move to validation
      get().stopSimulatedProgress();

      logger.info('SHOPPING_LIST_PIPELINE', '[STATE_UPDATE] Setting shopping list candidate in state');

      set({
        shoppingListCandidate,
        currentStep: 'validation',
        loadingState: 'idle',
        loadingMessage: 'Liste générée avec succès !'
      });

      logger.info('SHOPPING_LIST_PIPELINE', '[GENERATION_COMPLETE] Generation completed successfully', {
        sessionId: currentSessionId,
        totalItems,
        totalEstimatedCost,
        region,
        coefficient,
        current_step: 'validation'
      });

      // Award XP for shopping list generation using GamificationService
      // This ensures proper integration with the gaming system and correct XP values (15 XP)
      (async () => {
        try {
          const { data: { user } } = await supabase.auth.getUser();

          if (!user) {
            logger.warn('SHOPPING_LIST_PIPELINE', 'Cannot award XP: user not authenticated', {
              sessionId: currentSessionId
            });
            return;
          }

          const { gamificationService } = await import('../../../services/dashboard/coeur');

          // Award XP for shopping list generation with detailed metadata
          const xpResult = await gamificationService.awardShoppingListGeneratedXp(user.id, {
            list_id: shoppingListCandidate.id,
            list_name: shoppingListCandidate.name,
            total_items: shoppingListCandidate.totalItems,
            categories_count: shoppingListCandidate.categories.length,
            generation_mode: shoppingListCandidate.generationMode,
            session_id: currentSessionId,
            meal_plan_id: config.selectedMealPlanId,
            timestamp: new Date().toISOString()
          });

          logger.info('SHOPPING_LIST_PIPELINE', 'XP awarded successfully via GamificationService', {
            sessionId: currentSessionId,
            listId: shoppingListCandidate.id,
            totalItems: shoppingListCandidate.totalItems,
            xpAwarded: xpResult.xpAwarded,
            baseXp: xpResult.baseXp,
            multiplier: xpResult.multiplier,
            leveledUp: xpResult.leveledUp,
            newLevel: xpResult.newLevel,
            timestamp: new Date().toISOString()
          });

          // Force immediate refresh of gaming widget
          const { queryClient } = await import('../../../app/providers/AppProviders');
          await queryClient.refetchQueries({ queryKey: ['gamification-progress'], type: 'active' });
          await queryClient.refetchQueries({ queryKey: ['xp-events'], type: 'active' });
          await queryClient.refetchQueries({ queryKey: ['daily-actions'], type: 'active' });

          logger.info('SHOPPING_LIST_PIPELINE', 'Gaming widget queries refetched after shopping list generation', {
            sessionId: currentSessionId,
            xpAwarded: xpResult.xpAwarded,
            timestamp: new Date().toISOString()
          });
        } catch (error) {
          logger.warn('SHOPPING_LIST_PIPELINE', 'Failed to award XP for shopping list generation', {
            error: error instanceof Error ? error.message : 'Unknown error',
            sessionId: currentSessionId,
            timestamp: new Date().toISOString()
          });
          // Don't throw - XP attribution failure should not block user workflow
        }
      })();

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
      logger.info('SHOPPING_LIST_PIPELINE', '[SAVE_START] Saving shopping list to database', {
        user_id: user.id,
        name: shoppingListCandidate.name,
        total_items: shoppingListCandidate.totalItems,
        total_estimated_cost_cents: shoppingListCandidate.totalEstimatedCost,
        has_budget_estimation: !!shoppingListCandidate.budgetEstimation,
        has_suggestions: !!shoppingListCandidate.suggestions,
        has_advice: !!shoppingListCandidate.advice
      });

      const { data: savedList, error: listError } = await supabase
        .from('shopping_lists')
        .insert({
          user_id: user.id,
          name: shoppingListCandidate.name,
          generation_mode: shoppingListCandidate.generationMode,
          meal_plan_id: state.config.selectedMealPlanId,
          total_items: shoppingListCandidate.totalItems,
          total_estimated_cost_cents: shoppingListCandidate.totalEstimatedCost, // Column name with _cents suffix
          budget_estimation: shoppingListCandidate.budgetEstimation,
          suggestions: shoppingListCandidate.suggestions,
          advice: shoppingListCandidate.advice
        })
        .select()
        .single();

      if (listError) {
        logger.error('SHOPPING_LIST_PIPELINE', 'Failed to save list', {
          error: listError,
          error_message: listError.message,
          error_code: listError.code,
          error_details: listError.details
        });
        throw listError;
      }

      logger.info('SHOPPING_LIST_PIPELINE', '[SAVE_LIST_SUCCESS] Shopping list saved', {
        list_id: savedList.id
      });

      // Insert all items
      const itemsToInsert = shoppingListCandidate.categories.flatMap(category =>
        category.items.map(item => ({
          shopping_list_id: savedList.id,
          category_name: category.name,
          category_icon: category.icon,
          category_color: category.color,
          item_name: item.name,
          quantity: item.quantity,
          estimated_price_cents: item.estimatedPrice, // Column name with _cents suffix
          priority: item.priority,
          is_checked: false
        }))
      );

      logger.info('SHOPPING_LIST_PIPELINE', '[SAVE_ITEMS_START] Inserting items', {
        items_count: itemsToInsert.length
      });

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
