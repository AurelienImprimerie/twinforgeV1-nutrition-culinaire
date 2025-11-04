import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useRecipeGenerationPipeline } from '../../../system/store/recipeGeneration';
import { useMealPlanStore } from '../../../system/store/mealPlanStore';
import { useUserStore } from '../../../system/store/userStore';
import { useFeedback } from '../../../hooks/useFeedback';
import { useToast } from '../../../ui/components/ToastProvider';
import RecipeGenerationProgressHeader from './components/RecipeGenerationProgressHeader';
import ConfigurationStage from './stages/ConfigurationStage';
import GeneratingStage from './stages/GeneratingStage';
import ValidationStage from './stages/ValidationStage';
import logger from '../../../lib/utils/logger';

const RecipeGenerationPage: React.FC = () => {
  const navigate = useNavigate();
  const { click, success } = useFeedback();
  const { showToast } = useToast();
  const { session } = useUserStore();

  // Recipe generation state
  const {
    currentStep,
    isActive,
    currentSessionId,
    simulatedOverallProgress,
    loadingState,
    loadingMessage,
    recipeCandidates,
    config,
    steps,
    startPipeline,
    setConfig,
    generateRecipes,
    saveRecipes,
    discardRecipes,
    resetPipeline
  } = useRecipeGenerationPipeline();

  // Meal plan state for inventory
  const {
    availableInventories,
    loadAvailableInventories
  } = useMealPlanStore();

  // Initialize pipeline on mount
  useEffect(() => {
    if (!isActive) {
      startPipeline();
    }
  }, []);

  // Load inventories on mount
  useEffect(() => {
    if (session?.user?.id) {
      loadAvailableInventories();
    }
  }, [session?.user?.id, loadAvailableInventories]);

  // Handle inventory selection
  const handleSelectInventory = (inventoryId: string) => {
    click();
    setConfig({ selectedInventoryId: inventoryId });

    logger.info('RECIPE_GENERATION_PAGE', 'Inventory selected', {
      inventoryId,
      sessionId: currentSessionId,
      timestamp: new Date().toISOString()
    });
  };

  // Handle recipe count change
  const handleSetRecipeCount = (count: number) => {
    click();
    setConfig({ recipeCount: count });

    logger.info('RECIPE_GENERATION_PAGE', 'Recipe count updated', {
      recipeCount: count,
      sessionId: currentSessionId,
      timestamp: new Date().toISOString()
    });
  };

  // Handle generation
  const handleGenerate = async () => {
    click();

    if (!config.selectedInventoryId) {
      showToast({
        type: 'warning',
        title: 'Aucun inventaire sélectionné',
        message: 'Veuillez sélectionner un inventaire pour générer des recettes.',
        duration: 3000
      });
      return;
    }

    try {
      logger.info('RECIPE_GENERATION_PAGE', 'Starting generation', {
        sessionId: currentSessionId,
        config,
        timestamp: new Date().toISOString()
      });

      await generateRecipes();

      success();

      logger.info('RECIPE_GENERATION_PAGE', 'Generation completed successfully', {
        sessionId: currentSessionId,
        recipeCount: recipeCandidates.length,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('RECIPE_GENERATION_PAGE', 'Generation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        sessionId: currentSessionId,
        timestamp: new Date().toISOString()
      });

      showToast({
        type: 'error',
        title: 'Erreur de génération',
        message: error instanceof Error ? error.message : 'Une erreur est survenue lors de la génération',
        duration: 5000
      });
    }
  };

  // Handle save all recipes
  const handleSaveAll = async () => {
    click();

    try {
      logger.info('RECIPE_GENERATION_PAGE', 'Saving all recipes', {
        sessionId: currentSessionId,
        recipeCount: recipeCandidates.length,
        timestamp: new Date().toISOString()
      });

      await saveRecipes();

      success();

      showToast({
        type: 'success',
        title: 'Recettes sauvegardées',
        message: `${recipeCandidates.length} recette(s) ajoutée(s) à votre bibliothèque !`,
        duration: 3000
      });

      // Navigate to recipes library
      setTimeout(() => {
        navigate('/fridge#recipes');
      }, 500);

    } catch (error) {
      logger.error('RECIPE_GENERATION_PAGE', 'Failed to save recipes', {
        error: error instanceof Error ? error.message : 'Unknown error',
        sessionId: currentSessionId,
        timestamp: new Date().toISOString()
      });

      showToast({
        type: 'error',
        title: 'Erreur de sauvegarde',
        message: 'Une erreur est survenue lors de la sauvegarde des recettes',
        duration: 5000
      });
    }
  };

  // Handle discard
  const handleDiscard = () => {
    click();
    discardRecipes();

    showToast({
      type: 'info',
      title: 'Recettes annulées',
      message: 'Vous pouvez générer de nouvelles recettes',
      duration: 3000
    });

    logger.info('RECIPE_GENERATION_PAGE', 'Recipes discarded', {
      sessionId: currentSessionId,
      timestamp: new Date().toISOString()
    });
  };

  // Handle exit
  const handleExit = () => {
    click();

    // If we have unsaved recipes, show confirmation
    if (recipeCandidates.length > 0 && currentStep === 'validation') {
      const confirmed = window.confirm(
        'Vous avez des recettes non sauvegardées. Voulez-vous vraiment quitter ?'
      );

      if (!confirmed) return;
    }

    resetPipeline();
    navigate('/fridge#recipes');

    logger.info('RECIPE_GENERATION_PAGE', 'Pipeline exited', {
      sessionId: currentSessionId,
      timestamp: new Date().toISOString()
    });
  };

  // Handle view recipe
  const handleViewRecipe = (recipe: any) => {
    click();
  };

  const currentStepData = steps.find(s => s.id === currentStep) || steps[0];
  const isGenerating = loadingState === 'generating' || loadingState === 'streaming';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="space-y-6"
    >
      {/* Progress Header */}
      <RecipeGenerationProgressHeader
        currentStep={currentStepData}
        overallProgress={simulatedOverallProgress}
        loadingMessage={loadingMessage}
      />

      {/* Exit Button */}
      <div className="flex justify-end">
        <button
          onClick={handleExit}
          className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-white font-medium transition-all duration-200"
        >
          Quitter
        </button>
      </div>

      {/* Stage Content */}
      {currentStep === 'configuration' && (
        <ConfigurationStage
          availableInventories={availableInventories}
          selectedInventoryId={config.selectedInventoryId}
          recipeCount={config.recipeCount}
          onSelectInventory={handleSelectInventory}
          onSetRecipeCount={handleSetRecipeCount}
          onGenerate={handleGenerate}
          isGenerating={isGenerating}
        />
      )}

      {currentStep === 'generating' && <GeneratingStage />}

      {currentStep === 'validation' && (
        <ValidationStage
          recipes={recipeCandidates}
          onSaveAll={handleSaveAll}
          onDiscard={handleDiscard}
          onViewRecipe={handleViewRecipe}
          isSaving={false}
        />
      )}
    </motion.div>
  );
};

export default RecipeGenerationPage;
