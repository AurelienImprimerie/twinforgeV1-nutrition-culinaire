import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../supabase/client';
import { ShoppingList, ShoppingListCategory, ShoppingListItem } from '../../domain/shoppingList';
import logger from '../../lib/utils/logger';

interface ShoppingListState {
  shoppingList: ShoppingList | null;
  allShoppingLists: ShoppingList[];
  suggestions: any[];
  advice: string[];
  budgetEstimation: any;
  generationMode: 'user_only' | 'user_and_family';
  selectedMealPlanId: string | null;
  isGenerating: boolean;
  simulatedProgressPercentage: number;
  currentLoadingTitle: string;
  currentLoadingSubtitle: string;
  progressInterval: NodeJS.Timeout | null;
  error: string | null;

  // Actions
  setGenerationMode: (mode: 'user_only' | 'user_and_family') => void;
  setSelectedMealPlanId: (id: string | null) => void;
  generateShoppingList: (params: GenerateShoppingListParams) => Promise<void>;
  loadAllShoppingLists: () => Promise<void>;
  startSimulatedProgress: () => void;
  stopSimulatedProgress: () => void;
  reset: () => void;
}

interface GenerateShoppingListParams {
  generationMode: 'user_only' | 'user_and_family';
  selectedMealPlanId: string;
}

const LOADING_TITLES = [
  "Analyse du plan de repas...",
  "Calcul des quantités nécessaires...",
  "Génération de la liste intelligente...",
  "Optimisation des catégories...",
  "Ajout de suggestions personnalisées...",
  "Estimation budgétaire en cours..."
];

const LOADING_SUBTITLES = [
  "Examen détaillé de vos repas planifiés",
  "Adaptation selon vos préférences alimentaires",
  "Optimisation personnalisée en cours",
  "Organisation par rayons de magasin",
  "Conseils personnalisés basés sur votre profil",
  "Calcul des coûts selon votre région"
];

export const useShoppingListStore = create<ShoppingListState>()(
  persist(
    (set, get) => ({
      shoppingList: null,
      allShoppingLists: [],
      suggestions: [],
      advice: [],
      budgetEstimation: null,
      generationMode: 'user_only',
      selectedMealPlanId: null,
      isGenerating: false,
      simulatedProgressPercentage: 0,
      currentLoadingTitle: '',
      currentLoadingSubtitle: '',
      progressInterval: null,
      error: null,

      setGenerationMode: (mode) => set({ generationMode: mode }),
      setSelectedMealPlanId: (id) => set({ selectedMealPlanId: id }),

      loadAllShoppingLists: async () => {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) {
            logger.warn('SHOPPING_LIST_STORE', 'Cannot load shopping lists: user not authenticated');
            return;
          }

          const { data, error } = await supabase
            .from('shopping_lists')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

          if (error) {
            logger.error('SHOPPING_LIST_STORE', 'Failed to load shopping lists', { error });
            set({ error: error.message });
            return;
          }

          logger.info('SHOPPING_LIST_STORE', 'Loaded shopping lists', { count: data?.length || 0 });

          // Transform database records to ShoppingList objects
          const lists: ShoppingList[] = (data || []).map(record => ({
            id: record.id,
            name: record.name || 'Liste de Courses',
            generationMode: record.generation_mode || 'user_only',
            totalItems: record.total_items || 0,
            completedItems: record.completed_items || 0,
            totalEstimatedCost: record.total_estimated_cost || 0,
            categories: [], // Will be loaded with items when needed
            createdAt: record.created_at,
            updatedAt: record.updated_at
          }));

          set({ allShoppingLists: lists, error: null });
        } catch (error) {
          logger.error('SHOPPING_LIST_STORE', 'Exception loading shopping lists', { error });
          set({ error: error instanceof Error ? error.message : 'Failed to load shopping lists' });
        }
      },

      startSimulatedProgress: () => {
        const state = get();
        if (state.progressInterval) {
          clearInterval(state.progressInterval);
        }

        set({ 
          simulatedProgressPercentage: 0,
          currentLoadingTitle: LOADING_TITLES[0],
          currentLoadingSubtitle: LOADING_SUBTITLES[0]
        });

        let currentStep = 0;
        const totalDuration = 30000; // 30 seconds
        const stepDuration = totalDuration / LOADING_TITLES.length;
        const incrementPerStep = 95 / LOADING_TITLES.length; // Go up to 95%, leave 5% for completion

        const interval = setInterval(() => {
          const state = get();
          const newProgress = Math.min(95, (currentStep + 1) * incrementPerStep);
          
          set({
            simulatedProgressPercentage: newProgress,
            currentLoadingTitle: LOADING_TITLES[currentStep] || LOADING_TITLES[LOADING_TITLES.length - 1],
            currentLoadingSubtitle: LOADING_SUBTITLES[currentStep] || LOADING_SUBTITLES[LOADING_SUBTITLES.length - 1]
          });

          currentStep++;
          
          if (currentStep >= LOADING_TITLES.length) {
            // Keep the last step active but don't increment further
            currentStep = LOADING_TITLES.length - 1;
          }
        }, stepDuration);

        set({ progressInterval: interval });
      },

      stopSimulatedProgress: () => {
        const state = get();
        if (state.progressInterval) {
          clearInterval(state.progressInterval);
          set({ 
            progressInterval: null,
            simulatedProgressPercentage: 100,
            currentLoadingTitle: 'Liste générée avec succès !',
            currentLoadingSubtitle: 'Votre liste de courses personnalisée est prête'
          });
        }
      },

      generateShoppingList: async (params) => {
        const { generationMode, selectedMealPlanId } = params;
        
        logger.info('SHOPPING_LIST_STORE', 'Starting shopping list generation', {
          generationMode,
          selectedMealPlanId
        });

        try {
          set({ isGenerating: true });
          
          // Start simulated progress
          get().startSimulatedProgress();

          // Get current user
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) {
            logger.error('Cannot generate shopping list: user not authenticated');
            throw new Error('User not authenticated');
          }

          logger.info('Starting shopping list generation', {
            mealPlanId: selectedMealPlanId,
            generationMode,
            userId: user.id
          });

          logger.debug('Calling shopping-list-generator edge function');

          // Call the shopping-list-generator Edge Function
          const { data, error } = await supabase.functions.invoke('shopping-list-generator', {
            body: {
              user_id: user.id,
              meal_plan_id: selectedMealPlanId,
              generation_mode: generationMode
            }
          });

          if (error) {
            logger.error('Shopping list generation API error', error);
            logger.error('SHOPPING_LIST_STORE', 'Edge function error', { error });
            throw error;
          }

          if (!data || !data.shopping_list) {
            logger.error('SHOPPING_LIST_STORE', 'Invalid response from edge function', { data });
            throw new Error('Invalid response from shopping list generator');
          }

          logger.info('Shopping list generation API response received', {
            hasShoppingList: !!data.shopping_list,
            hasSuggestions: !!data.suggestions,
            hasAdvice: !!data.advice,
            hasBudgetEstimation: !!data.budget_estimation
          });

          // Transform the response data into a proper ShoppingList object
          const categories: ShoppingListCategory[] = (data.shopping_list || []).map((cat: any) => ({
            id: cat.id || `category-${Date.now()}-${Math.random()}`,
            name: cat.category || cat.name || 'Unknown Category',
            icon: cat.icon || 'Package',
            color: cat.color || '#6B7280',
            estimatedTotal: cat.estimatedTotal || 0,
            items: (cat.items || []).map((item: any) => ({
              id: item.id || `item-${Date.now()}-${Math.random()}`,
              name: item.name || 'Unknown Item',
              quantity: item.quantity || '1',
              estimatedPrice: item.estimatedPrice || 0,
              priority: item.priority || 'medium',
              isChecked: false
            }))
          }));

          const totalItems = categories.reduce((total, cat) => total + cat.items.length, 0);

          logger.info('SHOPPING_LIST_STORE', 'Successfully generated shopping list', {
            categoriesCount: categories.length,
            itemCount: totalItems,
            suggestionsCount: data.suggestions?.length || 0,
            adviceCount: data.advice?.length || 0,
            hasBudget: !!data.budget_estimation
          });

          // Log detailed category breakdown
          categories.forEach((category, index) => {
            logger.debug('SHOPPING_LIST_STORE', `Category ${index + 1}: ${category.name}`, {
              itemsCount: category.items.length,
              items: category.items.map(item => `${item.name} (${item.quantity})`)
            });
          });

          const shoppingList: ShoppingList = {
            id: data.shopping_list?.id || `list-${Date.now()}`,
            name: data.shopping_list?.name || 'Liste de Courses',
            generationMode: generationMode,
            totalItems: totalItems,
            completedItems: 0,
            totalEstimatedCost: data.shopping_list?.totalEstimatedCost || 0,
            categories: categories,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };

          // Stop simulated progress and set final state
          get().stopSimulatedProgress();

          set({
            shoppingList: shoppingList,
            suggestions: data.suggestions || [],
            advice: data.advice || [],
            budgetEstimation: data.budget_estimation || null,
            isGenerating: false
          });

          logger.info('Shopping list generation completed successfully', {
            itemsCount: totalItems,
            suggestionsCount: data.suggestions?.length || 0,
            adviceCount: data.advice?.length || 0
          });

          // Award XP for shopping list generation (async IIFE to not block UI)
          (async () => {
            try {
              if (user?.id && totalItems > 0) {
                const { gamificationService } = await import('../../services/dashboard/coeur');
                await gamificationService.awardShoppingListGeneratedXp(user.id, {
                  mealPlanId: selectedMealPlanId,
                  generationMode,
                  itemsGenerated: totalItems,
                  categoriesCount: categories.length,
                  timestamp: new Date().toISOString()
                });

                logger.info('SHOPPING_LIST_STORE', 'XP awarded for shopping list generation', {
                  mealPlanId: selectedMealPlanId,
                  itemsGenerated: totalItems,
                  xpAwarded: 15,
                  timestamp: new Date().toISOString()
                });

                // Force refetch gamification queries to refresh gaming widget immediately
                const { queryClient } = await import('../../app/providers/AppProviders');
                await queryClient.refetchQueries({ queryKey: ['gamification-progress'], type: 'active' });
                await queryClient.refetchQueries({ queryKey: ['xp-events'], type: 'active' });
                await queryClient.refetchQueries({ queryKey: ['daily-actions'], type: 'active' });

                logger.info('SHOPPING_LIST_STORE', 'Gaming widget queries refetched after shopping list generation', {
                  mealPlanId: selectedMealPlanId,
                  xpAwarded: 15,
                  timestamp: new Date().toISOString()
                });
              }
            } catch (xpError) {
              logger.warn('SHOPPING_LIST_STORE', 'Failed to award XP for shopping list generation', {
                error: xpError instanceof Error ? xpError.message : 'Unknown error',
                mealPlanId: selectedMealPlanId,
                timestamp: new Date().toISOString()
              });
            }
          })();

        } catch (error) {
          logger.error('Shopping list generation failed', error);
          logger.error('SHOPPING_LIST_STORE', 'Failed to generate shopping list', { error });
          
          // Stop progress and reset state
          get().stopSimulatedProgress();
          set({
            isGenerating: false,
            simulatedProgressPercentage: 0
          });
          throw error;
        }
      },

      reset: () => {
        const state = get();
        if (state.progressInterval) {
          clearInterval(state.progressInterval);
        }
        
        set({
          shoppingList: null,
          suggestions: [],
          advice: [],
          budgetEstimation: null,
          selectedMealPlanId: null,
          isGenerating: false,
          simulatedProgressPercentage: 0,
          currentLoadingTitle: '',
          currentLoadingSubtitle: '',
          progressInterval: null
        });
      }
    }),
    {
      name: 'shopping-list-store',
      partialize: (state) => ({
        shoppingList: state.shoppingList,
        suggestions: state.suggestions,
        advice: state.advice,
        budgetEstimation: state.budgetEstimation,
        generationMode: state.generationMode,
        selectedMealPlanId: state.selectedMealPlanId
      })
    }
  )
);