import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useShoppingListStore } from '../../../../system/store/shoppingListStore';
import { useNavigate } from 'react-router-dom';
import GlassCard from '../../../../ui/cards/GlassCard';
import SpatialIcon from '../../../../ui/icons/SpatialIcon';
import logger from '../../../../lib/utils/logger';

// Import components
import EmptyShoppingListState from './ShoppingListTab/components/EmptyShoppingListState';
import ShoppingListLibraryCTA from '../components/ShoppingListLibraryCTA';

/**
 * Shopping List Tab - Library of saved shopping lists
 */
const ShoppingListTab: React.FC = () => {
  const navigate = useNavigate();
  const {
    allShoppingLists,
    loadAllShoppingLists,
    error,
    reset
  } = useShoppingListStore();

  React.useEffect(() => {
    loadAllShoppingLists();
  }, [loadAllShoppingLists]);

  React.useEffect(() => {
    logger.debug('SHOPPING_LIST_TAB', 'Component mounted', {
      shoppingListsCount: allShoppingLists.length,
      hasError: !!error
    });

    // Cleanup on unmount
    return () => {
      logger.debug('SHOPPING_LIST_TAB', 'Component unmounting');
    };
  }, [allShoppingLists.length, error]);

  const handleScanFridge = () => {
    navigate('/fridge/scan');
  };

  // Determine which component to render based on state
  const renderContent = () => {
    // Empty state - no shopping lists saved yet
    if (allShoppingLists.length === 0) {
      return (
        <EmptyShoppingListState
          hasAvailableMealPlans={false}
          onScanFridge={handleScanFridge}
        />
      );
    }

    // TODO: Library view with saved shopping lists
    return (
      <div className="text-center text-white/60 py-12">
        <p>Bibliothèque de listes de courses - En construction</p>
        <p className="text-sm mt-2">{allShoppingLists.length} liste(s) sauvegardée(s)</p>
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="space-y-6 w-full"
    >
      {/* CTA pour Générer des Listes de Courses */}
      <ShoppingListLibraryCTA />

      {/* Error Display */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full"
          >
            <GlassCard className="border-red-500/20 bg-red-500/5">
              <div className="flex items-center gap-3 p-4">
                <SpatialIcon 
                  name="AlertTriangle" 
                  size={20} 
                  className="text-red-400 flex-shrink-0" 
                />
                <div className="flex-1">
                  <p className="text-red-400 font-medium">Erreur de génération</p>
                  <p className="text-red-300/80 text-sm mt-1">{error}</p>
                </div>
                <button
                  onClick={reset}
                  className="text-red-400 hover:text-red-300 transition-colors"
                >
                  <SpatialIcon name="X" size={16} />
                </button>
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={allShoppingLists.length > 0 ? 'library' : 'empty'}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className="w-full"
        >
          {renderContent()}
        </motion.div>
      </AnimatePresence>

    </motion.div>
  );
};

export default ShoppingListTab;