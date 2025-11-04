import { RecipeGenerationStepData } from './types';

// Configuration de la pipeline de génération de recettes
export const RECIPE_GENERATION_STEPS: RecipeGenerationStepData[] = [
  {
    id: 'configuration',
    title: 'Configuration',
    subtitle: 'Sélectionnez votre inventaire et vos préférences',
    icon: 'Settings',
    color: '#10B981',
    startProgress: 0
  },
  {
    id: 'generating',
    title: 'Génération IA',
    subtitle: 'La Forge Spatiale crée vos recettes personnalisées',
    icon: 'Sparkles',
    color: '#34D399',
    startProgress: 33
  },
  {
    id: 'validation',
    title: 'Validation',
    subtitle: 'Découvrez et sauvegardez vos recettes',
    icon: 'Check',
    color: '#10B981',
    startProgress: 66
  }
];

// Nombre de recettes par défaut
export const DEFAULT_RECIPE_COUNT = 4;

// Options pour le nombre de recettes
export const RECIPE_COUNT_OPTIONS = [
  { value: 2, label: '2 recettes' },
  { value: 4, label: '4 recettes (recommandé)' },
  { value: 6, label: '6 recettes' },
  { value: 8, label: '8 recettes' }
];

// Storage key pour la persistence
export const STORAGE_KEY = 'twinforge:recipe-generation:pipeline';

// Options de cuisine
export const CUISINE_TYPES = [
  { value: 'french', label: 'Française' },
  { value: 'italian', label: 'Italienne' },
  { value: 'asian', label: 'Asiatique' },
  { value: 'mediterranean', label: 'Méditerranéenne' },
  { value: 'mexican', label: 'Mexicaine' },
  { value: 'american', label: 'Américaine' },
  { value: 'middle-eastern', label: 'Moyen-Orient' },
  { value: 'indian', label: 'Indienne' }
];

// Options de difficulté
export const DIFFICULTY_LEVELS = [
  { value: 'easy', label: 'Facile', description: 'Recettes simples et rapides' },
  { value: 'medium', label: 'Moyen', description: 'Techniques intermédiaires' },
  { value: 'advanced', label: 'Avancé', description: 'Recettes élaborées' }
];

// Options de type de repas
export const MEAL_TYPES = [
  { value: 'breakfast', label: 'Petit-déjeuner' },
  { value: 'lunch', label: 'Déjeuner' },
  { value: 'dinner', label: 'Dîner' },
  { value: 'snack', label: 'Collation' }
];
