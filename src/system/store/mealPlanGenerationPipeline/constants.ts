import { MealPlanGenerationStepData } from './types';

// Configuration de la pipeline de génération de plans alimentaires
// 4 étapes pour une expérience plus simple et fluide
export const MEAL_PLAN_GENERATION_STEPS: MealPlanGenerationStepData[] = [
  {
    id: 'configuration',
    title: 'Configuration',
    subtitle: 'Sélectionnez vos préférences de planification',
    icon: 'Settings',
    color: '#8B5CF6',
    startProgress: 0
  },
  {
    id: 'generating',
    title: 'Génération des Plans',
    subtitle: 'La Forge crée vos plans alimentaires optimisés',
    icon: 'Sparkles',
    color: '#A855F7',
    startProgress: 25
  },
  {
    id: 'validation',
    title: 'Génération des Recettes',
    subtitle: 'Création des recettes détaillées pour vos repas',
    icon: 'ChefHat',
    color: '#8B5CF6',
    startProgress: 50
  },
  {
    id: 'recipe_details_validation',
    title: 'Finalisation',
    subtitle: 'Votre plan alimentaire complet est prêt',
    icon: 'Check',
    color: '#10B981',
    startProgress: 75
  }
];

// Nombre de semaines par défaut
export const DEFAULT_WEEK_COUNT = 1;

// Options pour le nombre de semaines
export const WEEK_COUNT_OPTIONS = [
  { value: 1, label: '1 semaine' },
  { value: 2, label: '2 semaines (recommandé)' },
  { value: 3, label: '3 semaines' },
  { value: 4, label: '4 semaines (1 mois)' }
];

// Storage key pour la persistence
export const STORAGE_KEY = 'twinforge:meal-plan-generation:pipeline';
