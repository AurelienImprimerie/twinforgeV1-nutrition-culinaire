import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useShoppingListGenerationPipeline } from '../../../system/store/shoppingListGenerationPipeline';
import { useMealPlanStore } from '../../../system/store/mealPlanStore';
import { useFeedback } from '../../../hooks/useFeedback';
import { useToast } from '../../../ui/components/ToastProvider';
import ShoppingListGenerationProgressHeader from './components/ShoppingListGenerationProgressHeader';
import ConfigurationStage from './stages/ConfigurationStage';
import GeneratingStage from './stages/GeneratingStage';
import ValidationStage from './stages/ValidationStage';

const ShoppingListGenerationPage: React.FC = () => {
  const navigate = useNavigate();
  const { click, success } = useFeedback();
  const { showToast } = useToast();

  const {
    currentStep,
    config,
    steps,
    simulatedOverallProgress,
    loadingMessage,
    shoppingListCandidate,
    startPipeline,
    resetPipeline,
    setConfig,
    generateShoppingList,
    saveShoppingList,
    discardShoppingList
  } = useShoppingListGenerationPipeline();

  const { allMealPlans, loadAllMealPlans } = useMealPlanStore();

  useEffect(() => {
    startPipeline();
    loadAllMealPlans();
  }, []);

  useEffect(() => {
    if (allMealPlans.length > 0 && !config.selectedMealPlanId) {
      const latestPlan = allMealPlans[0];
      setConfig({ selectedMealPlanId: latestPlan.id });
    }
  }, [allMealPlans, config.selectedMealPlanId, setConfig]);

  const handleGenerate = async () => {
    click();
    try {
      await generateShoppingList();
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

  const handleSave = async () => {
    click();
    try {
      await saveShoppingList();
      success();
      showToast({
        type: 'success',
        title: 'Liste sauvegardée !',
        message: 'Redirection vers votre bibliothèque...',
        duration: 3000
      });
      setTimeout(() => {
        navigate('/fridge#shopping');
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
    const confirmed = window.confirm('Voulez-vous vraiment régénérer ? La liste actuelle sera perdue.');
    if (confirmed) {
      discardShoppingList();
    }
  };

  const handleExit = () => {
    click();
    if (shoppingListCandidate && currentStep === 'validation') {
      const confirmed = window.confirm('Vous avez une liste non sauvegardée. Voulez-vous vraiment quitter ?');
      if (!confirmed) return;
    }
    resetPipeline();
    navigate('/fridge#shopping');
  };

  const currentStepData = steps.find(s => s.id === currentStep) || steps[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="space-y-6"
    >
      <ShoppingListGenerationProgressHeader
        currentStep={currentStepData}
        overallProgress={simulatedOverallProgress}
        loadingMessage={loadingMessage}
      />

      {currentStep === 'configuration' && (
        <ConfigurationStage
          availableMealPlans={allMealPlans}
          selectedMealPlanId={config.selectedMealPlanId}
          generationMode={config.generationMode}
          onSetGenerationMode={(mode) => setConfig({ generationMode: mode })}
          onSetSelectedMealPlan={(id) => setConfig({ selectedMealPlanId: id })}
          onGenerate={handleGenerate}
          isGenerating={false}
          onExit={handleExit}
        />
      )}

      {currentStep === 'generating' && <GeneratingStage onExit={handleExit} />}

      {currentStep === 'validation' && (
        <ValidationStage
          shoppingList={shoppingListCandidate}
          onSave={handleSave}
          onDiscard={handleDiscard}
          isSaving={false}
          onExit={handleExit}
        />
      )}
    </motion.div>
  );
};

export default ShoppingListGenerationPage;
