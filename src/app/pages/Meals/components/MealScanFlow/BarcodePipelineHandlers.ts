import React from 'react';
import logger from '../../../../../lib/utils/logger';
import { openFoodFactsService } from '../../../../../system/services/openFoodFactsService';
import type { ScanFlowState, ScannedBarcode, BarcodeAnalysisResults } from './ScanFlowState';

interface BarcodePipelineHandlersProps {
  scanFlowState: ScanFlowState;
  setScanFlowState: React.Dispatch<React.SetStateAction<ScanFlowState>>;
  clientScanIdRef: React.MutableRefObject<string | null>;
  processingGuardRef: React.MutableRefObject<boolean>;
  onAnalysisError: (error: string) => void;
  onSuccess: () => void;
}

export function useBarcodePipelineHandlers({
  scanFlowState,
  setScanFlowState,
  clientScanIdRef,
  processingGuardRef,
  onAnalysisError,
  onSuccess,
}: BarcodePipelineHandlersProps) {

  const handleBarcodeDetected = React.useCallback((barcode: ScannedBarcode) => {
    logger.info('BARCODE_PIPELINE', 'Barcode detected', {
      clientScanId: clientScanIdRef.current,
      barcode: barcode.barcode,
    });

    setScanFlowState(prev => ({
      ...prev,
      scannedBarcodes: [barcode],
      analysisError: null,
      progress: 33,
      progressMessage: 'Code-Barre Détecté',
      progressSubMessage: 'Prêt pour l\'analyse',
    }));
  }, [setScanFlowState, clientScanIdRef]);

  const handleBarcodeScan = React.useCallback(async () => {
    if (processingGuardRef.current || scanFlowState.scannedBarcodes.length === 0) {
      return;
    }

    processingGuardRef.current = true;
    const barcodeItem = scanFlowState.scannedBarcodes[0];
    const clientScanId = clientScanIdRef.current!;

    try {
      setScanFlowState(prev => ({
        ...prev,
        isProcessing: true,
        currentStep: 'processing',
        analysisError: null,
        progress: 20,
        progressMessage: 'Analyse du Code-Barre',
        progressSubMessage: 'Connexion à OpenFoodFacts...',
      }));

      logger.info('BARCODE_PIPELINE', 'Starting barcode analysis', {
        clientScanId,
        barcode: barcodeItem.barcode,
      });

      await new Promise(resolve => setTimeout(resolve, 500));

      setScanFlowState(prev => ({
        ...prev,
        progress: 40,
        progressSubMessage: 'Récupération du produit...',
      }));

      const result = await openFoodFactsService.getProductByBarcode(barcodeItem.barcode);

      if (!result.success || !result.product) {
        throw new Error(result.error || 'Produit non trouvé dans la base OpenFoodFacts');
      }

      logger.info('BARCODE_PIPELINE', 'Product found', {
        clientScanId,
        barcode: barcodeItem.barcode,
        productName: result.product.name,
      });

      setScanFlowState(prev => ({
        ...prev,
        progress: 60,
        progressSubMessage: 'Analyse des données nutritionnelles...',
      }));

      await new Promise(resolve => setTimeout(resolve, 500));

      const mealItem = openFoodFactsService.convertToMealItem(result.product, barcodeItem.portionMultiplier);

      if (!mealItem) {
        throw new Error('Impossible de convertir les données nutritionnelles');
      }

      setScanFlowState(prev => ({
        ...prev,
        progress: 80,
        progressSubMessage: 'Finalisation des données...',
      }));

      await new Promise(resolve => setTimeout(resolve, 500));

      const barcodeResults: BarcodeAnalysisResults = {
        scannedProduct: {
          barcode: result.product.barcode,
          name: result.product.name,
          brand: result.product.brand,
          image_url: result.product.image_url,
          mealItem,
          portionMultiplier: barcodeItem.portionMultiplier,
          scannedAt: barcodeItem.scannedAt,
        },
        totalCalories: mealItem.calories,
        totalProteins: mealItem.proteins,
        totalCarbs: mealItem.carbs,
        totalFats: mealItem.fats,
        productDetails: {
          name: result.product.name,
          brand: result.product.brand,
          image_url: result.product.image_url,
          barcode: result.product.barcode,
          portionSize: result.product.portion_size || '100g',
        },
      };

      setScanFlowState(prev => ({
        ...prev,
        barcodeAnalysisResults: barcodeResults,
        progress: 100,
        progressMessage: 'Analyse Terminée',
        progressSubMessage: 'Produit identifié avec succès',
      }));

      await new Promise(resolve => setTimeout(resolve, 500));

      setScanFlowState(prev => ({
        ...prev,
        currentStep: 'results',
      }));

      onSuccess();

      logger.info('BARCODE_PIPELINE', 'Analysis completed', {
        clientScanId,
        barcode: barcodeItem.barcode,
        productName: result.product.name,
        calories: mealItem.calories,
      });

      // Award XP for barcode scan completion (async IIFE to not block UI)
      (async () => {
        try {
          const { supabase } = await import('../../../../../system/supabase/client');
          const { data: { user } } = await supabase.auth.getUser();

          if (user?.id) {
            const { gamificationService } = await import('../../../../../services/dashboard/coeur');
            await gamificationService.awardBarcodeScanXp(user.id, {
              barcode: barcodeItem.barcode,
              productName: result.product.name,
              clientScanId,
              timestamp: new Date().toISOString()
            });

            logger.info('BARCODE_PIPELINE', 'XP awarded for barcode scan', {
              clientScanId,
              barcode: barcodeItem.barcode,
              xpAwarded: 15,
              timestamp: new Date().toISOString()
            });

            // Force refetch gamification queries to refresh gaming widget immediately
            const { queryClient } = await import('../../../../../app/providers/AppProviders');
            await queryClient.refetchQueries({ queryKey: ['gamification-progress'], type: 'active' });
            await queryClient.refetchQueries({ queryKey: ['xp-events'], type: 'active' });
            await queryClient.refetchQueries({ queryKey: ['daily-actions'], type: 'active' });

            logger.info('BARCODE_PIPELINE', 'Gaming widget queries refetched after barcode scan', {
              clientScanId,
              barcode: barcodeItem.barcode,
              xpAwarded: 15,
              timestamp: new Date().toISOString()
            });
          }
        } catch (xpError) {
          logger.warn('BARCODE_PIPELINE', 'Failed to award XP for barcode scan', {
            error: xpError instanceof Error ? xpError.message : 'Unknown error',
            clientScanId,
            timestamp: new Date().toISOString()
          });
        }
      })();

    } catch (error) {
      logger.error('BARCODE_PIPELINE', 'Analysis failed', {
        clientScanId,
        barcode: barcodeItem.barcode,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      onAnalysisError(error instanceof Error ? error.message : 'Erreur lors de l\'analyse du code-barre');
    } finally {
      setScanFlowState(prev => ({ ...prev, isProcessing: false }));
      processingGuardRef.current = false;
    }
  }, [scanFlowState.scannedBarcodes, setScanFlowState, clientScanIdRef, processingGuardRef, onAnalysisError, onSuccess]);

  const handleBarcodeRetake = React.useCallback(() => {
    setScanFlowState(prev => ({
      ...prev,
      scannedBarcodes: [],
      barcodeAnalysisResults: null,
      analysisError: null,
      currentStep: 'capture',
      progress: 0,
      progressMessage: 'Scanner un Code-Barre',
      progressSubMessage: 'Prêt pour un nouveau scan',
    }));

    logger.info('BARCODE_PIPELINE', 'Barcode retake requested', {
      clientScanId: clientScanIdRef.current,
    });
  }, [setScanFlowState, clientScanIdRef]);

  return {
    handleBarcodeDetected,
    handleBarcodeScan,
    handleBarcodeRetake,
  };
}
