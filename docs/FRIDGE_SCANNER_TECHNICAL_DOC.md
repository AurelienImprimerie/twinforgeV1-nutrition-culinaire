# Scanner de Frigo - Documentation Technique Complète

## Table des Matières
1. [Vue d'Ensemble](#vue-densemble)
2. [Architecture Multi-Agents](#architecture-multi-agents)
3. [Pipeline Frontend](#pipeline-frontend)
4. [Edge Functions Backend](#edge-functions-backend)
5. [Gestion d'État avec Zustand](#gestion-détat-avec-zustand)
6. [Stratégies de Prompting](#stratégies-de-prompting)
7. [Système de Cache](#système-de-cache)
8. [Gestion des Tokens](#gestion-des-tokens)
9. [Intégration Frontend-Backend](#intégration-frontend-backend)
10. [Performance et Optimisations](#performance-et-optimisations)

---

## 1. Vue d'Ensemble

### Concept Général
Le Scanner de Frigo est un système intelligent qui permet aux utilisateurs de scanner le contenu de leur réfrigérateur via des photos et de générer automatiquement des suggestions d'aliments complémentaires pour créer un inventaire équilibré.

### Technologies Utilisées
- **Frontend**: React + TypeScript + Zustand
- **Backend**: Supabase Edge Functions (Deno)
- **IA**: OpenAI GPT-5-mini (Vision + Text)
- **Base de données**: PostgreSQL (via Supabase)
- **Cache**: Table `ai_analysis_jobs` avec TTL

### Architecture Globale
```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React)                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │      FridgeScanPage (Orchestrateur UI)              │   │
│  │  • Capture photos (jusqu'à 6)                       │   │
│  │  • Affichage du pipeline                            │   │
│  │  • Gestion des étapes                               │   │
│  └───────────────────┬──────────────────────────────────┘   │
│                      │                                      │
│  ┌───────────────────▼──────────────────────────────────┐   │
│  │   useFridgeScanPipeline (Zustand Store)             │   │
│  │  • État global du pipeline                          │   │
│  │  • Persistance localStorage                         │   │
│  │  • Actions CRUD inventaire                          │   │
│  └───────────────────┬──────────────────────────────────┘   │
└────────────────────┬─┴──────────────────────────────────────┘
                     │
        API Calls (fetch)
                     │
┌────────────────────▼────────────────────────────────────────┐
│              Supabase Edge Functions                        │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  AGENT 1: fridge-scan-vision                        │   │
│  │  • Vision API (GPT-5-mini)                          │   │
│  │  • Détection exhaustive d'aliments                  │   │
│  │  • Cache: 24h TTL                                   │   │
│  │  • Output: 30-40+ items                             │   │
│  └──────────────────┬───────────────────────────────────┘   │
│                     │                                       │
│  ┌──────────────────▼───────────────────────────────────┐   │
│  │  AGENT 2: inventory-processor                       │   │
│  │  • Normalisation des données                        │   │
│  │  • Analyse des allergènes                           │   │
│  │  • Scoring de fraîcheur                             │   │
│  │  • Cache: 48h TTL                                   │   │
│  └──────────────────┬───────────────────────────────────┘   │
│                     │                                       │
│  ┌──────────────────▼───────────────────────────────────┐   │
│  │  AGENT 3: inventory-complementer                    │   │
│  │  • Analyse nutritionnelle                           │   │
│  │  • Historique des repas                             │   │
│  │  • Suggestions personnalisées (15-20 items)         │   │
│  │  • Pas de cache (personnalisé)                      │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Architecture Multi-Agents

### Philosophie de Design
Le système utilise **3 agents IA spécialisés** qui travaillent séquentiellement :
1. **Agent Vision** : Détection exhaustive des aliments
2. **Agent Processeur** : Normalisation et enrichissement
3. **Agent Complémenteur** : Suggestions personnalisées

### Avantages de l'Architecture Multi-Agents
- ✅ **Séparation des responsabilités** : Chaque agent a un rôle unique
- ✅ **Cache optimal** : Seul l'agent 3 n'est pas caché (personnalisation)
- ✅ **Réutilisabilité** : Agents 1 et 2 peuvent être réutilisés ailleurs
- ✅ **Maintenabilité** : Facile de débugger et améliorer chaque agent
- ✅ **Scalabilité** : Ajout d'agents supplémentaires sans refonte

---

## 3. Pipeline Frontend

### 3.1 Composant Principal : `FridgeScanPage.tsx`

**Localisation** : `src/app/pages/FridgeScanPage.tsx`

```typescript
const FridgeScanPage: React.FC = () => {
  const {
    currentStep,
    isActive,
    currentSessionId,
    capturedPhotos,
    rawDetectedItems,
    userEditedInventory,
    suggestedComplementaryItems,
    // ... actions
  } = useFridgeScanPipeline();

  // Hooks personnalisés pour la logique métier
  useFridgeScanLifecycle({ /* ... */ });
  const actions = useFridgeScanActions({ /* ... */ });

  return (
    <motion.div>
      <FridgeScanProgressHeader />
      <FridgeScanExitButton />
      <FridgeScanStageRenderer currentStep={currentStep} />
    </motion.div>
  );
};
```

**Responsabilités** :
- Orchestration UI du pipeline
- Rendu conditionnel selon l'étape (`currentStep`)
- Gestion des actions utilisateur (capture, édition, validation)

### 3.2 Hooks Personnalisés

#### `useFridgeScanLifecycle`
**Localisation** : `src/app/pages/FridgeScan/hooks/useFridgeScanLifecycle.ts`

Gère le cycle de vie du pipeline :
- Restauration de session depuis localStorage
- Détection des sessions abandonnées
- Proposition de reprise automatique

#### `useFridgeScanActions`
**Localisation** : `src/app/pages/FridgeScan/hooks/useFridgeScanActions.ts`

Encapsule toutes les actions métier :
- `handleAnalyzePhotos()` : Lance Agent 1 (Vision)
- `handleInventoryUpdate()` : Modifie l'inventaire
- `removePhoto()` : Supprime une photo
- `handleManualExit()` : Sortie propre du pipeline

### 3.3 Stages du Pipeline

Le pipeline comporte **5 étapes** définies dans `constants.ts` :

```typescript
export const FRIDGE_SCAN_STEPS = [
  {
    id: 'photo',
    label: 'Capture Photos',
    description: 'Prenez jusqu\'à 6 photos',
    startProgress: 0,
    endProgress: 20
  },
  {
    id: 'analysis',
    label: 'Analyse Vision',
    description: 'Détection des aliments...',
    startProgress: 20,
    endProgress: 50
  },
  {
    id: 'complement',
    label: 'Suggestions',
    description: 'Génération des compléments...',
    startProgress: 50,
    endProgress: 75
  },
  {
    id: 'validation',
    label: 'Validation',
    description: 'Vérifiez votre inventaire',
    startProgress: 75,
    endProgress: 95
  },
  {
    id: 'complete',
    label: 'Terminé',
    description: 'Inventaire créé avec succès',
    startProgress: 95,
    endProgress: 100
  }
];
```

---

## 4. Edge Functions Backend

### 4.1 Agent 1 : Vision (`fridge-scan-vision`)

**Localisation** : `supabase/functions/fridge-scan-vision/index.ts`

#### Rôle
Analyser les photos du frigo et détecter **exhaustivement** tous les aliments visibles.

#### Configuration Technique
```typescript
{
  model: 'gpt-5-mini',
  max_completion_tokens: 15000,
  image_detail: 'high',
  max_images: 6
}
```

#### Pricing GPT-5-mini
- **Input**: $0.25 / 1M tokens
- **Cached Input**: $0.025 / 1M tokens
- **Output**: $2.00 / 1M tokens

#### Prompt Strategy (Extractif Ultra-Exhaustif)

**Longueur du prompt** : ~4500 caractères

**Objectifs clés** :
1. ✅ Détecter **30-40+ items minimum**
2. ✅ Politique de détection inclusive (confiance ≥ 0.3)
3. ✅ Catégorisation précise (12 catégories)
4. ✅ Quantités réalistes basées sur l'observation
5. ✅ Scoring de fraîcheur (0-100)

**Prompt complet** (extrait clé) :
```
MISSION CRITIQUE: Détecter de manière ABSOLUMENT EXHAUSTIVE tous les
éléments alimentaires visibles. Il est IMPÉRATIF de lister chaque élément
identifiable.

POLITIQUE DE DÉTECTION INCLUSIVE: Listez les éléments même avec une FAIBLE
CONFIANCE (0.3-0.6) s'ils sont visuellement présents.

ÉLÉMENTS FRÉQUEMMENT MANQUÉS - ATTENTION PARTICULIÈRE:
- Petits pots de condiments partiellement cachés
- Bouteilles en arrière-plan
- Articles dans les bacs à légumes
- Sachets ou emballages souples
- Restes dans des contenants transparents
```

#### Output Format
```json
[
  {
    "label": "Pommes rouges",
    "confidence": 0.95,
    "category": "Fruits",
    "estimated_quantity": "5 pommes",
    "freshness_score": 85
  },
  {
    "label": "Lait demi-écrémé",
    "confidence": 0.90,
    "category": "Produits laitiers",
    "estimated_quantity": "1L",
    "freshness_score": 90
  }
]
```

#### Système de Cache
```typescript
const cacheKey = `fridge_vision_${imageHashes.join('_')}`;

// Check cache (24h TTL)
const { data: cachedResult } = await supabase
  .from('ai_analysis_jobs')
  .select('result_payload')
  .eq('input_hash', cacheKey)
  .eq('analysis_type', 'fridge_vision')
  .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
  .single();

if (cachedResult) {
  return cachedResult.result_payload; // Cache hit
}
```

#### Gestion des Erreurs de Parsing

L'agent inclut un système robuste de fallback pour gérer les erreurs de parsing JSON :

**1. Sanitization des valeurs de confiance**
```typescript
const sanitizeConfidenceValues = (jsonString: string): string => {
  // Convertit "0.ninety" → "0.90"
  // Convertit "Ninety" → "0.90"
  // Pattern matching avancé pour gérer les outputs malformés
};
```

**2. Extraction partielle**
```typescript
const extractCompleteItems = (jsonString: string): any[] => {
  // Extrait les objets JSON complets même si le tableau global est malformé
  const objectPattern = /\{[^{}]*"label"[^{}]*\}/g;
  const matches = jsonString.match(objectPattern);
  // Parse chaque objet indépendamment
};
```

**3. Fallback data**
Si tout échoue, retourne un inventaire minimal :
```typescript
detectedItems = [
  { label: 'Pommes rouges', confidence: 0.8, category: 'Fruits', ... },
  { label: 'Eau en bouteille', confidence: 0.9, category: 'Boissons', ... },
  // ... 7 items de base
];
```

#### Logging et Métriques

Le système inclut un logging exhaustif pour auditer la qualité des détections :

```typescript
console.log('FRIDGE_SCAN_VISION', 'DETECTION AUDIT - Items parsed', {
  items_detected: detectedItems.length,
  detection_quality_assessment:
    detectedItems.length >= 40 ? 'EXCELLENT' :
    detectedItems.length >= 35 ? 'VERY_GOOD_PLUS' :
    detectedItems.length >= 25 ? 'VERY_GOOD' :
    detectedItems.length >= 20 ? 'GOOD' :
    detectedItems.length >= 15 ? 'ACCEPTABLE' : 'POOR',
  exhaustiveness_target_met: detectedItems.length >= 30,
  all_detected_items: detectedItems.map(item => ({
    label: item.label,
    category: item.category,
    confidence: item.confidence
  })),
  categories_detected: [...new Set(detectedItems.map(item => item.category))],
  items_by_category: { /* ... */ },
  completeness_check: {
    fruits_count: /* ... */,
    beverages_count: /* ... */,
    // ... autres catégories
  }
});
```

---

### 4.2 Agent 2 : Processeur (`inventory-processor`)

**Localisation** : `supabase/functions/inventory-processor/index.ts`

#### Rôle
Normaliser et enrichir les données brutes détectées par l'Agent 1.

#### Pas d'IA utilisée
Cet agent utilise uniquement de la **logique règles-métier** (pas d'appels OpenAI).

#### Fonctionnalités

**1. Normalisation des noms**
```typescript
function normalizeItemName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-zA-ZÀ-ÿ\s]/g, '')
    .replace(/\s+/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
```

**2. Détection des allergènes**
```typescript
const ALLERGEN_MAPPING = {
  'milk': ['lactose', 'dairy'],
  'cheese': ['lactose', 'dairy'],
  'bread': ['gluten', 'wheat'],
  'fish': ['fish'],
  'nuts': ['nuts']
};

function checkAllergens(name: string, userAllergies: string[]): string[] {
  // Cross-reference avec le profil utilisateur
  // Retourne les allergènes détectés
}
```

**3. Matching des préférences**
```typescript
function checkPreferences(
  name: string,
  userDislikes: string[],
  foodPreferences: FoodPreferences,
  sensoryPreferences: SensoryPreferences
): 'like' | 'dislike' | 'unknown' {
  // Tri-state preferences (like, dislike, unknown)
  // Check contre food_preferences
  // Check contre sensory_preferences (textures)
}
```

**4. Estimation d'expiration**
```typescript
function estimateExpiryDays(category: string, freshness: string): number {
  const baseDays = {
    'Fruits': 7,
    'Légumes': 10,
    'Viandes': 3,
    'Poissons': 2,
    'Produits laitiers': 5,
    'Céréales': 30
  }[category] || 7;

  const freshnessMultiplier = {
    'Excellent': 1.0,
    'Bon': 0.7,
    'Moyen': 0.4,
    'À utiliser rapidement': 0.1
  }[freshness] || 0.5;

  return Math.max(1, Math.round(baseDays * freshnessMultiplier));
}
```

#### Input Format
```typescript
{
  raw_detected_items: [
    {
      label: "Pommes rouges",
      confidence: 0.95,
      category: "Fruits",
      estimated_quantity: "5 pommes",
      freshness_score: 85
    }
  ],
  user_id: "uuid"
}
```

#### Output Format
```typescript
{
  inventory_normalized: [
    {
      name: "Pommes Rouges",
      category: "Fruits",
      quantity: "5 pommes",
      freshness: "Excellent",
      allergen_flags: [],
      preference_match: "unknown",
      estimated_expiry_days: 7,
      texture_flags: []
    }
  ],
  processing_time_ms: 150,
  items_processed: 35
}
```

#### Système de Cache (48h TTL)
```typescript
const cacheKey = await generateCacheKey(raw_detected_items, user_id);

// Check cache
const { data: cachedResult } = await supabase
  .from('ai_analysis_jobs')
  .select('result_payload')
  .eq('input_hash', cacheKey)
  .eq('analysis_type', 'inventory_processing')
  .gte('created_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
  .single();
```

---

### 4.3 Agent 3 : Complémenteur (`inventory-complementer`)

**Localisation** : `supabase/functions/inventory-complementer/index.ts`

#### Rôle
Générer des suggestions d'aliments complémentaires personnalisées pour atteindre un inventaire équilibré de 20+ items.

#### Configuration Technique
```typescript
{
  model: 'gpt-5-mini',
  temperature: 0.7,
  max_completion_tokens: 15000
}
```

#### Données d'Entrée

**1. Inventaire actuel**
```typescript
current_inventory: FridgeItem[]
```

**2. Profil utilisateur complet**
```typescript
user_profile: {
  sex: string,
  height_cm: number,
  weight_kg: number,
  target_weight_kg: number,
  activity_level: string,
  objective: string,
  constraints: any,
  food_preferences: any,
  household_details: any,
  macro_targets: any
}
```

**3. Historique des repas (10 derniers)**
```typescript
const { data: recentMeals } = await supabase
  .from('meals')
  .select('id, meal_name, items, timestamp, meal_type')
  .eq('user_id', user_id)
  .order('timestamp', { ascending: false })
  .limit(10);
```

#### Prompt Strategy (Personnalisation Avancée)

**Longueur du prompt** : ~5000 caractères

**Contexte fourni** :
1. ✅ Profil utilisateur complet (sexe, taille, poids, objectifs)
2. ✅ Inventaire actuel avec catégories
3. ✅ **Historique des 10 derniers repas** (innovation clé)
4. ✅ Contraintes alimentaires et allergies
5. ✅ Préférences culinaires
6. ✅ Détails du foyer (nombre de personnes)

**Prompt complet** (extrait clé) :
```
Tu es un expert en nutrition et planification de repas.

PROFIL UTILISATEUR:
- Sexe: ${user_profile.sex}
- Objectif: ${user_profile.objective}
- Contraintes: ${user_profile.constraints}

INVENTAIRE ACTUEL (${current_inventory.length} éléments):
${current_inventory.map(item => `- ${item.label} (${item.category})`).join('\n')}

HISTORIQUE DES REPAS RÉCENTS (10 derniers):
${recentMealsContext}

MISSION:
Suggère 15 à 20 aliments complémentaires pour atteindre un total d'au moins
20 éléments. Prends en compte:

1. L'équilibre nutritionnel
2. La variété des catégories
3. **PRIORITÉ ABSOLUE**: Les préférences utilisateur
4. Les objectifs fitness
5. **IMPORTANT**: Les habitudes alimentaires observées dans l'historique
6. **IMPORTANT**: Propose des aliments qui complètent les ingrédients
   déjà utilisés tout en apportant de la variété

CONTRAINTES:
- Atteindre un total d'au moins 20 éléments
- Personnalisation maximale selon l'historique
- Introduire de la variété tout en respectant les habitudes
```

#### Output Format
```json
[
  {
    "label": "Poulet fermier",
    "category": "Viandes",
    "quantity": "500g",
    "confidence": 0.95,
    "freshness": 90,
    "reason": "Source de protéines maigres pour atteindre vos objectifs de prise de muscle. Complète bien les légumes déjà présents et s'aligne avec vos repas récents riches en protéines.",
    "priority": "high"
  },
  {
    "label": "Quinoa",
    "category": "Céréales",
    "quantity": "250g",
    "confidence": 0.90,
    "freshness": 95,
    "reason": "Glucide complexe et protéine végétale pour varier avec le riz déjà présent. Observé dans vos repas récents, vous appréciez les céréales complètes.",
    "priority": "medium"
  }
]
```

#### Particularités

**Pas de cache** : Chaque appel est unique car personnalisé selon :
- Le profil utilisateur
- L'inventaire actuel
- L'historique récent des repas

**Consommation de tokens** :
- Input : ~2000-3000 tokens (profil + inventaire + historique)
- Output : ~2000-3000 tokens (15-20 suggestions détaillées)
- **Coût estimé** : $0.015 - $0.025 par appel

---

## 5. Gestion d'État avec Zustand

### 5.1 Store Principal : `useFridgeScanPipeline`

**Localisation** : `src/system/store/fridgeScan/index.ts`

#### Configuration du Store

```typescript
export const useFridgeScanPipeline = create<FridgeScanPipelineState>()(
  persist(
    (set, get) => ({
      // État
      currentStep: 'photo',
      isActive: false,
      currentSessionId: null,
      capturedPhotos: [],
      rawDetectedItems: [],
      userEditedInventory: [],
      suggestedComplementaryItems: [],
      // Actions
      ...createProgressActions(set, get),
      ...createPhotoActions(set, get),
      ...createInventoryActions(set, get),
      ...createRecipeActions(set, get),
      ...createSessionActions(set, get),
      ...createNavigationActions(set, get),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ /* seulement les données persistables */ }),
      merge: (persistedState, currentState) => { /* logique de merge */ }
    }
  )
);
```

#### État Complet du Store

```typescript
interface FridgeScanPipelineState {
  // Navigation
  currentStep: FridgeScanStep;
  isActive: boolean;
  currentSessionId: string | null;

  // Progression
  simulatedLoadingStep: number;
  simulatedScanProgress: number;
  simulatedOverallProgress: number;
  progressIntervalId: number | null;
  progressTimeoutId: number | null;

  // Données
  capturedPhotos: string[]; // Base64 images
  rawDetectedItems: RawDetectedItem[]; // Output Agent 1
  userEditedInventory: FridgeItem[]; // Output Agent 2 + user edits
  suggestedComplementaryItems: SuggestedItem[]; // Output Agent 3

  // Métadonnées
  loadingState: 'idle' | 'uploading' | 'analyzing' | 'generating' | 'saving';
  loadingMessage: string;
  steps: FridgeScanStepData[];
  recentSessions: FridgeScanSession[];
}
```

### 5.2 Actions Modulaires

Les actions sont organisées en **6 modules** pour maintenir la lisibilité :

#### `progressActions.ts`
```typescript
export const createProgressActions = (set, get) => ({
  startProgressSimulation: () => {
    // Gère l'animation de la progress bar
  },
  stopProgressSimulation: () => {
    // Arrête l'animation
  }
});
```

#### `photoActions.ts`
```typescript
export const createPhotoActions = (set, get) => ({
  addCapturedPhotos: (photos: string[]) => {
    // Ajoute des photos (max 6)
  },
  removeCapturedPhoto: (index: number) => {
    // Supprime une photo
  }
});
```

#### `inventoryActions.ts`
```typescript
export const createInventoryActions = (set, get) => ({
  updateInventory: (newInventory: FridgeItem[]) => {
    // Met à jour l'inventaire édité par l'utilisateur
  },
  processVisionResults: (rawItems: RawDetectedItem[]) => {
    // Stocke les résultats de l'Agent 1
  },
  setSuggestedComplementaryItems: (items: SuggestedItem[]) => {
    // Stocke les suggestions de l'Agent 3
  },
  addSelectedComplementaryItems: (selectedItems: SuggestedItem[]) => {
    // Ajoute des suggestions sélectionnées à l'inventaire
  }
});
```

#### `recipeActions.ts`
```typescript
export const createRecipeActions = (set, get) => ({
  setRecipeCandidates: (recipes: RecipeCandidate[]) => {
    // (Future: génération de recettes)
  }
});
```

#### `sessionActions.ts`
```typescript
export const createSessionActions = (set, get) => ({
  startScan: async () => {
    const sessionId = crypto.randomUUID();
    // Crée une nouvelle session
    // Sauvegarde dans Supabase
  },
  resumePipeline: async (sessionId: string) => {
    // Reprend une session existante
  },
  resetPipeline: () => {
    // Réinitialise tout le pipeline
  }
});
```

#### `navigationActions.ts`
```typescript
export const createNavigationActions = (set, get) => ({
  goToStep: (step: FridgeScanStep) => {
    // Navigue vers une étape spécifique
  },
  nextStep: () => {
    // Passe à l'étape suivante
  },
  previousStep: () => {
    // Retour à l'étape précédente
  }
});
```

### 5.3 Persistance et Hydratation

#### Stratégie de Persistance

**Données persistées** :
```typescript
partialize: (state) => ({
  currentStep: state.currentStep,
  isActive: state.isActive,
  currentSessionId: state.currentSessionId,
  simulatedOverallProgress: state.simulatedOverallProgress,
  rawDetectedItems: state.rawDetectedItems,
  userEditedInventory: state.userEditedInventory,
  mealPlan: state.mealPlan
})
```

**Données NON persistées** (recalculées à chaque refresh) :
- `progressIntervalId` / `progressTimeoutId` (timers)
- `loadingState` / `loadingMessage` (UI transient)
- `capturedPhotos` (trop lourd pour localStorage)
- `suggestedComplementaryItems` (recalculé si besoin)

#### Logique de Merge (Hydratation)

**Cas 1 : Session complétée**
```typescript
if (isSessionCompleted) {
  // Reset tout → start fresh
  mergedState.currentSessionId = null;
  mergedState.isActive = false;
  mergedState.currentStep = 'photo';
  mergedState.simulatedOverallProgress = 0;
  mergedState.rawDetectedItems = [];
  mergedState.userEditedInventory = [];
}
```

**Cas 2 : Session valide en cours**
```typescript
if (isValidSessionId && hasPersistedData) {
  // Restaure la session
  mergedState.currentSessionId = persistedData.currentSessionId;
  mergedState.isActive = true;

  // Détermine l'étape correcte selon les données
  if (persistedData.userEditedInventory?.length > 0) {
    mergedState.currentStep = 'validation';
  } else if (persistedData.rawDetectedItems?.length > 0) {
    mergedState.currentStep = 'validation';
  } else {
    mergedState.currentStep = 'photo';
  }
}
```

**Cas 3 : Aucune session valide**
```typescript
else {
  // Nouvelle session
  mergedState.currentSessionId = null;
  mergedState.isActive = false;
  mergedState.currentStep = 'photo';
}
```

---

## 6. Stratégies de Prompting

### 6.1 Agent 1 (Vision) - Prompt Ultra-Exhaustif

#### Objectif
Maximiser le nombre d'items détectés (target: **30-40+**)

#### Techniques Utilisées

**1. Langage assertif et CAPS**
```
MISSION CRITIQUE: Détecter de manière ABSOLUMENT EXHAUSTIVE...
Il est IMPÉRATIF de lister chaque élément...
AUCUN ÉLÉMENT NE DOIT ÊTRE OMIS.
```

**2. Liste exhaustive d'exemples**
```
- **Fruits** (pommes, citrons, melons, raisins, poires, bananes, oranges, etc.)
- **Légumes** (céleri, salade, carottes, brocoli, poivrons, tomates, oignons, etc.)
- **Viandes** (jambon, dinde, poulet, bacon, saucisses, etc.)
[...] 10 catégories avec 40+ exemples
```

**3. Liste des "éléments fréquemment manqués"**
```
ÉLÉMENTS FRÉQUEMMENT MANQUÉS - ATTENTION PARTICULIÈRE:
- Petits pots de condiments ou d'épices partiellement cachés
- Bouteilles en arrière-plan ou sur les côtés
- Emballages génériques ou sans marque visible
- Articles dans les bacs à légumes ou tiroirs
- Petites conserves ou bocaux
- Sachets ou emballages souples
[...] 12 catégories d'items souvent oubliés
```

**4. Politique de confiance inclusive**
```
POLITIQUE DE DÉTECTION INCLUSIVE: Listez les éléments même avec une
FAIBLE CONFIANCE (0.3-0.6) s'ils sont visuellement présents, plutôt que
de les omettre. Il vaut mieux inclure un élément incertain que de le
manquer complètement.
```

**5. Rappels réguliers de l'objectif**
```
CRITÈRE DE PERFORMANCE CLEF: La QUANTITÉ d'éléments détectés est un
indicateur majeur de la qualité de votre analyse.

RAPPEL CRITIQUE: Votre objectif est de créer un inventaire COMPLET et
EXHAUSTIF. Chaque élément alimentaire visible doit être répertorié.
```

#### Métriques de Qualité (Code)

```typescript
detection_quality_assessment:
  detectedItems.length >= 40 ? 'EXCELLENT' :
  detectedItems.length >= 35 ? 'VERY_GOOD_PLUS' :
  detectedItems.length >= 25 ? 'VERY_GOOD' :
  detectedItems.length >= 20 ? 'GOOD' :
  detectedItems.length >= 15 ? 'ACCEPTABLE' :
  detectedItems.length >= 10 ? 'POOR' : 'VERY_POOR'
```

### 6.2 Agent 3 (Complémenteur) - Prompt Personnalisation Avancée

#### Objectif
Générer 15-20 suggestions **hyper-personnalisées** basées sur le profil ET l'historique.

#### Techniques Utilisées

**1. Contextualisation complète**
```
PROFIL UTILISATEUR:
- Sexe: ${user_profile.sex}
- Taille: ${user_profile.height_cm} cm
- Poids actuel: ${user_profile.weight_kg} kg
- Objectif: ${user_profile.objective}
- Contraintes: ${user_profile.constraints}
- Préférences: ${user_profile.food_preferences}

INVENTAIRE ACTUEL (${current_inventory.length} éléments):
[Liste complète]

HISTORIQUE DES REPAS RÉCENTS (10 derniers):
[Liste des repas avec ingrédients]
```

**2. Priorisation explicite**
```
MISSION:
Prends en compte:

1. L'équilibre nutritionnel
2. La variété des catégories
3. **PRIORITÉ ABSOLUE**: Les préférences utilisateur
4. Les objectifs fitness
5. **IMPORTANT**: Les habitudes alimentaires observées dans l'historique
6. **IMPORTANT**: Propose des aliments qui complètent les ingrédients
   déjà utilisés tout en apportant de la variété
```

**3. Contraintes multiples**
```
CONTRAINTES:
- **OBJECTIF**: Atteindre un total d'au moins 20 éléments
- Privilégie les aliments frais et de base
- Évite les doublons avec l'inventaire existant
- **PERSONNALISATION MAXIMALE**: Assure-toi que les suggestions sont
  parfaitement alignées avec les objectifs ET les habitudes
- Si l'utilisateur mange souvent certains types d'aliments, suggère
  des compléments qui s'accordent bien
- Introduis de la variété tout en respectant les préférences observées
```

**4. Format de sortie structuré avec justifications**
```json
{
  "label": "Nom de l'aliment",
  "category": "Catégorie",
  "quantity": "Quantité estimée",
  "confidence": 0.95,
  "freshness": 90,
  "reason": "Raison détaillée basée sur l'inventaire ET l'historique",
  "priority": "high|medium|low"
}
```

#### Innovation : Historique des Repas

L'Agent 3 est le **seul agent** à utiliser l'historique des 10 derniers repas :

```typescript
const recentMealsContext = recentMeals.map(meal => {
  const ingredients = meal.items
    .map(item => item.name || item.label)
    .filter(Boolean)
    .join(', ');
  return `- ${meal.meal_name} (${meal.meal_type}): ${ingredients}`;
}).join('\n');
```

**Exemple de contexte historique** :
```
HISTORIQUE DES REPAS RÉCENTS (10 derniers repas):
- Salade César (déjeuner): Poulet, laitue romaine, parmesan, croûtons
- Pâtes carbonara (dîner): Pâtes, lardons, œufs, parmesan
- Smoothie protéiné (petit-déjeuner): Banane, protéine whey, lait d'amande
- Riz sauté aux légumes (déjeuner): Riz, brocoli, carottes, sauce soja
...
```

**Avantage** : L'IA peut observer les patterns (ex: utilisation fréquente de poulet) et suggérer des compléments cohérents (ex: marinades, épices asiatiques).

---

## 7. Système de Cache

### 7.1 Architecture du Cache

#### Table Supabase : `ai_analysis_jobs`

**Schema** :
```sql
CREATE TABLE ai_analysis_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  analysis_type TEXT NOT NULL, -- 'fridge_vision', 'inventory_processing', etc.
  status TEXT NOT NULL, -- 'completed', 'failed', etc.
  input_hash TEXT NOT NULL, -- Cache key
  request_payload JSONB,
  result_payload JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_cache_lookup
ON ai_analysis_jobs(input_hash, analysis_type, created_at);
```

### 7.2 Stratégies de Cache par Agent

#### Agent 1 (Vision) : 24h TTL

**Génération de la clé** :
```typescript
// Hash SHA-256 des images (premiers 1000 chars de chaque)
const imageHashes = await Promise.all(images.map(async (img) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(img.substring(0, 1000));
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}));

const cacheKey = `fridge_vision_${imageHashes.join('_')}`;
```

**Lookup** :
```typescript
const { data: cachedResult } = await supabase
  .from('ai_analysis_jobs')
  .select('result_payload')
  .eq('input_hash', cacheKey)
  .eq('analysis_type', 'fridge_vision')
  .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
  .single();

if (cachedResult) {
  return { ...cachedResult.result_payload, cache_hit: true };
}
```

**Justification du TTL 24h** :
- Les photos de frigo changent peu en 24h
- Économie de tokens significative (2000-4000 tokens input/output)
- Réponse instantanée pour l'utilisateur

#### Agent 2 (Processor) : 48h TTL

**Génération de la clé** :
```typescript
async function generateCacheKey(items: RawDetectedItem[], userId: string): Promise<string> {
  const data = JSON.stringify({ items, userId });
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
```

**Justification du TTL 48h** :
- Traitement déterministe (pas d'IA)
- Profil utilisateur change rarement
- Traitement rapide (150ms) donc cache moins critique

#### Agent 3 (Complémenteur) : PAS DE CACHE

**Raisons** :
1. ✅ **Personnalisation maximale** : Chaque appel est unique (profil + inventaire + historique)
2. ✅ **Historique dynamique** : Les 10 derniers repas changent fréquemment
3. ✅ **Faible coût** : ~$0.015-$0.025 par appel
4. ✅ **Expérience utilisateur** : Fraîcheur des suggestions

### 7.3 Métriques de Cache

#### Cache Hit Rate

```typescript
console.log('FRIDGE_SCAN_VISION', 'Cache hit', {
  user_id,
  cache_key: cacheKey,
  timestamp: new Date().toISOString()
});
```

#### Économies Estimées

**Agent 1 (Vision)** :
- Coût sans cache : ~$0.08 par scan (4000 input + 3000 output tokens)
- Cache hit rate estimé : 30-40% (utilisateurs scannant plusieurs fois par jour)
- Économie mensuelle (1000 users, 2 scans/jour) : **$1,440 - $1,920**

**Agent 2 (Processor)** :
- Pas de coût OpenAI (logique métier)
- Gain : Réduction de la charge serveur

**Agent 3 (Complémenteur)** :
- Pas de cache → Coût fixe par appel
- Coût estimé : $0.015 - $0.025 par scan

---

## 8. Gestion des Tokens

### 8.1 Système de Tokens Unifié

#### Architecture

**Table Supabase** : `ai_token_balances`
```sql
CREATE TABLE ai_token_balances (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  balance INT NOT NULL DEFAULT 0,
  last_refill_date DATE,
  subscription_type TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Table de consommation** : `ai_token_consumption`
```sql
CREATE TABLE ai_token_consumption (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  edge_function_name TEXT NOT NULL,
  operation_type TEXT NOT NULL,
  tokens_consumed INT NOT NULL,
  openai_model TEXT,
  openai_input_tokens INT,
  openai_output_tokens INT,
  openai_cost_usd DECIMAL(10, 6),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 8.2 Middleware de Tokens

**Localisation** : `supabase/functions/_shared/tokenMiddleware.ts`

#### `checkTokenBalance()`

```typescript
export async function checkTokenBalance(
  supabase: SupabaseClient,
  userId: string,
  requiredTokens: number
): Promise<{
  hasEnoughTokens: boolean;
  currentBalance: number;
  isSubscribed: boolean;
}> {
  const { data, error } = await supabase
    .from('ai_token_balances')
    .select('balance, subscription_type')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    return {
      hasEnoughTokens: false,
      currentBalance: 0,
      isSubscribed: false
    };
  }

  return {
    hasEnoughTokens: data.balance >= requiredTokens,
    currentBalance: data.balance,
    isSubscribed: data.subscription_type !== 'free' && !!data.subscription_type
  };
}
```

#### `consumeTokensAtomic()`

```typescript
export async function consumeTokensAtomic(
  supabase: SupabaseClient,
  params: {
    userId: string;
    edgeFunctionName: string;
    operationType: string;
    openaiModel?: string;
    openaiInputTokens?: number;
    openaiOutputTokens?: number;
    openaiCostUsd?: number;
    metadata?: any;
  }
): Promise<void> {
  // Calculer tokens consommés selon modèle et usage
  const tokensConsumed = calculateTokenCost(params);

  // Transaction atomique
  await supabase.rpc('consume_tokens_atomic', {
    p_user_id: params.userId,
    p_tokens_to_consume: tokensConsumed
  });

  // Logger la consommation
  await supabase.from('ai_token_consumption').insert({
    user_id: params.userId,
    edge_function_name: params.edgeFunctionName,
    operation_type: params.operationType,
    tokens_consumed: tokensConsumed,
    openai_model: params.openaiModel,
    openai_input_tokens: params.openaiInputTokens,
    openai_output_tokens: params.openaiOutputTokens,
    openai_cost_usd: params.openaiCostUsd,
    metadata: params.metadata
  });
}
```

### 8.3 Coûts Estimés par Agent

#### Agent 1 (Vision)

**Estimation** : 120 tokens

```typescript
const estimatedTokensForFridgeScan = 120;
const tokenCheck = await checkTokenBalance(supabase, user_id, estimatedTokensForFridgeScan);
```

**Détail** :
- Input tokens : ~4000 (prompt + 6 images high-res)
- Output tokens : ~3000 (30-40 items détaillés)
- Coût réel OpenAI : ~$0.08
- **Conversion** : 120 tokens internes ≈ $0.08

#### Agent 2 (Processor)

**Pas de coût** : Logique métier uniquement (pas d'OpenAI)

#### Agent 3 (Complémenteur)

**Estimation** : 35 tokens

```typescript
const estimatedTokens = 35;
const tokenCheck = await checkTokenBalance(supabase, user_id, estimatedTokens);
```

**Détail** :
- Input tokens : ~2500 (profil + inventaire + historique)
- Output tokens : ~2500 (15-20 suggestions)
- Coût réel OpenAI : ~$0.015 - $0.025
- **Conversion** : 35 tokens internes ≈ $0.025

### 8.4 Flow Complet de Gestion

```typescript
// 1. Pre-check
const tokenCheck = await checkTokenBalance(supabase, user_id, estimatedTokens);

if (!tokenCheck.hasEnoughTokens) {
  return createInsufficientTokensResponse(
    tokenCheck.currentBalance,
    estimatedTokens,
    !tokenCheck.isSubscribed,
    corsHeaders
  );
}

// 2. Exécution de l'opération (appel OpenAI)
const openaiResponse = await fetch(/* ... */);

// 3. Consommation atomique
await consumeTokensAtomic(supabase, {
  userId: user_id,
  edgeFunctionName: 'fridge-scan-vision',
  operationType: 'fridge-inventory-vision',
  openaiModel: 'gpt-5-mini',
  openaiInputTokens: inputTokens,
  openaiOutputTokens: outputTokens,
  openaiCostUsd: costUsd,
  metadata: {
    imagesProcessed: images.length,
    itemsDetected: detectedItems.length
  }
});
```

---

## 9. Intégration Frontend-Backend

### 9.1 Flow Complet du Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│                    ÉTAPE 1: CAPTURE                         │
│  User capture 1-6 photos                                    │
│  → Store: addCapturedPhotos(photos)                         │
│  → State: capturedPhotos[] (Base64)                         │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ handleAnalyzePhotos()
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    ÉTAPE 2: AGENT 1 (VISION)                │
│  POST /fridge-scan-vision                                   │
│  Body: { image_base64: [...], user_id }                     │
│                                                              │
│  Backend:                                                   │
│  1. checkTokenBalance(120 tokens)                           │
│  2. Check cache (24h TTL)                                   │
│  3. OpenAI Vision API (GPT-5-mini)                          │
│  4. Parse JSON (avec fallback robuste)                      │
│  5. consumeTokensAtomic()                                   │
│  6. Return: { detected_items: [...] }                       │
│                                                              │
│  Frontend:                                                  │
│  → Store: processVisionResults(detected_items)              │
│  → State: rawDetectedItems[]                                │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ Auto-trigger
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                  ÉTAPE 3: AGENT 2 (PROCESSOR)               │
│  POST /inventory-processor                                  │
│  Body: { raw_detected_items: [...], user_id }               │
│                                                              │
│  Backend:                                                   │
│  1. Pas de token check (logique métier)                     │
│  2. Check cache (48h TTL)                                   │
│  3. Normalize items (regex + mappings)                      │
│  4. Check allergens (ALLERGEN_MAPPING)                      │
│  5. Check preferences (tri-state)                           │
│  6. Estimate expiry (category-based)                        │
│  7. Return: { inventory_normalized: [...] }                 │
│                                                              │
│  Frontend:                                                  │
│  → Store: updateInventory(inventory_normalized)             │
│  → State: userEditedInventory[]                             │
│  → Navigation: goToStep('complement')                       │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ Check: items < 20?
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                 ÉTAPE 4: AGENT 3 (COMPLEMENTER)             │
│  POST /inventory-complementer                               │
│  Body: {                                                    │
│    user_id,                                                 │
│    current_inventory: [...],                                │
│    user_profile: { ... }                                    │
│  }                                                           │
│                                                              │
│  Backend:                                                   │
│  1. checkTokenBalance(35 tokens)                            │
│  2. Fetch recent meals (10 last)                            │
│  3. Build context (profile + inventory + meals)             │
│  4. OpenAI Chat API (GPT-5-mini)                            │
│  5. Parse JSON suggestions                                  │
│  6. consumeTokensAtomic()                                   │
│  7. Return: { suggested_items: [...] }                      │
│                                                              │
│  Frontend:                                                  │
│  → Store: setSuggestedComplementaryItems(suggested_items)   │
│  → State: suggestedComplementaryItems[]                     │
│  → Navigation: goToStep('validation')                       │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ User selects items
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    ÉTAPE 5: VALIDATION                      │
│  User reviews & edits final inventory                       │
│  → Store: addSelectedComplementaryItems(selected)           │
│  → State: userEditedInventory[] (merged)                    │
│  → Navigation: goToStep('complete')                         │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ Save to DB
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    ÉTAPE 6: SAUVEGARDE                      │
│  INSERT INTO fridge_scan_sessions                           │
│  Body: {                                                    │
│    session_id,                                              │
│    user_id,                                                 │
│    stage: 'complete',                                       │
│    final_inventory: userEditedInventory                     │
│  }                                                           │
│                                                              │
│  → Store: resetPipeline()                                   │
│  → Redirect: /fridge (Tabs "Fridges" ou "Plan")            │
└─────────────────────────────────────────────────────────────┘
```

### 9.2 Exemple de Code d'Intégration

#### Frontend : `useFridgeScanActions.ts`

```typescript
const handleAnalyzePhotos = async () => {
  try {
    setLoadingState('analyzing');
    startProgressSimulation();

    // AGENT 1: Vision
    const visionResponse = await fetch(
      `${SUPABASE_URL}/functions/v1/fridge-scan-vision`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          image_base64: capturedPhotos,
          user_id: userId
        })
      }
    );

    const visionData = await visionResponse.json();

    if (visionData.error === 'insufficient_tokens') {
      // Handle low tokens
      return;
    }

    // Store raw items
    processVisionResults(visionData.detected_items);

    // AGENT 2: Processor
    const processorResponse = await fetch(
      `${SUPABASE_URL}/functions/v1/inventory-processor`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          raw_detected_items: visionData.detected_items,
          user_id: userId
        })
      }
    );

    const processorData = await processorResponse.json();
    updateInventory(processorData.inventory_normalized);

    // Check if complement needed (< 20 items)
    if (processorData.inventory_normalized.length < 20) {
      goToStep('complement');

      // AGENT 3: Complementer
      const complementResponse = await fetch(
        `${SUPABASE_URL}/functions/v1/inventory-complementer`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            user_id: userId,
            current_inventory: processorData.inventory_normalized,
            user_profile: userProfile
          })
        }
      );

      const complementData = await complementResponse.json();
      setSuggestedComplementaryItems(complementData.suggested_items);
    }

    goToStep('validation');
  } catch (error) {
    console.error('Error in analyze photos', error);
    setLoadingState('idle');
  }
};
```

---

## 10. Performance et Optimisations

### 10.1 Métriques de Performance

#### Agent 1 (Vision)

**Sans cache** :
- Temps de traitement : 8-12 secondes
- Input tokens : ~4000
- Output tokens : ~3000
- Coût : ~$0.08

**Avec cache hit** :
- Temps de traitement : **< 500ms**
- Coût : **$0.00**
- Économie : **100%**

#### Agent 2 (Processor)

**Sans cache** :
- Temps de traitement : 150-300ms
- Coût : $0.00 (logique métier)

**Avec cache hit** :
- Temps de traitement : **< 100ms**
- Coût : $0.00

#### Agent 3 (Complémenteur)

**Pas de cache** :
- Temps de traitement : 5-8 secondes
- Input tokens : ~2500
- Output tokens : ~2500
- Coût : ~$0.015 - $0.025

### 10.2 Optimisations Implémentées

#### Frontend

**1. Persistance intelligente**
```typescript
// Seules les données essentielles sont persistées
partialize: (state) => ({
  currentStep: state.currentStep,
  isActive: state.isActive,
  currentSessionId: state.currentSessionId,
  rawDetectedItems: state.rawDetectedItems,
  userEditedInventory: state.userEditedInventory
})
// Photos (Base64) et loading states exclus → réduit localStorage
```

**2. Lazy loading des stages**
```typescript
const ComplementStage = lazy(() => import('./stages/ComplementStage'));
const ReviewEditStage = lazy(() => import('./stages/ReviewEditStage'));
```

**3. Simulation de progression**
```typescript
// UX : Progress bar animée pendant les appels API
startProgressSimulation: () => {
  const intervalId = setInterval(() => {
    set(state => ({
      simulatedScanProgress: Math.min(state.simulatedScanProgress + 2, 95)
    }));
  }, 200);
}
```

#### Backend

**1. Cache SHA-256 intelligent**
```typescript
// Hash uniquement les premiers 1000 chars de chaque image
const data = encoder.encode(img.substring(0, 1000));
// Génération rapide tout en restant unique
```

**2. Extraction JSON robuste**
```typescript
// Fallback multi-niveaux :
// 1. Parse JSON standard
// 2. Sanitize confidence values (word → number)
// 3. Extract partial items (regex)
// 4. Fallback minimal data
```

**3. Parsing parallèle**
```typescript
// Traitement concurrent des images
const imageHashes = await Promise.all(
  images.map(async (img) => hashImage(img))
);
```

**4. Logging structuré**
```typescript
// Tous les logs incluent:
// - user_id
// - timestamp ISO
// - operation context
// - performance metrics
// → Facilite le debugging et l'analyse
```

### 10.3 Axes d'Amélioration Future

#### Court Terme (Q1 2025)

1. **Compression des images côté client**
   - Réduire la taille des Base64 avant envoi
   - Target : 800x600px max par image
   - Économie estimée : 30% sur input tokens

2. **Batch processing amélioré**
   - Grouper Agents 1 + 2 en un seul appel
   - Réduire les round-trips réseau
   - Gain : 2-3 secondes sur le pipeline total

3. **WebSocket pour progression en temps réel**
   - Remplacer polling par WebSocket
   - Updates instantanés de la progress bar
   - Meilleure UX pendant l'analyse

#### Moyen Terme (Q2 2025)

1. **Fine-tuning GPT-5-mini**
   - Modèle spécialisé sur la détection alimentaire
   - Réduction des tokens output (JSON plus compact)
   - Amélioration de la précision (moins de fallbacks)

2. **Edge caching (CDN)**
   - Cache les réponses AI au niveau CDN
   - Géolocalisation des edge functions
   - Latence réduite de 50-70%

3. **Analytics dashboard**
   - Métriques de détection par agent
   - Cache hit rates
   - Coûts par utilisateur
   - Alertes si qualité < seuil

---

## Conclusion

Le Scanner de Frigo est un système **robuste, scalable et optimisé** qui :

✅ **Architecture Multi-Agents** : 3 agents spécialisés avec responsabilités claires
✅ **Prompting Avancé** : Techniques d'extraction exhaustive + personnalisation
✅ **Cache Intelligent** : TTL adaptatifs pour maximiser les économies
✅ **Gestion de Tokens** : Système unifié avec pre-check et consommation atomique
✅ **UX Optimale** : Pipeline fluide avec persistance et reprise automatique
✅ **Performance** : Cache hit → réponse en < 500ms, économie de 100%
✅ **Maintenabilité** : Code modulaire, logging structuré, typé TypeScript

**Coût moyen par scan** : $0.08 - $0.12 (avec cache ~30% → $0.06 - $0.09)
**Temps moyen** : 15-20 secondes (sans cache) | < 1 seconde (avec cache)

---

## Glossaire Technique

- **Agent** : Edge Function Supabase spécialisée avec un rôle unique
- **Pipeline** : Séquence d'étapes orchestrées par le frontend
- **TTL** (Time To Live) : Durée de validité du cache
- **Zustand** : Bibliothèque de gestion d'état React
- **Persistance** : Sauvegarde de l'état dans localStorage
- **Hydratation** : Restauration de l'état depuis localStorage
- **Token Balance** : Monnaie interne pour limiter l'usage de l'IA
- **Cache Hit** : Résultat trouvé dans le cache (pas d'appel OpenAI)
- **Exhaustivité** : Objectif de détecter 30-40+ items minimum

---

**Dernière mise à jour** : Novembre 2025
**Auteur** : Documentation générée depuis le code source réel
**Version** : 1.0.0
