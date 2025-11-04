import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useMealPlanGenerationStore } from '../../../system/store/mealPlanGenerationStore';
import { useMealPlanStore } from '../../../system/store/mealPlanStore';
import { useUserStore } from '../../../system/store/userStore';
import { useFeedback } from '../../../hooks/useFeedback';
import { useToast } from '../../../ui/components/ToastProvider';
import MealPlanGenerationProgressHeader from './components/MealPlanGenerationProgressHeader';
import ConfigurationStage from './stages/ConfigurationStage';
import GeneratingPlanStage from './stages/GeneratingPlanStage';
import PreviewStage from './stages/PreviewStage';
import GeneratingRecipesStage from './stages/GeneratingRecipesStage';
import ValidationStage from './stages/ValidationStage';
import logger from '../../../lib/utils/logger';

const MealPlanGenerationPage: React.FC = () => {
  const navigate = useNavigate();
  const { click, success } = useFeedback();
  const { showToast } = useToast();
  const { session } = useUserStore();

  const {
    currentStep,
    isActive,
    currentSessionId,
    simulatedOverallProgress,
    loadingState,
    loadingMessage,
    planCandidates,
    config,
    steps,
    startPipeline,
    setConfig,
    generateMealPlans,
    generateDetailedRecipes,
    savePlans,
    discardPlans,
    resetPipeline,
    regenerateWeek,
    regenerateMeal
  } = useMealPlanGenerationStore();

  const {
    availableInventories,
    loadAvailableInventories
  } = useMealPlanStore();

  useEffect(() => {
    if (!isActive) {
      startPipeline();
    }
  }, []);

  useEffect(() => {
    if (session?.user?.id) {
      loadAvailableInventories();
    }
  }, [session?.user?.id, loadAvailableInventories]);

  useEffect(() => {
    if (availableInventories.length > 0 && !config.selectedInventoryId) {
      const latestInventory = availableInventories[0];
      setConfig({ selectedInventoryId: latestInventory.id });

      logger.info('MEAL_PLAN_GENERATION_PAGE', 'Auto-selected latest inventory', {
        inventoryId: latestInventory.id,
        sessionId: currentSessionId
      });
    }
  }, [availableInventories, config.selectedInventoryId, setConfig, currentSessionId]);

  const handleSetWeekCount = (count: number) => {
    click();
    setConfig({ weekCount: count });
  };

  const handleToggleBatchCooking = () => {
    click();
    setConfig({ batchCookingEnabled: !config.batchCookingEnabled });
  };

  const handleGenerate = async () => {
    click();

    if (!config.selectedInventoryId) {
      showToast({
        type: 'warning',
        title: 'Aucun inventaire sélectionné',
        message: 'Veuillez sélectionner un inventaire pour générer un plan.',
        duration: 3000
      });
      return;
    }

    try {
      await generateMealPlans();
      success();
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Erreur de génération',
        message: error instanceof Error ? error.message : 'Une erreur est survenue',
        duration: 5000
      });
    }
  };

  const handleProceedToRecipes = async () => {
    click();
    try {
      await generateDetailedRecipes();
      success();
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Erreur',
        message: 'Impossible de générer les recettes détaillées',
        duration: 5000
      });
    }
  };

  const handleSaveAll = async () => {
    click();

    try {
      await savePlans();
      success();

      showToast({
        type: 'success',
        title: 'Plans sauvegardés',
        message: `${planCandidates.length} plan(s) ajouté(s) à votre bibliothèque !`,
        duration: 3000
      });

      setTimeout(() => {
        navigate('/fridge#plan');
      }, 500);

    } catch (error) {
      showToast({
        type: 'error',
        title: 'Erreur de sauvegarde',
        message: 'Une erreur est survenue lors de la sauvegarde',
        duration: 5000
      });
    }
  };

  const handleDiscard = () => {
    click();
    discardPlans();

    showToast({
      type: 'info',
      title: 'Plans annulés',
      message: 'Vous pouvez générer de nouveaux plans',
      duration: 3000
    });
  };

  const handleExit = () => {
    click();

    if (planCandidates.length > 0 && (currentStep === 'preview' || currentStep === 'validation')) {
      const confirmed = window.confirm(
        'Vous avez des plans non sauvegardés. Voulez-vous vraiment quitter ?'
      );

      if (!confirmed) return;
    }

    resetPipeline();
    navigate('/fridge#plan');
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
      <MealPlanGenerationProgressHeader
        currentStep={currentStepData}
        overallProgress={simulatedOverallProgress}
        loadingMessage={loadingMessage}
      />

      {currentStep === 'configuration' && (
        <ConfigurationStage
          availableInventories={availableInventories}
          selectedInventoryId={config.selectedInventoryId}
          weekCount={config.weekCount}
          batchCookingEnabled={config.batchCookingEnabled}
          onSetWeekCount={handleSetWeekCount}
          onToggleBatchCooking={handleToggleBatchCooking}
          onGenerate={handleGenerate}
          isGenerating={isGenerating}
          onExit={handleExit}
        />
      )}

      {currentStep === 'generating_plan' && (
        <>
          <GeneratingPlanStage />
          <div className="flex justify-end">
            <button
              onClick={handleExit}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-white font-medium transition-all duration-200"
            >
              Quitter
            </button>
          </div>
        </>
      )}

      {currentStep === 'preview' && (
        <>
          <PreviewStage
            plans={planCandidates}
            onProceedToRecipes={handleProceedToRecipes}
            onRegenerateWeek={regenerateWeek}
            onRegenerateMeal={regenerateMeal}
            onDiscard={handleDiscard}
            isGenerating={false}
          />
          <div className="flex justify-end">
            <button
              onClick={handleExit}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-white font-medium transition-all duration-200"
            >
              Quitter
            </button>
          </div>
        </>
      )}

      {currentStep === 'generating_recipes' && (
        <>
          <GeneratingRecipesStage />
          <div className="flex justify-end">
            <button
              onClick={handleExit}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-white font-medium transition-all duration-200"
            >
              Quitter
            </button>
          </div>
        </>
      )}

      {currentStep === 'validation' && (
        <>
          <ValidationStage
            plans={planCandidates}
            onSaveAll={handleSaveAll}
            onDiscard={handleDiscard}
            isSaving={loadingState === 'streaming'}
          />
          <div className="flex justify-end">
            <button
              onClick={handleExit}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-white font-medium transition-all duration-200"
            >
              Quitter
            </button>
          </div>
        </>
      )}
    </motion.div>
  );
};

export default MealPlanGenerationPage;
