import React from 'react';
import { nanoid } from 'nanoid';
import { type UserProfileContext, type MealAnalysisRequest } from '../../../../../system/data/repositories/mealsRepo';
import logger from '../../../../../lib/utils/logger';
import type { CapturedMealPhoto, ScanFlowState, ScannedProduct, ScannedBarcode } from './ScanFlowState';
import { openFoodFactsService } from '../../../../../system/services/openFoodFactsService';
import { useForgeXpRewards } from '../../../../../hooks/useForgeXpRewards';

/**
 * Convert File to Base64 for API transmission
 * Returns full data URL format (data:image/jpeg;base64,...)
 */
async function convertFileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Keep the full data URL format for validation
      resolve(result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Build complete user profile context for AI analysis
 */
export function buildUserProfileContext(profile: any): UserProfileContext {
  return {
    // Données d'identité
    sex: profile?.sex,
    height_cm: profile?.height_cm,
    weight_kg: profile?.weight_kg,
    target_weight_kg: profile?.target_weight_kg,
    activity_level: profile?.activity_level,
    objective: profile?.objective,
    birthdate: profile?.birthdate,
    job_category: profile?.job_category,
    
    // Données nutritionnelles
    nutrition: {
      diet: profile?.nutrition?.diet,
      allergies: profile?.nutrition?.allergies || [],
      intolerances: profile?.nutrition?.intolerances || [],
      disliked: profile?.nutrition?.disliked || [],
      budgetLevel: profile?.nutrition?.budgetLevel,
      proteinTarget_g: profile?.nutrition?.proteinTarget_g,
      fastingWindow: profile?.nutrition?.fastingWindow,
    },
    
    // Données de santé
    health: {
      bloodType: profile?.health?.bloodType,
      conditions: profile?.health?.conditions || [],
      medications: profile?.health?.medications || [],
    },
    
    // Données émotionnelles
    emotions: {
      chronotype: profile?.emotions?.chronotype,
      stress: profile?.emotions?.stress,
      sleepHours: profile?.emotions?.sleepHours,
      moodBaseline: profile?.emotionBaseline?.moodBaseline,
      sensitivities: profile?.emotions?.sensitivities || [],
    },
    
    // Préférences d'entraînement
    workout: {
      type: profile?.preferences?.workout?.type,
      sessionsPerWeek: profile?.preferences?.workout?.sessionsPerWeek,
      preferredDuration: profile?.preferences?.workout?.preferredDuration,
      equipment: profile?.preferences?.workout?.equipment || [],
      morningWorkouts: profile?.preferences?.workout?.morningWorkouts,
      highIntensity: profile?.preferences?.workout?.highIntensity,
      groupWorkouts: profile?.preferences?.workout?.groupWorkouts,
      outdoorActivities: profile?.preferences?.workout?.outdoorActivities,
    },
    
    // Contraintes alimentaires
    constraints: profile?.constraints || {},
    
    // Métadonnées calculées pour l'IA
    calculated_metrics: (() => {
      const age = profile?.birthdate ? 
        new Date().getFullYear() - new Date(profile.birthdate).getFullYear() : undefined;
      
      const bmi = profile?.height_cm && profile?.weight_kg ? 
        profile.weight_kg / Math.pow(profile.height_cm / 100, 2) : undefined;
      
      // Calcul BMR (Harris-Benedict)
      const bmr = profile?.height_cm && profile?.weight_kg && age ? 
        (profile.sex === 'male' 
          ? 88.362 + (13.397 * profile.weight_kg) + (4.799 * profile.height_cm) - (5.677 * age)
          : 447.593 + (9.247 * profile.weight_kg) + (3.098 * profile.height_cm) - (4.330 * age)
        ) : undefined;
      
      // Calcul TDEE (Total Daily Energy Expenditure)
      const activityFactor = profile?.activity_level === 'sedentary' ? 1.2 :
                            profile?.activity_level === 'light' ? 1.375 :
                            profile?.activity_level === 'moderate' ? 1.55 :
                            profile?.activity_level === 'active' ? 1.725 :
                            profile?.activity_level === 'athlete' ? 1.9 : 1.55;
      
      const tdee = bmr ? bmr * activityFactor : undefined;
      
      // Calcul cible protéines (1.6-2.2g/kg selon objectif)
      const proteinMultiplier = profile?.objective === 'muscle_gain' ? 2.2 :
                               profile?.objective === 'fat_loss' ? 2.0 : 1.6;
      const protein_target_calculated = profile?.weight_kg ? 
        profile.weight_kg * proteinMultiplier : undefined;
      
      return {
        age,
        bmi: bmi ? Math.round(bmi * 10) / 10 : undefined,
        bmr: bmr ? Math.round(bmr) : undefined,
        tdee: tdee ? Math.round(tdee) : undefined,
        protein_target_calculated: protein_target_calculated ? Math.round(protein_target_calculated) : undefined,
        daily_calorie_target: tdee ? Math.round(tdee) : undefined,
      };
    })(),
  };
}

/**
 * Custom hook for scan flow handlers
 */
export function useScanFlowHandlers({
  scanFlowState,
  setScanFlowState,
  profile,
  userId,
  clientScanIdRef,
  processingGuardRef,
  readyForProcessingRef,
  showToast,
  success,
  errorSound,
  queryClient,
  onAnalysisError,
  onSuccess
}: {
  scanFlowState: ScanFlowState;
  setScanFlowState: React.Dispatch<React.SetStateAction<ScanFlowState>>;
  profile: any;
  userId: string | undefined;
  clientScanIdRef: React.MutableRefObject<string | null>;
  processingGuardRef: React.MutableRefObject<boolean>;
  readyForProcessingRef: React.RefObject<HTMLDivElement>;
  showToast: (message: string, type?: string) => void;
  success: () => void;
  errorSound: () => void;
  queryClient: any;
  onAnalysisError: (error: string) => void;
  onSuccess: () => void;
}) {
  // Use the XP rewards hook at the component level
  const { awardForgeXpSilently } = useForgeXpRewards();

  // Gérer la capture de photo
  const handlePhotoCapture = React.useCallback(async (
    file: File,
    captureReport: any
  ) => {
    const photo: CapturedMealPhoto = {
      file,
      url: URL.createObjectURL(file),
      validationResult: {
        isValid: captureReport.validation?.isValid ?? true,
        issues: captureReport.validation?.issues ?? [],
        confidence: captureReport.validation?.confidence ?? 0.8,
      },
      captureReport,
    };

    setScanFlowState(prev => ({
      ...prev,
      capturedPhoto: photo,
      analysisError: null,
      progress: 33,
      progressMessage: 'Forge du Repas',
      progressSubMessage: 'Photo capturée avec succès'
    }));
    
    logger.info('MEAL_SCAN_FLOW', 'Photo captured', { 
      clientScanId: clientScanIdRef.current,
      isValid: photo.validationResult.isValid 
    });
    
    // Scroll fluide vers la section "Ready For Processing" après capture
    setTimeout(() => {
      if (readyForProcessingRef.current) {
        readyForProcessingRef.current.scrollIntoView({ 
          behavior: 'smooth',
          block: 'center'
        });
      }
    }, 300);
  }, [setScanFlowState, clientScanIdRef, readyForProcessingRef]);

  // Gérer la reprise de photo
  const handleRetake = React.useCallback(() => {
    setScanFlowState(prev => ({
      ...prev,
      capturedPhoto: null,
      analysisError: null,
      analysisMetadata: null,
      currentStep: 'capture',
      progress: 0,
      progressMessage: 'Forge du Repas',
      progressSubMessage: 'Prêt pour une nouvelle capture'
    }));
    
    logger.info('MEAL_SCAN_FLOW', 'Photo retake requested', { 
      clientScanId: clientScanIdRef.current 
    });
  }, [setScanFlowState, clientScanIdRef]);

  // Procéder au traitement
  const handleProceedToProcessing = React.useCallback(async () => {
    if (processingGuardRef.current || (!scanFlowState.capturedPhoto && scanFlowState.scannedBarcodes.length === 0 && scanFlowState.scannedProducts.length === 0) || !userId) {
      return;
    }

    processingGuardRef.current = true;
    setScanFlowState(prev => ({
      ...prev,
      isProcessing: true,
      currentStep: 'processing',
      analysisError: null,
      progress: 20,
      progressMessage: 'Analyse du Carburant',
      progressSubMessage: 'Démarrage de l\'analyse...'
    }));

    const clientScanId = clientScanIdRef.current!;

    try {
      // Étape 1: Analyser les codes-barres détectés
      if (scanFlowState.scannedBarcodes.length > 0) {
        logger.info('MEAL_SCAN_FLOW', 'Starting barcode analysis', {
          clientScanId,
          barcodesCount: scanFlowState.scannedBarcodes.length,
          barcodes: scanFlowState.scannedBarcodes.map(b => b.barcode),
        });

        setScanFlowState(prev => ({
          ...prev,
          progress: 30,
          progressSubMessage: `Analyse de ${scanFlowState.scannedBarcodes.length} code${scanFlowState.scannedBarcodes.length > 1 ? 's-barres' : '-barre'}...`
        }));

        const analyzedProducts: ScannedProduct[] = [];
        const failedBarcodes: Array<{barcode: string; reason: string}> = [];

        for (let i = 0; i < scanFlowState.scannedBarcodes.length; i++) {
          const barcodeItem = scanFlowState.scannedBarcodes[i];

          logger.info('MEAL_SCAN_FLOW', `Analyzing barcode ${i + 1}/${scanFlowState.scannedBarcodes.length}`, {
            clientScanId,
            barcode: barcodeItem.barcode,
            portionMultiplier: barcodeItem.portionMultiplier,
          });

          try {
            const result = await openFoodFactsService.getProductByBarcode(barcodeItem.barcode);

            if (result.success && result.product) {
              const mealItem = openFoodFactsService.convertToMealItem(result.product, barcodeItem.portionMultiplier);

              if (mealItem) {
                analyzedProducts.push({
                  barcode: result.product.barcode,
                  name: result.product.name,
                  brand: result.product.brand,
                  image_url: result.product.image_url,
                  mealItem,
                  portionMultiplier: barcodeItem.portionMultiplier,
                  scannedAt: barcodeItem.scannedAt,
                });

                logger.info('MEAL_SCAN_FLOW', 'Barcode analyzed successfully', {
                  clientScanId,
                  barcode: barcodeItem.barcode,
                  productName: result.product.name,
                  calories: mealItem.calories,
                });
              } else {
                failedBarcodes.push({barcode: barcodeItem.barcode, reason: 'Failed to convert to meal item'});
                logger.warn('MEAL_SCAN_FLOW', 'Failed to convert product to meal item', {
                  clientScanId,
                  barcode: barcodeItem.barcode,
                });
              }
            } else {
              failedBarcodes.push({barcode: barcodeItem.barcode, reason: result.error || 'Product not found'});
              logger.warn('MEAL_SCAN_FLOW', 'Product not found for barcode', {
                clientScanId,
                barcode: barcodeItem.barcode,
                error: result.error,
              });
            }
          } catch (error) {
            failedBarcodes.push({barcode: barcodeItem.barcode, reason: error instanceof Error ? error.message : 'Unknown error'});
            logger.error('MEAL_SCAN_FLOW', 'Exception during barcode analysis', {
              clientScanId,
              barcode: barcodeItem.barcode,
              error: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack : undefined,
            });
          }

          // Update progress for each barcode
          setScanFlowState(prev => ({
            ...prev,
            progress: 30 + (15 * (i + 1) / scanFlowState.scannedBarcodes.length),
            progressSubMessage: `Analyse ${i + 1}/${scanFlowState.scannedBarcodes.length} codes-barres...`,
          }));
        }

        // Ajouter les produits analysés au state
        setScanFlowState(prev => ({
          ...prev,
          scannedProducts: [...prev.scannedProducts, ...analyzedProducts],
          scannedBarcodes: [], // Vider les codes-barres après analyse
        }));

        logger.info('MEAL_SCAN_FLOW', 'Barcodes analysis completed', {
          clientScanId,
          totalBarcodes: scanFlowState.scannedBarcodes.length,
          analyzedCount: analyzedProducts.length,
          failedCount: failedBarcodes.length,
          failedDetails: failedBarcodes,
          analyzedProducts: analyzedProducts.map(p => ({
            barcode: p.barcode,
            name: p.name,
            calories: p.mealItem.calories,
          })),
        });

        // Show error if all barcodes failed
        if (analyzedProducts.length === 0 && failedBarcodes.length > 0) {
          const errorMsg = `Impossible d'analyser les codes-barres: ${failedBarcodes.map(f => f.reason).join(', ')}`;
          logger.error('MEAL_SCAN_FLOW', 'All barcodes failed to analyze', {
            clientScanId,
            failedBarcodes,
          });
          onAnalysisError(errorMsg);
          return;
        }
      }

      setScanFlowState(prev => ({
        ...prev,
        progress: 50,
        progressSubMessage: 'Identification des aliments...'
      }));

      // Construction du contexte utilisateur complet pour l'IA GPT-5 mini
      const userContext = buildUserProfileContext(profile);

      // CRITICAL: Build the analysis request with proper typing
      const analysisRequest: MealAnalysisRequest = {
        user_id: userId,
        meal_type: 'dinner' as const,
        timestamp: new Date().toISOString(),
        user_profile_context: userContext,
      };

      // Si on a une photo, l'ajouter
      if (scanFlowState.capturedPhoto) {
        analysisRequest.image_data = await convertFileToBase64(scanFlowState.capturedPhoto.file);
      }

      // Si on a des produits scannés, les ajouter
      if (scanFlowState.scannedProducts.length > 0) {
        analysisRequest.scanned_products = scanFlowState.scannedProducts.map(p => ({
          barcode: p.barcode,
          name: p.name,
          brand: p.brand,
          mealItem: p.mealItem,
          portionMultiplier: p.portionMultiplier,
        }));

        console.log('🔵 DEBUG - scannedProducts being sent:', {
          count: scanFlowState.scannedProducts.length,
          products: analysisRequest.scanned_products,
          analysisRequestKeys: Object.keys(analysisRequest),
          hasScannedProducts: !!analysisRequest.scanned_products,
        });
      }

      // Log du contexte transmis pour audit
      logger.info('MEAL_SCAN_FLOW', 'Transmitting complete user context to analysis', {
        clientScanId,
        contextKeys: Object.keys(userContext),
        philosophy: 'complete_user_context_transmission_to_analysis'
      });
      
      // Pause pour montrer l'étape processing
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setScanFlowState(prev => ({
        ...prev,
        progress: 60,
        progressSubMessage: 'Analyse des nutriments...'
      }));
      
      // Import dynamique pour éviter les dépendances circulaires
      const { mealsRepo } = await import('../../../../../system/data/repositories/mealsRepo');
      const analysisResponse = await mealsRepo.analyzeMeal(analysisRequest);

      // Debug log to check analysis response structure
      console.log('🔍 ScanFlowHandlers - analysisResponse:', {
        hasDetectedFoods: !!analysisResponse.detected_foods,
        detectedFoodsLength: analysisResponse.detected_foods?.length,
        detectedFoodsType: typeof analysisResponse.detected_foods,
        detectedFoods: analysisResponse.detected_foods,
        allKeys: Object.keys(analysisResponse)
      });

      // Store analysis metadata for display
      const analysisMetadata = {
        model: analysisResponse.analysis_metadata.ai_model_used,
        tokensUsed: analysisResponse.analysis_metadata.tokens_used?.total || 0,
        costUSD: analysisResponse.analysis_metadata.tokens_used?.cost_estimate_usd || 0,
        fallbackUsed: analysisResponse.analysis_metadata.fallback_used || false,
        photo_url: scanFlowState.capturedPhoto?.url,
      };
      
      setScanFlowState(prev => ({
        ...prev,
        progress: 70,
        progressSubMessage: 'Calcul des macronutriments...',
        analysisMetadata
      }));
      
      // Brief pause for UX
      await new Promise(resolve => setTimeout(resolve, 500));
      setScanFlowState(prev => ({
        ...prev,
        progress: 85,
        progressSubMessage: 'Optimisation pour vos objectifs...'
      }));
      
      await new Promise(resolve => setTimeout(resolve, 500));

      setScanFlowState(prev => ({
        ...prev,
        analysisResults: analysisResponse,
        progress: 95,
        progressMessage: 'Énergie Raffinée',
        progressSubMessage: 'Finalisation des données...'
      }));
      
      await new Promise(resolve => setTimeout(resolve, 500));
      setScanFlowState(prev => ({
        ...prev,
        progress: 100,
        currentStep: 'results'
      }));

      // Award XP for meal scan
      try {
        if (scanFlowState.capturedPhoto) {
          await awardForgeXpSilently('meal_scan');
        }

        if (scanFlowState.scannedProducts.length > 0) {
          await awardForgeXpSilently('barcode_scan');
        }
      } catch (error) {
        console.error('[MealScan] Failed to award XP:', error);
      }
      
      onSuccess();

      logger.info('MEAL_SCAN_FLOW', 'Analysis completed', {
        clientScanId,
        totalCalories: analysisResponse.total_calories,
        confidence: analysisResponse.confidence,
        insightsCount: analysisResponse.personalized_insights?.length || 0,
        aiModelUsed: analysisResponse.analysis_metadata?.ai_model_used,
        tokensUsed: analysisResponse.analysis_metadata?.tokens_used,
        analysisId: analysisResponse.analysis_id,
        hasPhoto: !!scanFlowState.capturedPhoto,
        scannedProductsCount: scanFlowState.scannedProducts.length,
        philosophy: 'analysis_with_complete_user_context_and_hybrid_input'
      });

    } catch (error) {
      logger.error('MEAL_SCAN_FLOW', 'Analysis failed', {
        clientScanId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      onAnalysisError(error instanceof Error ? error.message : 'Unknown error occurred');
    } finally {
      setScanFlowState(prev => ({ ...prev, isProcessing: false }));
      processingGuardRef.current = false;
    }
  }, [scanFlowState.capturedPhoto, scanFlowState.scannedBarcodes, scanFlowState.scannedProducts, userId, profile, setScanFlowState, clientScanIdRef, processingGuardRef, onAnalysisError, onSuccess, awardForgeXpSilently]);

  // Gérer l'ajout d'un produit scanné
  const handleProductScanned = React.useCallback((product: ScannedProduct) => {
    setScanFlowState(prev => ({
      ...prev,
      scannedProducts: [...prev.scannedProducts, product],
      analysisError: null,
    }));

    logger.info('MEAL_SCAN_FLOW', 'Product scanned and added', {
      clientScanId: clientScanIdRef.current,
      barcode: product.barcode,
      productName: product.name,
      totalScannedProducts: scanFlowState.scannedProducts.length + 1,
    });
  }, [setScanFlowState, clientScanIdRef, scanFlowState.scannedProducts.length]);

  // Gérer le changement de portion
  const handleProductPortionChange = React.useCallback((barcode: string, newMultiplier: number) => {
    setScanFlowState(prev => ({
      ...prev,
      scannedProducts: prev.scannedProducts.map(product => {
        if (product.barcode === barcode) {
          const updatedMealItem = openFoodFactsService.convertToMealItem(
            {
              barcode: product.barcode,
              name: product.name,
              brand: product.brand,
              image_url: product.image_url,
              portion_size: product.mealItem.portion_size,
              nutrition_per_100g: {
                calories: product.mealItem.calories / product.portionMultiplier,
                proteins: product.mealItem.proteins / product.portionMultiplier,
                carbs: product.mealItem.carbs / product.portionMultiplier,
                fats: product.mealItem.fats / product.portionMultiplier,
                fiber: product.mealItem.fiber ? product.mealItem.fiber / product.portionMultiplier : undefined,
                sugar: product.mealItem.sugar ? product.mealItem.sugar / product.portionMultiplier : undefined,
                sodium: product.mealItem.sodium ? product.mealItem.sodium / product.portionMultiplier : undefined,
              },
            },
            newMultiplier
          );

          return {
            ...product,
            portionMultiplier: newMultiplier,
            mealItem: updatedMealItem!,
          };
        }
        return product;
      }),
    }));

    logger.info('MEAL_SCAN_FLOW', 'Product portion changed', {
      clientScanId: clientScanIdRef.current,
      barcode,
      newMultiplier,
    });
  }, [setScanFlowState, clientScanIdRef]);

  // Gérer la suppression d'un produit
  const handleProductRemove = React.useCallback((barcode: string) => {
    setScanFlowState(prev => ({
      ...prev,
      scannedProducts: prev.scannedProducts.filter(p => p.barcode !== barcode),
    }));

    logger.info('MEAL_SCAN_FLOW', 'Product removed', {
      clientScanId: clientScanIdRef.current,
      barcode,
      remainingProducts: scanFlowState.scannedProducts.length - 1,
    });
  }, [setScanFlowState, clientScanIdRef, scanFlowState.scannedProducts.length]);

  // Track last barcode detection time to prevent rapid duplicates
  const lastBarcodeDetectionRef = React.useRef<{barcode: string; timestamp: number} | null>(null);

  // Gérer l'ajout d'un code-barre détecté
  const handleBarcodeDetected = React.useCallback((barcode: ScannedBarcode) => {
    setScanFlowState(prev => {
      const now = Date.now();
      const DUPLICATE_COOLDOWN_MS = 2000; // 2 seconds cooldown

      // Check if this is a rapid duplicate (same barcode within cooldown period)
      if (lastBarcodeDetectionRef.current &&
          lastBarcodeDetectionRef.current.barcode === barcode.barcode &&
          (now - lastBarcodeDetectionRef.current.timestamp) < DUPLICATE_COOLDOWN_MS) {
        logger.warn('MEAL_SCAN_FLOW', 'Rapid duplicate barcode detected, applying cooldown', {
          clientScanId: clientScanIdRef.current,
          barcode: barcode.barcode,
          timeSinceLastScan: now - lastBarcodeDetectionRef.current.timestamp,
          cooldownMs: DUPLICATE_COOLDOWN_MS,
        });
        return prev;
      }

      // Check if barcode already exists in current session
      const exists = prev.scannedBarcodes.some(b => b.barcode === barcode.barcode);
      if (exists) {
        logger.warn('MEAL_SCAN_FLOW', 'Barcode already in session, skipping', {
          clientScanId: clientScanIdRef.current,
          barcode: barcode.barcode,
          existingCount: prev.scannedBarcodes.length,
        });
        return prev;
      }

      // Update last detection timestamp
      lastBarcodeDetectionRef.current = {
        barcode: barcode.barcode,
        timestamp: now,
      };

      logger.info('MEAL_SCAN_FLOW', 'Barcode detected and added', {
        clientScanId: clientScanIdRef.current,
        barcode: barcode.barcode,
        totalScannedBarcodes: prev.scannedBarcodes.length + 1,
        timestamp: barcode.scannedAt,
      });

      return {
        ...prev,
        scannedBarcodes: [...prev.scannedBarcodes, barcode],
        analysisError: null,
      };
    });
  }, [setScanFlowState, clientScanIdRef]);

  // Gérer le changement de portion d'un code-barre
  const handleBarcodePortionChange = React.useCallback((barcode: string, newMultiplier: number) => {
    setScanFlowState(prev => ({
      ...prev,
      scannedBarcodes: prev.scannedBarcodes.map(item =>
        item.barcode === barcode ? { ...item, portionMultiplier: newMultiplier } : item
      ),
    }));

    logger.info('MEAL_SCAN_FLOW', 'Barcode portion changed', {
      clientScanId: clientScanIdRef.current,
      barcode,
      newMultiplier,
    });
  }, [setScanFlowState, clientScanIdRef]);

  // Gérer la suppression d'un code-barre
  const handleBarcodeRemove = React.useCallback((barcode: string) => {
    setScanFlowState(prev => ({
      ...prev,
      scannedBarcodes: prev.scannedBarcodes.filter(item => item.barcode !== barcode),
    }));

    logger.info('MEAL_SCAN_FLOW', 'Barcode removed', {
      clientScanId: clientScanIdRef.current,
      barcode,
      remainingBarcodes: scanFlowState.scannedBarcodes.length - 1,
    });
  }, [setScanFlowState, clientScanIdRef, scanFlowState.scannedBarcodes.length]);

  return {
    handlePhotoCapture,
    handleRetake,
    handleProceedToProcessing,
    handleProductScanned,
    handleProductPortionChange,
    handleProductRemove,
    handleBarcodeDetected,
    handleBarcodePortionChange,
    handleBarcodeRemove,
  };
}