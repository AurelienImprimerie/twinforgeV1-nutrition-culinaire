# Guide d'implémentation du système HEAD

Ce guide explique comment utiliser le système HEAD dans votre code.

## Table des matières

1. [Initialisation](#initialisation)
2. [Utiliser le contexte](#utiliser-le-contexte)
3. [Enrichir le chat texte](#enrichir-le-chat-texte)
4. [Enrichir le voice coaching](#enrichir-le-voice-coaching)
5. [Événements d'entraînement](#événements-dentraînement)
6. [Mémoire conversationnelle](#mémoire-conversationnelle)
7. [Coaching proactif](#coaching-proactif)
8. [Invalidation du cache](#invalidation-du-cache)
9. [Monitoring et debugging](#monitoring-et-debugging)

---

## Initialisation

### Initialisation automatique dans l'app

Le système HEAD s'initialise automatiquement au démarrage de l'application:

```typescript
// src/app/App.tsx
import { useBrainInitialization } from '@/hooks';

function App() {
  const { initialized, error, healthStatus } = useBrainInitialization();

  if (error) {
    return <ErrorScreen error={error} />;
  }

  if (!initialized) {
    return <LoadingScreen />;
  }

  return <MainApp />;
}
```

### Vérifier l'état d'initialisation

```typescript
import { brainCore } from '@/system/head';

// Vérifier si le brain est initialisé
if (!brainCore.isInitialized()) {
  console.error('Brain not initialized');
}

// Obtenir l'ID utilisateur actuel
const userId = brainCore.getCurrentUserId();
console.log('Current user:', userId);

// Vérifier la santé du système
const health = brainCore.getHealthStatus();
console.log('Brain health:', health);
// {
//   brain: 'healthy',
//   supabase: 'connected',
//   cache: 'fresh',
//   lastCheck: 1699123456789
// }
```

---

## Utiliser le contexte

### Obtenir le contexte complet

```typescript
import { brainCore } from '@/system/head';

const context = await brainCore.getContext();

console.log('User profile:', context.user.profile);
console.log('Training data:', context.user.training);
console.log('Equipment:', context.user.equipment);
console.log('Current page:', context.app.pageContext);
console.log('Activity state:', context.app.activityState);
console.log('Session active:', context.session.isActive);
console.log('Missing data:', context.missingData);
```

### Obtenir le contexte d'un forge spécifique

```typescript
// Obtenir seulement les données d'entraînement
const trainingData = await brainCore.getForgeContext('training');

console.log('Recent sessions:', trainingData.recentSessions);
console.log('Current loads:', trainingData.currentLoads);
console.log('Personal records:', trainingData.personalRecords);

// Obtenir seulement les données d'équipement
const equipmentData = await brainCore.getForgeContext('equipment');

console.log('Locations:', equipmentData.locations);
console.log('Default location:', equipmentData.defaultLocation);
```

### Tracker automatiquement la page

```typescript
// Dans n'importe quel composant/page
import { useBrainPageTracking } from '@/hooks';

function MyPage() {
  // Cet hook met automatiquement à jour le contexte de page dans le brain
  useBrainPageTracking();

  return <div>My content</div>;
}
```

Le brain connaîtra maintenant:
- La route actuelle
- Le type de page (home, training, profile, etc.)
- Le sous-contexte (ex: 'pipeline-step-3')
- L'état d'activité (idle, training-active, training-rest, etc.)

---

## Enrichir le chat texte

### Enrichissement automatique dans GlobalChatDrawer

```typescript
// src/ui/components/chat/GlobalChatDrawer.tsx
import { chatIntegration } from '@/system/head';

async function handleSendMessage(userMessage: string) {
  // Créer la requête de base
  const request = {
    messages: [
      { role: 'user', content: userMessage }
    ],
    mode: 'training' // ou 'nutrition', 'general', etc.
  };

  // Enrichir avec le contexte HEAD
  const enrichedRequest = await chatIntegration.enrichChatRequest(
    request,
    'training'
  );

  // La requête est maintenant enrichie avec:
  // - Profil utilisateur complet
  // - Historique d'entraînement
  // - Équipement disponible
  // - État actuel (repos vs effort)
  // - Exercice en cours si en session
  // - Style de réponse adaptatif

  // Envoyer au service AI
  const response = await chatAIService.sendMessage(enrichedRequest);
  return response;
}
```

### Exemple de prompt enrichi

Avant enrichissement:
```
User: "Comment améliorer mon squat?"
```

Après enrichissement (ce que l'IA reçoit):
```
System: Tu es un coach sportif expert. L'utilisateur s'appelle John, 32 ans, objectif muscle gain.
Il s'entraîne en force depuis 2 ans. Dernière session: Squat 110kg x 5, RPE 8.
Record actuel: 120kg. Équipement disponible: rack, barre, disques.

CONTEXTE ACTUEL:
• Session active: Step 3 - Exercice 2/4 (Squat)
• Série 2/3 en cours
• EN REPOS (90s restantes)
• Dernière série: 110kg x 5, RPE 8

STYLE DE RÉPONSE: SHORT (15-30 mots)
Tu es dans un repos, tu peux donner des conseils techniques.

User: "Comment améliorer mon squat?"
```

---

## Enrichir le voice coaching

### Initialisation du voice coach avec contexte

```typescript
// src/app/pages/Training/Pipeline/steps/Step3/hooks/useVoiceCoachSession.ts
import { realtimeIntegration } from '@/system/head';
import { openaiRealtimeService } from '@/system/services/openai-realtime/openaiRealtimeService';

async function startVoiceCoach() {
  // Construire le prompt système enrichi
  const basePrompt = "Tu es un coach vocal pour accompagner l'entraînement.";

  const enrichedPrompt = await realtimeIntegration.buildRealtimeSystemPrompt(
    basePrompt,
    'training'
  );

  // Le prompt enrichi contient TOUT le contexte utilisateur
  // + instructions adaptatives (ultra-short pendant l'effort)

  // Configurer la session OpenAI Realtime
  await openaiRealtimeService.configureSession(enrichedPrompt, 'training');

  // Démarrer la session
  await openaiRealtimeService.connect();
}
```

### Mettre à jour le contexte pendant la session

```typescript
// À chaque changement d'exercice ou de série
realtimeIntegration.updateTrainingContext({
  sessionId: 'session-123',
  discipline: 'force',
  currentExerciseIndex: 2,
  totalExercises: 5,
  currentExercise: {
    name: 'Squat',
    load: 110,
    reps: '5',
    sets: 3
  },
  currentSet: 2,
  totalSets: 3,
  isResting: false,  // Important! Change le style de réponse
  restTimeRemaining: 0,
  startTime: Date.now(),
  elapsedTime: 1200000 // 20 minutes
});

// Le brain ajuste automatiquement le style de réponse:
// isResting: false → ultra-short (5-15 mots)
// isResting: true → short (15-30 mots)
```

### Enregistrer des moments clés

```typescript
// Quand l'utilisateur mentionne une douleur, un record, etc.
await realtimeIntegration.recordVoiceFeedback(
  sessionId,
  "J'ai une douleur au genou niveau 6/10",
  {
    exerciseName: 'Squat',
    setNumber: 2,
    load: 110,
    reps: 5
  }
);

// Le système:
// 1. Auto-catégorise le feedback (category: 'pain')
// 2. Marque comme moment clé (is_key_moment: true)
// 3. Enregistre dans training_feedbacks
// 4. Sera utilisé pour enrichir le contexte futur
```

### Nettoyer le contexte à la fin

```typescript
// À la fin de la session
realtimeIntegration.clearTrainingContext();

// Le brain revient au contexte par défaut (hors session)
```

---

## Événements d'entraînement

### Émettre des événements

```typescript
import { eventListenerHub } from '@/system/head';

// Série complétée
eventListenerHub.emit('set:completed', {
  sessionId: 'session-123',
  exerciseName: 'Squat',
  setNumber: 2,
  totalSets: 3,
  reps: 5,
  load: 110,
  rpe: 8,
  timestamp: Date.now()
});

// Exercice terminé
eventListenerHub.emit('exercise:completed', {
  sessionId: 'session-123',
  exerciseName: 'Squat',
  setsCompleted: 3,
  totalReps: 15,
  avgRPE: 7.5,
  timestamp: Date.now()
});

// Record battu
eventListenerHub.emit('record:achieved', {
  exerciseName: 'Squat',
  recordType: 'weight',
  previousValue: 120,
  newValue: 125,
  discipline: 'force',
  timestamp: Date.now()
});

// Douleur signalée
eventListenerHub.emit('pain:reported', {
  sessionId: 'session-123',
  exerciseName: 'Squat',
  setNumber: 2,
  location: 'knee',
  level: 7, // 0-10
  description: 'Douleur aiguë au genou gauche',
  timestamp: Date.now()
});

// RPE signalé
eventListenerHub.emit('rpe:reported', {
  sessionId: 'session-123',
  exerciseName: 'Squat',
  setNumber: 2,
  rpe: 9,
  timestamp: Date.now()
});

// Repos commencé
eventListenerHub.emit('rest:started', {
  sessionId: 'session-123',
  exerciseName: 'Squat',
  restDuration: 90000, // 90 secondes
  timestamp: Date.now()
});
```

### Écouter des événements

```typescript
import { eventListenerHub } from '@/system/head';

// Écouter les records
const handleRecord = (event: TrainingEvent<RecordAchievedData>) => {
  console.log('Nouveau record!', event.data);
  // Afficher une célébration
  showRecordCelebration(event.data);
};

eventListenerHub.on('record:achieved', handleRecord);

// Écouter les douleurs
const handlePain = (event: TrainingEvent<PainReportedData>) => {
  console.log('ATTENTION - Douleur:', event.data);
  if (event.data.level >= 7) {
    // Afficher une alerte critique
    showCriticalAlert(event.data);
  }
};

eventListenerHub.on('pain:reported', handlePain);

// Nettoyer les listeners au démontage
useEffect(() => {
  return () => {
    eventListenerHub.off('record:achieved', handleRecord);
    eventListenerHub.off('pain:reported', handlePain);
  };
}, []);
```

---

## Mémoire conversationnelle

### Ajouter un message à l'historique

```typescript
import { conversationMemoryManager } from '@/system/head';

// Message utilisateur
await conversationMemoryManager.addMessage(userId, sessionId, {
  mode: 'text', // ou 'voice'
  role: 'user',
  content: 'Comment améliorer mon squat?',
  timestamp: Date.now(),
  metadata: {
    exerciseName: 'Squat',
    isResting: true
  }
});

// Réponse de l'assistant
await conversationMemoryManager.addMessage(userId, sessionId, {
  mode: 'text',
  role: 'assistant',
  content: 'Pour améliorer ton squat, concentre-toi sur...',
  timestamp: Date.now()
});
```

### Obtenir le context window (optimisé pour l'IA)

```typescript
// Récupère le résumé + 20 messages récents
const contextWindow = await conversationMemoryManager.getContextWindow(
  userId,
  sessionId
);

console.log('Summary:', contextWindow.summary?.text);
console.log('Recent messages:', contextWindow.recentMessages);
console.log('Total messages:', contextWindow.totalMessageCount);

// Utiliser dans un prompt AI
const prompt = `
HISTORIQUE DE CONVERSATION:
${contextWindow.summary?.text || 'Aucun résumé disponible'}

MESSAGES RÉCENTS:
${contextWindow.recentMessages.map(m => `${m.role}: ${m.content}`).join('\n')}

USER: ${newUserMessage}
`;
```

### Switch transparent entre texte et voix

```typescript
import { conversationSwitchService } from '@/system/services/chat/conversationSwitchService';

// Passer de texte à voix
const voiceContext = await conversationSwitchService.switchToVoice(
  userId,
  sessionId
);
// voiceContext contient le résumé + 20 derniers messages texte
// À fournir au service voice realtime

// Passer de voix à texte
const textContext = await conversationSwitchService.switchToText(
  userId,
  sessionId
);
// textContext contient le résumé + 20 derniers messages voix
// À afficher dans l'interface chat texte
```

### Créer un résumé manuellement

```typescript
// Généralement automatique tous les 50 messages
// Mais peut être déclenché manuellement:
await conversationMemoryManager.createSummary(
  userId,
  sessionId,
  ['technique squat', 'progression charge', 'douleur genou']
);
```

---

## Coaching proactif

### Démarrer le coaching proactif

```typescript
import { proactiveCoachingOrchestrator } from '@/system/services/coaching/ProactiveCoachingOrchestrator';

// Démarrer l'orchestrateur (généralement au début de Step 3)
proactiveCoachingOrchestrator.start();

// Il écoute automatiquement tous les événements
// et envoie des messages proactifs selon les priorités

// Arrêter à la fin de la session
proactiveCoachingOrchestrator.stop();
```

### Configurer le comportement

```typescript
// Modifier la configuration
proactiveCoachingOrchestrator.updateConfig({
  minDelayBetweenMessages: 10000,  // 10s au lieu de 8s
  priorityOverrideThreshold: 30,   // Seuil plus élevé pour interrompre
  maxQueueSize: 15,                // Plus de messages en file
  enableVoice: true,               // Activer voice
  enableText: false,               // Désactiver texte
  enableNotifications: true        // Activer notifications
});
```

### Envoyer un message proactif manuel

```typescript
// Forcer l'envoi d'un message (bypass rate limiting)
proactiveCoachingOrchestrator.sendMessage({
  content: '⚠️ ATTENTION - Arrête l\'exercice immédiatement!',
  priority: MessagePriority.CRITICAL,
  eventType: 'pain:reported',
  requiresImmediate: true,  // Bypass rate limiting
  channels: ['voice', 'text', 'notification']
});
```

### Obtenir le statut de la file

```typescript
const status = proactiveCoachingOrchestrator.getQueueStatus();

console.log('Queue size:', status.queueSize);
console.log('Last message:', status.lastMessageTime);
console.log('Processing:', status.isProcessing);
console.log('Queued messages:', status.messages);
```

### Exemple de célébration de record

```typescript
// Dans un composant
import { useRecordCelebration } from '@/app/pages/Training/Pipeline/steps/Step3/hooks/useRecordCelebration';

function MyTrainingComponent() {
  const { celebrationData, isShowing, showCelebration } = useRecordCelebration();

  // Le hook écoute automatiquement 'record:achieved'
  // et affiche la célébration

  return (
    <>
      {/* Votre contenu */}

      {isShowing && celebrationData && (
        <RecordCelebration
          exerciseName={celebrationData.exerciseName}
          recordType={celebrationData.recordType}
          previousValue={celebrationData.previousValue}
          newValue={celebrationData.newValue}
          onComplete={() => {
            // Animation terminée
          }}
        />
      )}
    </>
  );
}
```

---

## Invalidation du cache

### Invalider le cache d'un forge spécifique

```typescript
import { brainCore } from '@/system/head';

// Après une mise à jour de profil
await updateUserProfile(newData);
brainCore.invalidateCache('training'); // Force refresh des données training

// Après ajout d'équipement
await addEquipmentToLocation(locationId, equipment);
brainCore.invalidateCache('equipment');
```

### Invalider tout le cache

```typescript
// Force un refresh complet de toutes les données
brainCore.invalidateCache();
await brainCore.refresh();
```

### Refresh manuel

```typescript
// Forcer un refresh sans passer par le cache
const freshContext = await brainCore.refresh();
console.log('Fresh context:', freshContext);
```

---

## Monitoring et debugging

### Métriques de performance

```typescript
import { brainCore } from '@/system/head';

const metrics = brainCore.getPerformanceMetrics();

console.log('Data collection:', metrics.dataCollectionLatency, 'ms');
console.log('Context building:', metrics.contextBuildingLatency, 'ms');
console.log('Prompt generation:', metrics.promptGenerationLatency, 'ms');
console.log('Cache hit rate:', (metrics.cacheHitRate * 100).toFixed(1), '%');
console.log('Total latency:', metrics.totalLatency, 'ms');

// Objectifs:
// - dataCollectionLatency: < 500ms
// - contextBuildingLatency: < 200ms
// - promptGenerationLatency: < 100ms
// - cacheHitRate: > 60%
// - totalLatency: < 1000ms
```

### Health checks

```typescript
const health = brainCore.getHealthStatus();

if (health.brain === 'degraded') {
  console.warn('Brain system degraded!');
}

if (health.supabase === 'disconnected') {
  console.error('Supabase disconnected!');
}

if (health.cache === 'stale') {
  console.warn('Cache is stale, consider refreshing');
  await brainCore.refresh();
}
```

### Debugging en console

```typescript
// Activer les logs détaillés
import { logger } from '@/lib/utils/logger';

// Les logs du brain sont automatiquement préfixés avec 'HEAD_SYSTEM'
// Exemples:
// [HEAD_SYSTEM] BrainCore initialized for user: abc-123
// [HEAD_SYSTEM] Context built in 234ms (cache hit: training, equipment)
// [HEAD_SYSTEM] Chat request enriched with context
// [HEAD_SYSTEM] Training context updated: Squat (set 2/3)
```

### Inspecter le contexte dans la console

```typescript
// Dans DevTools console:
window.__brain = brainCore;

// Puis:
const ctx = await window.__brain.getContext();
console.log('Context:', ctx);

const health = window.__brain.getHealthStatus();
console.log('Health:', health);

const metrics = window.__brain.getPerformanceMetrics();
console.log('Metrics:', metrics);
```

---

## Cas d'usage complets

### Cas 1: Chat enrichi pendant une session d'entraînement

```typescript
// 1. L'utilisateur est en Step 3, exercice en cours
realtimeIntegration.updateTrainingContext({
  sessionId: 'abc',
  discipline: 'force',
  currentExerciseIndex: 2,
  totalExercises: 5,
  currentExercise: { name: 'Squat', load: 110, reps: '5', sets: 3 },
  currentSet: 2,
  totalSets: 3,
  isResting: true,  // En repos
  restTimeRemaining: 60000
});

// 2. L'utilisateur ouvre le chat et pose une question
const request = {
  messages: [{ role: 'user', content: 'Dois-je augmenter la charge?' }],
  mode: 'training'
};

// 3. Enrichir avec le contexte
const enriched = await chatIntegration.enrichChatRequest(request, 'training');

// Le prompt système contient maintenant:
// - Profil utilisateur complet
// - Historique d'entraînement (30 jours)
// - Charges actuelles (Squat: 110kg)
// - État: EN REPOS, série 2/3
// - Style: SHORT (15-30 mots car en repos)

// 4. Envoyer à l'IA
const response = await chatAIService.sendMessage(enriched);
// Response: "Avec RPE 8, maintiens 110kg. Vise RPE 7 avant d'augmenter."
```

### Cas 2: Record battu avec célébration

```typescript
// 1. L'utilisateur termine une série avec un nouveau record
eventListenerHub.emit('record:achieved', {
  exerciseName: 'Squat',
  recordType: 'weight',
  previousValue: 120,
  newValue: 125,
  discipline: 'force',
  timestamp: Date.now()
});

// 2. ProactiveCoachingOrchestrator réagit (HIGH priority)
// → Envoie message vocal: "🔥 NOUVEAU RECORD ! 125kg sur Squat !"
// → Envoie message texte dans le chat
// → Envoie notification

// 3. useRecordCelebration affiche l'animation
// → Fullscreen avec confettis
// → "NOUVEAU RECORD: 120kg → 125kg"
// → Auto-dismiss après 5 secondes

// 4. Le feedback est enregistré
await realtimeIntegration.recordVoiceFeedback(
  sessionId,
  'Nouveau record: 125kg!',
  { exerciseName: 'Squat', setNumber: 3, load: 125, reps: 5 }
);
```

### Cas 3: Switch transparent texte → voix

```typescript
// 1. L'utilisateur discute en texte avec le coach
await conversationMemoryManager.addMessage(userId, sessionId, {
  mode: 'text',
  role: 'user',
  content: 'Comment respirer pendant le squat?'
});
// ... échange de plusieurs messages ...

// 2. L'utilisateur démarre le voice coach
const voiceContext = await conversationSwitchService.switchToVoice(
  userId,
  sessionId
);

// voiceContext contient:
// - summary: "L'utilisateur a demandé des conseils sur..."
// - recentMessages: [derniers 20 messages texte]

// 3. Construire le prompt voice avec l'historique
const prompt = await realtimeIntegration.buildRealtimeSystemPrompt(
  basePrompt,
  'training'
);
// Le prompt inclut automatiquement l'historique texte

// 4. Le voice coach a le contexte complet des discussions texte
// Il peut dire: "Pour répondre à ta question sur la respiration..."
```

### Cas 4: Adaptation nutritionnelle pour allaitement

```typescript
// 1. L'utilisateur scanne un repas dans l'app nutrition
const context = await brainCore.getContext();

// 2. Le système détecte automatiquement l'allaitement
if (context.user.breastfeeding?.isBreastfeeding) {
  const needs = context.user.breastfeeding.nutritionalNeeds;

  console.log('Besoins augmentés:', {
    extraCalories: needs.extraCalories,  // +500 kcal
    extraProtein: needs.extraProtein,    // +25g
    waterIntake: needs.waterIntake       // 3.0L
  });

  console.log('Aliments prioritaires:',
    context.user.breastfeeding.recommendations.priorityFoods
  );
  // ['Poissons gras', 'Légumineuses', 'Produits laitiers', ...]

  console.log('Aliments à éviter:',
    context.user.breastfeeding.recommendations.avoidFoods
  );
  // ['Alcool', 'Excès de caféine', 'Poissons à mercure élevé']
}

// 3. L'IA nutritionnelle adapte ses recommandations automatiquement
const aiPrompt = await chatIntegration.enrichChatRequest({
  messages: [{ role: 'user', content: 'Ce repas couvre mes besoins?' }],
  mode: 'nutrition'
});
// Le prompt inclut automatiquement:
// "L'utilisatrice allaite (exclusif), bébé de 4 mois"
// "Besoins augmentés: +500 kcal, +25g protéines, 3.0L eau"
// "Aliments prioritaires: [liste]"
// "Aliments à éviter: [liste]"
```

### Cas 5: Adaptation entraînement selon phase de ménopause

```typescript
// 1. L'utilisatrice démarre une session d'entraînement
const context = await brainCore.getContext();

// 2. Le système détecte la phase de ménopause
if (context.user.menopause?.hasActiveTracking) {
  const menopause = context.user.menopause;

  console.log('Phase:', menopause.status);           // 'perimenopause'
  console.log('Stade:', menopause.stage);            // 'late-perimenopause'
  console.log('Niveau énergie:', menopause.energyLevel);  // 'moderate'
  console.log('Taux métabolique:', menopause.metabolicRate);  // 'reduced'
  console.log('Symptômes moyens:', menopause.averageSymptomIntensity);  // 6/10

  // Recommandations adaptées
  console.log('Exercice:', menopause.recommendations?.exercise);
  // ['Privilégier musculation lourde', 'Limiter cardio intense',
  //  'Augmenter repos entre séries', 'Focus force et masse osseuse']
}

// 3. Le coach vocal adapte automatiquement ses conseils
const voicePrompt = await realtimeIntegration.buildRealtimeSystemPrompt(
  basePrompt,
  'training'
);
// Le prompt inclut automatiquement:
// "Utilisatrice en périménopause tardive"
// "Taux métabolique réduit, niveau énergie modéré"
// "Symptômes moyens 6/10 (bouffées de chaleur, fatigue)"
// "ADAPTATIONS: Focus masse musculaire et osseuse, récupération prolongée"

// 4. Suggestions proactives de transition
if (menopause.transitionSuggestion?.shouldSuggest) {
  console.log('Suggestion:', menopause.transitionSuggestion.reason);
  // "90 jours sans règles, considérer transition vers ménopause confirmée"
}
```

---

## Troubleshooting

### Brain ne s'initialise pas

```typescript
// Vérifier les credentials Supabase
console.log('SUPABASE_URL:', import.meta.env.VITE_SUPABASE_URL);
console.log('SUPABASE_ANON_KEY:', import.meta.env.VITE_SUPABASE_ANON_KEY);

// Vérifier l'authentification
import { userStore } from '@/system/store/userStore';
const user = userStore.getState().user;
console.log('User authenticated:', !!user);

// Forcer réinitialisation
if (user?.id) {
  await brainCore.initialize(user.id);
}
```

### Contexte vide ou incomplet

```typescript
// Vérifier les données en base
const context = await brainCore.getContext();

if (!context.user.training.hasData) {
  console.warn('No training data found for user');
  // L'utilisateur n'a peut-être jamais complété de session
}

if (context.user.equipment.locations.length === 0) {
  console.warn('No equipment locations configured');
  // L'utilisateur n'a pas encore scanné de lieu
}

// Vérifier la fraîcheur
console.log('Last updated:', context.user.lastUpdated);
// Si trop vieux, forcer un refresh
if (Date.now() - context.user.lastUpdated.training > 300000) {
  brainCore.invalidateCache('training');
}
```

### Performance dégradée

```typescript
const metrics = brainCore.getPerformanceMetrics();

if (metrics.totalLatency > 2000) {
  console.warn('High latency detected:', metrics);

  // Vérifier le cache hit rate
  if (metrics.cacheHitRate < 0.5) {
    console.warn('Low cache hit rate, consider increasing TTL');
  }

  // Vérifier la latence de collecte
  if (metrics.dataCollectionLatency > 1000) {
    console.error('Data collection is slow, check database');
  }
}
```

---

**Vous êtes maintenant prêt à utiliser le système HEAD dans votre code!**
