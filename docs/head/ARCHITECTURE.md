# Architecture du Système HEAD

Cette documentation décrit l'architecture complète du système HEAD, le cerveau central de TwinForge.

## Table des matières

1. [Vue d'ensemble](#vue-densemble)
2. [Structure des composants](#structure-des-composants)
3. [Types et interfaces](#types-et-interfaces)
4. [Flux de données](#flux-de-données)
5. [Base de données](#base-de-données)
6. [Système d'événements](#système-dévénements)
7. [Mémoire conversationnelle](#mémoire-conversationnelle)
8. [Coaching proactif](#coaching-proactif)

---

## Vue d'ensemble

Le système HEAD est organisé en plusieurs couches:

```
┌─────────────────────────────────────────────────────────┐
│                     REACT APP LAYER                     │
│  (Hooks, Components, Pages)                             │
└─────────────────────────────────────────────────────────┘
                         │
┌─────────────────────────────────────────────────────────┐
│                  INTEGRATION LAYER                      │
│  • ChatIntegration (enrichissement chat texte)          │
│  • RealtimeIntegration (enrichissement voice)           │
│  • ProactiveCoachingOrchestrator (coaching proactif)    │
│  • UnifiedPromptBuilder (construction de prompts)       │
│  • FeedbackRecorder (enregistrement moments clés)       │
└─────────────────────────────────────────────────────────┘
                         │
┌─────────────────────────────────────────────────────────┐
│                      CORE LAYER                         │
│  • BrainCore (orchestrateur central - singleton)        │
│  • ContextManager (construction contexte unifié)        │
│  • CacheManager (cache intelligent avec TTL)            │
└─────────────────────────────────────────────────────────┘
                         │
┌──────────────────┬──────────────────┬──────────────────┐
│  KNOWLEDGE       │   AWARENESS      │    EVENTS        │
│  • UserKnowledge │   • SessionAware │   • EventHub     │
│  • DataCollectors│   • ActivityState│   • Listeners    │
│  • Forges        │   • AppContext   │   • Emitters     │
└──────────────────┴──────────────────┴──────────────────┘
                         │
┌─────────────────────────────────────────────────────────┐
│                   MEMORY LAYER                          │
│  • ConversationMemoryManager                            │
│  • Message persistence (texte + voix)                   │
│  • Context window management                            │
│  • Summaries automatiques                               │
└─────────────────────────────────────────────────────────┘
                         │
┌─────────────────────────────────────────────────────────┐
│                    DATA LAYER                           │
│  • Supabase PostgreSQL                                  │
│  • RLS Policies                                         │
│  • Realtime subscriptions                               │
└─────────────────────────────────────────────────────────┘
```

---

## Structure des composants

### 1. Core Infrastructure

#### BrainCore
**Fichier**: `/src/system/head/core/BrainCore.ts`

Singleton qui orchestre tout le système HEAD.

**Responsabilités**:
- Initialisation du système
- Gestion du cycle de vie
- Coordination des sous-systèmes
- API unifiée pour accéder au contexte
- Métriques de performance
- Health checks

**Méthodes principales**:
```typescript
class BrainCore {
  initialize(userId: string): Promise<void>
  getContext(): Promise<BrainContext>
  getForgeContext(forgeType: ForgeType): Promise<any>
  updateAppContext(context: AppContext): void
  updateSessionAwareness(awareness: SessionAwareness): void
  invalidateCache(forgeType?: ForgeType): void
  refresh(): Promise<void>
  getHealthStatus(): HealthStatus
  getPerformanceMetrics(): PerformanceMetrics
}
```

#### ContextManager
**Fichier**: `/src/system/head/core/ContextManager.ts`

Construit le contexte unifié en orchestrant tous les collecteurs de données.

**Responsabilités**:
- Orchestration de la collecte de données
- Fusion des données de plusieurs sources
- Gestion de la fraîcheur des données
- Construction du BrainContext complet

#### CacheManager
**Fichier**: `/src/system/head/core/CacheManager.ts`

Gestion du cache intelligent avec TTL.

**Responsabilités**:
- Cache en mémoire avec expiration
- Invalidation sélective par forge
- Nettoyage automatique des entrées expirées
- Métriques de cache hit rate

**Configuration TTL**:
- Training: 5 minutes (données fréquemment mises à jour)
- Equipment: 15 minutes (données stables)
- Profile: 10 minutes (mise à jour modérée)

### 2. Knowledge Base

#### UserKnowledgeBase
**Fichier**: `/src/system/head/knowledge/UserKnowledgeBase.ts`

Référentiel central pour toutes les données utilisateur.

**Responsabilités**:
- Agrégation des données de tous les forges
- Coordination des collecteurs de données
- Suivi de la fraîcheur des données
- Calcul des scores de complétude

**Forges supportés**:
```typescript
type ForgeType = 'training' | 'nutrition' | 'fasting' | 'body-scan' | 'equipment';
```

#### Data Collectors

**TrainingDataCollector** (`/src/system/head/knowledge/collectors/TrainingDataCollector.ts`):
- Sessions récentes (30 derniers jours)
- Charges actuelles par exercice
- Préférences d'exercices
- Patterns de progression
- Records personnels
- Objectifs actifs

**EquipmentDataCollector** (`/src/system/head/knowledge/collectors/EquipmentDataCollector.ts`):
- Lieux d'entraînement
- Équipement disponible par lieu
- Lieu par défaut

**NutritionDataCollector** (`/src/system/head/knowledge/collectors/NutritionDataCollector.ts`):
- Repas récents et scans
- Macros et calories journalières
- Patterns alimentaires
- Objectifs nutritionnels

**FastingDataCollector** (`/src/system/head/knowledge/collectors/FastingDataCollector.ts`):
- Sessions de jeûne actives et historique
- Protocoles de jeûne préférés
- Progression et metrics

**BodyScanDataCollector** (`/src/system/head/knowledge/collectors/BodyScanDataCollector.ts`):
- Scans corporels 3D récents
- Évolution morphologique
- Composition corporelle

**BreastfeedingDataCollector** (`/src/system/head/knowledge/collectors/BreastfeedingDataCollector.ts`):
- Statut d'allaitement actuel
- Type d'allaitement (exclusif/mixte/partiel)
- Âge du bébé et durée
- Besoins nutritionnels augmentés (calories, protéines, calcium, fer, oméga-3, eau)
- Recommandations alimentaires personnalisées
- Aliments prioritaires, limités et à éviter

**MenopauseDataCollector** (`/src/system/head/knowledge/collectors/MenopauseDataCollector.ts`):
- Statut reproductif (menstruant/périménopause/ménopause/post-ménopause)
- Phase de périménopause (précoce/tardive)
- Jours depuis dernières règles
- Progression vers confirmation de ménopause
- Niveaux hormonaux (FSH, œstrogène)
- Symptômes récents et intensité moyenne
- Recommandations adaptées (nutrition, exercice, jeûne, lifestyle)
- Suggestions de transition de phase
- Description de phase formatée pour l'IA

### 3. Session Awareness

#### SessionAwarenessService
**Fichier**: `/src/system/head/awareness/SessionAwarenessService.ts`

Suivi de l'activité utilisateur en temps réel.

**Responsabilités**:
- Tracking de la page/route actuelle
- Détection de l'état d'activité
- Suivi du contexte d'entraînement
- Style de réponse adaptatif

**États d'activité**:
```typescript
type ActivityState =
  | 'idle'
  | 'navigation'
  | 'training-active'
  | 'training-rest'
  | 'post-training'
  | 'meal-scan'
  | 'fridge-scan'
  | 'body-scan'
  | 'profile-editing';
```

**Styles de réponse**:
```typescript
type ResponseStyle = 'ultra-short' | 'short' | 'normal' | 'detailed';

// Mapping automatique:
// training-active → ultra-short (5-15 mots)
// training-rest → short (15-30 mots)
// idle/navigation → normal (30-50 mots)
// profile-editing → detailed (50+ mots)
```

#### TrainingSessionMonitor
**Fichier**: `/src/system/head/awareness/TrainingSessionMonitor.ts`

Suivi détaillé du contexte d'entraînement.

**Données trackées**:
```typescript
interface TrainingSessionContext {
  sessionId: string;
  discipline: string;
  currentExerciseIndex: number;
  totalExercises: number;
  currentExercise: {
    name: string;
    load: number;
    reps: string;
    sets: number;
  };
  currentSet: number;
  totalSets: number;
  isResting: boolean;
  restTimeRemaining: number;
  startTime: number;
  elapsedTime: number;
}
```

### 4. Integration Layer

#### ChatIntegration
**Fichier**: `/src/system/head/integration/ChatIntegration.ts`

Enrichissement du chat texte avec le contexte HEAD.

**Processus d'enrichissement**:
```typescript
async enrichChatRequest(
  request: ChatRequest,
  mode: ConversationMode
): Promise<EnrichedChatRequest> {
  // 1. Obtenir le contexte complet du brain
  const context = await brainCore.getContext();

  // 2. Construire un prompt système enrichi
  const systemPrompt = await promptBuilder.buildSystemPrompt(
    basePrompt,
    context,
    mode
  );

  // 3. Ajouter metadata contextuelle
  return {
    ...request,
    messages: [
      { role: 'system', content: systemPrompt },
      ...request.messages
    ],
    metadata: {
      userId: context.user.profile.userId,
      activityState: context.app.activityState,
      sessionActive: context.session.isActive
    }
  };
}
```

#### RealtimeIntegration
**Fichier**: `/src/system/head/integration/RealtimeIntegration.ts`

Enrichissement du voice coaching en temps réel.

**Méthodes principales**:
```typescript
class RealtimeIntegration {
  // Construire le prompt système initial
  async buildRealtimeSystemPrompt(
    basePrompt: string,
    mode: ConversationMode
  ): Promise<string>

  // Mettre à jour le contexte pendant la session
  updateTrainingContext(context: TrainingSessionContext): void

  // Enregistrer un feedback vocal
  async recordVoiceFeedback(
    sessionId: string,
    message: string,
    context: ExerciseContext
  ): Promise<void>

  // Nettoyer le contexte
  clearTrainingContext(): void
}
```

#### UnifiedPromptBuilder
**Fichier**: `/src/system/head/integration/UnifiedPromptBuilder.ts`

Construction de prompts riches et adaptatifs pour l'IA.

**Structure du prompt**:
```
┌─────────────────────────────────────────┐
│ SECTION 1: Identité du coach           │
│ "Tu es un coach sportif expert..."     │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│ SECTION 2: Profil utilisateur          │
│ • Objectif, niveau, disciplines         │
│ • Âge, sexe, contraintes               │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│ SECTION 3: Contexte d'entraînement     │
│ • Sessions récentes                     │
│ • Charges actuelles                     │
│ • Records personnels                    │
│ • Équipement disponible                 │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│ SECTION 4: Contexte actuel (si session)│
│ • Exercice en cours                     │
│ • Progression (série X/Y)               │
│ • État (effort vs repos)                │
│ • RPE dernière série                    │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│ SECTION 5: Style de réponse adaptatif  │
│ • Ultra-short si training-active        │
│ • Short si training-rest                │
│ • Normal sinon                          │
└─────────────────────────────────────────┘
```

#### ProactiveCoachingOrchestrator
**Fichier**: `/src/system/services/coaching/ProactiveCoachingOrchestrator.ts`

Orchestrateur pour le coaching proactif avec système de priorités.

**Système de priorités**:
```typescript
enum MessagePriority {
  CRITICAL = 100,  // Douleur, intervention immédiate
  HIGH = 75,       // Record, achievement majeur
  MEDIUM = 50,     // RPE élevé, série complétée
  LOW = 25,        // Conseils généraux, repos
  INFO = 10        // Information contextuelle
}
```

**Configuration**:
```typescript
interface ProactiveConfig {
  minDelayBetweenMessages: number;      // 8000ms par défaut
  priorityOverrideThreshold: number;    // 25 par défaut
  maxQueueSize: number;                 // 10 par défaut
  enableVoice: boolean;
  enableText: boolean;
  enableNotifications: boolean;
}
```

**Event handlers**:
- `handleSetCompleted()` - MEDIUM priority
- `handleExerciseCompleted()` - MEDIUM priority
- `handleRPEReported()` - MEDIUM priority (si RPE ≥ 8)
- `handlePainReported()` - CRITICAL priority (intervention immédiate)
- `handleRecordAchieved()` - HIGH priority (célébration)
- `handleRestStarted()` - LOW priority (conseils occasionnels)

---

## Types et interfaces

### BrainContext

```typescript
interface BrainContext {
  user: UserKnowledge;           // Toutes les données utilisateur
  app: AppContext;               // Page/activité actuelle
  session: SessionAwareness;     // Sessions actives
  missingData: MissingDataReport;// Données manquantes
  timestamp: number;             // Fraîcheur du contexte
  cacheKey: string;              // Identifiant de cache
}
```

### UserKnowledge

```typescript
interface UserKnowledge {
  profile: ProfileKnowledge;     // Identité, objectifs
  training: TrainingKnowledge;   // Entraînements, progression
  equipment: EquipmentKnowledge; // Lieux, matériel
  nutrition: NutritionKnowledge; // Repas, scans nutritionnels
  fasting: FastingKnowledge;     // Sessions de jeûne
  bodyScan: BodyScanKnowledge;   // Scans 3D corporels
  energy: EnergyKnowledge;       // Niveau d'énergie, fatigue
  temporal: TemporalKnowledge;   // Contexte temporel (jour, heure)
  breastfeeding?: BreastfeedingKnowledge;  // Allaitement et besoins nutritionnels
  menopause?: MenopauseKnowledge;          // Ménopause et adaptations
  lastUpdated: Record<ForgeType, number>;
  completeness: Record<ForgeType, number>; // 0-100%
}
```

### TrainingKnowledge

```typescript
interface TrainingKnowledge {
  recentSessions: TrainingSessionSummary[];
  currentLoads: Record<string, number>;
  exercisePreferences: ExercisePreference[];
  progressionPatterns: ProgressionPattern[];
  avgRPE: number;
  weeklyVolume: number;
  lastSessionDate: string | null;
  personalRecords: PersonalRecord[];
  activeGoals: TrainingGoal[];
  hasData: boolean;
}
```

### BreastfeedingKnowledge

```typescript
interface BreastfeedingKnowledge {
  hasData: boolean;
  isBreastfeeding: boolean;
  breastfeedingType: 'exclusive' | 'mixed' | 'partial' | null;
  babyAgeMonths: number | null;
  startDate: string | null;
  durationMonths: number | null;
  nutritionalNeeds: {
    extraCalories: number;      // Surplus calorique requis (300-500 kcal)
    extraProtein: number;       // Surplus protéique (20-25g)
    calciumNeed: number;        // Besoin en calcium (1000-1300mg)
    ironNeed: number;           // Besoin en fer (18-27mg)
    omega3Need: number;         // Besoin en oméga-3 (250-375mg DHA)
    waterIntake: number;        // Hydratation (2.0-3.0L)
  };
  recommendations: {
    priorityFoods: string[];    // Aliments prioritaires
    limitedFoods: string[];     // Aliments à limiter
    avoidFoods: string[];       // Aliments à éviter
    mealFrequency: string;      // Fréquence des repas
  };
  notes: string | null;
}
```

### MenopauseKnowledge

```typescript
interface MenopauseKnowledge {
  hasActiveTracking: boolean;
  status: 'menstruating' | 'perimenopause' | 'menopause' | 'postmenopause' | null;
  stage: 'early-perimenopause' | 'late-perimenopause' | null;
  daysSinceLastPeriod: number | null;
  daysUntilMenopauseConfirmation: number | null;  // 365 jours sans règles = confirmation
  isInTransition: boolean;
  phaseDescription: string | null;
  energyLevel: 'low' | 'moderate' | 'high' | null;
  metabolicRate: 'reduced' | 'normal' | null;
  fshLevel: number | null;        // Niveau FSH (follicle-stimulating hormone)
  estrogenLevel: number | null;   // Niveau œstrogène
  recentSymptoms: MenopauseSymptomLog[];  // 30 derniers jours
  averageSymptomIntensity: number;  // 0-10
  recommendations: {
    nutrition: string[];    // Adaptations nutritionnelles
    exercise: string[];     // Adaptations exercice
    fasting: string[];      // Adaptations jeûne
    lifestyle: string[];    // Adaptations lifestyle
  } | null;
  transitionSuggestion: {
    shouldSuggest: boolean;
    suggestedStatus: 'perimenopause' | 'menopause' | 'postmenopause' | null;
    reason: string;
  } | null;
  formattedForAI: string | null;  // Description formatée pour l'IA
  lastUpdate: string | null;
  hasData: boolean;
}
```

### SessionAwareness

```typescript
interface SessionAwareness {
  isActive: boolean;
  sessionType: 'training' | 'nutrition' | 'fasting' | 'body-scan' | null;
  trainingSession?: TrainingSessionContext;
  timestamp: number;
}
```

---

## Flux de données

### Initialisation

```
App Start
    ↓
useBrainInitialization()
    ↓
BrainCore.initialize(userId)
    ↓
├─ Create Supabase client
├─ Create CacheManager
├─ Create UserKnowledgeBase
│  ├─ Create TrainingDataCollector
│  ├─ Create EquipmentDataCollector
│  └─ Load initial data (cached)
├─ Create SessionAwarenessService
├─ Create ContextManager
├─ Create EventListenerHub
└─ Create ConversationMemoryManager
    ↓
Brain Ready ✓
```

### Construction du contexte

```
Chat/Realtime Request
    ↓
chatIntegration.enrichChatRequest() OR
realtimeIntegration.buildRealtimeSystemPrompt()
    ↓
brainCore.getContext()
    ↓
ContextManager.buildContext()
    ↓
├─ UserKnowledgeBase.getUserKnowledge()
│  ├─ Check cache (5-15 min TTL)
│  ├─ If stale, collect fresh data
│  │  ├─ TrainingDataCollector.collect()
│  │  └─ EquipmentDataCollector.collect()
│  └─ Return cached or fresh data
├─ SessionAwarenessService.getSessionAwareness()
├─ SessionAwarenessService.getAppContext()
└─ MissingDataDetector.analyze()
    ↓
UnifiedPromptBuilder.buildSystemPrompt()
    ↓
Context-Enriched Request ✓
```

### Tracking de page

```
Route Change
    ↓
useBrainPageTracking() (hook)
    ↓
brainCore.updateAppContext({
  currentRoute,
  pageContext: { type, subContext },
  activityState,
  timestamp
})
    ↓
SessionAwarenessService.updateAppContext()
    ↓
Next context request includes updated page info ✓
```

### Événements d'entraînement

```
Training Event (set completed, record, etc.)
    ↓
EventListenerHub.emit(eventType, data)
    ↓
├─ ProactiveCoachingOrchestrator (listener)
│  ├─ Determine message priority
│  ├─ Check rate limiting
│  ├─ Send or queue message
│  └─ Send to voice/text/notifications
│
├─ ConversationMemoryManager (listener)
│  └─ Store event in conversation history
│
└─ Other listeners...
    ↓
User sees proactive coaching ✓
```

---

## Base de données

### brain_context_cache

Cache pour optimiser les performances.

```sql
CREATE TABLE brain_context_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  forge_type text CHECK (forge_type IN ('training', 'nutrition', 'fasting', 'body-scan', 'equipment')),
  cache_key text NOT NULL,
  data jsonb NOT NULL,
  timestamp timestamptz DEFAULT now(),
  ttl integer DEFAULT 300000, -- 5 minutes en ms
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_brain_cache_user_forge ON brain_context_cache(user_id, forge_type);
CREATE INDEX idx_brain_cache_timestamp ON brain_context_cache(timestamp);
```

**RLS**:
- Users can only access their own cache entries

### conversation_history

Historique de toutes les conversations (texte + voix).

```sql
CREATE TABLE conversation_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id text,
  mode text CHECK (mode IN ('text', 'voice', 'system')),
  role text CHECK (role IN ('user', 'assistant', 'system')),
  content text NOT NULL,
  timestamp bigint NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_conversation_user_session ON conversation_history(user_id, session_id);
CREATE INDEX idx_conversation_timestamp ON conversation_history(timestamp DESC);
```

**RLS**:
- Users can only access their own conversations

### conversation_summaries

Résumés automatiques pour optimiser le context window.

```sql
CREATE TABLE conversation_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id text,
  summary_text text NOT NULL,
  message_count integer NOT NULL,
  start_timestamp bigint NOT NULL,
  end_timestamp bigint NOT NULL,
  key_topics text[] DEFAULT ARRAY[]::text[],
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_summaries_user_session ON conversation_summaries(user_id, session_id);
CREATE INDEX idx_summaries_timestamp ON conversation_summaries(end_timestamp DESC);
```

**Fonctions PostgreSQL**:
- `get_conversation_context_with_summary()` - Récupère résumé + 20 messages récents
- `cleanup_old_summaries()` - Nettoie les résumés > 90 jours

### training_feedbacks

Moments clés enregistrés pendant les sessions (douleurs, records, etc.).

```sql
CREATE TABLE training_feedbacks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_name text,
  set_number integer,
  category text CHECK (category IN ('motivation', 'technique', 'difficulty', 'pain', 'progression', 'question', 'general')),
  is_key_moment boolean DEFAULT false,
  message text NOT NULL,
  context_metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_feedbacks_user_session ON training_feedbacks(user_id, session_id);
CREATE INDEX idx_feedbacks_key_moments ON training_feedbacks(user_id, is_key_moment) WHERE is_key_moment = true;
```

### breastfeeding_tracking

Suivi de l'allaitement pour adaptations nutritionnelles personnalisées.

```sql
CREATE TABLE breastfeeding_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  is_breastfeeding boolean DEFAULT false,
  breastfeeding_type text CHECK (breastfeeding_type IN ('exclusive', 'mixed', 'partial')),
  baby_age_months integer CHECK (baby_age_months >= 0 AND baby_age_months <= 36),
  start_date date,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_breastfeeding_user ON breastfeeding_tracking(user_id);
```

**RLS**:
- Les utilisateurs ne peuvent accéder qu'à leurs propres données d'allaitement

### menopause_tracking

Suivi de la ménopause et périménopause pour adaptations personnalisées.

```sql
CREATE TABLE menopause_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  reproductive_status text CHECK (reproductive_status IN ('menstruating', 'perimenopause', 'menopause', 'postmenopause')),
  perimenopause_stage text CHECK (perimenopause_stage IN ('early-perimenopause', 'late-perimenopause')),
  last_period_date date,
  menopause_confirmation_date date,
  fsh_level numeric,
  estrogen_level numeric,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_menopause_user ON menopause_tracking(user_id);
CREATE INDEX idx_menopause_status ON menopause_tracking(reproductive_status);
```

**RLS**:
- Les utilisateurs ne peuvent accéder qu'à leurs propres données de ménopause

### menopause_symptoms_log

Journal des symptômes de ménopause pour suivi et adaptations.

```sql
CREATE TABLE menopause_symptoms_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  symptom_date date NOT NULL,
  hot_flashes_count integer DEFAULT 0,
  hot_flashes_intensity integer CHECK (hot_flashes_intensity >= 0 AND hot_flashes_intensity <= 10),
  night_sweats_intensity integer CHECK (night_sweats_intensity >= 0 AND night_sweats_intensity <= 10),
  mood_changes_intensity integer CHECK (mood_changes_intensity >= 0 AND mood_changes_intensity <= 10),
  sleep_quality integer CHECK (sleep_quality >= 1 AND sleep_quality <= 10),
  energy_level integer CHECK (energy_level >= 1 AND energy_level <= 10),
  vaginal_dryness_intensity integer CHECK (vaginal_dryness_intensity >= 0 AND vaginal_dryness_intensity <= 10),
  brain_fog_intensity integer CHECK (brain_fog_intensity >= 0 AND brain_fog_intensity <= 10),
  joint_pain_intensity integer CHECK (joint_pain_intensity >= 0 AND joint_pain_intensity <= 10),
  weight_kg numeric,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_symptoms_user_date ON menopause_symptoms_log(user_id, symptom_date DESC);
```

**RLS**:
- Les utilisateurs ne peuvent accéder qu'à leurs propres journaux de symptômes

### menstrual_cycle_tracking

Suivi du cycle menstruel pour adaptations nutritionnelles et d'entraînement.

```sql
CREATE TABLE menstrual_cycle_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  period_start_date date NOT NULL,
  period_end_date date,
  cycle_length_days integer,
  flow_intensity text CHECK (flow_intensity IN ('light', 'moderate', 'heavy', 'spotting')),
  symptoms jsonb DEFAULT '[]'::jsonb,
  mood_rating integer CHECK (mood_rating >= 1 AND mood_rating <= 10),
  energy_level integer CHECK (energy_level >= 1 AND energy_level <= 10),
  pain_level integer CHECK (pain_level >= 0 AND pain_level <= 10),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_menstrual_user_date ON menstrual_cycle_tracking(user_id, period_start_date DESC);
```

**RLS**:
- Les utilisateurs ne peuvent accéder qu'à leurs propres données de cycle menstruel

---

## Système d'événements

### EventListenerHub
**Fichier**: `/src/system/head/events/EventListenerHub.ts`

Hub central pour tous les événements de l'application.

**Types d'événements**:
```typescript
type TrainingEventType =
  | 'set:completed'
  | 'exercise:completed'
  | 'session:started'
  | 'session:completed'
  | 'rest:started'
  | 'rest:ended'
  | 'record:achieved'
  | 'pain:reported'
  | 'rpe:reported'
  | 'load:adjusted'
  | 'difficulty:adjusted';
```

**API**:
```typescript
// Émettre un événement
eventListenerHub.emit('record:achieved', {
  exerciseName: 'Squat',
  recordType: 'weight',
  previousValue: 120,
  newValue: 125,
  timestamp: Date.now()
});

// Écouter un événement
eventListenerHub.on('record:achieved', (event) => {
  console.log('Nouveau record!', event.data);
});

// Se désabonner
eventListenerHub.off('record:achieved', handler);
```

---

## Mémoire conversationnelle

### ConversationMemoryManager
**Fichier**: `/src/system/head/memory/ConversationMemoryManager.ts`

Gestion de la mémoire des conversations (texte + voix).

**Fonctionnalités**:

1. **Persistence des messages**
   ```typescript
   await conversationMemory.addMessage(userId, sessionId, {
     mode: 'text',
     role: 'user',
     content: 'Comment améliorer mon squat?',
     timestamp: Date.now()
   });
   ```

2. **Context window optimisé**
   ```typescript
   const contextWindow = await conversationMemory.getContextWindow(
     userId,
     sessionId
   );
   // {
   //   summary: { text: "L'utilisateur a discuté...", messageCount: 45 },
   //   recentMessages: [...20 derniers messages],
   //   totalMessageCount: 65
   // }
   ```

3. **Génération de résumés**
   ```typescript
   // Automatique tous les 50 messages
   if (messageCount >= 50 && shouldCreateSummary()) {
     await conversationMemory.createSummary(userId, sessionId);
   }
   ```

4. **Switch transparent texte ↔ voix**
   ```typescript
   // L'utilisateur passe de texte à voix
   await conversationSwitchService.switchToVoice(userId, sessionId);
   // Les 20 derniers messages texte sont chargés automatiquement
   // Le résumé est inclus dans le context
   ```

---

## Coaching proactif

### Système de priorités et rate limiting

Le ProactiveCoachingOrchestrator gère une file de messages avec priorités:

```
Message Queue (triée par priorité):
┌─────────────────────────────────────┐
│ CRITICAL (100): "⚠️ STOP - douleur"│ → Envoi immédiat
├─────────────────────────────────────┤
│ HIGH (75): "🔥 Nouveau record!"     │ → Peut interrompre
├─────────────────────────────────────┤
│ MEDIUM (50): "Série 3/4 validée"   │ → Respect du délai
├─────────────────────────────────────┤
│ LOW (25): "Profite du repos..."    │ → File d'attente
└─────────────────────────────────────┘

Rate Limiting: 8 secondes minimum entre messages
Override: Priority diff ≥ 25 peut interrompre
Bypass: CRITICAL + requiresImmediate flag
```

### Célébration de record

Lorsqu'un record est battu, le système:

1. **Émet l'événement**: `eventListenerHub.emit('record:achieved', data)`
2. **ProactiveOrchestrator réagit**: Message HIGH priority
3. **useRecordCelebration affiche**: Animation fullscreen avec confettis
4. **Messages multi-canaux**: Voix + Texte + Notification

---

## Performance et optimisation

### Cache Strategy

- **TTL par forge**: Training (5min), Equipment (15min), Profile (10min)
- **Invalidation sélective**: Sur changement de données
- **Cleanup automatique**: Entrées expirées nettoyées périodiquement

### Métriques collectées

```typescript
interface PerformanceMetrics {
  dataCollectionLatency: number;    // ms
  contextBuildingLatency: number;   // ms
  promptGenerationLatency: number;  // ms
  cacheHitRate: number;             // 0-1
  totalLatency: number;             // ms
}
```

### Health Checks

```typescript
interface HealthStatus {
  brain: 'healthy' | 'degraded' | 'down';
  supabase: 'connected' | 'disconnected';
  cache: 'fresh' | 'stale';
  lastCheck: number;
}
```

---

## Sécurité

### Row Level Security (RLS)

Toutes les tables ont RLS activée:
- Les utilisateurs ne peuvent accéder qu'à leurs propres données
- Aucun accès public autorisé
- Policies strictes sur toutes les opérations (SELECT, INSERT, UPDATE, DELETE)

### CSRF Protection

- Tokens CSRF pour tous les appels aux edge functions
- Tokens réutilisables pendant 1 heure
- Compteur d'utilisation pour monitoring
- Nettoyage automatique des vieux tokens

### Data Retention

- Conversations: 90 jours (configurable)
- Cache: Invalidé selon TTL (5-15 minutes)
- Feedbacks: Illimité (données importantes)
- Old summaries: Nettoyés après 90 jours

---

**Cette architecture est production-ready et extensible pour de futurs forges (nutrition, fasting, body-scan).**
