import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useMealPlanGenerationPipeline } from '../../../system/store/mealPlanGenerationPipeline';
import { useMealPlanStore } from '../../../system/store/mealPlanStore';
import { useUserStore } from '../../../system/store/userStore';
import { useFeedback } from '../../../hooks/useFeedback';
import { useToast } from '../../../ui/components/ToastProvider';
import MealPlanGenerationProgressHeader from './components/MealPlanGenerationProgressHeader';
import ConfigurationStage from './stages/ConfigurationStage';
import GeneratingStage from './stages/GeneratingStage';
import ValidationStage from './stages/ValidationStage';
import RecipeDetailsGeneratingStage from './stages/RecipeDetailsGeneratingStage';
import RecipeDetailsValidationStage from './stages/RecipeDetailsValidationStage';
import ResumeProgressModal from './components/ResumeProgressModal';
import { mealPlanProgressService } from '../../../system/services/mealPlanProgressService';
import logger from '../../../lib/utils/logger';

const MealPlanGenerationPage: React.FC = () => {
  const navigate = useNavigate();
  const { click, success } = useFeedback();
  const { showToast } = useToast();
  const { session } = useUserStore();
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [savedSessionInfo, setSavedSessionInfo] = useState<any>(null);

  const {
    currentStep,
    isActive,
    currentSessionId,
    simulatedOverallProgress,
    loadingState,
    loadingMessage,
    mealPlanCandidates,
    config,
    steps,
    startPipeline,
    setConfig,
    generateMealPlans,
    generateDetailedRecipes,
    saveMealPlans,
    discardMealPlans,
    resetPipeline,
    loadProgressFromDatabase,
    clearSavedProgress
  } = useMealPlanGenerationPipeline();

  const {
    availableInventories,
    loadAvailableInventories
  } = useMealPlanStore();

  useEffect(() => {
    const checkSavedProgress = async () => {
      if (session?.user?.id) {
        const summary = await mealPlanProgressService.getProgressSummary(session.user.id);

        if (summary.hasSession && (summary.currentStep === 'validation' || summary.currentStep === 'recipe_details_validation')) {
          setSavedSessionInfo({
            currentStep: summary.currentStep,
            sessionId: summary.sessionId,
            updatedAt: summary.updatedAt
          });
          setShowResumeModal(true);
        } else if (!isActive) {
          startPipeline();
        }
      } else if (!isActive) {
        startPipeline();
      }
    };

    checkSavedProgress();
  }, [session?.user?.id, isActive, startPipeline]);

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
        sessionId: currentSessionId,
        timestamp: new Date().toISOString()
      });
    }
  }, [availableInventories, config.selectedInventoryId, setConfig, currentSessionId]);

  const handleSetWeekCount = (count: number) => {
    click();
    setConfig({ weekCount: count });
  };

  const handleSetBatchCooking = (enabled: boolean) => {
    click();
    setConfig({ batchCooking: enabled });
  };

  const handleGenerate = async () => {
    click();

    if (!config.selectedInventoryId) {
      showToast({
        type: 'warning',
        title: 'Aucun inventaire sélectionné',
        message: 'Veuillez sélectionner un inventaire pour générer des plans.',
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

  const handleSaveBasicPlan = async () => {
    click();
    try {
      await saveMealPlans(false);
      success();
      showToast({
        type: 'success',
        title: 'Plan sauvegardé avec succès !',
        message: 'Votre plan est maintenant disponible dans votre bibliothèque',
        duration: 4000,
        action: {
          label: 'Voir dans Plans',
          onClick: () => navigate('/fridge#plans')
        }
      });
      // DO NOT navigate automatically - let user stay on validation screen
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Erreur de sauvegarde',
        message: error instanceof Error ? error.message : 'Une erreur est survenue',
        duration: 5000
      });
    }
  };

  const handleGenerateAllRecipes = async () => {
    click();
    try {
      await generateDetailedRecipes();
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

  const handleSaveCompletePlan = async () => {
    click();
    try {
      await saveMealPlans(true);
      success();
      showToast({
        type: 'success',
        title: 'Plan complet sauvegardé !',
        message: 'Votre plan avec toutes les recettes est dans votre bibliothèque',
        duration: 4000,
        action: {
          label: 'Voir dans Plans',
          onClick: () => navigate('/fridge#plans')
        }
      });
      // DO NOT navigate automatically - let user stay on validation screen
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Erreur de sauvegarde',
        message: error instanceof Error ? error.message : 'Une erreur est survenue',
        duration: 5000
      });
    }
  };

  const handleDiscard = () => {
    click();
    const confirmed = window.confirm(
      'Voulez-vous vraiment régénérer ? Les plans actuels seront perdus.'
    );
    if (confirmed) {
      discardMealPlans();
    }
  };

  const handleResumeProgress = async () => {
    click();
    setShowResumeModal(false);

    const success = await loadProgressFromDatabase();
    if (success) {
      showToast({
        type: 'success',
        title: 'Progression restaurée',
        message: 'Votre génération en cours a été restaurée avec succès',
        duration: 3000
      });
    } else {
      showToast({
        type: 'error',
        title: 'Erreur de restauration',
        message: 'Impossible de restaurer la progression',
        duration: 3000
      });
      startPipeline();
    }
  };

  const handleRestartFromScratch = async () => {
    click();
    setShowResumeModal(false);

    await clearSavedProgress();
    resetPipeline();
    startPipeline();

    showToast({
      type: 'info',
      title: 'Nouvelle génération',
      message: 'Démarrage d\'une nouvelle génération',
      duration: 3000
    });
  };

  const handleExit = () => {
    click();

    if (mealPlanCandidates.length > 0 && currentStep !== 'configuration') {
      const confirmed = window.confirm(
        'Vous avez des plans non sauvegardés. Voulez-vous vraiment quitter ?'
      );

      if (!confirmed) return;
    }

    resetPipeline();
    navigate('/fridge#plans');
  };

  const currentStepData = steps.find(s => s.id === currentStep) || steps[0];
  const isGenerating = loadingState === 'generating' || loadingState === 'streaming';
  const isGeneratingRecipes = loadingState === 'generating_recipes' || loadingState === 'streaming_recipes';
  const isSaving = loadingState === 'saving';
  const currentMealPlan = mealPlanCandidates.length > 0 ? mealPlanCandidates[0] : null;

  return (
    <>
      <ResumeProgressModal
        isOpen={showResumeModal}
        currentStep={savedSessionInfo?.currentStep}
        sessionId={savedSessionInfo?.sessionId}
        updatedAt={savedSessionInfo?.updatedAt}
        onResume={handleResumeProgress}
        onRestart={handleRestartFromScratch}
      />

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
          batchCooking={config.batchCooking}
          onSetWeekCount={handleSetWeekCount}
          onSetBatchCooking={handleSetBatchCooking}
          onGenerate={handleGenerate}
          isGenerating={isGenerating}
          onExit={handleExit}
        />
      )}

      {currentStep === 'generating' && (
        <GeneratingStage onExit={handleExit} />
      )}

      {currentStep === 'validation' && (
        <ValidationStage
          mealPlan={currentMealPlan}
          onSaveBasicPlan={handleSaveBasicPlan}
          onGenerateAllRecipes={handleGenerateAllRecipes}
          onDiscard={handleDiscard}
          isSaving={isSaving}
          onExit={handleExit}
        />
      )}

      {currentStep === 'recipe_details_generating' && (
        <RecipeDetailsGeneratingStage
          onExit={handleExit}
        />
      )}

      {currentStep === 'recipe_details_validation' && (
        <RecipeDetailsValidationStage
          mealPlan={currentMealPlan}
          onSaveCompletePlan={handleSaveCompletePlan}
          onDiscard={handleDiscard}
          isSaving={isSaving}
          onExit={handleExit}
        />
      )}
      </motion.div>
    </>
  );
};

export default MealPlanGenerationPage;
