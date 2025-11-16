# Head System - Central Intelligence Hub

The Head System is the central brain of the application that knows the user intimately and connects all user data to chat and realtime functionality.

## Overview

The Head System provides:

- **Unified User Knowledge**: Centralizes all user data from Supabase (training, equipment, nutrition, fasting, body-scan)
- **Session Awareness**: Tracks user activity and location in real-time
- **Context-Rich Prompts**: Enriches AI prompts with relevant user context
- **Missing Data Detection**: Proactively suggests actions when data is incomplete
- **Feedback Recording**: Captures key moments from training sessions
- **Intelligent Caching**: Optimizes performance with TTL-based caching
- **Modular Architecture**: Extensible forge system for new functionality domains

## Architecture

```
Head System
├── Core
│   ├── BrainCore          # Main orchestrator (singleton)
│   ├── ContextManager     # Builds unified context
│   └── CacheManager       # Intelligent caching
├── Knowledge
│   ├── UserKnowledgeBase  # Central data repository
│   └── DataCollectors     # Specialized collectors per forge
├── Awareness
│   └── SessionAwareness   # Real-time activity tracking
├── Integration
│   ├── ChatIntegration    # Text chat enrichment
│   ├── RealtimeIntegration# Voice realtime enrichment
│   ├── UnifiedPromptBuilder
│   └── FeedbackRecorder
├── Forge Modules
│   └── ForgeRegistry      # Extensible module system
└── Utils
    └── MissingDataDetector
```

## Quick Start

### 1. Initialization

The brain is automatically initialized when the app starts:

```typescript
import { useBrainInitialization } from '@/hooks';

function MyApp() {
  const { initialized, error, healthStatus } = useBrainInitialization();

  if (!initialized) {
    return <LoadingScreen />;
  }

  return <MainApp />;
}
```

### 2. Using in Chat

```typescript
import { chatIntegration } from '@/system/head';
import { chatAIService } from '@/system/services/chat/chatAiService';

// Enrich chat request with brain context
const enrichedRequest = await chatIntegration.enrichChatRequest(request, 'training');

// Send to chat AI
const response = await chatAIService.sendMessage(enrichedRequest);
```

### 3. Using in Realtime Voice

```typescript
import { realtimeIntegration } from '@/system/head';

// Build context-aware system prompt
const systemPrompt = await realtimeIntegration.buildRealtimeSystemPrompt(
  basePrompt,
  'training'
);

// Configure realtime session
await openaiRealtimeService.configureSession(systemPrompt, 'training');

// Update training context during session
realtimeIntegration.updateTrainingContext({
  sessionId: 'session-123',
  currentExerciseIndex: 2,
  totalExercises: 5,
  currentExercise: {
    name: 'Squat',
    load: 100,
    reps: '5',
    sets: 3
  },
  currentSet: 2,
  totalSets: 3,
  isResting: false,
  restTimeRemaining: 0,
  discipline: 'force'
});

// Record key moments from voice conversation
await realtimeIntegration.recordVoiceFeedback(
  sessionId,
  userMessage,
  exerciseContext
);
```

### 4. Tracking Page Context

Page context is automatically tracked:

```typescript
import { useBrainPageTracking } from '@/hooks';

function MyComponent() {
  // Automatically updates brain's awareness of user location
  useBrainPageTracking();

  return <div>...</div>;
}
```

### 5. Manual Context Access

```typescript
import { brainCore } from '@/system/head';

// Get full brain context
const context = await brainCore.getContext();

console.log(context.user.training);
console.log(context.session.isActive);
console.log(context.missingData);

// Get specific forge context
const trainingData = await brainCore.getForgeContext('training');

// Invalidate cache
brainCore.invalidateCache('training');

// Refresh all data
await brainCore.refresh();

// Check health
const health = brainCore.getHealthStatus();
```

## Core Concepts

### Brain Context

The unified context that represents everything the brain knows:

```typescript
interface BrainContext {
  user: UserKnowledge;           // All user data
  app: AppContext;               // Current page/activity
  session: SessionAwareness;     // Active sessions
  missingData: MissingDataReport;// Incomplete data
  timestamp: number;             // Context freshness
  cacheKey: string;              // Cache identifier
}
```

### User Knowledge

Aggregated data from all forges:

```typescript
interface UserKnowledge {
  profile: ProfileKnowledge;     // Name, objectives, disciplines
  training: TrainingKnowledge;   // Sessions, loads, preferences
  equipment: EquipmentKnowledge; // Locations, available gear
  nutrition: NutritionKnowledge; // Meals, scans
  fasting: FastingKnowledge;     // Fasting sessions
  bodyScan: BodyScanKnowledge;   // Body scans
  lastUpdated: Record<ForgeType, number>;
  completeness: Record<ForgeType, number>; // 0-100%
}
```

### Session Awareness

Real-time tracking of user activity:

```typescript
interface SessionAwareness {
  isActive: boolean;
  sessionType: 'training' | 'nutrition' | 'fasting' | 'body-scan' | null;
  trainingSession?: TrainingSessionContext;
  timestamp: number;
}
```

### Forge System

Modular architecture for extensibility:

```typescript
interface IForgeModule {
  forgeType: ForgeType;
  collectData(userId: string): Promise<any>;
  getContextSummary(data: any): string;
  detectMissingData(data: any): MissingDataReport;
  getPromptEnrichment(data: any, context: AppContext): PromptEnrichment;
  isDataFresh(lastUpdate: number): boolean;
}
```

## Database Tables

### brain_context_cache

Caches brain context for performance optimization:

```sql
CREATE TABLE brain_context_cache (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id),
  forge_type text CHECK (forge_type IN ('training', 'nutrition', 'fasting', 'body-scan', 'equipment')),
  cache_key text NOT NULL,
  data jsonb NOT NULL,
  timestamp timestamptz DEFAULT now(),
  ttl integer DEFAULT 300000, -- 5 minutes
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

### training_feedbacks

Records key moments from training sessions:

```sql
CREATE TABLE training_feedbacks (
  id uuid PRIMARY KEY,
  session_id text NOT NULL,
  user_id uuid REFERENCES auth.users(id),
  exercise_name text,
  set_number integer,
  category text CHECK (category IN ('motivation', 'technique', 'difficulty', 'pain', 'progression', 'question', 'general')),
  is_key_moment boolean DEFAULT false,
  message text NOT NULL,
  context_metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);
```

## Performance

### Caching Strategy

- **TTL-Based**: Each forge has configurable TTL (default 5 minutes)
- **Invalidation**: Automatic on data changes, manual via `invalidateCache()`
- **Cleanup**: Expired entries removed automatically

### Optimization Tips

1. **Cache Hit Rate**: Monitor via `brainCore.getPerformanceMetrics()`
2. **Data Freshness**: Balance between freshness and performance
3. **Selective Refresh**: Use `invalidateCache(forgeType)` instead of full refresh

## Extensibility

### Adding a New Forge

1. Create forge module implementing `IForgeModule`
2. Create data collector for the forge
3. Register module with `brainCore.registerForge(module)`
4. Update `UserKnowledge` interface with new forge data

Example:

```typescript
import type { IForgeModule } from '@/system/head/types';

class NutritionForgeModule implements IForgeModule {
  forgeType = 'nutrition' as const;

  async collectData(userId: string) {
    // Fetch nutrition data from Supabase
  }

  getContextSummary(data: any): string {
    // Generate summary for prompts
  }

  detectMissingData(data: any): MissingDataReport {
    // Detect incomplete data
  }

  getPromptEnrichment(data: any, context: AppContext): PromptEnrichment {
    // Build enrichment for prompts
  }

  isDataFresh(lastUpdate: number): boolean {
    const TTL = 5 * 60 * 1000; // 5 minutes
    return Date.now() - lastUpdate < TTL;
  }
}

// Register
brainCore.registerForge(new NutritionForgeModule());
```

## Integration with Existing Services

### Chat Service

The brain enriches all chat messages with context:

```typescript
// Before (old approach)
const response = await chatAIService.sendMessage(request);

// After (with brain)
const enrichedRequest = await chatIntegration.enrichChatRequest(request, mode);
const response = await chatAIService.sendMessage(enrichedRequest);
```

### Realtime Service

The brain provides context-aware voice coaching:

```typescript
// Build system prompt with context
const systemPrompt = await realtimeIntegration.buildRealtimeSystemPrompt(
  basePrompt,
  'training'
);

// Update context during session
realtimeIntegration.updateTrainingContext(context);

// Record key moments
await realtimeIntegration.recordVoiceFeedback(sessionId, message, context);

// Clear context after session
realtimeIntegration.clearTrainingContext();
```

## Monitoring & Health

### Health Check

```typescript
const health = brainCore.getHealthStatus();
// {
//   brain: 'healthy' | 'degraded' | 'down',
//   supabase: 'connected' | 'disconnected',
//   cache: 'fresh' | 'stale',
//   lastCheck: timestamp
// }
```

### Performance Metrics

```typescript
const metrics = brainCore.getPerformanceMetrics();
// {
//   dataCollectionLatency: number,
//   contextBuildingLatency: number,
//   promptGenerationLatency: number,
//   cacheHitRate: number,
//   totalLatency: number
// }
```

## Best Practices

1. **Initialize Early**: Brain should initialize when app starts
2. **Track Pages**: Always use `useBrainPageTracking()` to keep awareness current
3. **Invalidate on Changes**: Invalidate cache when user data changes
4. **Monitor Health**: Check health status in production
5. **Record Key Moments**: Only record truly important feedback to avoid noise
6. **Use Context**: Always enrich AI prompts with brain context
7. **Handle Errors**: Brain initialization might fail, handle gracefully

## Troubleshooting

### Brain Not Initialized

```typescript
if (!brainCore.isInitialized()) {
  console.error('Brain not initialized');
  await brainCore.initialize(userId);
}
```

### Stale Data

```typescript
// Force refresh
await brainCore.refresh();

// Or invalidate specific forge
brainCore.invalidateCache('training');
```

### Poor Performance

```typescript
// Check metrics
const metrics = brainCore.getPerformanceMetrics();
console.log('Cache hit rate:', metrics.cacheHitRate);
console.log('Total latency:', metrics.totalLatency);

// Adjust TTL in data collectors if needed
```

### Missing Context

```typescript
const context = await brainCore.getContext();

if (context.missingData.hasIncompletProfile) {
  // Prompt user to complete profile
}

// Show suggestions
context.missingData.suggestions.forEach(suggestion => {
  console.log(suggestion.message);
});
```

## Future Enhancements

- [ ] Real-time sync with Supabase Realtime
- [ ] Predictive data fetching based on user patterns
- [ ] A/B testing for prompt strategies
- [ ] Analytics dashboard for brain performance
- [ ] Multi-language support in context summaries
- [ ] Webhook integration for external data sources
