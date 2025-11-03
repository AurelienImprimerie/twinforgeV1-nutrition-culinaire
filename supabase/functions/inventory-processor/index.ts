import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
// Category mapping for food items
const CATEGORY_MAPPING = {
  'apple': 'Fruits',
  'banana': 'Fruits',
  'orange': 'Fruits',
  'carrot': 'Légumes',
  'potato': 'Légumes',
  'onion': 'Légumes',
  'tomato': 'Légumes',
  'milk': 'Produits laitiers',
  'cheese': 'Produits laitiers',
  'yogurt': 'Produits laitiers',
  'chicken': 'Viandes',
  'beef': 'Viandes',
  'pork': 'Viandes',
  'fish': 'Poissons',
  'salmon': 'Poissons',
  'rice': 'Céréales',
  'pasta': 'Céréales',
  'bread': 'Céréales',
  'salt': 'Épices',
  'pepper': 'Épices',
  'garlic': 'Épices'
};
// Freshness estimation based on category
const FRESHNESS_ESTIMATES = {
  'Fruits': {
    base: 75,
    variance: 20
  },
  'Légumes': {
    base: 80,
    variance: 15
  },
  'Viandes': {
    base: 85,
    variance: 10
  },
  'Poissons': {
    base: 90,
    variance: 5
  },
  'Produits laitiers': {
    base: 88,
    variance: 8
  },
  'Céréales': {
    base: 95,
    variance: 5
  },
  'Épices': {
    base: 98,
    variance: 2
  },
  'Autre': {
    base: 80,
    variance: 15
  }
};
// Common allergens
const ALLERGEN_MAPPING = {
  'milk': [
    'lactose',
    'dairy'
  ],
  'cheese': [
    'lactose',
    'dairy'
  ],
  'yogurt': [
    'lactose',
    'dairy'
  ],
  'bread': [
    'gluten',
    'wheat'
  ],
  'pasta': [
    'gluten',
    'wheat'
  ],
  'fish': [
    'fish'
  ],
  'salmon': [
    'fish'
  ],
  'nuts': [
    'nuts'
  ],
  'eggs': [
    'eggs'
  ]
};
serve(async (req)=>{
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    // Validate request method
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({
        error: 'Method not allowed'
      }), {
        status: 405,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Parse request body
    const { raw_detected_items, user_id } = await req.json();
    // Validate input
    if (!raw_detected_items || !Array.isArray(raw_detected_items)) {
      return new Response(JSON.stringify({
        error: 'raw_detected_items array is required'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    if (!user_id) {
      return new Response(JSON.stringify({
        error: 'user_id is required'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    const startTime = Date.now();
    console.log('INVENTORY_PROCESSOR', 'Starting inventory processing', {
      user_id,
      items_count: raw_detected_items.length,
      timestamp: new Date().toISOString()
    });
    // Generate cache key
    const cacheKey = await generateCacheKey(raw_detected_items, user_id);
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    // Check cache first
    const { data: cachedResult } = await supabase.from('ai_analysis_jobs').select('result_payload').eq('input_hash', cacheKey).eq('analysis_type', 'inventory_processing').gte('created_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()) // 48h TTL
    .single();
    if (cachedResult?.result_payload) {
      console.log('INVENTORY_PROCESSOR', 'Cache hit', {
        user_id,
        cache_key: cacheKey,
        timestamp: new Date().toISOString()
      });
      return new Response(JSON.stringify({
        ...cachedResult.result_payload,
        cache_hit: true,
        processing_time_ms: Date.now() - startTime
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Get user preferences for allergen/preference matching
    const { data: userProfile } = await supabase
      .from('user_profile')
      .select(`
        nutrition, 
        food_preferences, 
        sensory_preferences,
        household_details,
        shopping_preferences
      `)
      .eq('user_id', user_id)
      .single();

    const userAllergies = userProfile?.nutrition?.allergies || [];
    const userDislikes = userProfile?.nutrition?.disliked || [];
    const foodPreferences = userProfile?.food_preferences || { ingredients: [], cuisines: [], flavors: [] };
    const sensoryPreferences = {
      textureAversions: userProfile?.sensory_preferences?.textureAversions || [],
      spiceTolerance: userProfile?.sensory_preferences?.spiceTolerance || 1
    };
    const householdDetails = userProfile?.household_details || { adults: 1, children: 0 };

    const normalizedItems = raw_detected_items.map((item)=>{
      // Normalize name
      const normalizedName = normalizeItemName(item.label || item.name || 'Ingrédient inconnu');
      // Determine category
      const category = determineCategory(normalizedName, item.category);
      // Estimate quantity
      const quantity = normalizeQuantity(item.estimated_quantity || item.quantity || '1'); // Keep raw quantity
      // Estimate freshness
      const freshness = estimateFreshness(category, item.freshness_score);
      // Check allergens
      const allergenFlags = checkAllergens(normalizedName, userAllergies);
      // Check preferences
      const preferenceMatch = checkPreferences(normalizedName, userDislikes, foodPreferences, sensoryPreferences);
      // Estimate expiry
      const estimatedExpiryDays = estimateExpiryDays(category, freshness);
      
      // Check for texture aversions
      const textureFlags = checkTextureAversions(normalizedName, category, sensoryPreferences.textureAversions);
      
      return {
        name: normalizedName,
        category,
        quantity: quantity, // Keep raw detected quantity - no household adjustment here
        freshness,
        allergen_flags: allergenFlags,
        preference_match: preferenceMatch,
        estimated_expiry_days: estimatedExpiryDays,
        texture_flags: textureFlags
      };
    });
    const processingTime = Date.now() - startTime;
    const response = {
      inventory_normalized: normalizedItems,
      processing_time_ms: processingTime,
      items_processed: raw_detected_items.length,
      cache_hit: false
    };
    // Cache the result
    await supabase.from('ai_analysis_jobs').upsert({
      user_id,
      analysis_type: 'inventory_processing',
      status: 'completed',
      input_hash: cacheKey,
      request_payload: {
        items_count: raw_detected_items.length
      },
      result_payload: response,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    console.log('INVENTORY_PROCESSOR', 'Processing completed', {
      user_id,
      items_processed: raw_detected_items.length,
      items_normalized: normalizedItems.length,
      normalized_items_audit: normalizedItems.map(item => ({
        name: item.name,
        category: item.category,
        quantity: item.quantity,
        freshness: item.freshness
      })),
      processing_time_ms: processingTime,
      cache_key: cacheKey,
      timestamp: new Date().toISOString()
    });
    return new Response(JSON.stringify(response), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('INVENTORY_PROCESSOR', 'Error in inventory processing', {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: error.message
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
// Helper functions
async function generateCacheKey(items, userId) {
  const data = JSON.stringify({
    items,
    userId
  });
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
  return Array.from(new Uint8Array(hashBuffer)).map((b)=>b.toString(16).padStart(2, '0')).join('');
}
function normalizeItemName(name) {
  return name.toLowerCase().trim().replace(/[^a-zA-ZÀ-ÿ\s]/g, '').replace(/\s+/g, ' ').split(' ').map((word)=>word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}
function determineCategory(name, suggestedCategory) {
  if (suggestedCategory && suggestedCategory !== 'Autre') {
    return suggestedCategory;
  }
  const nameLower = name.toLowerCase();
  for (const [keyword, category] of Object.entries(CATEGORY_MAPPING)){
    if (nameLower.includes(keyword)) {
      return category;
    }
  }
  return 'Autre';
}
function normalizeQuantity(quantity) {
  if (!quantity || quantity === '1') {
    return '1 unité';
  }
  // Clean and normalize quantity string - preserve original format as much as possible
  return quantity.trim().replace(/\s+/g, ' ');
}
function estimateFreshness(category, providedScore) {
  if (providedScore && providedScore > 0) {
    if (providedScore > 80) return 'Excellent';
    if (providedScore > 60) return 'Bon';
    if (providedScore > 40) return 'Moyen';
    return 'À utiliser rapidement';
  }
  const estimate = FRESHNESS_ESTIMATES[category] || FRESHNESS_ESTIMATES['Autre'];
  const score = estimate.base + (Math.random() - 0.5) * estimate.variance;
  if (score > 80) return 'Excellent';
  if (score > 60) return 'Bon';
  if (score > 40) return 'Moyen';
  return 'À utiliser rapidement';
}
function checkAllergens(name, userAllergies) {
  const nameLower = name.toLowerCase();
  const flags = [];
  for (const [food, allergens] of Object.entries(ALLERGEN_MAPPING)){
    if (nameLower.includes(food)) {
      for (const allergen of allergens){
        if (userAllergies.some((allergy)=>allergy.toLowerCase().includes(allergen))) {
          flags.push(allergen);
        }
      }
    }
  }
  return flags;
}
function checkPreferences(
  name, 
  userDislikes,
  foodPreferences,
  sensoryPreferences
) {
  const nameLower = name.toLowerCase();
  
  // Check dislikes first (legacy support)
  if (userDislikes.some((dislike) => nameLower.includes(dislike.toLowerCase()))) {
    return 'dislike';
  }
  
  // Check enhanced food preferences (tri-state)
  if (foodPreferences?.ingredients) {
    const preference = foodPreferences.ingredients.find((pref) => 
      nameLower.includes(pref.name.toLowerCase()) || 
      pref.name.toLowerCase().includes(nameLower)
    );
    if (preference) {
      return preference.state;
    }
  }
  
  // Check cuisine preferences
  if (foodPreferences?.cuisines) {
    const cuisinePreference = foodPreferences.cuisines.find((pref) => 
      nameLower.includes(pref.name.toLowerCase())
    );
    if (cuisinePreference) {
      return cuisinePreference.state;
    }
  }
  
  return 'unknown';
}

function checkTextureAversions(name, category, textureAversions) {
  const nameLower = name.toLowerCase();
  const flags = [];
  
  // Map common texture aversions to food categories/names
  const textureMapping = {
    'gélatineux': ['gelée', 'aspic', 'gélatine'],
    'granuleux': ['semoule', 'couscous', 'quinoa'],
    'visqueux': ['okra', 'gombo', 'mucilage'],
    'fibreux': ['céleri', 'artichaut', 'asperge'],
    'spongieux': ['champignon', 'éponge'],
    'croquant': ['noix', 'crackers', 'chips'],
    'mou': ['banane mûre', 'avocat mûr', 'tomate mûre']
  };
  
  textureAversions.forEach(aversion => {
    const aversions = textureMapping[aversion.toLowerCase()] || [aversion.toLowerCase()];
    if (aversions.some(texture => nameLower.includes(texture))) {
      flags.push(aversion);
    }
  });
  
  return flags;
}

function estimateExpiryDays(category, freshness) {
  const freshnessMultiplier = {
    'Excellent': 1.0,
    'Bon': 0.7,
    'Moyen': 0.4,
    'À utiliser rapidement': 0.1
  }[freshness] || 0.5;
  const baseDays = {
    'Fruits': 7,
    'Légumes': 10,
    'Viandes': 3,
    'Poissons': 2,
    'Produits laitiers': 5,
    'Céréales': 30,
    'Épices': 365,
    'Autre': 7
  }[category] || 7;
  return Math.max(1, Math.round(baseDays * freshnessMultiplier));
}