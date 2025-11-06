/**
 * useHideFastingForBulking Hook
 *
 * Hook personnalisé pour déterminer si les fonctionnalités de jeûne doivent être masquées.
 * Les fonctionnalités de jeûne sont masquées pour les utilisateurs en objectif de prise de masse
 * car le jeûne intermittent est contre-productif pour la croissance musculaire.
 *
 * @returns {boolean} true si l'utilisateur est en prise de masse et que le jeûne doit être masqué
 */

import { useUserStore } from '../system/store/userStore';

export function useHideFastingForBulking(): boolean {
  const profile = useUserStore((state) => state.profile);

  // Masquer le jeûne si l'objectif est la prise de masse
  return profile?.objective === 'muscle_gain';
}
