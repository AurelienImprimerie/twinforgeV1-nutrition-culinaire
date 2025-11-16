import { useState, useEffect } from 'react';
import { useUpdateWeight } from '@/hooks/coeur/useGamification';
import { useUserStore } from '@/system/store/userStore';
import { useToast } from '@/ui/components/ToastProvider';
import { weightValidationService } from '@/services/dashboard/suivi/WeightValidationService';
import type { WeightValidationResult } from '@/services/dashboard/suivi/WeightValidationService';
import { useAbsenceStatus } from '@/hooks/useAbsenceStatus';
import { useAbsenceReconciliation } from '@/hooks/useAbsenceReconciliation';
import type { CoachMessage } from '@/services/dashboard/coeur/absence/AbsenceRecoveryCoachingService';
import logger from '@/lib/utils/logger';

interface WeightUpdateState {
  weight: number;
  showValidationModal: boolean;
  validationResult: WeightValidationResult | null;
  showCelebration: boolean;
  coachMessages: CoachMessage[];
}

export function useWeightUpdate(weightHistory: any, onReconciliationSuccess?: (messages: CoachMessage[]) => void) {
  const [state, setState] = useState<WeightUpdateState>({
    weight: 70,
    showValidationModal: false,
    validationResult: null,
    showCelebration: false,
    coachMessages: []
  });

  const { profile } = useUserStore();
  const { showToast } = useToast();
  const updateWeightMutation = useUpdateWeight();

  // Absence detection and reconciliation
  const { data: absenceStatus } = useAbsenceStatus();
  const absenceReconciliation = useAbsenceReconciliation();

  useEffect(() => {
    if (profile?.weight_kg) {
      setState(prev => ({ ...prev, weight: profile.weight_kg }));
    }
  }, [profile?.weight_kg]);

  const handleIncrement = (amount: number) => {
    setState(prev => ({
      ...prev,
      weight: Math.round((Math.min(200, Math.max(30, prev.weight + amount)) * 10)) / 10 // Round to 0.1kg
    }));
  };

  const handleWeightChange = (newWeight: number) => {
    setState(prev => ({
      ...prev,
      weight: Math.round((Math.min(200, Math.max(30, newWeight)) * 10)) / 10
    }));
  };

  const handleWeightSubmit = async () => {
    if (state.weight === profile?.weight_kg) return;

    // Check if user has active absence - use reconciliation flow instead
    if (absenceStatus?.hasActiveAbsence) {
      logger.info('WEIGHT_UPDATE', 'Active absence detected, using reconciliation flow', {
        daysAbsent: absenceStatus.daysAbsent,
        pendingXp: absenceStatus.pendingXp
      });
      await handleAbsenceReconciliation();
      return;
    }

    // Normal weight update flow (no absence)
    const lastUpdate = weightHistory && weightHistory.length > 0 ? weightHistory[0] : null;
    const previousWeight = profile?.weight_kg || null;
    const lastUpdateDate = lastUpdate?.createdAt ? new Date(lastUpdate.createdAt) : null;

    const validation = weightValidationService.validateWeightChange(
      previousWeight || 70,
      state.weight,
      previousWeight,
      lastUpdateDate,
      profile?.objective as any || null
    );

    if (!validation.isValid || validation.severity !== 'safe') {
      setState(prev => ({
        ...prev,
        validationResult: validation,
        showValidationModal: true
      }));
      return;
    }

    await submitWeightUpdate();
  };

  const submitWeightUpdate = async () => {
    try {
      logger.info('WEIGHT_UPDATE', 'Starting weight update', {
        newWeight: state.weight,
        currentWeight: profile?.weight_kg,
        objective: profile?.objective,
        updatedFrom: 'dashboard_gaming'
      });

      const result = await updateWeightMutation.mutateAsync({
        newWeight: state.weight,
        updatedFrom: 'dashboard_gaming',
        objective: profile?.objective as any
      });

      logger.info('WEIGHT_UPDATE', 'Weight update successful', {
        weightDelta: result.weightUpdate.weightDelta,
        isMilestone: result.weightUpdate.isMilestone,
        xpAwarded: result.xpResult.xpAwarded
      });

      const weightDelta = result.weightUpdate.weightDelta;
      const isPositiveProgress =
        (profile?.objective === 'fat_loss' && weightDelta && weightDelta < 0) ||
        (profile?.objective === 'muscle_gain' && weightDelta && weightDelta > 0);

      if (isPositiveProgress || result.weightUpdate.isMilestone) {
        setState(prev => ({ ...prev, showCelebration: true }));
        setTimeout(() => {
          setState(prev => ({ ...prev, showCelebration: false }));
        }, 3000);
      }

      showToast({
        title: result.weightUpdate.isMilestone ? '🎯 Milestone atteint!' : '✅ Poids mis à jour!',
        message: `+${result.xpResult.xpAwarded} points${
          result.xpResult.leveledUp ? ` 🎉 Level Up! Niveau ${result.xpResult.newLevel}` : ''
        }`,
        type: 'success'
      });

      setState(prev => ({ ...prev, showValidationModal: false }));
    } catch (error: any) {
      logger.error('WEIGHT_UPDATE', 'Failed to update weight', {
        error: error?.message || 'Unknown error',
        errorDetails: error,
        newWeight: state.weight,
        currentWeight: profile?.weight_kg,
        objective: profile?.objective,
        code: error?.code,
        details: error?.details,
        hint: error?.hint
      });

      let errorMessage = 'Impossible de mettre à jour le poids';
      let errorTitle = 'Erreur';

      if (error?.message) {
        if (error.message.includes('row-level security') || error.message.includes('RLS')) {
          errorMessage = 'Problème de permissions. Veuillez vous reconnecter.';
          errorTitle = 'Permissions insuffisantes';
        } else if (error.message.includes('foreign key') || error.message.includes('not found')) {
          errorMessage = 'Données utilisateur introuvables. Veuillez rafraîchir la page.';
          errorTitle = 'Données manquantes';
        } else if (error.message.includes('constraint') || error.message.includes('check')) {
          errorMessage = 'Valeur de poids invalide. Veuillez vérifier votre saisie.';
          errorTitle = 'Valeur invalide';
        } else {
          errorMessage = `Erreur: ${error.message}`;
        }
      }

      showToast({
        title: errorTitle,
        message: errorMessage,
        type: 'error'
      });
    }
  };

  const closeValidationModal = () => {
    setState(prev => ({
      ...prev,
      showValidationModal: false,
      validationResult: null
    }));
  };

  const confirmWeightUpdate = async () => {
    if (state.validationResult?.allowSubmit) {
      await submitWeightUpdate();
    }
  };

  /**
   * Handle absence reconciliation when user has pending XP
   */
  const handleAbsenceReconciliation = async () => {
    try {
      logger.info('WEIGHT_UPDATE', 'Starting absence reconciliation', {
        newWeight: state.weight,
        currentWeight: profile?.weight_kg,
        daysAbsent: absenceStatus?.daysAbsent,
        pendingXp: absenceStatus?.pendingXp
      });

      const result = await absenceReconciliation.mutateAsync({
        newWeight: state.weight
      });

      logger.info('WEIGHT_UPDATE', 'Absence reconciliation successful', {
        totalAwardedXp: result.totalAwardedXp,
        bonusXp: result.bonusXp,
        coherenceScore: result.coherenceScore,
        messagesCount: result.coachMessages.length
      });

      // Store coach messages for display
      setState(prev => ({
        ...prev,
        coachMessages: result.coachMessages,
        showCelebration: true
      }));

      // Notify parent component about reconciliation success
      if (onReconciliationSuccess && result.coachMessages.length > 0) {
        onReconciliationSuccess(result.coachMessages);
      }

      // Hide celebration after 3 seconds
      setTimeout(() => {
        setState(prev => ({ ...prev, showCelebration: false }));
      }, 3000);

      showToast({
        title: '🎉 Points débloqués!',
        message: `+${result.totalAwardedXp} points attribués${result.bonusXp > 0 ? ` (bonus: +${result.bonusXp})` : ''}`,
        type: 'success'
      });
    } catch (error: any) {
      logger.error('WEIGHT_UPDATE', 'Absence reconciliation failed', {
        error: error?.message || 'Unknown error',
        newWeight: state.weight
      });

      showToast({
        title: 'Erreur',
        message: 'Impossible de réconcilier l\'absence. Réessayez.',
        type: 'error'
      });
    }
  };

  return {
    weight: state.weight,
    showValidationModal: state.showValidationModal,
    validationResult: state.validationResult,
    showCelebration: state.showCelebration,
    coachMessages: state.coachMessages,
    hasActiveAbsence: absenceStatus?.hasActiveAbsence || false,
    pendingXp: absenceStatus?.pendingXp || 0,
    isReconciling: absenceReconciliation.isPending,
    handleIncrement,
    handleWeightChange,
    handleWeightSubmit,
    submitWeightUpdate,
    closeValidationModal,
    confirmWeightUpdate
  };
}
