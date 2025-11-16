import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useBlocker } from 'react-router-dom';
import { usePerformanceMode } from '../../../system/context/PerformanceModeContext';
import { useQueryClient } from '@tanstack/react-query';
import { nanoid } from 'nanoid';
import { useUserStore } from '../../../system/store/userStore';
import { useToast } from '../../../ui/components/ToastProvider';
import { useFeedback } from '../../../hooks';
import { mealsRepo } from '../../../system/data/repositories/mealsRepo';
import MealPhotoCaptureStep from './components/MealPhotoCaptureStep/index';
import MealAnalysisProcessingStep from './components/MealAnalysisProcessingStep/index';
import MealResultsDisplayStep from './components/MealResultsDisplayStep';
import GlassCard from '../../../ui/cards/GlassCard';
import SpatialIcon from '../../../ui/icons/SpatialIcon';
import { ICONS } from '../../../ui/icons/registry';
import PageHeader from '../../../ui/page/PageHeader';
import logger from '../../../lib/utils/logger';
import { initialScanFlowState, type ScanFlowState, type ScanType } from './components/MealScanFlow/ScanFlowState';
import { useScanFlowHandlers } from './components/MealScanFlow/ScanFlowHandlers';
import { useBarcodePipelineHandlers } from './components/MealScanFlow/BarcodePipelineHandlers';
import BarcodeAnalysisProcessingStep from './components/BarcodeAnalysisStep/BarcodeAnalysisProcessingStep';
import BarcodeResultsDisplayStep from './components/BarcodeAnalysisStep/BarcodeResultsDisplayStep';
import ScanExitConfirmationModal from './components/MealScanFlow/ScanExitConfirmationModal';
import AIStatusBadge from './components/MealScanFlow/AIStatusBadge';
import { uploadMealPhoto, type UploadResult } from '../../../lib/storage/imageUpload';
import Portal from '../../../ui/components/Portal';

/**
 * Meal Scan Flow Page - HARMONISÉ avec MealsPage.tsx
 * Utilise exactement la même structure que les autres pages
 */
const MealScanFlowPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isPerformanceMode } = usePerformanceMode();
  const MotionDiv = isPerformanceMode ? 'div' : motion.div;
  const { profile, authReady, session, user } = useUserStore();
  const { showToast } = useToast();
  const { success, error: errorSound } = useFeedback();

  // State pour le flux de scan de repas
  const [scanFlowState, setScanFlowState] = useState<ScanFlowState>(initialScanFlowState);
  
  // State pour la modal de confirmation de sortie
  const [showExitConfirmation, setShowExitConfirmation] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);
  
  // Refs pour éviter les doubles appels
  const clientScanIdRef = useRef<string | null>(null);
  const processingGuardRef = useRef(false);
  const readyForProcessingRef = useRef<HTMLDivElement>(null);
  
  // Get userId from multiple sources with fallback
  const userId = session?.user?.id || user?.id || profile?.userId;

  // Bloquer la navigation si un scan est en cours
  const shouldBlockNavigation = !!(
    scanFlowState.capturedPhoto || 
    scanFlowState.isProcessing || 
    scanFlowState.analysisResults
  );

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => {
      // Ne pas bloquer si on reste sur la même page
      if (currentLocation.pathname === nextLocation.pathname) {
        return false;
      }
      
      // Bloquer seulement si un scan est en cours
      return shouldBlockNavigation;
    }
  );

  // Gérer le blocage de navigation
  React.useEffect(() => {
    if (blocker.state === 'blocked') {
      logger.info('MEAL_SCAN_EXIT', 'Navigation blocked - showing confirmation', {
        currentStep: scanFlowState.currentStep,
        hasCapturedPhoto: !!scanFlowState.capturedPhoto,
        isProcessing: scanFlowState.isProcessing,
        hasResults: !!scanFlowState.analysisResults,
        timestamp: new Date().toISOString()
      });
      
      // Stocker la navigation en attente
      setPendingNavigation(() => () => {
        blocker.proceed();
      });
      
      // Afficher la modal de confirmation
      setShowExitConfirmation(true);
    }
  }, [blocker.state, scanFlowState]);

  // Force scroll to top on step changes
  React.useEffect(() => {
    const scrollToTop = () => {
      // Scroll to top of main content container
      const mainContent = document.getElementById('main-content');
      if (mainContent) {
        mainContent.scrollTo({ top: 0, behavior: 'smooth' });
      }
      
      // Also scroll window as fallback
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    
    // Scroll on step changes with delay to allow DOM updates
    const timeoutId = setTimeout(scrollToTop, 100);
    
    logger.debug('MEAL_SCAN_SCROLL', 'Auto scroll triggered on step change', {
      currentStep: scanFlowState.currentStep,
      progress: scanFlowState.progress,
      timestamp: new Date().toISOString()
    });
    
    return () => clearTimeout(timeoutId);
  }, [scanFlowState.currentStep]);

  // Enhanced debugging for auth state - CRITICAL DIAGNOSTIC
  React.useEffect(() => {
    logger.info('MEAL_SCAN_FLOW_AUTH_DEBUG', 'Complete auth state in MealScanFlowPage', {
      // Direct Session Analysis
      hasSession: !!session,
      sessionUserId: session?.user?.id,
      sessionUserEmail: session?.user?.email,
      sessionAccessToken: session?.access_token ? 'present' : 'missing',
      sessionExpiresAt: session?.expires_at,
      
      // Direct User Analysis
      hasUser: !!user,
      userIdDirect: user?.id,
      userEmail: user?.email,
      
      // Profile Analysis
      hasProfile: !!profile,
      profileUserId: profile?.userId,
      profileDisplayName: profile?.displayName,
      profileKeys: profile ? Object.keys(profile) : [],
      
      // Auth Ready State
      authReady,
      
      // Derived userId
      userId
    });
  }, [session, user, profile, authReady, userId]);

  // Get scan flow handlers (for photo-analysis pipeline)
  const scanFlowHandlers = useScanFlowHandlers({
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
    onAnalysisError: (error: string) => {
      setScanFlowState(prev => ({ ...prev, analysisError: error }));
      showToast(`Erreur d'analyse: ${error}`, 'error');
      errorSound();
    },
    onSuccess: () => {
      success();
    }
  });

  // Get barcode pipeline handlers (for barcode-scan pipeline)
  const barcodePipelineHandlers = useBarcodePipelineHandlers({
    scanFlowState,
    setScanFlowState,
    clientScanIdRef,
    processingGuardRef,
    onAnalysisError: (error: string) => {
      setScanFlowState(prev => ({ ...prev, analysisError: error }));
      showToast(`Erreur d'analyse: ${error}`, 'error');
      errorSound();
    },
    onSuccess: () => {
      success();
    },
  });

  // Handle scan type selection
  const handleSelectScanType = React.useCallback((selectedScanType: ScanType) => {
    setScanFlowState(prev => ({
      ...prev,
      scanType: selectedScanType,
      progressMessage: selectedScanType === 'photo-analysis' ? 'Forge du Repas' : 'Scanner un Code-Barre',
      progressSubMessage: selectedScanType === 'photo-analysis' ? 'Capturez votre carburant nutritionnel' : 'Scannez le code-barre d\'un produit',
    }));

    logger.info('MEAL_SCAN_FLOW', 'Scan type selected', {
      scanType: selectedScanType,
      timestamp: new Date().toISOString(),
    });
  }, [setScanFlowState]);

  // State pour la sauvegarde
  const [isSaving, setIsSaving] = useState(false);

  // Handle save meal and reset - Fonction complète de sauvegarde et réinitialisation
  const handleSaveMealAndReset = async () => {
    if (!userId || isSaving) {
      return;
    }

    // Check if we have results from either pipeline
    const hasPhotoAnalysisResults = !!scanFlowState.analysisResults;
    const hasBarcodeResults = !!scanFlowState.barcodeAnalysisResults;

    if (!hasPhotoAnalysisResults && !hasBarcodeResults) {
      return;
    }

    setIsSaving(true);

    try {
      logger.info('MEAL_SCAN_SAVE', 'Starting meal save and reset process', {
        userId,
        scanType: scanFlowState.scanType,
        hasAnalysisResults: hasPhotoAnalysisResults,
        hasBarcodeResults: hasBarcodeResults,
        totalCalories: hasPhotoAnalysisResults
          ? scanFlowState.analysisResults.total_calories
          : scanFlowState.barcodeAnalysisResults?.totalCalories,
        hasCapturedPhoto: !!scanFlowState.capturedPhoto,
        timestamp: new Date().toISOString()
      });

      // Upload photo to Supabase Storage if available
      let photoUrl: string | undefined;
      if (scanFlowState.capturedPhoto?.file) {
        logger.info('MEAL_SCAN_SAVE', 'Uploading meal photo to storage', {
          userId,
          fileSize: scanFlowState.capturedPhoto.file.size,
          fileType: scanFlowState.capturedPhoto.file.type,
          timestamp: new Date().toISOString()
        });

        try {
          const uploadResult = await uploadMealPhoto(
            scanFlowState.capturedPhoto.file,
            userId
          );

          if (uploadResult.success && uploadResult.signedUrl) {
            photoUrl = uploadResult.signedUrl;
            logger.info('MEAL_SCAN_SAVE', 'Photo uploaded successfully with signed URL', {
              hasSignedUrl: true,
              uploadPath: uploadResult.uploadPath,
              userId,
              timestamp: new Date().toISOString()
            });
          } else {
            logger.warn('MEAL_SCAN_SAVE', 'Photo upload failed, continuing without photo', {
              error: uploadResult.error,
              userId,
              timestamp: new Date().toISOString()
            });

            // Show user-friendly message about photo upload failure
            showToast({
              type: 'warning',
              title: 'Photo non sauvegardée',
              message: uploadResult.error || 'La photo n\'a pas pu être sauvegardée, mais votre repas sera enregistré.',
              duration: 4000,
            });
          }
        } catch (uploadError) {
          logger.error('MEAL_SCAN_SAVE', 'Photo upload exception', {
            error: uploadError instanceof Error ? uploadError.message : String(uploadError),
            userId,
            timestamp: new Date().toISOString()
          });
          // Continue without photo
        }
      }

      // Préparer les données du repas selon le type de scan
      let mealData;

      if (scanFlowState.scanType === 'barcode-scan' && hasBarcodeResults) {
        // Barcode scan: utiliser les données du produit scanné
        const product = scanFlowState.barcodeAnalysisResults!.scannedProduct;
        mealData = {
          user_id: userId,
          timestamp: new Date().toISOString(),
          items: [product.mealItem],
          total_kcal: scanFlowState.barcodeAnalysisResults!.totalCalories,
          meal_type: 'snack' as const,
          meal_name: product.name,
          photo_url: photoUrl,
        };
      } else if (hasPhotoAnalysisResults) {
        // Photo analysis: utiliser les résultats de l'IA
        const allItems = [
          ...(scanFlowState.analysisResults.detected_foods || []),
          ...(scanFlowState.scannedProducts.map(p => p.mealItem) || []),
        ];

        const totalCalories = allItems.reduce((sum, item) => sum + item.calories, 0);

        mealData = {
          user_id: userId,
          timestamp: new Date().toISOString(),
          items: allItems,
          total_kcal: totalCalories || scanFlowState.analysisResults.total_calories || 0,
          meal_type: (scanFlowState.analysisResults.meal_type || 'dinner') as 'breakfast' | 'lunch' | 'dinner' | 'snack',
          meal_name: scanFlowState.analysisResults.meal_name,
          photo_url: photoUrl,
        };
      } else {
        throw new Error('Aucune donnée de repas à sauvegarder');
      }

      // Sauvegarder le repas
      const savedMeal = await mealsRepo.saveMeal(mealData);

      logger.info('MEAL_SCAN_SAVE', 'Meal saved to database, starting cache update', {
        mealId: savedMeal.id,
        userId,
        timestamp: new Date().toISOString()
      });

      // OPTIMISATION CRITIQUE: Mise à jour optimiste du cache avant invalidation
      // Cela garantit que l'UI affiche immédiatement le nouveau repas
      const existingMeals = queryClient.getQueryData<any[]>(['meals-today', userId]) || [];
      queryClient.setQueryData(['meals-today', userId], [savedMeal, ...existingMeals]);

      logger.info('MEAL_SCAN_SAVE', 'Optimistic cache update applied', {
        mealId: savedMeal.id,
        newMealsCount: existingMeals.length + 1,
        timestamp: new Date().toISOString()
      });

      // OPTIMISATION CRITIQUE: Forcer le refetch synchrone de toutes les queries de repas
      // Utilisation de refetchQueries avec type: 'active' pour forcer les refetch immediats
      // Gracefully handle cancellation errors to prevent console warnings
      await Promise.all([
        queryClient.refetchQueries({
          queryKey: ['meals-today', userId],
          type: 'active'
        }).catch(error => {
          if (error?.name !== 'CancelledError') throw error;
          logger.debug('MEAL_SCAN_SAVE', 'meals-today refetch cancelled, ignoring', { userId });
        }),
        queryClient.refetchQueries({
          queryKey: ['meals-week', userId],
          type: 'active'
        }).catch(error => {
          if (error?.name !== 'CancelledError') throw error;
          logger.debug('MEAL_SCAN_SAVE', 'meals-week refetch cancelled, ignoring', { userId });
        }),
        queryClient.refetchQueries({
          queryKey: ['meals-recent', userId],
          type: 'active'
        }).catch(error => {
          if (error?.name !== 'CancelledError') throw error;
          logger.debug('MEAL_SCAN_SAVE', 'meals-recent refetch cancelled, ignoring', { userId });
        }),
        queryClient.refetchQueries({
          queryKey: ['meals-history', userId],
          type: 'active'
        }).catch(error => {
          if (error?.name !== 'CancelledError') throw error;
          logger.debug('MEAL_SCAN_SAVE', 'meals-history refetch cancelled, ignoring', { userId });
        }),
        queryClient.invalidateQueries({ queryKey: ['meals-month', userId] }),
        queryClient.invalidateQueries({ queryKey: ['daily-ai-summary', userId] })
      ]);

      logger.info('MEAL_SCAN_SAVE', 'All meal queries refetched', {
        mealId: savedMeal.id,
        queries: ['meals-today', 'meals-week', 'meals-recent', 'meals-history', 'meals-month', 'daily-ai-summary'],
        timestamp: new Date().toISOString()
      });

      // Audio feedback de succès
      success();
      
      // Toast de succès
      const totalCalories = hasPhotoAnalysisResults
        ? scanFlowState.analysisResults.total_calories
        : scanFlowState.barcodeAnalysisResults!.totalCalories;

      showToast({
        type: 'success',
        title: 'Repas sauvegardé !',
        message: `${totalCalories} kcal ajoutées à votre forge nutritionnelle${photoUrl ? ' avec photo' : ''}`,
        duration: 3000,
      });

      logger.info('MEAL_SCAN_SAVE', 'Meal saved successfully, resetting scan state', {
        mealId: savedMeal.id,
        userId,
        photoSaved: !!photoUrl,
        timestamp: new Date().toISOString()
      });

      // Award XP for meal scan completion (async IIFE to not block UI)
      (async () => {
        try {
          if (userId) {
            const { gamificationService } = await import('../../../services/dashboard/coeur');
            await gamificationService.awardMealScanXp(userId, {
              mealId: savedMeal.id,
              scanType: scanFlowState.scanType,
              totalCalories: totalCalories,
              itemsCount: hasPhotoAnalysisResults
                ? scanFlowState.analysisResults.detected_foods?.length
                : 1,
              timestamp: new Date().toISOString()
            });

            logger.info('MEAL_SCAN_SAVE', 'XP awarded for meal scan', {
              mealId: savedMeal.id,
              scanType: scanFlowState.scanType,
              xpAwarded: 25,
              timestamp: new Date().toISOString()
            });

            // Force refetch gamification queries to refresh gaming widget immediately
            await queryClient.refetchQueries({ queryKey: ['gamification-progress'], type: 'active' });
            await queryClient.refetchQueries({ queryKey: ['xp-events'], type: 'active' });
            await queryClient.refetchQueries({ queryKey: ['daily-actions'], type: 'active' });

            logger.info('MEAL_SCAN_SAVE', 'Gaming widget queries refetched after meal scan', {
              mealId: savedMeal.id,
              scanType: scanFlowState.scanType,
              xpAwarded: 25,
              timestamp: new Date().toISOString()
            });
          }
        } catch (xpError) {
          logger.warn('MEAL_SCAN_SAVE', 'Failed to award XP for meal scan', {
            error: xpError instanceof Error ? xpError.message : 'Unknown error',
            mealId: savedMeal.id,
            timestamp: new Date().toISOString()
          });
        }
      })();

      // CRITIQUE: Ne pas naviguer ici si on est dans un contexte d'exit modal
      // La navigation sera gérée par handleSaveAndExit
      // Si on est dans le flux normal (bouton "Sauvegarder"), on navigue
      if (!showExitConfirmation) {
        // Réinitialiser complètement l'état du scan AVANT la navigation
        setScanFlowState(initialScanFlowState);
        clientScanIdRef.current = null;
        processingGuardRef.current = false;

        // OPTIMISATION CRITIQUE: Attendre légèrement plus longtemps pour que le cache soit à jour
        // Cela garantit que le DailyRecapTab affiche les données fraîches immédiatement
        await new Promise(resolve => setTimeout(resolve, 150));

        logger.info('MEAL_SCAN_SAVE', 'Navigating to meals page with fresh cache', {
          mealId: savedMeal.id,
          timestamp: new Date().toISOString()
        });

        // Navigation vers la page des repas avec état pour indiquer une sauvegarde récente
        navigate('/meals', { state: { freshMealSaved: true, mealId: savedMeal.id } });
      }
      
    } catch (error) {
      errorSound();
      logger.error('MEAL_SCAN_SAVE', 'Failed to save meal', {
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        userId,
        mealData: {
          totalCalories: scanFlowState.analysisResults?.total_calories,
          itemsCount: scanFlowState.analysisResults?.detected_foods?.length,
          mealType: scanFlowState.analysisResults?.meal_type,
          hasPhoto: !!photoUrl
        },
        timestamp: new Date().toISOString()
      });

      showToast({
        type: 'error',
        title: 'Erreur de sauvegarde',
        message: `Impossible de sauvegarder le repas: ${error instanceof Error ? error.message : 'Erreur inconnue'}. Veuillez réessayer.`,
        duration: 4000,
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Gestionnaires pour la modal de confirmation
  const handleSaveAndExit = async () => {
    try {
      if (scanFlowState.analysisResults) {
        logger.info('MEAL_SCAN_EXIT', 'Saving meal before exit', {
          hasResults: !!scanFlowState.analysisResults,
          timestamp: new Date().toISOString()
        });

        // Fermer la modal immédiatement pour éviter les double-appels
        setShowExitConfirmation(false);

        // Réinitialiser l'état de blocage pour permettre la navigation
        setScanFlowState(initialScanFlowState);
        clientScanIdRef.current = null;
        processingGuardRef.current = false;

        // Procéder à la navigation en attente
        if (pendingNavigation) {
          pendingNavigation();
          setPendingNavigation(null);
        }

        // Sauvegarder le repas (sans bloquer la navigation)
        // On laisse la sauvegarde se faire en arrière-plan
        handleSaveMealAndReset().catch(error => {
          logger.error('MEAL_SCAN_EXIT', 'Background save failed', {
            error: error instanceof Error ? error.message : String(error),
            timestamp: new Date().toISOString()
          });
        });

        logger.info('MEAL_SCAN_EXIT', 'Navigation allowed, saving in background', {
          timestamp: new Date().toISOString()
        });
      } else {
        // Pas de résultats, juste quitter
        setShowExitConfirmation(false);
        setScanFlowState(initialScanFlowState);
        clientScanIdRef.current = null;
        if (pendingNavigation) {
          pendingNavigation();
          setPendingNavigation(null);
        }
      }
    } catch (error) {
      logger.error('MEAL_SCAN_EXIT', 'Failed to exit', {
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      });
      showToast('Erreur lors de la sortie', 'error');
      setShowExitConfirmation(false);
    }
  };

  const handleDiscardAndExit = () => {
    logger.info('MEAL_SCAN_EXIT', 'User chose to discard scan and exit', {
      currentStep: scanFlowState.currentStep,
      hasCapturedPhoto: !!scanFlowState.capturedPhoto,
      hasResults: !!scanFlowState.analysisResults,
      timestamp: new Date().toISOString()
    });

    // Nettoyer l'état du scan
    setScanFlowState(initialScanFlowState);
    clientScanIdRef.current = null;
    processingGuardRef.current = false;

    // Fermer la modal
    setShowExitConfirmation(false);

    // Procéder à la navigation
    if (pendingNavigation) {
      pendingNavigation();
      setPendingNavigation(null);
    }
  };

  const handleCancelExit = () => {
    logger.info('MEAL_SCAN_EXIT', 'User cancelled exit, continuing scan', {
      currentStep: scanFlowState.currentStep,
      timestamp: new Date().toISOString()
    });
    
    setShowExitConfirmation(false);
    setPendingNavigation(null);
    
    // Reset blocker
    if (blocker.state === 'blocked') {
      blocker.reset();
    }
  };


  // Early return si pas d'auth
  if (!authReady) {
    return (
      <div className="space-y-6 w-full">
        <PageHeader
          icon="Loader"
          title="Chargement..."
          subtitle="Initialisation de votre session"
          circuit="meal-scan"
        />
        <GlassCard className="p-8 text-center">
          <div className="animate-spin w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-300">Chargement de votre session...</p>
        </GlassCard>
      </div>
    );
  }

  // Early return si pas d'utilisateur connecté
  if (!userId) {
    return (
      <div className="space-y-6 w-full">
        <PageHeader
          icon="LogIn"
          title="Connexion Requise"
          subtitle="Connectez-vous pour analyser vos repas"
          circuit="meal-scan"
        />
        <GlassCard className="p-8 text-center">
          <h2 className="text-xl font-bold text-white mb-4">Connexion Requise</h2>
          <p className="text-gray-300 mb-6">
            Vous devez être connecté pour utiliser l'analyse de repas.
          </p>
          <button
            onClick={() => navigate('/auth/login')}
            className="btn-glass--primary w-full"
          >
            <div className="flex items-center justify-center gap-2">
              <SpatialIcon Icon={ICONS.LogIn} size={16} />
              <span>Se Connecter</span>
            </div>
          </button>
        </GlassCard>
      </div>
    );
  }

  // Early return si pas de profil
  if (!profile) {
    logger.warn('MEAL_SCAN_FLOW_NO_PROFILE', 'CRITICAL: No profile detected, showing incomplete profile', {
      hasProfile: !!profile,
      hasSessionInfo: !!sessionInfo,
      authReady,
      userId,
      profileType: typeof profile,
      profileStringified: profile ? JSON.stringify(profile, null, 2).substring(0, 500) + '...' : 'null',
      userStoreProfileState: {
        profile: !!useUserStore.getState().profile,
        profileUserId: useUserStore.getState().profile?.userId,
        profileDisplayName: useUserStore.getState().profile?.displayName
      },
      timestamp: new Date().toISOString()
    });
    
    return (
      <div className="space-y-6 w-full">
        <PageHeader
          icon="User"
          title="Profil Incomplet"
          subtitle="Complétez votre profil pour des analyses nutritionnelles personnalisées"
          circuit="meal-scan"
        />
        <GlassCard className="p-8 text-center">
          <h2 className="text-xl font-bold text-white mb-4">Profil Incomplet</h2>
          <p className="text-gray-300 mb-6">
            Complétez votre profil pour bénéficier d'analyses nutritionnelles personnalisées.
          </p>
          <button
            onClick={() => navigate('/profile')}
            className="btn-glass--primary w-full mb-3"
          >
            <div className="flex items-center justify-center gap-2">
              <SpatialIcon Icon={ICONS.User} size={16} />
              <span>Compléter le Profil</span>
            </div>
          </button>
          <button
            onClick={() => navigate('/')}
            className="btn-glass--secondary-nav w-full"
          >
            <div className="flex items-center justify-center gap-2">
              <SpatialIcon Icon={ICONS.Home} size={16} />
              <span>Retour à l'accueil</span>
            </div>
          </button>
        </GlassCard>
      </div>
    );
  }

  // Rendu du contenu selon l'étape
  const renderContent = () => {
    if (scanFlowState.analysisError && scanFlowState.currentStep === 'processing') {
      return (
        <GlassCard className="p-8 text-center">
          <div className="mb-6">
            <SpatialIcon Icon={ICONS.AlertCircle} size={48} className="text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Erreur d'analyse</h2>
            <p className="text-gray-300">{scanFlowState.analysisError}</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => navigate('/meals')}
              className="flex-1 btn-glass--secondary-nav"
            >
              <div className="flex items-center justify-center gap-2">
                <SpatialIcon Icon={ICONS.ArrowLeft} size={16} />
                <span>Retour</span>
              </div>
            </button>
            <button
              onClick={scanFlowHandlers.handleRetake}
              className="flex-1 btn-glass--primary"
            >
              <div className="flex items-center justify-center gap-2">
                <SpatialIcon Icon={ICONS.RotateCcw} size={16} />
                <span>Réessayer</span>
              </div>
            </button>
          </div>
        </GlassCard>
      );
    }

    switch (scanFlowState.currentStep) {
      case 'capture':
        return (
          <MealPhotoCaptureStep
            scanType={scanFlowState.scanType}
            onSelectScanType={handleSelectScanType}
            capturedPhoto={scanFlowState.capturedPhoto}
            scannedBarcodes={scanFlowState.scannedBarcodes}
            scannedProducts={scanFlowState.scannedProducts}
            onPhotoCapture={scanFlowHandlers.handlePhotoCapture}
            onBarcodeDetected={scanFlowState.scanType === 'barcode-scan' ? barcodePipelineHandlers.handleBarcodeDetected : scanFlowHandlers.handleBarcodeDetected}
            onProductScanned={scanFlowHandlers.handleProductScanned}
            onProductPortionChange={scanFlowHandlers.handleProductPortionChange}
            onProductRemove={scanFlowHandlers.handleProductRemove}
            onBarcodePortionChange={scanFlowHandlers.handleBarcodePortionChange}
            onBarcodeRemove={scanFlowHandlers.handleBarcodeRemove}
            onRetake={scanFlowState.scanType === 'barcode-scan' ? barcodePipelineHandlers.handleBarcodeRetake : scanFlowHandlers.handleRetake}
            onBack={() => navigate('/meals')}
            onProceedToProcessing={scanFlowState.scanType === 'barcode-scan' ? barcodePipelineHandlers.handleBarcodeScan : scanFlowHandlers.handleProceedToProcessing}
            isProcessingInProgress={scanFlowState.isProcessing}
            readyForProcessingRef={readyForProcessingRef}
            progress={scanFlowState.progress}
            progressMessage={scanFlowState.progressMessage}
            progressSubMessage={scanFlowState.progressSubMessage}
          />
        );

      case 'processing':
        if (scanFlowState.scanType === 'barcode-scan') {
          return (
            <BarcodeAnalysisProcessingStep
              barcode={scanFlowState.scannedBarcodes[0]?.barcode || ''}
              productImage={scanFlowState.scannedBarcodes[0]?.image_url}
              progress={scanFlowState.progress}
              progressMessage={scanFlowState.progressMessage}
              progressSubMessage={scanFlowState.progressSubMessage}
            />
          );
        }
        return (
          <MealAnalysisProcessingStep
            capturedPhoto={scanFlowState.capturedPhoto}
            progress={scanFlowState.progress}
            progressMessage={scanFlowState.progressMessage}
            progressSubMessage={scanFlowState.progressSubMessage}
          />
        );

      case 'results':
        if (scanFlowState.scanType === 'barcode-scan' && scanFlowState.barcodeAnalysisResults) {
          return (
            <BarcodeResultsDisplayStep
              barcodeResults={scanFlowState.barcodeAnalysisResults}
              onSaveMeal={handleSaveMealAndReset}
              isSaving={isSaving}
              onRetake={barcodePipelineHandlers.handleBarcodeRetake}
              onNewScan={() => {
                setScanFlowState(initialScanFlowState);
                clientScanIdRef.current = nanoid();
              }}
            />
          );
        }
        return (
          <MealResultsDisplayStep
            analysisResults={scanFlowState.analysisResults}
            capturedPhoto={scanFlowState.capturedPhoto}
            progress={scanFlowState.progress}
            progressMessage={scanFlowState.progressMessage}
            progressSubMessage={scanFlowState.progressSubMessage}
            onSaveMeal={handleSaveMealAndReset}
            isSaving={isSaving}
            onRetake={scanFlowHandlers.handleRetake}
            onNewScan={() => {
              setScanFlowState(initialScanFlowState);
              clientScanIdRef.current = nanoid();
            }}
          />
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="w-full min-w-0 pb-8" style={{ overflow: 'visible !important' }}>
      <AnimatePresence mode="wait">
        <MotionDiv
          key={scanFlowState.currentStep}
          className="meal-scan-step pb-6"
          data-step={scanFlowState.currentStep}
          {...(!isPerformanceMode && {
            initial: { opacity: 0, y: 20 },
            animate: { opacity: 1, y: 0 },
            exit: { opacity: 0, y: -20 },
            transition: { duration: 0.3 }
          })}
          style={{ minHeight: 'auto', overflow: 'visible' }}
        >
          {renderContent()}
        </MotionDiv>
      </AnimatePresence>
      
      {/* Modal de Confirmation de Sortie */}
      <Portal>
        <ScanExitConfirmationModal
          isOpen={showExitConfirmation}
          onSaveAndExit={handleSaveAndExit}
          onDiscardAndExit={handleDiscardAndExit}
          onCancel={handleCancelExit}
          hasResults={!!scanFlowState.analysisResults}
          isProcessing={scanFlowState.isProcessing}
          capturedPhoto={scanFlowState.capturedPhoto}
        />
      </Portal>
    </div>
  );
};

export default MealScanFlowPage;