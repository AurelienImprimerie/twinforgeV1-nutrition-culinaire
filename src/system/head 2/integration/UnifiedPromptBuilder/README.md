# UnifiedPromptBuilder - Modularisation

## Vue d'ensemble

Le fichier monolithique `UnifiedPromptBuilder.ts` (954 lignes) a été divisé en modules spécialisés pour améliorer la maintenabilité et la lisibilité du code.

## Structure

```
UnifiedPromptBuilder/
├── index.ts                                    (Point d'entrée principal - 126 lignes)
└── builders/
    ├── ActivityContextBuilder.ts               (65 lignes)
    ├── BodyScanContextBuilder.ts              (108 lignes)
    ├── EnergyContextBuilder.ts                (186 lignes)
    ├── NutritionContextBuilder.ts             (287 lignes)
    ├── ResponseStyleBuilder.ts                (62 lignes)
    ├── TemporalContextBuilder.ts              (105 lignes)
    ├── TrainingContextBuilder.ts              (79 lignes)
    └── UserKnowledgeSummaryBuilder.ts         (83 lignes)
```

## Modules

### index.ts
Point d'entrée principal qui orchestre tous les builders. Contient:
- La classe `UnifiedPromptBuilder`
- La méthode `buildSystemPrompt()` qui construit le prompt complet
- La méthode privée `buildEnrichment()` qui coordonne les builders

### builders/ResponseStyleBuilder.ts
Détermine le style de réponse approprié selon le contexte (ultra-court pendant l'effort, court pendant repos, normal sinon).

### builders/ActivityContextBuilder.ts
Construit le contexte de l'activité actuelle de l'utilisateur (page, sous-contexte, état, activités du jour).

### builders/TrainingContextBuilder.ts
Construit le contexte d'entraînement (séances récentes, RPE, volume, records, objectifs).

### builders/NutritionContextBuilder.ts
Construit le contexte nutritionnel complet (repas, plans alimentaires, listes de courses, inventaire frigo, analyses IA).

### builders/EnergyContextBuilder.ts
Construit le contexte énergétique et biométrique (wearables, FC, HRV, VO2max, récupération, activités récentes).

### builders/BodyScanContextBuilder.ts
Construit le contexte de composition corporelle (scans, mesures, progression, insights IA).

### builders/TemporalContextBuilder.ts
Construit le contexte temporel (patterns d'entraînement, créneaux optimaux, consistance).

### builders/UserKnowledgeSummaryBuilder.ts
Orchestre tous les builders de contexte pour créer le résumé complet des connaissances utilisateur.

## Backup

Le fichier original a été sauvegardé dans:
```
src/system/head/integration/UnifiedPromptBuilder.backup/UnifiedPromptBuilder.ts.backup
```

## Compatibilité

Tous les imports existants continuent de fonctionner sans modification grâce au fichier `index.ts`:
```typescript
import { UnifiedPromptBuilder } from './UnifiedPromptBuilder';
```

## Bénéfices

1. **Lisibilité**: Chaque module fait ~100 lignes au lieu de 954
2. **Maintenabilité**: Modifications isolées par domaine
3. **Testabilité**: Chaque builder peut être testé indépendamment
4. **Extensibilité**: Facile d'ajouter de nouveaux builders
5. **Aucune régression**: Le build fonctionne parfaitement ✅

## Date de modularisation

7 novembre 2025
