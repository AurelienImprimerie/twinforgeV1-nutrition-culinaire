import React, { useState } from 'react';
import { motion } from 'framer-motion';
import GlassCard from '../../../../../ui/cards/GlassCard';
import SpatialIcon from '../../../../../ui/icons/SpatialIcon';
import { ICONS } from '../../../../../ui/icons/registry';
import MealProgressHeader from '../MealProgressHeader';
import PipelineGamingHint from '../../../../../components/dashboard/PipelineGamingHint';
import type { BarcodeAnalysisResults } from '../MealScanFlow/ScanFlowState';

interface BarcodeResultsDisplayStepProps {
  barcodeResults: BarcodeAnalysisResults;
  onSaveMeal: () => void;
  isSaving: boolean;
  onRetake: () => void;
  onNewScan: () => void;
}

const BarcodeResultsDisplayStep: React.FC<BarcodeResultsDisplayStepProps> = ({
  barcodeResults,
  onSaveMeal,
  isSaving,
  onRetake,
  onNewScan,
}) => {
  const [portionMultiplier, setPortionMultiplier] = useState(
    barcodeResults.scannedProduct.portionMultiplier
  );

  const handlePortionChange = (newMultiplier: number) => {
    setPortionMultiplier(newMultiplier);
  };

  const displayCalories = Math.round(barcodeResults.totalCalories * portionMultiplier);
  const displayProteins = Math.round(barcodeResults.totalProteins * portionMultiplier);
  const displayCarbs = Math.round(barcodeResults.totalCarbs * portionMultiplier);
  const displayFats = Math.round(barcodeResults.totalFats * portionMultiplier);

  return (
    <div className="space-y-6 w-full pb-32">
      <MealProgressHeader
        currentStep="results"
        progress={100}
        message="Analyse Terminée"
        subMessage="Produit identifié avec succès"
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <GlassCard
          className="p-6"
          style={{
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(79, 70, 229, 0.05))',
            borderColor: 'rgba(99, 102, 241, 0.35)',
          }}
        >
          <div className="flex items-start gap-4 mb-6">
            {barcodeResults.productDetails.image_url && (
              <div
                className="w-24 h-24 rounded-2xl overflow-hidden flex-shrink-0"
                style={{
                  background: 'rgba(99, 102, 241, 0.1)',
                  border: '2px solid rgba(99, 102, 241, 0.3)',
                }}
              >
                <img
                  src={barcodeResults.productDetails.image_url}
                  alt={barcodeResults.productDetails.name}
                  className="w-full h-full object-contain p-2"
                />
              </div>
            )}

            <div className="flex-1">
              <h2 className="text-white font-bold text-xl mb-1">
                {barcodeResults.productDetails.name}
              </h2>
              {barcodeResults.productDetails.brand && (
                <p className="text-indigo-300 text-sm mb-2">
                  {barcodeResults.productDetails.brand}
                </p>
              )}
              <p className="text-gray-400 text-xs font-mono">
                {barcodeResults.productDetails.barcode}
              </p>
            </div>
          </div>

          <div
            className="p-4 rounded-xl mb-4"
            style={{
              background: 'rgba(99, 102, 241, 0.08)',
              border: '1px solid rgba(99, 102, 241, 0.2)',
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-gray-300 text-sm">Portion</span>
              <span className="text-indigo-300 text-sm font-semibold">
                {barcodeResults.productDetails.portionSize}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => handlePortionChange(Math.max(0.25, portionMultiplier - 0.25))}
                className="w-10 h-10 rounded-lg flex items-center justify-center touch-feedback-css"
                style={{
                  background: 'rgba(99, 102, 241, 0.15)',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                }}
              >
                <SpatialIcon Icon={ICONS.Minus} size={18} className="text-indigo-300" />
              </button>

              <div className="flex-1 text-center">
                <p className="text-white font-bold text-2xl">{portionMultiplier}x</p>
                <p className="text-gray-400 text-xs">Multiplicateur de portion</p>
              </div>

              <button
                onClick={() => handlePortionChange(portionMultiplier + 0.25)}
                className="w-10 h-10 rounded-lg flex items-center justify-center touch-feedback-css"
                style={{
                  background: 'rgba(99, 102, 241, 0.15)',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                }}
              >
                <SpatialIcon Icon={ICONS.Plus} size={18} className="text-indigo-300" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div
              className="p-4 rounded-xl text-center"
              style={{
                background: 'linear-gradient(135deg, rgba(251, 146, 60, 0.15), rgba(249, 115, 22, 0.08))',
                border: '1px solid rgba(251, 146, 60, 0.3)',
              }}
            >
              <SpatialIcon Icon={ICONS.Flame} size={24} className="text-orange-400 mx-auto mb-2" />
              <p className="text-white font-bold text-2xl mb-1">{displayCalories}</p>
              <p className="text-orange-300 text-xs font-semibold">Calories</p>
            </div>

            <div
              className="p-4 rounded-xl text-center"
              style={{
                background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(220, 38, 38, 0.08))',
                border: '1px solid rgba(239, 68, 68, 0.3)',
              }}
            >
              <SpatialIcon Icon={ICONS.Drumstick} size={24} className="text-red-400 mx-auto mb-2" />
              <p className="text-white font-bold text-2xl mb-1">{displayProteins}g</p>
              <p className="text-red-300 text-xs font-semibold">Protéines</p>
            </div>

            <div
              className="p-4 rounded-xl text-center"
              style={{
                background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(37, 99, 235, 0.08))',
                border: '1px solid rgba(59, 130, 246, 0.3)',
              }}
            >
              <SpatialIcon Icon={ICONS.Wheat} size={24} className="text-blue-400 mx-auto mb-2" />
              <p className="text-white font-bold text-2xl mb-1">{displayCarbs}g</p>
              <p className="text-blue-300 text-xs font-semibold">Glucides</p>
            </div>

            <div
              className="p-4 rounded-xl text-center"
              style={{
                background: 'linear-gradient(135deg, rgba(234, 179, 8, 0.15), rgba(202, 138, 4, 0.08))',
                border: '1px solid rgba(234, 179, 8, 0.3)',
              }}
            >
              <SpatialIcon Icon={ICONS.Droplet} size={24} className="text-yellow-400 mx-auto mb-2" />
              <p className="text-white font-bold text-2xl mb-1">{displayFats}g</p>
              <p className="text-yellow-300 text-xs font-semibold">Lipides</p>
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* Gaming Hint - Centré */}
      <div className="flex justify-center">
        <PipelineGamingHint
          points={25}
          forgeName="Forge Nutritionnelle"
          message="Code-barre scanné avec succès !"
        />
      </div>

      <div
        className="fixed bottom-0 left-0 right-0 p-4 z-50"
        style={{
          background: 'linear-gradient(to top, rgba(17, 24, 39, 0.98), rgba(17, 24, 39, 0.95), transparent)',
          pointerEvents: 'none',
        }}
      >
        <div className="max-w-2xl mx-auto space-y-3" style={{ pointerEvents: 'auto' }}>
          <button
            onClick={onSaveMeal}
            disabled={isSaving}
            className="w-full btn-glass touch-feedback-css disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.25), rgba(5, 150, 105, 0.15))',
              borderColor: 'rgba(16, 185, 129, 0.4)',
            }}
          >
            <div className="flex items-center justify-center gap-2">
              {isSaving ? (
                <>
                  <div className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                  <span className="text-white font-semibold">Sauvegarde en cours...</span>
                </>
              ) : (
                <>
                  <SpatialIcon Icon={ICONS.Check} size={20} className="text-emerald-400" />
                  <span className="text-white font-semibold">Sauvegarder dans mon historique</span>
                </>
              )}
            </div>
          </button>

          <div className="flex gap-3">
            <button
              onClick={onRetake}
              disabled={isSaving}
              className="flex-1 btn-glass touch-feedback-css disabled:opacity-50"
              style={{
                background: 'rgba(107, 114, 128, 0.1)',
                borderColor: 'rgba(107, 114, 128, 0.3)',
              }}
            >
              <div className="flex items-center justify-center gap-2">
                <SpatialIcon Icon={ICONS.RotateCcw} size={18} className="text-gray-400" />
                <span className="text-gray-300 font-medium text-sm">Rescanner</span>
              </div>
            </button>

            <button
              onClick={onNewScan}
              disabled={isSaving}
              className="flex-1 btn-glass touch-feedback-css disabled:opacity-50"
              style={{
                background: 'rgba(99, 102, 241, 0.1)',
                borderColor: 'rgba(99, 102, 241, 0.3)',
              }}
            >
              <div className="flex items-center justify-center gap-2">
                <SpatialIcon Icon={ICONS.Plus} size={18} className="text-indigo-400" />
                <span className="text-indigo-300 font-medium text-sm">Nouveau scan</span>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BarcodeResultsDisplayStep;
