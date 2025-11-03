import { corsHeaders, jsonResponse } from './response.ts';
import { buildK5Envelope, validateEnvelopeIntegrity } from './envelopeBuilder.ts';
import { selectClosestArchetypes } from './archetypeSelector.ts';
import { getServiceClient, validateServiceClientEnv } from './supabaseClient.ts';
import { getMorphologyMappingDirect } from './morphologyHelpers.ts';

/**
 * Scan Match Edge Function - RPC Integration v4.0
 * PHASE A.2/A.3: Enhanced with strict muscular gating and K=5 envelope building
 * FIXED: Completely self-sufficient for morphology mapping (no external Edge Function calls)
 */
Deno.serve(async (req) => {
  const processingStartTime = performance.now();

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  // Validate environment variables
  const envValidation = validateServiceClientEnv();
  if (!envValidation.isValid) {
    console.error('❌ [scan-match] Missing required environment variables', {
      missingVars: envValidation.missingVars,
      requiredVars: ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'],
      currentEnv: {
        hasUrl: !!Deno.env.get('SUPABASE_URL'),
        hasServiceKey: !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
        urlPreview: Deno.env.get('SUPABASE_URL')?.substring(0, 30) + '...' || 'missing',
        serviceKeyPreview: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ? 'eyJ...' + Deno.env.get('SUPABASE_SERVICE_ROLE_KEY').slice(-10) : 'missing'
      },
      philosophy: 'environment_validation_failed'
    });
    return jsonResponse({
      error: "Server configuration incomplete",
      details: `Missing environment variables: ${envValidation.missingVars.join(', ')}`,
      debug: {
        requiredVars: ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'],
        missingVars: envValidation.missingVars
      },
      philosophy: 'environment_validation_error'
    }, 500);
  }

  // Initialize Supabase client
  const supabase = getServiceClient();
  console.log('✅ [scan-match] Service client initialized successfully', {
    clientType: 'service_role',
    philosophy: 'rls_bypass_controlled_access'
  });

  // Validate request method
  if (req.method !== "POST") {
    return jsonResponse({
      error: "Method not allowed"
    }, 405);
  }

  try {
    // Parse and validate request
    const requestBody = await req.json();
    
    // Add debug log for incoming request
    console.log('📩 scan-match received params:', {
      ...requestBody
    });

    // PHASE A.2: Extract and validate parameters for strict filtering
    const userProfile = {
      sex: requestBody.matching_config?.gender === 'masculine' ? 'male' : 'female',
      estimated_bmi: requestBody.extracted_data?.estimated_bmi,
      semantic_profile: {
        obesity: requestBody.semantic_profile?.obesity,
        muscularity: requestBody.semantic_profile?.muscularity,
        level: requestBody.semantic_profile?.level,
        morphotype: requestBody.semantic_profile?.morphotype
      },
      morph_index: requestBody.user_semantic_indices?.morph_index,
      muscle_index: requestBody.user_semantic_indices?.muscle_index
    };

    const limit = requestBody.matching_config?.limit || 5;

    console.log('📥 [scan-match] PHASE A.2: Enhanced archetype selection parameters', {
      userProfile,
      limit,
      philosophy: 'strict_filtering_zero_muscular_mismatch'
    });

    // Validate required fields
    if (!userProfile.sex || 
        typeof userProfile.morph_index !== 'number' || 
        typeof userProfile.muscle_index !== 'number' || 
        typeof userProfile.estimated_bmi !== 'number') {
      return jsonResponse({
        error: "Missing required fields: sex, morph_index, muscle_index, estimated_bmi",
        received: userProfile
      }, 400);
    }

    // PHASE A.2: Use new strict archetype selector
    console.log('🔍 [scan-match] PHASE A.2: Calling strict archetype selector');
    const { selectedArchetypes, strategyUsed, semanticCoherenceScore, filteringStats } = await selectClosestArchetypes(supabase, userProfile, limit);

    console.log('📊 [scan-match] PHASE A.2: COMPREHENSIVE FILTERING AUDIT', {
      filteringStats,
      userProfile: {
        userBMI: userProfile.estimated_bmi,
        obesity: userProfile.semantic_profile.obesity,
        muscularity: userProfile.semantic_profile.muscularity,
        level: userProfile.semantic_profile.level,
        morphotype: userProfile.semantic_profile.morphotype
      },
      philosophy: 'comprehensive_filtering_audit'
    });

    console.log('✅ [scan-match] PHASE A.2: AUDIT - Archetype selection completed', {
      userProfile: {
        userBMI: userProfile.estimated_bmi,
        obesity: userProfile.semantic_profile.obesity,
        muscularity: userProfile.semantic_profile.muscularity,
        level: userProfile.semantic_profile.level,
        morphotype: userProfile.semantic_profile.morphotype
      },
      selectedArchetypesCount: selectedArchetypes.length,
      strategyUsed,
      semanticCoherenceScore: semanticCoherenceScore.toFixed(3),
      filteringStats,
      selectedArchetypesDetails: selectedArchetypes.map(arch => ({
        id: arch.id,
        name: arch.name,
        bmiRange: arch.bmi_range,
        obesity: arch.obesity,
        muscularity: arch.muscularity,
        morphotype: arch.morphotype,
        distance: arch.distance?.toFixed(3),
        bmiCompatible: arch.semantic_compatibility?.bmi_in_range
      })),
      bmiFilteringAnalysis: {
        userBMI: userProfile.estimated_bmi,
        bmiRelaxationApplied: filteringStats.bmiRelaxationApplied,
        totalArchetypesEvaluated: filteringStats.totalArchetypes,
        afterBMIFilter: filteringStats.afterBMIFilter,
        rejectedByBMI: filteringStats.totalArchetypes - filteringStats.afterBMIFilter
      },
      philosophy: 'zero_muscular_mismatch_enforced'
    });

    if (!selectedArchetypes || selectedArchetypes.length === 0) {
      console.error('❌ [scan-match] CRITICAL: No archetypes selected after all filtering steps', {
        userProfile: {
          userBMI: userProfile.estimated_bmi,
          obesity: userProfile.semantic_profile.obesity,
          muscularity: userProfile.semantic_profile.muscularity,
          morphotype: userProfile.semantic_profile.morphotype
        },
        filteringStats,
        possibleCauses: [
          'BMI too extreme for available archetypes',
          'Semantic classification mismatch',
          'Muscular gating too restrictive',
          'Database archetype coverage insufficient'
        ],
        recommendations: [
          'Check database for archetypes with BMI range covering ' + userProfile.estimated_bmi,
          'Verify semantic classifications are valid',
          'Consider expanding archetype database for extreme BMI cases'
        ],
        philosophy: 'critical_failure_analysis'
      });

      return jsonResponse({
        error: "No suitable archetypes found after all filtering steps",
        debug: {
          userProfile,
          filteringStats
        }
      }, 422);
    }

    // FIXED: Get morphology mapping directly (self-sufficient approach)
    console.log('🔍 [scan-match] PHASE A.3: Getting morphology mapping directly from database');
    const mappingResult = await getMorphologyMappingDirect(supabase);

    if (!mappingResult.success) {
      console.error('❌ [scan-match] PHASE A.3: Failed to get morphology mapping', {
        error: mappingResult.error,
        fallbackUsed: mappingResult.fallback_used,
        philosophy: 'mapping_fetch_failed'
      });
      return jsonResponse({
        error: "Failed to retrieve morphology mapping for envelope building",
        details: mappingResult.error,
        fallback_attempted: mappingResult.fallback_used
      }, 500);
    }

    const mappingData = mappingResult.data;
    const mappingMetadata = mappingResult.metadata;

    // Log mapping source for audit trail
    console.log('🔍 [scan-match] PHASE A.3: Morphology mapping source audit', {
      mapping_source: mappingMetadata.mapping_source,
      fallback_used: mappingMetadata.fallback_used,
      fallback_reason: mappingMetadata.fallback_reason,
      checksum: mappingMetadata.checksum,
      degraded_mode: mappingMetadata.fallback_used,
      archetypes_analyzed: mappingMetadata.total_archetypes_analyzed,
      philosophy: 'mapping_source_telemetry'
    });

    // Surface degraded mode in logs if fallback is used
    if (mappingMetadata.fallback_used) {
      console.warn('⚠️ [scan-match] DEGRADED MODE: Using fallback mapping data', {
        fallback_reason: mappingMetadata.fallback_reason,
        impact: 'reduced_archetype_precision',
        recommendation: 'check_database_connectivity',
        philosophy: 'degraded_mode_telemetry'
      });
    }

    const genderMapping = userProfile.sex === 'male' ? mappingResult.data.mapping_masculine : mappingResult.data.mapping_feminine;
    const traceId = `envelope_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const k5Envelope = buildK5Envelope(selectedArchetypes, genderMapping, traceId);

    // PHASE A.3: Validate envelope integrity
    const envelopeValidation = validateEnvelopeIntegrity(k5Envelope, traceId);
    if (!envelopeValidation.isValid) {
      console.warn('⚠️ [scan-match] PHASE A.3: Envelope integrity issues detected', {
        issues: envelopeValidation.issues,
        usingCorrectedEnvelope: true,
        philosophy: 'envelope_integrity_correction'
      });
    }

    const finalEnvelope = envelopeValidation.correctedEnvelope || k5Envelope;

    console.log('✅ [scan-match] PHASE A.3: K=5 envelope built successfully', {
      envelopeMetadata: finalEnvelope.envelope_metadata,
      envelopeValid: envelopeValidation.isValid,
      mappingSource: mappingMetadata.mapping_source,
      degradedMode: mappingMetadata.fallback_used,
      philosophy: 'k5_envelope_dynamic_constraints'
    });

    // Build enhanced response with K=5 envelope
    const response = {
      // PHASE A.2: Selected archetypes with strict filtering applied
      selected_archetypes: selectedArchetypes,
      
      // PHASE A.3: K=5 envelope for AI refinement constraints
      k5_envelope: finalEnvelope,
      
      // Enhanced strategy and coherence information
      strategy_used: strategyUsed,
      semantic_coherence_score: semanticCoherenceScore,
      
      // PHASE A.2: Enhanced filtering statistics
      filtering_stats: filteringStats,
      
      // Mapping telemetry for audit trail
      mapping_metadata: mappingMetadata,
      
      // User profile for validation (enhanced)
      user_semantic_profile: {
        morph_index: userProfile.morph_index,
        muscle_index: userProfile.muscle_index,
        estimated_bmi: userProfile.estimated_bmi,
        obesity: userProfile.semantic_profile.obesity,
        muscularity: userProfile.semantic_profile.muscularity,
        level: userProfile.semantic_profile.level,
        morphotype: userProfile.semantic_profile.morphotype,
        sex: userProfile.sex
      },
      
      // PHASE A.2/A.3: Enhanced debug information
      debug_phase_a: {
        processing_time_ms: performance.now() - processingStartTime,
        selection_strategy: strategyUsed,
        muscular_gating_applied: true,
        bmi_filtering_applied: true,
        semantic_filtering_applied: true,
        k5_envelope_built: true,
        envelope_integrity_validated: envelopeValidation.isValid,
        zero_muscular_mismatch_enforced: true,
        filtering_stats: filteringStats,
        envelope_metadata: finalEnvelope.envelope_metadata,
        mapping_source: mappingMetadata.mapping_source,
        degraded_mode: mappingMetadata.fallback_used,
        philosophy: 'phase_a_strict_filtering_and_envelope_building'
      },
      
      // Legacy compatibility for existing client code
      advanced_matching: {
        matches: selectedArchetypes,
        blending: {
          method: 'client_side_k5_envelope_constrained_blending',
          requires_client_processing: true,
          archetypes_count: selectedArchetypes.length,
          semantic_coherence_score: semanticCoherenceScore,
          k5_envelope_available: true
        },
        diagnostics: {
          candidates_evaluated: filteringStats.totalArchetypes,
          filtering_applied: [
            'strict_gender',
            'muscular_gating',
            'bmi_range',
            'semantic_exact'
          ],
          selection_method: 'strict_filtering_with_k5_envelope',
          semantic_columns_used: [
            'obesity',
            'muscularity',
            'level',
            'morphotype'
          ],
          distance_function_used: 'weighted_morph_muscle_indices',
          client_blending_required: true,
          envelope_constraints_applied: true
        }
      }
    };

    const processingTime = performance.now() - processingStartTime;

    console.log('🎉 [scan-match] PHASE A.2/A.3: Enhanced pipeline completed successfully', {
      processingTimeMs: processingTime.toFixed(2),
      primaryArchetypeId: selectedArchetypes[0]?.id,
      primaryArchetypeName: selectedArchetypes[0]?.name,
      primaryArchetypeMuscularity: selectedArchetypes[0]?.muscularity,
      selectedArchetypesCount: response.selected_archetypes.length,
      strategyUsed: response.strategy_used,
      semanticCoherenceScore: semanticCoherenceScore.toFixed(3),
      k5EnvelopeBuilt: true,
      muscularGatingEnforced: true,
      zeroMuscularMismatchAchieved: true,
      philosophy: 'phase_a_complete_zero_muscular_mismatch'
    });

    return jsonResponse(response);

  } catch (error) {
    const processingTime = performance.now() - processingStartTime;
    console.error('❌ [scan-match] PHASE A.2/A.3: Enhanced archetype selection failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      processingTime: processingTime.toFixed(2),
      philosophy: 'comprehensive_error_analysis'
    });

    // Determine if this is a logical failure (422) or server error (500)
    const isLogicalFailure = error instanceof Error && (
      error.message.includes('No suitable archetypes found') ||
      error.message.includes('No archetypes found for') ||
      error.message.includes('archetype coverage insufficient')
    );

    const statusCode = isLogicalFailure ? 422 : 500;
    const errorType = isLogicalFailure ? 'logical_failure' : 'server_error';

    console.log(`🔍 [scan-match] Error classification: ${errorType}`, {
      isLogicalFailure,
      statusCode,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      philosophy: 'error_classification_for_proper_response'
    });

    // PHASE A.2: Return appropriate response based on error type
    const fallbackResponse = {
      selected_archetypes: [],
      k5_envelope: null,
      strategy_used: isLogicalFailure ? 'logical_failure_no_suitable_archetypes' : 'server_error_fallback',
      semantic_coherence_score: 0,
      filtering_stats: {
        totalArchetypes: 0,
        afterGenderFilter: 0,
        afterMuscularGating: 0,
        afterBMIFilter: 0,
        afterMorphotypeFilter: 0,
        afterSemanticFilter: 0,
        finalSelected: 0
      },
      user_semantic_profile: {
        morph_index: userProfile?.morph_index || 0,
        muscle_index: userProfile?.muscle_index || 0,
        estimated_bmi: userProfile?.estimated_bmi || 25,
        obesity: userProfile?.semantic_profile?.obesity || 'Non obèse',
        muscularity: userProfile?.semantic_profile?.muscularity || 'Normal',
        level: userProfile?.semantic_profile?.level || 'Normal',
        morphotype: userProfile?.semantic_profile?.morphotype || 'REC',
        sex: userProfile?.sex || 'male'
      },
      debug_phase_a: {
        processing_time_ms: processingTime,
        selection_strategy: isLogicalFailure ? 'logical_failure_documented' : 'server_error_fallback',
        error_type: errorType,
        error_occurred: true,
        error_message: error instanceof Error ? error.message : "Unknown error",
        philosophy: isLogicalFailure ? 'logical_failure_documented_response' : 'server_error_fallback'
      },
      advanced_matching: {
        matches: [],
        blending: {
          method: isLogicalFailure ? 'logical_failure_no_archetypes' : 'server_error_fallback',
          requires_client_processing: false,
          archetypes_count: 0,
          semantic_coherence_score: 0,
          k5_envelope_available: false
        },
        diagnostics: {
          candidates_evaluated: 0,
          filtering_applied: [isLogicalFailure ? 'logical_failure' : 'server_error'],
          selection_method: isLogicalFailure ? 'logical_failure_documented' : 'server_error_fallback',
          semantic_columns_used: [],
          distance_function_used: 'none',
          client_blending_required: false,
          envelope_constraints_applied: false
        }
      }
    };

    console.log(`🔧 [scan-match] PHASE A.2/A.3: Returning ${errorType} response`, {
      fallbackResponseKeys: Object.keys(fallbackResponse),
      selectedArchetypesLength: fallbackResponse.selected_archetypes.length,
      processingTime: processingTime.toFixed(2),
      philosophy: 'phase_a_resilient_fallback'
    });

    return jsonResponse({
      ...fallbackResponse,
      error: "PHASE A.2/A.3: Internal server error - fallback response provided",
      details: error instanceof Error ? error.message : "Unknown error"
    }, 500);
  }
});