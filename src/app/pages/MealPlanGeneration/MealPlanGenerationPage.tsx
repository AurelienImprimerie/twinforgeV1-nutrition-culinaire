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
import ImprovedExitConfirmationModal from '../../../ui/components/modals/ImprovedExitConfirmationModal';
import { mealPlanProgressService } from '../../../system/services/mealPlanProgressService';
import logger from '../../../lib/utils/logger';

const MealPlanGenerationPage: React.FC = () => {
  const navigate = useNavigate();
  const { click, success } = useFeedback();
  const { showToast } = useToast();
  const { session } = useUserStore();
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [savedSessionInfo, setSavedSessionInfo] = useState<any>(null);
  const [showExitModal, setShowExitModal] = useState(false);

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
    cancelGeneration,
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
        // Don't show modal if pipeline is already active (generation in progress)
        if (isActive) {
          logger.info('MEAL_PLAN_GENERATION_PAGE', 'Pipeline already active, skipping resume modal', {
            currentStep,
            currentSessionId
          });
          return;
        }

        const summary = await mealPlanProgressService.getProgressSummary(session.user.id);

        if (summary.hasSession && (summary.currentStep === 'validation' || summary.currentStep === 'recipe_details_generating' || summary.currentStep === 'recipe_details_validation')) {
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
  }, [session?.user?.id, isActive, startPipeline, currentStep, currentSessionId]);

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
          onClick: () => navigate('/fridge#plan')
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
        message: 'Redirection vers votre bibliothèque de plans...',
        duration: 3000
      });

      // Automatic redirect to Plan tab after successful save
      setTimeout(() => {
        navigate('/fridge#plan');
      }, 1500);
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

    // Check if we're already on the correct session
    if (savedSessionInfo?.sessionId === currentSessionId && isActive) {
      logger.info('MEAL_PLAN_GENERATION_PAGE', 'Already on correct session, no need to reload', {
        sessionId: currentSessionId,
        currentStep
      });
      showToast({
        type: 'success',
        title: 'Génération en cours',
        message: 'Votre génération se poursuit normalement',
        duration: 3000
      });
      return;
    }

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
      setShowExitModal(true);
    } else {
      resetPipeline();
      navigate('/fridge#plan');
    }
  };

  const handleContinueInBackground = async () => {
    click();
    setShowExitModal(false);

    if (currentSessionId && session?.user?.id) {
      if (currentStep === 'recipe_details_generating') {
        await mealPlanProgressService.updateSessionStep(currentSessionId, 'recipe_details_generating');
      } else if (currentStep === 'validation') {
        await mealPlanProgressService.saveValidationProgress(currentSessionId, mealPlanCandidates);
      } else if (currentStep === 'recipe_details_validation') {
        await mealPlanProgressService.updateSessionStep(currentSessionId, 'recipe_details_validation');
      }
    }

    showToast({
      type: 'info',
      title: 'Génération en arrière-plan',
      message: 'Votre génération continue. Vous recevrez une notification quand elle sera terminée.',
      duration: 4000
    });

    navigate('/fridge#plan');
  };

  const handleStopAndReturn = async () => {
    click();
    setShowExitModal(false);

    // Cancel ongoing generation
    showToast({
      type: 'info',
      title: 'Arrêt en cours...',
      message: 'Arrêt de la génération',
      duration: 2000
    });

    await cancelGeneration();

    // Save current progress
    if (currentSessionId) {
      if (currentStep === 'validation') {
        await mealPlanProgressService.saveValidationProgress(currentSessionId, mealPlanCandidates);
      } else if (currentStep === 'generating' || currentStep === 'enriching') {
        // Save whatever we have so far
        await mealPlanProgressService.saveValidationProgress(currentSessionId, mealPlanCandidates);
      }
    }

    showToast({
      type: 'success',
      title: 'Génération arrêtée',
      message: 'Votre progression a été sauvegardée',
      duration: 3000
    });

    navigate('/fridge#plan');
  };

  const handleDiscardAndExit = async () => {
    click();
    setShowExitModal(false);

    // Cancel ongoing generation first
    showToast({
      type: 'info',
      title: 'Arrêt en cours...',
      message: 'Annulation de la génération',
      duration: 2000
    });

    await cancelGeneration();

    // Clear all progress
    if (currentSessionId) {
      await clearSavedProgress();
    }

    resetPipeline();

    showToast({
      type: 'info',
      title: 'Plan abandonné',
      message: 'La génération a été annulée et supprimée',
      duration: 3000
    });

    navigate('/fridge#plan');
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

      <ImprovedExitConfirmationModal
        isOpen={showExitModal}
        currentStep={currentStep}
        hasUnsavedProgress={mealPlanCandidates.length > 0}
        onContinueInBackground={handleContinueInBackground}
        onStopAndReturn={handleStopAndReturn}
        onDiscardAndExit={handleDiscardAndExit}
        onCancel={() => setShowExitModal(false)}
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
