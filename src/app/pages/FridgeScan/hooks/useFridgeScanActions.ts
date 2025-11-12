import { useNavigate } from 'react-router-dom';
import { useUserStore } from '../../../../system/store/userStore';
import { useToast } from '../../../../ui/components/ToastProvider';
import { useFeedback } from '../../../../hooks/useFeedback';
import { useExitModalStore } from '../../../../system/store/exitModalStore';
import { FRIDGE_SCAN_STEPS } from '../../../../system/store/fridgeScan';
import type { SuggestedFridgeItem } from '../../../../system/store/fridgeScan/types';
import logger from '../../../../lib/utils/logger';

interface UseFridgeScanActionsProps {
  currentStep: string;
  loadingState: string;
  isActive: boolean;
  currentSessionId: string | null;
  capturedPhotos: string[];
  rawDetectedItems: any[];
  suggestedComplementaryItems: SuggestedFridgeItem[];
  goToStep: (step: string) => void;
  setLoadingState: (state: string) => void;
  startProgressSimulation: (steps: any[], startProgress: number, endProgress: number) => void;
  processVisionResults: (fridgeItems: any[], suggestedItems: SuggestedFridgeItem[]) => void;
  setSuggestedComplementaryItems: (items: SuggestedFridgeItem[]) => void;
  addCapturedPhotos: (photos: string[]) => void;
  updateInventory: (inventory: any[]) => void;
  removeCapturedPhoto: (index: number) => void;
  resetPipeline: () => void;
}

/**
 * Hook to provide all action handlers for the FridgeScan component
 */
export const useFridgeScanActions = ({
  currentStep,
  loadingState,
  isActive,
  currentSessionId,
  capturedPhotos,
  rawDetectedItems,
  suggestedComplementaryItems,
  goToStep,
  setLoadingState,
  startProgressSimulation,
  processVisionResults,
  setSuggestedComplementaryItems,
  addCapturedPhotos,
  updateInventory,
  removeCapturedPhoto,
  resetPipeline
}: UseFridgeScanActionsProps) => {
  
  const navigate = useNavigate();
  const { profile, session } = useUserStore();
  const { success, error: errorSound, click } = useFeedback();
  const { showToast } = useToast();
  const { showModal } = useExitModalStore();

  // Handle manual exit from pipeline
  const handleManualExit = () => {
    logger.info('FRIDGE_SCAN_PAGE', 'User requested manual exit from pipeline', {
      currentStep,
      loadingState,
      isActive,
      sessionId: currentSessionId,
      timestamp: new Date().toISOString()
    });

    showModal({
      title: 'Quitter l\'Atelier de Recettes',
      message: 'Votre session de scan et de génération de recettes est en cours. Quitter maintenant entraînera une perte de progression et pourrait générer des coûts IA inutiles.',
      processName: 'Scanner de Frigo',
      onConfirm: () => {
        logger.info('FRIDGE_SCAN_PAGE', 'User confirmed manual exit, resetting pipeline', {
          currentStep,
          loadingState,
          sessionId: currentSessionId,
          timestamp: new Date().toISOString()
        });
        
        // Reset pipeline and navigate to fridge main page
        resetPipeline();
        navigate('/fridge');
        
        showToast({
          type: 'info',
          title: 'Atelier Réinitialisé',
          message: 'Votre session a été annulée et l\'atelier a été réinitialisé',
          duration: 3000
        });
      },
      onCancel: () => {
        logger.info('FRIDGE_SCAN_PAGE', 'User cancelled manual exit, continuing pipeline', {
          currentStep,
          loadingState,
          timestamp: new Date().toISOString()
        });
      }
    });
  };

  // Handle photos upload and processing
  const handlePhotosUploaded = async (photos: string[]) => {
    try {
      logger.info('FRIDGE_SCAN_PAGE', 'Photos uploaded, starting analysis', {
        photosCount: photos.length,
        sessionId: currentSessionId,
        timestamp: new Date().toISOString()
      });

      // Change to analyze step first
      goToStep('analyze');

      // Set loading state to analyzing to enable navigation protection
      setLoadingState('analyzing');

      // Start progress simulation for analysis phase (25% to 50%)
      const analyzeStep = FRIDGE_SCAN_STEPS.find(step => step.id === 'analyze');
      const validationStep = FRIDGE_SCAN_STEPS.find(step => step.id === 'validation');
      
      startProgressSimulation(
        [
          { message: 'Initialisation de l\'analyse IA...', duration: 5000, icon: 'Zap' },
          { message: 'Traitement des images avec GPT-4o...', duration: 40000, icon: 'Eye' },
          { message: 'Détection des ingrédients...', duration: 15000, icon: 'Search' },
          { message: 'Normalisation de l\'inventaire...', duration: 10000, icon: 'CheckCircle' }
        ],
        analyzeStep?.startProgress || 33,
        validationStep?.startProgress || 66
      );

      // Step 1: Call fridge-scan-vision Edge Function
      logger.info('FRIDGE_SCAN_PAGE', 'Starting vision analysis with OpenAI', {
        photosCount: photos.length,
        sessionId: currentSessionId,
        aiModel: 'gpt-5-mini',
        timestamp: new Date().toISOString()
      });

      const visionResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fridge-scan-vision`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image_base64: photos,
          user_id: session?.user?.id
        })
      });

      if (!visionResponse.ok) {
        throw new Error(`Vision analysis failed: ${visionResponse.status} ${visionResponse.statusText}`);
      }

      const visionData = await visionResponse.json();
      
      // AUDIT: Log vision data to debug detected items
      logger.info('FRIDGE_SCAN_PAGE', 'Vision data received from Edge Function', {
        sessionId: currentSessionId,
        hasDetectedItems: !!visionData.detected_items,
        detectedItemsCount: visionData.detected_items?.length || 0,
        allDetectedItems: visionData.detected_items?.map((item: any) => ({
          label: item.label,
          confidence: item.confidence,
          category: item.category,
          quantity: item.estimated_quantity,
          freshness: item.freshness_score
        })),
        detectionQuality: (visionData.detected_items?.length || 0) >= 15 ? 'EXCELLENT' : 
                         (visionData.detected_items?.length || 0) >= 10 ? 'GOOD' : 
                         (visionData.detected_items?.length || 0) >= 6 ? 'ACCEPTABLE' : 'POOR',
        visionDataKeys: Object.keys(visionData),
        processingTimeMs: visionData.processing_time_ms,
        costUsd: visionData.cost_usd,
        cacheHit: visionData.cache_hit,
        timestamp: new Date().toISOString()
      });

      logger.info('FRIDGE_SCAN_PAGE', 'Vision analysis completed', {
        sessionId: currentSessionId,
        itemsDetected: visionData.detected_items?.length || 0,
        processingTimeMs: visionData.processing_time_ms,
        costUsd: visionData.cost_usd,
        imagesProcessed: visionData.images_processed,
        cacheHit: visionData.cache_hit,
        aiModel: 'gpt-5-mini',
        timestamp: new Date().toISOString()
      });

      // Step 2: Call inventory-processor Edge Function
      logger.info('FRIDGE_SCAN_PAGE', 'Starting inventory processing', {
        rawItemsCount: visionData.detected_items?.length || 0,
        sessionId: currentSessionId,
        timestamp: new Date().toISOString()
      });

      const processorResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/inventory-processor`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          raw_detected_items: visionData.detected_items || [],
          user_id: session?.user?.id
        })
      });

      if (!processorResponse.ok) {
        const processorErrorText = await processorResponse.text();
        logger.error('FRIDGE_SCAN_PAGE', 'Inventory processor response error', {
          status: processorResponse.status,
          statusText: processorResponse.statusText,
          errorBody: processorErrorText,
          sessionId: currentSessionId,
          timestamp: new Date().toISOString()
        });
        throw new Error(`Inventory processing failed: ${processorResponse.status} ${processorResponse.statusText}`);
      }

      const processorData = await processorResponse.json();
      
      // AUDIT: Log processor data to debug inventory processing
      logger.info('FRIDGE_SCAN_PAGE', 'Processor data received from Edge Function', {
        sessionId: currentSessionId,
        hasInventoryNormalized: !!processorData.inventory_normalized,
        inventoryNormalizedCount: processorData.inventory_normalized?.length || 0,
        allNormalizedInventory: processorData.inventory_normalized?.map((item: any) => ({
          name: item.name,
          category: item.category,
          quantity: item.quantity,
          freshness: item.freshness
        })),
        quantityAdjustmentCheck: processorData.inventory_normalized?.some((item: any) => 
          item.quantity?.includes('pour') || item.quantity?.includes('personnes')
        ) ? 'DETECTED_HOUSEHOLD_ADJUSTMENT' : 'RAW_QUANTITIES_PRESERVED',
        processorDataKeys: Object.keys(processorData),
        processingTimeMs: processorData.processing_time_ms,
        cacheHit: processorData.cache_hit,
        timestamp: new Date().toISOString()
      });

      logger.info('FRIDGE_SCAN_PAGE', 'Inventory processing completed', {
        sessionId: currentSessionId,
        itemsProcessed: processorData.items_processed,
        itemsNormalized: processorData.inventory_normalized?.length || 0,
        processingTimeMs: processorData.processing_time_ms,
        cacheHit: processorData.cache_hit,
        timestamp: new Date().toISOString()
      });

      // Initialize suggested items array
      let suggestedFridgeItems: SuggestedFridgeItem[] = [];

      // Check if inventory is insufficient and call complementer if needed
      const MINIMUM_ITEMS_THRESHOLD = 10;
      const normalizedItemsCount = processorData.inventory_normalized?.length || 0;
      
      if (normalizedItemsCount < MINIMUM_ITEMS_THRESHOLD) {
        logger.info('FRIDGE_SCAN_PAGE', 'Inventory insufficient, calling complementer', {
          sessionId: currentSessionId,
          normalizedItemsCount,
          threshold: MINIMUM_ITEMS_THRESHOLD,
          timestamp: new Date().toISOString()
        });

        try {
          const complementerResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/inventory-complementer`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              user_id: session?.user?.id,
              current_inventory: processorData.inventory_normalized || [],
              user_profile: profile
            })
          });

          if (!complementerResponse.ok) {
            throw new Error(`Complementer failed: ${complementerResponse.status} ${complementerResponse.statusText}`);
          }

          const complementerData = await complementerResponse.json();
          
          logger.info('FRIDGE_SCAN_PAGE', 'Complementer suggestions received', {
            sessionId: currentSessionId,
            suggestionsCount: complementerData.suggested_items?.length || 0,
            processingTimeMs: complementerData.processing_time_ms,
            timestamp: new Date().toISOString()
          });

          // Convert suggested items to FridgeItem format
          suggestedFridgeItems = (complementerData.suggested_items || []).map((item: any, index: number) => ({
            id: crypto.randomUUID(),
            userId: session?.user?.id || '',
            sessionId: currentSessionId || '',
            name: item.label,
            category: item.category,
            quantity: item.quantity,
            confidence: item.confidence || 0.85,
            freshnessScore: item.freshness || 90,
            isUserEdited: false,
            isSuggested: true,
            suggestionReason: item.reason || 'Recommandé par notre IA nutritionniste',
            suggestionPriority: (item.priority as 'high' | 'medium' | 'low') || 'medium',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }));

          // Store suggested items in the pipeline
          setSuggestedComplementaryItems(suggestedFridgeItems);
          
        } catch (error) {
          logger.error('FRIDGE_SCAN_PAGE', 'Complementer call failed', {
            error: error instanceof Error ? error.message : 'Unknown error',
            sessionId: currentSessionId,
            timestamp: new Date().toISOString()
          });
          
          // Continue without suggestions if complementer fails
          showToast({
            type: 'warning',
            title: 'Suggestions indisponibles',
            message: 'Impossible de suggérer des aliments complémentaires, mais vous pouvez continuer.',
            duration: 4000
          });
        }
      }

      // Convert normalized inventory to FridgeItem format
      logger.debug('FRIDGE_SCAN_PAGE', 'Converting normalized inventory to FridgeItem format', {
        sessionId: currentSessionId,
        normalizedItemsCount: processorData.inventory_normalized?.length || 0,
        timestamp: new Date().toISOString()
      });

      const fridgeItems = (processorData.inventory_normalized || []).map((item: any, index: number) => ({
        id: `item-${index}`,
        userId: session?.user?.id || '',
        sessionId: currentSessionId || '',
        name: item.name,
        category: item.category,
        quantity: item.quantity,
        confidence: 0.9, // High confidence for processed items
        freshnessScore: item.freshness === 'Excellent' ? 90 : 
                       item.freshness === 'Bon' ? 75 : 
                       item.freshness === 'Moyen' ? 50 : 30,
        expiryDate: item.estimated_expiry_days ? 
          new Date(Date.now() + item.estimated_expiry_days * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : 
          undefined,
        isUserEdited: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }));

      logger.info('FRIDGE_SCAN_PAGE', 'FridgeItems created successfully', {
        sessionId: currentSessionId,
        fridgeItemsCount: fridgeItems.length,
        fridgeItemsPreview: fridgeItems.slice(0, 3).map(item => ({
          id: item.id,
          name: item.name,
          category: item.category,
          quantity: item.quantity,
          freshnessScore: item.freshnessScore
        })),
        timestamp: new Date().toISOString()
      });

      processVisionResults(fridgeItems, suggestedFridgeItems);

      // Reset loading state after successful processing
      setLoadingState('idle');

      // Award XP for fridge scan completion (async IIFE to not block UI)
      (async () => {
        try {
          const userId = session?.user?.id;
          if (userId && fridgeItems.length > 0) {
            const { gamificationService } = await import('../../../../services/dashboard/coeur');
            await gamificationService.awardFridgeScanXp(userId, {
              sessionId: currentSessionId,
              itemsDetected: fridgeItems.length,
              suggestedItemsCount: suggestedFridgeItems.length,
              timestamp: new Date().toISOString()
            });

            logger.info('FRIDGE_SCAN_PAGE', 'XP awarded for fridge scan', {
              sessionId: currentSessionId,
              itemsDetected: fridgeItems.length,
              xpAwarded: 30,
              timestamp: new Date().toISOString()
            });

            // Invalidate gamification queries to refresh gaming widget immediately
            const { queryClient } = await import('../../../../app/providers/AppProviders');
            await queryClient.invalidateQueries({ queryKey: ['gamification-progress'] });
            await queryClient.invalidateQueries({ queryKey: ['xp-events'] });
            await queryClient.invalidateQueries({ queryKey: ['daily-actions'] });
          }
        } catch (xpError) {
          logger.warn('FRIDGE_SCAN_PAGE', 'Failed to award XP for fridge scan', {
            error: xpError instanceof Error ? xpError.message : 'Unknown error',
            sessionId: currentSessionId,
            timestamp: new Date().toISOString()
          });
        }
      })();
      
    } catch (error) {
      logger.error('FRIDGE_SCAN_PAGE', 'Photo analysis failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        photosCount: photos.length,
        sessionId: currentSessionId,
        loadingState,
        currentStep,
        timestamp: new Date().toISOString(),
        stack: error instanceof Error ? error.stack : undefined
      });

      errorSound();
      showToast({
        type: 'error',
        title: 'Erreur d\'analyse',
        message: error instanceof Error && error.message.includes('unsupported image') 
          ? 'Format d\'image non supporté. Utilisez PNG, JPEG, GIF ou WebP.'
          : 'Impossible d\'analyser les photos. Veuillez réessayer.',
        duration: 5000,
      });

      // Reset to photo step on error
      setLoadingState('idle');
      goToStep('photo');
    }
  };

  // Handle inventory update
  const handleInventoryUpdate = (inventory: any[]) => {
    logger.debug('FRIDGE_SCAN_PAGE', 'Inventory updated by user', {
      inventoryCount: inventory.length,
      sessionId: currentSessionId,
      timestamp: new Date().toISOString()
    });

    updateInventory(inventory);
  };

  // Handle file selection for photo capture
  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const supportedFormats = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
    const validFiles = Array.from(files).filter(file => {
      if (!supportedFormats.includes(file.type.toLowerCase())) {
        showToast({
          type: 'error',
          title: 'Format non supporté',
          message: `${file.name} doit être au format PNG, JPEG, GIF ou WebP`,
          duration: 4000
        });
        return false;
      }
      if (file.size > 10 * 1024 * 1024) {
        showToast({
          type: 'error',
          title: 'Fichier trop volumineux',
          message: `${file.name} dépasse la limite de 10MB`,
          duration: 3000
        });
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    try {
      // Process up to 6 images (system supports 1-6 images)
      const filesToProcess = validFiles.slice(0, 6);
      const photoPromises = filesToProcess.map(file => {
        return new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      });

      const photos = await Promise.all(photoPromises);

      logger.info('FRIDGE_SCAN_PAGE', 'Photos captured for analysis', {
        photosCount: photos.length,
        maxSupported: 6,
        timestamp: new Date().toISOString()
      });

      // Only add photos to captured photos, don't start analysis yet
      addCapturedPhotos(photos);

      success();
      showToast({
        type: 'success',
        title: 'Photos capturées !',
        message: `${photos.length} photo${photos.length > 1 ? 's' : ''} prête${photos.length > 1 ? 's' : ''} pour l'analyse`,
        duration: 3000
      });

    } catch (error) {
      showToast({
        type: 'error',
        title: 'Erreur de traitement',
        message: 'Impossible de traiter les photos sélectionnées',
        duration: 4000
      });
    }
  };

  const removePhoto = (index: number) => {
    removeCapturedPhoto(index);
  };

  const handleAnalyzePhotos = () => {
    if (capturedPhotos.length === 0) return;
    
    click();
    
    logger.info('FRIDGE_SCAN_PAGE', 'User clicked analyze photos button', {
      capturedPhotosCount: capturedPhotos.length,
      sessionId: currentSessionId,
      timestamp: new Date().toISOString()
    });
    
    // Start analysis immediately
    handlePhotosUploaded(capturedPhotos);
  };

  return {
    handleManualExit,
    handlePhotosUploaded,
    handleInventoryUpdate,
    handleFileSelect,
    removePhoto,
    handleAnalyzePhotos
  };
};