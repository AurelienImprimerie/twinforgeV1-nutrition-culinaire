import React from 'react';
import { motion } from 'framer-motion';
import { usePlanTabLogic } from './PlanTab/hooks/usePlanTabLogic';
import PlanHeaderSection from './PlanTab/components/PlanHeaderSection';
import PlanContentSection from './PlanTab/components/PlanContentSection';
import PlanFooterSection from './PlanTab/components/PlanFooterSection';
import RecipeDetailModal from './RecipesTab/components/RecipeDetailModal';

/**
 * Plan Tab - Onglet Plan de Repas
 * Gère la génération et l'affichage des plans de repas basés sur l'inventaire du frigo
 * et le profil nutritionnel complet de l'utilisateur
 */
const PlanTab: React.FC = () => {
  const {
    // State
    currentPlan,
    currentWeek,
    availableInventories,
    selectedInventoryId,
    isGenerating,
    generationProgress,
    loadingMessage,
    currentLoadingTitle,
    currentLoadingSubtitle,
    availableWeeks,
    maxAvailableWeek,
    isWeekAvailable,
    profileCompletion,
    featureGuidance,
    nudgeDismissed,
    showRecipeDetailModal,
    selectedRecipeForDetail,
    hasInventory,
    selectedInventory,
    weekDateRange,
    canGenerateNextWeek,
    
    // Actions
    getWeekDateRange,
    selectInventory,
    clearPlan,
    setCurrentWeek,
    setNudgeDismissed,
    setShowRecipeDetailModal,
    setSelectedRecipeForDetail,
    
    // Handlers
    handleGenerateMealPlan,
    handleRegenerateWeek,
    handleExportPlan,
    handleViewRecipe,
    handleGenerateAllRecipes,
    handleSavePlanAsIs,
    
    // External functions
    generateDetailedRecipeForMeal,
    generateAllDetailedRecipesForDay
  } = usePlanTabLogic();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="space-y-6"
    >
      {/* Header Section */}
      {(currentPlan || isGenerating) && (
        <PlanHeaderSection
          currentPlan={currentPlan}
          handleExportPlan={handleExportPlan}
          clearPlan={clearPlan}
          selectedInventoryId={selectedInventoryId}
          availableInventories={availableInventories}
          selectInventory={selectInventory}
          isGenerating={isGenerating}
          currentWeek={currentWeek}
          availableWeeks={availableWeeks}
          maxAvailableWeek={maxAvailableWeek}
          canGenerateNextWeek={canGenerateNextWeek}
          setCurrentWeek={setCurrentWeek}
          getWeekDateRange={getWeekDateRange}
          handleGenerateMealPlan={handleGenerateMealPlan}
          isWeekAvailable={isWeekAvailable}
          weekDateRange={weekDateRange}
        />
      )}

      {/* Content Section */}
      <PlanContentSection
        hasInventory={hasInventory}
        isGenerating={isGenerating}
        generationProgress={generationProgress}
        loadingMessage={loadingMessage}
        currentLoadingTitle={currentLoadingTitle}
        currentLoadingSubtitle={currentLoadingSubtitle}
        currentPlan={currentPlan}
        selectedInventory={selectedInventory}
        handleGenerateAllRecipes={handleGenerateAllRecipes}
        handleRegenerateWeek={handleRegenerateWeek}
        handleExportPlan={handleExportPlan}
        clearPlan={clearPlan}
        handleViewRecipe={handleViewRecipe}
        generateDetailedRecipeForMeal={generateDetailedRecipeForMeal}
        setCurrentWeek={setCurrentWeek}
        generateAllDetailedRecipesForDay={generateAllDetailedRecipesForDay}
        profileCompletion={profileCompletion}
        featureGuidance={featureGuidance}
        nudgeDismissed={nudgeDismissed}
        setNudgeDismissed={setNudgeDismissed}
        currentWeek={currentWeek}
        weekDateRange={weekDateRange}
        handleGenerateMealPlan={handleGenerateMealPlan}
        isWeekAvailable={isWeekAvailable}
        handleSavePlanAsIs={handleSavePlanAsIs}
      />

      {/* Footer Section */}
      <PlanFooterSection
        isGenerating={isGenerating}
        currentPlan={currentPlan}
        selectedInventory={selectedInventory}
        currentWeek={currentWeek}
      />

      {/* Modal de Détail de Recette */}
      {showRecipeDetailModal && selectedRecipeForDetail && (
        <RecipeDetailModal
          recipe={selectedRecipeForDetail}
          onClose={() => {
            setShowRecipeDetailModal(false);
            setSelectedRecipeForDetail(null);
          }}
        />
      )}
    </motion.div>
  );
};

export default PlanTab;