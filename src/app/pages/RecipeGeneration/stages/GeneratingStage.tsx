import React from 'react';
import { useNavigate } from 'react-router-dom';
import RecipeGenerationLoader from '../../../pages/Fridge/tabs/RecipesTab/components/RecipeGenerationLoader';
import { useRecipeGenerationPipeline } from '../../../../system/store/recipeGeneration';
import { useFeedback } from '../../../../hooks/useFeedback';
import logger from '../../../../lib/utils/logger';

const GeneratingStage: React.FC = () => {
  const navigate = useNavigate();
  const { click } = useFeedback();
  const { currentSessionId, recipeCandidates, resetPipeline } = useRecipeGenerationPipeline();

  const handleExit = () => {
    click();

    // If we have unsaved recipes, show confirmation
    if (recipeCandidates.length > 0) {
      const confirmed = window.confirm(
        'La génération est en cours. Voulez-vous vraiment quitter ?'
      );

      if (!confirmed) return;
    }

    resetPipeline();
    navigate('/fridge#recipes');

    logger.info('RECIPE_GENERATION_PAGE', 'Pipeline exited during generation', {
      sessionId: currentSessionId,
      timestamp: new Date().toISOString()
    });
  };

  return (
    <div className="space-y-6">
      <RecipeGenerationLoader />

      {/* Exit Button */}
      <div className="flex justify-center">
        <button
          onClick={handleExit}
          className="px-6 py-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-white font-medium transition-all duration-200"
        >
          Quitter la génération
        </button>
      </div>
    </div>
  );
};

export default GeneratingStage;
