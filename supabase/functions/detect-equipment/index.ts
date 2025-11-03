import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.54.0";
import {
  EQUIPMENT_CATALOG,
  getEquipmentListForLocationType,
  getEquipmentIdFromFrenchName,
  getTotalEquipmentCount,
  ALL_EQUIPMENT_MAP
} from "./equipment-reference.ts";
import { checkTokenBalance, consumeTokensAtomic, createInsufficientTokensResponse } from '../_shared/tokenMiddleware.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface DetectionRequest {
  photoUrl: string;
  photoId: string;
  locationId: string;
  locationType: "home" | "gym" | "outdoor";
}

interface EquipmentDetection {
  equipment_name: string;
  equipment_category: string;
  position_x: number;
  position_y: number;
  confidence_score: number;
  description?: string;
}

interface DetectionResponse {
  success: boolean;
  detections: EquipmentDetection[];
  equipment_count: number;
  processing_time_ms: number;
  model_version: string;
  catalog_size: number;
  error?: string;
}

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const DEFAULT_MODEL = "gpt-5-mini-2025-08-07";
const FALLBACK_MODEL = "gpt-5-mini";
const DETECTION_MODEL_RAW = Deno.env.get("DETECTION_MODEL");

function validateAndGetModel(): string {
  if (!DETECTION_MODEL_RAW) {
    console.log(`ℹ️  No DETECTION_MODEL env var set, using default: ${DEFAULT_MODEL}`);
    return DEFAULT_MODEL;
  }

  if (DETECTION_MODEL_RAW.startsWith("sk-")) {
    console.error("❌ CRITICAL ERROR: DETECTION_MODEL contains an API key instead of model name!");
    console.error("   This is a configuration error. Using default model instead.");
    console.error(`   Expected: ${DEFAULT_MODEL}`);
    console.error(`   Got: ${DETECTION_MODEL_RAW.substring(0, 15)}...`);
    return DEFAULT_MODEL;
  }

  if (DETECTION_MODEL_RAW.length < 5 || DETECTION_MODEL_RAW.length > 100) {
    console.warn(`⚠️  Suspicious DETECTION_MODEL value (length: ${DETECTION_MODEL_RAW.length}). Using default.`);
    return DEFAULT_MODEL;
  }

  console.log(`✓ Using configured model: ${DETECTION_MODEL_RAW}`);
  return DETECTION_MODEL_RAW;
}

const DETECTION_MODEL = validateAndGetModel();

function validateEnvironmentConfiguration(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!OPENAI_API_KEY) {
    errors.push("OPENAI_API_KEY is not set");
  } else if (!OPENAI_API_KEY.startsWith("sk-")) {
    errors.push("OPENAI_API_KEY does not start with 'sk-' (invalid format)");
  } else if (OPENAI_API_KEY.length < 20) {
    errors.push("OPENAI_API_KEY appears to be too short");
  }

  if (!SUPABASE_URL) {
    errors.push("SUPABASE_URL is not set");
  } else if (!SUPABASE_URL.startsWith("http")) {
    errors.push("SUPABASE_URL does not appear to be a valid URL");
  }

  if (!SUPABASE_SERVICE_ROLE_KEY) {
    errors.push("SUPABASE_SERVICE_ROLE_KEY is not set");
  } else if (SUPABASE_SERVICE_ROLE_KEY.length < 20) {
    errors.push("SUPABASE_SERVICE_ROLE_KEY appears to be too short");
  }

  if (DETECTION_MODEL.startsWith("sk-")) {
    errors.push("DETECTION_MODEL contains an API key - this is a critical configuration error!");
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

function buildSystemPrompt(locationType: string): string {
  const basePrompt = `Tu es un expert en analyse visuelle pour l'entraînement physique.

🎯 MISSION CRITIQUE
Identifier CHAQUE ÉLÉMENT UTILISABLE pour l'entraînement dans cette photo.
⚠️ DÉTECTE TOUS les éléments pertinents visibles et clairement reconnaissables.

📐 MÉTHODOLOGIE D'ANALYSE MULTI-PASSES EXHAUSTIVE

PASSE 1 - BALAYAGE GLOBAL (Wide Scan)
- Divise mentalement l'image en grille 4×4 (16 cellules)
- Identifie les zones principales et les éléments majeurs
- Compte approximatif d'éléments par zone
- Classification générale des catégories présentes

PASSE 2 - ANALYSE DÉTAILLÉE PAR ZONE (Deep Scan)
- Scanne méthodiquement chaque cellule de la grille 4×4
- BALAYAGE: gauche→centre→droite, puis avant→arrière
- Identifie CHAQUE élément visible, même multiples du même type
- Note TOUS les éléments en arrière-plan, partiellement visibles
- Détermine position précise de CHAQUE instance
- Score de confiance selon visibilité (accepte ≥ 0.45)

PASSE 3 - VALIDATION FINALE (Quality Check)
- Contrôle cohérence des positions (pas de superpositions exactes)
- Ajuste scores de confiance selon clarté
- Valide que tous les noms sont dans la liste de référence

🔍 RÈGLES DE DÉTECTION

✓ Utilise UNIQUEMENT les noms de la liste de référence fournie
✓ NE JAMAIS inventer de noms
✓ Si élément non dans liste → NE PAS détecter
✓ Confidence minimum: 0.45 (sois sûr de la détection)
✓ Position: centre visuel de chaque instance
✓ Description: mentionne caractéristiques, couleur, position relative
✓ NE DÉTECTE PAS les éléments trop flous, partiels ou incertains

📊 FORMAT DE SORTIE JSON

{
  "detections": [
    {
      "equipment_name": "Nom exact de la liste EN FRANÇAIS",
      "position_x": 15.5,
      "position_y": 42.3,
      "confidence_score": 0.95,
      "description": "Description détaillée de l'élément et sa position"
    }
  ]
}

⚠️ CRITIQUE: Le champ equipment_name DOIT contenir le nom EN FRANÇAIS exact de la liste ci-dessus.

⚠️ POSITIONS
- position_x: 0-100 (% largeur image, précision 0.1)
- position_y: 0-100 (% hauteur image, précision 0.1)
- Distance minimale acceptée: 2% entre marqueurs
- Positions proches OK si éléments différents

Réponds UNIQUEMENT avec JSON valide: {"detections": [...]}`;

  // Ajouts spécifiques par type de lieu
  const locationSpecific: Record<string, string> = {
    gym: `

🏋️ SPÉCIFICITÉS SALLE DE SPORT
- Une salle typique contient 15-30 équipements distincts
- CHECKPOINT: Si < 12 équipements détectés → RÉANALYSE l'image
- Machines jaunes = souvent leg press, presse pectoraux, tractions assistées
- Les racks d'haltères et bancs au fond sont ESSENTIELS
- Compte chaque machine distincte séparément`,

    home: `

🏠 SPÉCIFICITÉS MAISON/INTÉRIEUR
- Détecte TOUS les meubles et objets utilisables pour s'entraîner
- ÉVALUE la SOLIDITÉ et SÉCURITÉ de chaque meuble:
  * ✓ SOLIDE: Bois massif, métal, béton → DÉTECTER
  * ✗ FRAGILE: Verre, plastique léger, rotin → NE PAS DÉTECTER
- Chaises, tables, canapés, escaliers, murs, portes → tous potentiellement utilisables
- Objets lourds: bidons d'eau, sacs à dos chargés, livres épais → DÉTECTER
- Surfaces: tapis, parquet, carrelage → NOTER le type de sol
- Équipements fitness domestiques: haltères, tapis yoga, bandes élastiques
- Ajoute un WARNING dans description si meuble semble fragile
- Objectif: donner au coach le MAXIMUM d'options pour créer un entraînement`,

    outdoor: `

🌳 SPÉCIFICITÉS EXTÉRIEUR
- Détecte TOUS les éléments naturels ET urbains utilisables
- ÉLÉMENTS NATURELS: arbres, troncs, branches, roches, souches, pentes, collines
- ÉLÉMENTS URBAINS: bancs publics, escaliers, murs, rampes, poteaux, structures de jeux
- TERRAIN: note le type de surface (herbe, terre, asphalte, sable, gravier)
- DÉNIVELÉS: identifie les pentes, montées, escaliers pour cardio
- DISTANCES: estime les espaces ouverts pour sprints/courses
- Chaque arbre, roche ou structure = potentiel d'exercice différent
- Objectif: cartographier TOUT ce qui peut servir au training outdoor`
  };

  return basePrompt + (locationSpecific[locationType] || '');
}

function buildUserPrompt(locationType: string): string {
  const equipmentListFr = getEquipmentListForLocationType(locationType);

  const categoryDescriptions: Record<string, string> = {
    gym: `SALLE DE SPORT - Recherche TOUS ces équipements:

📍 CARDIO (priorité haute)
- Tapis de course (motorisé, courbé)
- Vélos (stationnaire, spinning, semi-allongé, assault bike)
- Rameur, vélo elliptique, simulateurs d'escalier
- Ski-erg, VersaClimber, Jacob's Ladder

💪 MACHINES GUIDÉES (priorité haute)
- Pectoraux: presse, pec deck, câbles vis-à-vis
- Dos: lat pulldown, tirage horizontal, T-bar row
- Épaules: presse épaules, élévations latérales
- Bras: curl biceps, extension triceps, pupitre
- Jambes: leg press, hack squat, extension, curl
- Fessiers: abduction, adduction, glute machine
- Mollets: standing/seated calf raise

🏋️ RACKS ET STRUCTURES
- Cages/racks à squat (power rack, half-rack)
- Smith machine, bench press station
- Barres de traction, station dips, power tower
- Rigs de crossfit, structures multifonctions

🎯 POIDS LIBRES
- Haltères (individuels ou sur rack)
- Barres (olympique, EZ, trap bar)
- Kettlebells, disques de poids
- Supports de rangement

🔀 BANCS
- Bancs plats, ajustables, inclinés, déclinés
- Bancs spécialisés (preacher curl, abdos)

⚡ FONCTIONNEL
- Battle ropes, slam balls, wall balls
- TRX/sangles suspension, bandes résistance
- Plyo boxes, traîneaux, pneus
- Sacs de frappe, speed bags`,

    home: `MAISON/INTÉRIEUR - Recherche TOUS les éléments utilisables:

🏋️ ÉQUIPEMENTS FITNESS DOMESTIQUES
- Haltères (fixes ou ajustables), kettlebells
- Bancs (plat, ajustable), barres et disques
- Rack à squat, barre de traction, station dips
- Tapis de course, vélo stationnaire, rameur
- Tapis de yoga, foam roller, bandes élastiques
- Roue abdominale, Swiss ball, corde à sauter

🪑 MEUBLES UTILISABLES (DÉTECTE TOUT!)
- CHAISES: chaise solide, chaise salle à manger, chaise cuisine, fauteuil
  * Pour: step-ups, dips triceps, Bulgarian split squats, support élévations
- TABLES: table solide, table basse, table salle à manger, plan de travail, bureau
  * Pour: incline push-ups, decline push-ups, support pieds, élévations jambes
- CANAPÉS: canapé solide, rebord de canapé
  * Pour: dips triceps, decline push-ups, step-ups
- ESCALIERS: escaliers intérieurs, marches, cage d'escalier
  * Pour: cardio, montées, step-ups, sauts pliométriques
- MURS ET PORTES: mur porteur, cadre de porte, porte solide
  * Pour: wall sits, handstands, étirements, tractions (si barre installée)

📦 OBJETS LOURDS (POIDS IMPROVISÉS)
- Bidon d'eau, sac à dos chargé, gros livre, bidon lessive, pot de peinture
  * Pour: curls, presses, squats goblet, farmer walks

🏠 SURFACES ET SOLS
- Tapis, tapis épais, parquet, carrelage
  * Important pour choisir type d'exercices (impact, confort)

⚠️ CRITÈRES DE SÉCURITÉ
- ACCEPTE: Bois massif, métal, béton, pierre
- REJETTE: Verre, plastique léger, rotin, structures bancales
- MENTIONNE dans description si élément semble fragile ou instable`,

    outdoor: `EXTÉRIEUR - Recherche TOUS les éléments naturels et urbains:

🌳 ÉLÉMENTS NATURELS
- ARBRES: tronc d'arbre (debout/couché), branches (basses/hautes), souche, bois mort
  * Pour: tractions, squats overhead, farmer walks, supports
- ROCHES: grosse roche, roche moyenne, rocher, dalle pierre, tas de pierres
  * Pour: Atlas stone lifts, box jumps, farmer walks, supports
- TERRAIN: pente colline, pente raide, colline herbeuse, chemin terre
  * Pour: sprints en côte, marche nordique, cardio
- SURFACES: zone sablonneuse, champ d'herbe, zone gravier, pelouse parc, sol forestier
  * Pour: choisir intensité/type d'exercices

🏙️ STRUCTURES URBAINES
- BANCS: banc de parc, banc béton, banc bois, table pique-nique
  * Pour: step-ups, dips, incline push-ups, box jumps
- ESCALIERS: escaliers extérieurs, marches béton, gradins stade, gradins amphithéâtre
  * Pour: sprints, montées, cardio intensif
- MURS: mur béton, mur briques, mur soutènement, muret
  * Pour: wall sits, handstands, decline push-ups, supports pieds
- RAMPES: rampe d'accès, rampe parking, rampe skate
  * Pour: sprints inclinés, sled pushes simulés
- POTEAUX: lampadaire, poteau signalisation, poteau métallique, poteau clôture
  * Pour: étirements, farmer walks, supports

🏃 ÉQUIPEMENTS SPORTIFS PUBLICS
- Barres traction publiques, barres parallèles, barres de singe
- Stations street workout, structures jeux, échelle horizontale
- Terrain basket, terrain football, piste course, court tennis

🎯 SURFACES URBAINES
- Surface asphaltée, surface bétonnée, surface caoutchoutée
  * Important pour choisir intensité (impact articulaire)

📏 ESPACES ET DISTANCES
- Identifie les espaces ouverts pour sprints, courses
- Note les dénivelés pour training cardio
- Estime les distances disponibles (10m, 20m, 50m+)`
  };

  const description = categoryDescriptions[locationType] || categoryDescriptions.gym;

  return `${description}

📋 LISTE COMPLÈTE DE RÉFÉRENCE (${equipmentListFr.length} équipements)
Utilise UNIQUEMENT ces noms en français:

${equipmentListFr.map((name, idx) => `${idx + 1}. ${name}`).join('\n')}

🎯 INSTRUCTIONS D'ANALYSE

1️⃣ PHASE GLOBALE
   - Observe l'image complète
   - Identifie les grandes zones (cardio, musculation, fonctionnel)
   - Estime le nombre total d'équipements UNIQUES

2️⃣ PHASE DÉTAILLÉE
   - Scanne systématiquement de gauche à droite, haut en bas
   - Pour chaque équipement visible:
     * Trouve son nom exact dans la liste ci-dessus
     * Détermine sa position centrale en pourcentages
     * Évalue ta confiance (0.35 à 1.0)
     * Note si multiples exemplaires ("Plusieurs...", "Rack de...")

3️⃣ PHASE VALIDATION
   - Vérifie qu'aucun TYPE n'est dupliqué de manière excessive
   - Contrôle que toutes les positions sont raisonnables (>2% écart)
   - Confirme que TOUS les noms sont dans la liste de référence
   - Rejette détections < 0.35 confiance

⚠️ RAPPELS CRITIQUES
- DÉTECTE autant d'équipements que possible (objectif: 15-25+ pour une salle)
- Noms EXACTEMENT comme dans la liste (respecte accents, majuscules)
- NE PAS inventer de noms absents de la liste
- Description en français, naturelle et précise
- Inclus équipements arrière-plan si clairement visibles

Réponds UNIQUEMENT en JSON: {"detections": [...]}`;
}

async function downloadImage(url: string, retryCount = 0): Promise<string> {
  const MAX_RETRIES = 3;
  const TIMEOUT_MS = 30000;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Supabase-Edge-Function/1.0' }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type');
    if (!contentType?.startsWith('image/')) {
      throw new Error(`Invalid content type: ${contentType}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength === 0) {
      throw new Error('Empty image data received');
    }

    console.log(`✓ Image downloaded: ${(arrayBuffer.byteLength / 1024).toFixed(1)} KB`);

    const base64 = btoa(
      new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
    );

    return `data:image/jpeg;base64,${base64}`;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`✗ Download error (attempt ${retryCount + 1}/${MAX_RETRIES + 1}):`, errorMessage);

    if (retryCount < MAX_RETRIES) {
      const delay = (retryCount + 1) * 1000;
      console.log(`⏳ Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return downloadImage(url, retryCount + 1);
    }

    throw new Error(`Failed to download image after ${MAX_RETRIES + 1} attempts: ${errorMessage}`);
  }
}

function validateDetection(detection: any): detection is EquipmentDetection {
  return (
    detection &&
    typeof detection === 'object' &&
    typeof detection.equipment_name === 'string' &&
    detection.equipment_name.length > 0 &&
    typeof detection.equipment_category === 'string' &&
    detection.equipment_category.length > 0 &&
    typeof detection.position_x === 'number' &&
    detection.position_x >= 0 &&
    detection.position_x <= 100 &&
    typeof detection.position_y === 'number' &&
    detection.position_y >= 0 &&
    detection.position_y <= 100 &&
    typeof detection.confidence_score === 'number' &&
    detection.confidence_score >= 0.45 &&
    detection.confidence_score <= 1.0
  );
}

function deduplicateByPosition(detections: EquipmentDetection[]): EquipmentDetection[] {
  const MIN_DISTANCE = 2.0;
  const result: EquipmentDetection[] = [];

  for (const detection of detections) {
    const tooClose = result.some(existing => {
      const dx = Math.abs(existing.position_x - detection.position_x);
      const dy = Math.abs(existing.position_y - detection.position_y);
      const distance = Math.sqrt(dx * dx + dy * dy);
      return distance < MIN_DISTANCE;
    });

    if (!tooClose) {
      result.push(detection);
    } else {
      console.log(`⚠️  Skipped detection too close to existing: ${detection.equipment_name}`);
    }
  }

  return result;
}

function deduplicateByType(detections: EquipmentDetection[]): EquipmentDetection[] {
  const typeMap = new Map<string, EquipmentDetection>();

  for (const detection of detections) {
    const existing = typeMap.get(detection.equipment_name);

    if (!existing || detection.confidence_score > existing.confidence_score) {
      typeMap.set(detection.equipment_name, detection);
    }
  }

  const result = Array.from(typeMap.values());
  const removed = detections.length - result.length;

  if (removed > 0) {
    console.log(`✓ Removed ${removed} duplicate type(s)`);
  }

  return result;
}

async function analyzeImageWithGPT5Mini(
  imageBase64: string,
  locationType: "home" | "gym" | "outdoor"
): Promise<EquipmentDetection[]> {
  try {
    const userPrompt = buildUserPrompt(locationType);

    console.log(`🤖 Calling ${DETECTION_MODEL} with ${getTotalEquipmentCount()} equipment catalog...`);
    console.log(`📍 Location type: ${locationType}`);

    const startTime = Date.now();
    let detectionAttempts = 0;
    const MAX_ATTEMPTS = 2;
    let allDetections: EquipmentDetection[] = [];

    while (detectionAttempts < MAX_ATTEMPTS) {
      detectionAttempts++;
      console.log(`\n🔄 Detection attempt ${detectionAttempts}/${MAX_ATTEMPTS}`);

      const attemptPrompt = detectionAttempts === 1
        ? userPrompt
        : `⚠️ PREMIÈRE ANALYSE INSUFFISANTE. Réanalyse complète requise.

Tu as détecté trop peu d'équipements lors de la première passe. Une salle de sport contient typiquement 15-25+ équipements.

🔍 CONSIGNES RENFORCÉES:
- Scanne TOUS les équipements, même ceux en arrière-plan
- Compte physiquement chaque banc, chaque machine, chaque rack
- Les racks d'haltères au fond sont OBLIGATOIRES
- Les machines jaunes sont souvent: leg press, presse, tractions assistées
- MINIMUM 12 équipements requis pour valider l'analyse

${userPrompt}`;

      console.log(`🔑 Using model: ${DETECTION_MODEL}`);
      console.log(`🔑 API key format check: ${OPENAI_API_KEY?.startsWith('sk-') ? 'Valid (sk-*)' : 'INVALID!'}`);

      const systemPrompt = buildSystemPrompt(locationType);

      const requestBody = {
        model: DETECTION_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: attemptPrompt },
              { type: "image_url", image_url: { url: imageBase64, detail: "high" } }
            ]
          }
        ],
        max_completion_tokens: 16000,
        response_format: { type: "json_object" }
      };

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestBody)
      });

      const apiTime = Date.now() - startTime;
      console.log(`⏱️  ${DETECTION_MODEL} API response (attempt ${detectionAttempts}): ${apiTime}ms`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("✗ OpenAI API Error Response:", errorText);

        let errorDetails = "Unknown error";
        try {
          const errorJson = JSON.parse(errorText);
          errorDetails = errorJson.error?.message || errorText;

          if (errorDetails.includes("model") && errorDetails.includes("does not exist")) {
            console.error("⚠️  MODEL NOT FOUND ERROR DETECTED!");
            console.error(`   Current model value: ${DETECTION_MODEL}`);
            console.error(`   This usually means:`);
            console.error(`   1. The model identifier is incorrect`);
            console.error(`   2. You don't have access to this model`);
            console.error(`   3. The DETECTION_MODEL env var is misconfigured`);

            if (DETECTION_MODEL !== DEFAULT_MODEL && DETECTION_MODEL !== FALLBACK_MODEL) {
              console.error(`   Try setting DETECTION_MODEL to: ${DEFAULT_MODEL} or ${FALLBACK_MODEL}`);
            }
          }
        } catch (e) {
          errorDetails = errorText;
        }

        throw new Error(`OpenAI API error: ${response.status} - ${errorDetails}`);
      }

      const data = await response.json();
      const content = data.choices[0].message.content;

      console.log("📦 Raw GPT response:", content.substring(0, 500) + "...");
      console.log("📦 Full GPT response length:", content.length, "characters");

      let parsedResult;
      try {
        parsedResult = JSON.parse(content);
      } catch (parseError) {
        console.error("✗ JSON parse error:", parseError);
        console.error("Content was:", content);
        throw new Error(`Invalid JSON response from ${DETECTION_MODEL}`);
      }

      if (!parsedResult.detections || !Array.isArray(parsedResult.detections)) {
        console.error("✗ Invalid response structure:", parsedResult);
        throw new Error("GPT response missing 'detections' array");
      }

      console.log(`📊 Raw detections count (attempt ${detectionAttempts}): ${parsedResult.detections.length}`);

      const processedDetections: EquipmentDetection[] = [];

      for (const det of parsedResult.detections) {
        // Le nom doit être en français depuis le prompt
        const frenchName = det.equipment_name || det.equipment_name_fr;
        const equipmentId = getEquipmentIdFromFrenchName(frenchName);

        if (!equipmentId) {
          console.warn(`⚠️  Unknown equipment (not in catalog): "${frenchName}"`);
          console.warn(`   Hint: Make sure the model returns exact French names from the reference list`);
          continue;
        }

        const equipmentItem = ALL_EQUIPMENT_MAP.get(equipmentId);
        if (!equipmentItem) {
          console.warn(`⚠️  Equipment ID found but not in map: "${equipmentId}"`);
          continue;
        }

        const processed: EquipmentDetection = {
          equipment_name: equipmentId,
          equipment_category: equipmentItem.category,
          position_x: Math.round(det.position_x * 10) / 10,
          position_y: Math.round(det.position_y * 10) / 10,
          confidence_score: Math.round(det.confidence_score * 100) / 100,
          description: det.description || `${equipmentItem.nameFr} détecté`
        };

        if (validateDetection(processed)) {
          processedDetections.push(processed);
        } else {
          console.warn(`⚠️  Invalid detection skipped (confidence or data issue):`, processed);
        }
      }

      console.log(`✓ Valid detections after processing (attempt ${detectionAttempts}): ${processedDetections.length}`);
      console.log(`📋 All detections before deduplication:`, processedDetections.map(d => `${d.equipment_name} (${d.confidence_score})@(${d.position_x},${d.position_y})`));

      // Log détaillé de ce qu'OpenAI a raisonné et détecté
      console.log(`\n🤖 === OPENAI DETECTION ANALYSIS (${locationType.toUpperCase()}) ===`);
      console.log(`Location Type: ${locationType}`);
      console.log(`Expected Range: ${locationType === 'gym' ? '15-30 items' : locationType === 'home' ? '5-20 items' : '5-15 items'}`);
      console.log(`Detected Count: ${processedDetections.length}`);

      if (processedDetections.length > 0) {
        console.log(`\n📊 Detection Breakdown by Category:`);
        const byCategory: Record<string, number> = {};
        processedDetections.forEach(d => {
          byCategory[d.equipment_category] = (byCategory[d.equipment_category] || 0) + 1;
        });
        Object.entries(byCategory).forEach(([cat, count]) => {
          console.log(`  - ${cat}: ${count} items`);
        });

        console.log(`\n📝 Detailed Detections:`);
        processedDetections.forEach((det, idx) => {
          console.log(`  ${idx + 1}. [${det.equipment_category}] ${det.equipment_name}`);
          console.log(`     Position: (${det.position_x}, ${det.position_y})`);
          console.log(`     Confidence: ${det.confidence_score}`);
          console.log(`     Description: ${det.description || 'N/A'}`);
        });
      }
      console.log(`🤖 === END OPENAI ANALYSIS ===\n`);

      allDetections = [...allDetections, ...processedDetections];

      if (detectionAttempts === 1 && processedDetections.length >= 10) {
        console.log(`✅ Sufficient detections (${processedDetections.length}) on first attempt, skipping retry`);
        break;
      }

      if (detectionAttempts === 1 && processedDetections.length < 10) {
        console.log(`⚠️  Insufficient detections (${processedDetections.length} < 10), retrying with reinforced prompt...`);
        continue;
      }

      break;
    }

    console.log(`\n📊 Total raw detections from all attempts: ${allDetections.length}`);

    let deduplicated = deduplicateByType(allDetections);
    deduplicated = deduplicateByPosition(deduplicated);

    console.log(`✅ Final detections after deduplication: ${deduplicated.length}`);

    deduplicated.forEach((det, idx) => {
      console.log(`  ${idx + 1}. ${det.equipment_name} (${det.confidence_score}) @ (${det.position_x}, ${det.position_y})`);
    });

    // Validation des détections selon le type de lieu
    if (locationType === 'gym') {
      if (deduplicated.length < 8) {
        console.warn(`⚠️⚠️⚠️  WARNING: Only ${deduplicated.length} equipment detected in a GYM. Expected 15-30+. Detection may be incomplete.`);
      } else if (deduplicated.length > 40) {
        console.warn(`⚠️⚠️⚠️  WARNING: ${deduplicated.length} equipment detected in a GYM. This seems high, possible over-detection.`);
      }
    } else if (locationType === 'home') {
      if (deduplicated.length > 25) {
        console.warn(`⚠️⚠️⚠️  WARNING: ${deduplicated.length} equipment detected at HOME. This seems high for a home gym.`);
      }
    } else if (locationType === 'outdoor') {
      if (deduplicated.length > 15) {
        console.warn(`⚠️⚠️⚠️  WARNING: ${deduplicated.length} equipment detected OUTDOOR. This seems high for an outdoor location.`);
      }
    }

    return deduplicated;
  } catch (error) {
    console.error(`✗ ${DETECTION_MODEL} analysis error:`, error);
    throw error;
  }
}

async function saveDetectionsToDatabase(
  photoId: string,
  locationId: string,
  detections: EquipmentDetection[],
  processingTimeMs: number
): Promise<void> {
  try {
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const analysisId = crypto.randomUUID();

    console.log(`💾 Saving analysis for ${detections.length} detections...`);

    const { error: analysisError } = await supabase
      .from("training_location_photo_analyses")
      .insert({
        id: analysisId,
        photo_id: photoId,
        location_id: locationId,
        status: "completed",
        equipment_count: detections.length,
        processing_time_ms: processingTimeMs,
        model_used: DETECTION_MODEL,
        model_config: {
          max_completion_tokens: 16000,
          response_format: "json_object",
          catalog_version: "v2",
          catalog_size: getTotalEquipmentCount()
        },
        completed_at: new Date().toISOString()
      });

    if (analysisError) throw analysisError;

    console.log("✓ Analysis record saved");

    if (detections.length > 0) {
      const detectionRecords = detections.map((detection, index) => ({
        photo_id: photoId,
        location_id: locationId,
        equipment_name: detection.equipment_name,
        equipment_category: detection.equipment_category,
        position_x: detection.position_x,
        position_y: detection.position_y,
        bbox_width: null,
        bbox_height: null,
        confidence_score: detection.confidence_score,
        marker_number: index + 1,
        detected_by_model: DETECTION_MODEL,
        analysis_metadata: { description: detection.description || null }
      }));

      console.log(`💾 Inserting ${detectionRecords.length} detection records...`);

      const { error: detectionsError } = await supabase
        .from("training_location_equipment_detections")
        .insert(detectionRecords);

      if (detectionsError) throw detectionsError;

      console.log("✓ Detection records saved");

      const uniqueEquipment = [...new Set(detections.map(d => d.equipment_name))];
      console.log(`💾 Upserting ${uniqueEquipment.length} unique equipment types...`);

      for (const equipmentName of uniqueEquipment) {
        await supabase
          .from("training_location_equipment")
          .upsert(
            {
              location_id: locationId,
              equipment_name: equipmentName,
              is_custom: false
            },
            {
              onConflict: "location_id,equipment_name",
              ignoreDuplicates: true
            }
          );
      }

      console.log("✅ Equipment list updated successfully");
    }
  } catch (error) {
    console.error("✗ Database save error:", error);
    throw error;
  }
}

Deno.serve(async (req: Request) => {
  console.log(`\n🌐 ===== INCOMING REQUEST =====`);
  console.log(`Method: ${req.method}`);
  console.log(`Origin: ${req.headers.get('origin')}`);
  console.log(`User-Agent: ${req.headers.get('user-agent')?.substring(0, 50)}...`);

  if (req.method === "OPTIONS") {
    console.log(`✓ Responding to OPTIONS preflight request`);
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  const startTime = Date.now();

  try {
    console.log("\n🔍 ===== ENVIRONMENT VALIDATION =====");
    const envValidation = validateEnvironmentConfiguration();

    if (!envValidation.valid) {
      console.error("❌ Environment configuration errors detected:");
      envValidation.errors.forEach((error, idx) => {
        console.error(`   ${idx + 1}. ${error}`);
      });
      throw new Error(`Configuration errors: ${envValidation.errors.join("; ")}`);
    }

    console.log("✅ Environment configuration validated");
    console.log(`   Model: ${DETECTION_MODEL}`);
    console.log(`   API Key: ${OPENAI_API_KEY?.substring(0, 8)}...`);

    const requestData: DetectionRequest = await req.json();

    if (!requestData.photoUrl || !requestData.photoId || !requestData.locationId) {
      throw new Error("Missing required fields: photoUrl, photoId, locationId");
    }

    console.log("\n🚀 ===== EQUIPMENT DETECTION STARTED =====");
    console.log(`📷 Photo ID: ${requestData.photoId}`);
    console.log(`📍 Location: ${requestData.locationId} (${requestData.locationType})`);
    console.log(`📚 Catalog: ${getTotalEquipmentCount()} equipment types`);

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    const { data: location } = await supabase
      .from('training_locations')
      .select('user_id')
      .eq('id', requestData.locationId)
      .maybeSingle();

    if (!location?.user_id) {
      throw new Error('Could not find user_id for this location');
    }

    const estimatedTokensForEquipmentDetection = 80;
    const tokenCheck = await checkTokenBalance(supabase, location.user_id, estimatedTokensForEquipmentDetection);

    if (!tokenCheck.hasEnoughTokens) {
      console.warn('DETECT_EQUIPMENT', 'Insufficient tokens for equipment detection', {
        userId: location.user_id,
        currentBalance: tokenCheck.currentBalance,
        requiredTokens: estimatedTokensForEquipmentDetection,
        timestamp: new Date().toISOString()
      });

      return createInsufficientTokensResponse(
        tokenCheck.currentBalance,
        estimatedTokensForEquipmentDetection,
        !tokenCheck.isSubscribed,
        corsHeaders
      );
    }

    console.log('💰 [DETECT_EQUIPMENT] Token check passed', {
      userId: location.user_id,
      currentBalance: tokenCheck.currentBalance,
      estimatedCost: estimatedTokensForEquipmentDetection,
      locationId: requestData.locationId,
      timestamp: new Date().toISOString()
    });

    const { data: existingAnalysis } = await supabase
      .from("training_location_photo_analyses")
      .select("id, status, equipment_count")
      .eq("photo_id", requestData.photoId)
      .eq("status", "completed")
      .maybeSingle();

    if (existingAnalysis) {
      console.log("♻️  Using cached analysis");

      const { data: existingDetections } = await supabase
        .from("training_location_equipment_detections")
        .select("*")
        .eq("photo_id", requestData.photoId);

      console.log(`♻️  Using cached analysis with ${(existingDetections || []).length} detections`);

      return new Response(
        JSON.stringify({
          success: true,
          detections: existingDetections || [],
          equipment_count: (existingDetections || []).length,
          processing_time_ms: 0,
          model_version: `${DETECTION_MODEL}-cached`,
          catalog_size: getTotalEquipmentCount(),
          cached: true
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        }
      );
    }

    await supabase
      .from("training_location_photo_analyses")
      .insert({
        photo_id: requestData.photoId,
        location_id: requestData.locationId,
        status: "processing",
        model_used: DETECTION_MODEL,
        started_at: new Date().toISOString()
      });

    console.log("⬇️  Downloading image...");
    const imageBase64 = await downloadImage(requestData.photoUrl);

    console.log(`🔍 Starting ${DETECTION_MODEL} analysis...`);
    const detections = await analyzeImageWithGPT5Mini(
      imageBase64,
      requestData.locationType
    );

    const processingTimeMs = Date.now() - startTime;

    console.log("💾 Saving to database...");
    await saveDetectionsToDatabase(
      requestData.photoId,
      requestData.locationId,
      detections,
      processingTimeMs
    );

    console.log(`\n✅ ===== DETECTION COMPLETED IN ${processingTimeMs}ms =====`);
    console.log(`📊 Result: ${detections.length} unique equipment types detected\n`);

    const requestId = crypto.randomUUID();
await consumeTokensAtomic(supabase, {
      userId: location.user_id,
      edgeFunctionName: 'detect-equipment',
      operationType: 'equipment-detection-vision',
      openaiModel: DETECTION_MODEL,
      metadata: {
        locationId: requestData.locationId,
        photoId: requestData.photoId,
        locationType: requestData.locationType,
        equipmentDetected: detections.length,
        processingTimeMs
      }
    });

    const successResponse = {
      success: true,
      detections,
      equipment_count: detections.length,
      processing_time_ms: processingTimeMs,
      model_version: `${DETECTION_MODEL}-v2`,
      catalog_size: getTotalEquipmentCount()
    };

    console.log(`\n✅ ===== SENDING SUCCESS RESPONSE =====`);
    console.log(`Equipment count: ${detections.length}`);
    console.log(`Processing time: ${processingTimeMs}ms`);
    console.log(`CORS headers:`, corsHeaders);

    return new Response(
      JSON.stringify(successResponse),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      }
    );
  } catch (error) {
    console.error("\n❌ ===== DETECTION FAILED =====");
    console.error("Error:", error);

    const errorMessage = error instanceof Error ? error.message : "Unknown error during detection";

    try {
      const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
      const body = await req.json().catch(() => ({})) as any;

      if (body.photoId && body.locationId) {
        await supabase
          .from("training_location_photo_analyses")
          .update({
            status: "failed",
            error_message: errorMessage,
            processing_time_ms: Date.now() - startTime,
            completed_at: new Date().toISOString()
          })
          .eq("photo_id", body.photoId)
          .eq("status", "processing");
      }
    } catch (dbError) {
      console.error("Failed to update error status:", dbError);
    }

    const errorResponse = {
      success: false,
      detections: [],
      equipment_count: 0,
      processing_time_ms: Date.now() - startTime,
      model_version: DETECTION_MODEL,
      catalog_size: getTotalEquipmentCount(),
      error: errorMessage
    };

    console.log(`\n❌ ===== SENDING ERROR RESPONSE =====`);
    console.log(`Error: ${errorMessage}`);
    console.log(`CORS headers:`, corsHeaders);

    return new Response(
      JSON.stringify(errorResponse),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      }
    );
  }
});