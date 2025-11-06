# HEAD System - Cerveau Central de TwinForge

Le système HEAD est le cerveau central de l'application TwinForge. Il connaît l'utilisateur intimement et connecte toutes les données utilisateur au chat texte et aux fonctionnalités temps réel.

## 📚 Documentation

Cette documentation est organisée en 3 documents principaux:

1. **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Architecture complète du système
   - Structure des composants (Core, Knowledge, Awareness, Integration)
   - Types et interfaces TypeScript
   - Flux de données et diagrammes
   - Tables de base de données

2. **[IMPLEMENTATION.md](./IMPLEMENTATION.md)** - Guide d'implémentation et d'utilisation
   - Comment initialiser le système
   - Comment utiliser le contexte dans le chat
   - Comment utiliser le contexte en temps réel (voice)
   - Intégration avec les événements d'entraînement
   - Exemples de code complets

3. **[POUR_BIEN_COMPRENDRE.md](./POUR_BIEN_COMPRENDRE.md)** - Explication simplifiée pour non-techniques
   - Qu'est-ce que le système HEAD ?
   - Comment ça marche en termes simples
   - Pourquoi c'est important
   - Bénéfices pour les utilisateurs

## 🎯 Vue d'ensemble rapide

### Qu'est-ce que le système HEAD ?

Le HEAD est un système d'intelligence contextuelle qui:

- **Connaît l'utilisateur**: Entraînements, équipement, objectifs, historique
- **Suit l'activité**: Page actuelle, exercice en cours, état (effort/repos)
- **Enrichit l'IA**: Fournit un contexte ultra-riche aux coaches IA
- **Gère la mémoire**: Persiste les conversations texte et voix
- **Déclenche des actions**: Réactions proactives aux événements importants

### Composants clés

```
HEAD System
├── BrainCore             # Orchestrateur central (singleton)
├── ContextManager        # Construction du contexte unifié
├── UserKnowledgeBase     # Connaissance complète de l'utilisateur
├── SessionAwareness      # Suivi de l'activité en temps réel
├── EventListenerHub      # Système d'événements
├── ConversationMemory    # Mémoire des conversations
└── Integrations
    ├── ChatIntegration       # Enrichissement du chat texte
    ├── RealtimeIntegration   # Enrichissement du voice coaching
    └── ProactiveCoaching     # Coaching proactif avec priorités
```

### Forges supportées

Le système HEAD collecte les données de plusieurs "forges" (domaines fonctionnels):

- ✅ **Training**: Sessions, charges, progression, records
- ✅ **Equipment**: Lieux d'entraînement, matériel disponible
- ✅ **Nutrition**: Repas, scans, macros, calories journalières
- ✅ **Fasting**: Sessions de jeûne, protocoles, progression
- ✅ **Body-scan**: Scans corporels 3D, morphologie, composition
- ✅ **Energy**: Niveau d'énergie, fatigue, récupération
- ✅ **Temporal**: Contexte temporel (jour, heure, saison)
- ✅ **Breastfeeding**: Allaitement, besoins nutritionnels augmentés
- ✅ **Menopause**: Ménopause, symptômes, adaptations personnalisées

## 🚀 Quick Start

### Initialisation (automatique)

```typescript
import { useBrainInitialization } from '@/hooks';

function MyApp() {
  const { initialized, error } = useBrainInitialization();

  if (!initialized) return <LoadingScreen />;
  return <MainApp />;
}
```

### Utilisation du contexte

```typescript
import { brainCore } from '@/system/head';

// Obtenir le contexte complet
const context = await brainCore.getContext();
console.log(context.user.training);
console.log(context.session.isActive);
```

### Enrichir un message de chat

```typescript
import { chatIntegration } from '@/system/head';

const enriched = await chatIntegration.enrichChatRequest(
  request,
  'training'
);
// Le message est maintenant enrichi avec tout le contexte utilisateur
```

### Écouter les événements

```typescript
import { eventListenerHub } from '@/system/head';

eventListenerHub.on('record:achieved', (event) => {
  console.log('Nouveau record!', event.data);
});
```

## 📊 Caractéristiques principales

### 1. Contexte Ultra-Riche

Le système HEAD fournit aux coaches IA:
- Historique d'entraînement (30 derniers jours)
- Charges actuelles par exercice
- Préférences et niveau
- Équipement disponible
- État actuel (repos vs effort)
- Exercice en cours et progression

### 2. Réponses Adaptatives

Le coach adapte son style de réponse automatiquement:
- **Effort actif**: Ultra-court (5-15 mots) - "Allez! Pousse!"
- **Repos**: Court (15-30 mots) - Conseils techniques
- **Hors session**: Normal (30-50 mots) - Explications détaillées

### 3. Coaching Proactif

Le système réagit automatiquement aux événements:
- 🔥 **Record battu**: Célébration immédiate (HIGH priority)
- ⚠️ **Douleur**: Intervention immédiate (CRITICAL priority)
- 💪 **RPE élevé**: Suggestion d'ajustement (MEDIUM priority)
- ✅ **Série complétée**: Encouragement (MEDIUM priority)

### 4. Mémoire Conversationnelle

- Persiste toutes les conversations (texte + voix)
- Switch transparent entre texte et voix
- Context window optimisé (résumé + 20 messages récents)
- Génération automatique de résumés (tous les 50 messages)

### 5. Performance Optimisée

- Cache intelligent avec TTL (5-15 minutes selon le forge)
- Invalidation sélective sur changement de données
- Métriques de performance en temps réel
- Health checks automatiques

### 6. Personnalisation Santé Reproductive

Le système HEAD prend en compte la santé reproductive féminine pour des adaptations ultra-personnalisées:

**Allaitement** (BreastfeedingDataCollector):
- Détection automatique du type d'allaitement (exclusif/mixte/partiel)
- Calcul des besoins nutritionnels augmentés (calories, protéines, calcium, fer, oméga-3, eau)
- Recommandations alimentaires adaptées (aliments prioritaires, limités, à éviter)
- Ajustement des cibles nutritionnelles selon l'âge du bébé

**Ménopause** (MenopauseDataCollector):
- Suivi du statut reproductif (menstruant/périménopause/ménopause/post-ménopause)
- Calcul automatique de la progression (jours depuis dernières règles)
- Analyse des symptômes récents et intensité moyenne
- Recommandations adaptées pour nutrition, exercice, jeûne, lifestyle
- Suggestions proactives de transition de phase
- Adaptation du taux métabolique et niveau d'énergie

**Cycle Menstruel** (menstrual_cycle_tracking):
- Suivi des cycles et patterns
- Analyse de l'intensité du flux et symptômes
- Corrélation avec humeur, énergie et douleur
- Adaptations d'entraînement selon la phase du cycle

## 🔗 Intégrations

### Chat Texte

Le chat texte est automatiquement enrichi avec le contexte HEAD:
- Profil utilisateur
- Entraînements récents
- État actuel de la session
- Progression en temps réel

### Voice Coaching (Realtime)

Le voice coach utilise le HEAD pour:
- Construire des prompts système contextuels
- Adapter le style de réponse (ultra-court pendant l'effort)
- Enregistrer les moments clés (douleurs, records)
- Réagir aux événements en temps réel

### Système d'événements

Le HEAD émet et écoute des événements:
- `set:completed` - Série terminée
- `exercise:completed` - Exercice terminé
- `record:achieved` - Record battu
- `pain:reported` - Douleur signalée
- `rpe:reported` - RPE signalé
- `rest:started` / `rest:ended` - Périodes de repos

## 🛠️ Technologies

- **Frontend**: React 18, TypeScript, Zustand
- **Backend**: Supabase (PostgreSQL, Realtime, RLS)
- **AI**: OpenAI GPT-4, Whisper (via edge functions)
- **Cache**: In-memory avec TTL configurables
- **Events**: EventEmitter pattern avec typage strict

## 📈 Métriques

Le système HEAD suit plusieurs métriques:
- Latence de collecte de données
- Latence de construction du contexte
- Taux de cache hit
- Latence totale (end-to-end)
- Nombre de messages proactifs envoyés

## 🔒 Sécurité

- Row Level Security (RLS) sur toutes les tables
- Les utilisateurs ne peuvent accéder qu'à leurs propres données
- Tokens CSRF pour les appels aux edge functions
- Nettoyage automatique des anciennes données (90 jours)

## 🎓 Pour aller plus loin

- Lisez [ARCHITECTURE.md](./ARCHITECTURE.md) pour comprendre la structure complète
- Lisez [IMPLEMENTATION.md](./IMPLEMENTATION.md) pour des guides d'utilisation détaillés
- Lisez [POUR_BIEN_COMPRENDRE.md](./POUR_BIEN_COMPRENDRE.md) pour une explication simplifiée

## 📞 Support

Pour toute question sur le système HEAD:
- Consultez d'abord cette documentation
- Vérifiez le code source dans `/src/system/head/`
- Les types sont documentés dans `/src/system/head/types.ts`

---

**Dernière mise à jour**: Novembre 2025
**Version**: 1.0.0 (Production Ready)
