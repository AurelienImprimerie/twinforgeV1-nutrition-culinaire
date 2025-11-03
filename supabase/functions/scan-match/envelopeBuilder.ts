/**
 * K=5 Envelope Builder - PHASE A.3 Implementation
 * Builds dynamic morphological constraints from selected archetypes
 */ /**
 * Build K=5 envelope from selected archetypes with DB fallback
 */ export function buildK5Envelope(selectedArchetypes, genderMapping, traceId) {
  console.log(`🔍 [envelopeBuilder] [${traceId}] PHASE A.3: Building K=5 envelope`, {
    archetypesCount: selectedArchetypes.length,
    archetypeIds: selectedArchetypes.map((a)=>a.id),
    genderMappingMorphKeys: Object.keys(genderMapping.morph_values).length,
    genderMappingLimbKeys: Object.keys(genderMapping.limb_masses).length,
    philosophy: 'k5_envelope_dynamic_constraints'
  });
  const shape_params_envelope = {};
  const limb_masses_envelope = {};
  let keys_with_archetype_data = 0;
  let keys_using_db_fallback = 0;
  // Process shape parameters
  console.log(`🔍 [envelopeBuilder] [${traceId}] Processing shape parameters for envelope`);
  Object.keys(genderMapping.morph_values).forEach((morphKey)=>{
    const dbRange = genderMapping.morph_values[morphKey];
    // Collect values from archetypes
    const archetypeValues = [];
    selectedArchetypes.forEach((archetype)=>{
      let morphValues;
      try {
        morphValues = typeof archetype.morph_values === 'string' ? JSON.parse(archetype.morph_values) : archetype.morph_values;
      } catch (error) {
        console.warn(`Failed to parse morph_values for archetype ${archetype.id}`);
        return;
      }
      if (morphValues && typeof morphValues[morphKey] === 'number') {
        archetypeValues.push(morphValues[morphKey]);
      }
    });
    if (archetypeValues.length >= 2) {
      // Use archetype data for envelope
      const archetypeMin = Math.min(...archetypeValues);
      const archetypeMax = Math.max(...archetypeValues);
      // Expand envelope slightly for AI flexibility (10% margin)
      const margin = (archetypeMax - archetypeMin) * 0.1;
      const envelopeMin = Math.max(dbRange.min, archetypeMin - margin);
      const envelopeMax = Math.min(dbRange.max, archetypeMax + margin);
      shape_params_envelope[morphKey] = {
        min: envelopeMin,
        max: envelopeMax,
        archetype_min: archetypeMin,
        archetype_max: archetypeMax,
        source: 'archetypes'
      };
      keys_with_archetype_data++;
      console.log(`✅ [envelopeBuilder] [${traceId}] Shape param envelope from archetypes`, {
        morphKey,
        archetypeValues: archetypeValues.map((v)=>v.toFixed(3)),
        archetypeRange: [
          archetypeMin.toFixed(3),
          archetypeMax.toFixed(3)
        ],
        envelopeRange: [
          envelopeMin.toFixed(3),
          envelopeMax.toFixed(3)
        ],
        dbRange: [
          dbRange.min.toFixed(3),
          dbRange.max.toFixed(3)
        ],
        margin: margin.toFixed(3)
      });
    } else {
      // Use DB range as fallback
      shape_params_envelope[morphKey] = {
        min: dbRange.min,
        max: dbRange.max,
        archetype_min: dbRange.min,
        archetype_max: dbRange.max,
        source: 'db_fallback'
      };
      keys_using_db_fallback++;
      console.log(`🔧 [envelopeBuilder] [${traceId}] Shape param envelope from DB fallback`, {
        morphKey,
        archetypeValuesCount: archetypeValues.length,
        dbRange: [
          dbRange.min.toFixed(3),
          dbRange.max.toFixed(3)
        ],
        reason: 'insufficient_archetype_data'
      });
    }
  });
  // Process limb masses
  console.log(`🔍 [envelopeBuilder] [${traceId}] Processing limb masses for envelope`);
  Object.keys(genderMapping.limb_masses).forEach((limbKey)=>{
    const dbRange = genderMapping.limb_masses[limbKey];
    // Collect values from archetypes
    const archetypeValues = [];
    selectedArchetypes.forEach((archetype)=>{
      let limbMasses;
      try {
        limbMasses = typeof archetype.limb_masses === 'string' ? JSON.parse(archetype.limb_masses) : archetype.limb_masses;
      } catch (error) {
        console.warn(`Failed to parse limb_masses for archetype ${archetype.id}`);
        return;
      }
      if (limbMasses && typeof limbMasses[limbKey] === 'number') {
        archetypeValues.push(limbMasses[limbKey]);
      }
    });
    if (archetypeValues.length >= 2) {
      // Use archetype data for envelope
      const archetypeMin = Math.min(...archetypeValues);
      const archetypeMax = Math.max(...archetypeValues);
      // Smaller margin for limb masses (5%)
      const margin = (archetypeMax - archetypeMin) * 0.05;
      const envelopeMin = Math.max(dbRange.min, archetypeMin - margin);
      const envelopeMax = Math.min(dbRange.max, archetypeMax + margin);
      limb_masses_envelope[limbKey] = {
        min: envelopeMin,
        max: envelopeMax,
        archetype_min: archetypeMin,
        archetype_max: archetypeMax,
        source: 'archetypes'
      };
      console.log(`✅ [envelopeBuilder] [${traceId}] Limb mass envelope from archetypes`, {
        limbKey,
        archetypeValues: archetypeValues.map((v)=>v.toFixed(3)),
        archetypeRange: [
          archetypeMin.toFixed(3),
          archetypeMax.toFixed(3)
        ],
        envelopeRange: [
          envelopeMin.toFixed(3),
          envelopeMax.toFixed(3)
        ],
        dbRange: [
          dbRange.min.toFixed(3),
          dbRange.max.toFixed(3)
        ],
        margin: margin.toFixed(3)
      });
    } else {
      // Use DB range as fallback
      limb_masses_envelope[limbKey] = {
        min: dbRange.min,
        max: dbRange.max,
        archetype_min: dbRange.min,
        archetype_max: dbRange.max,
        source: 'db_fallback'
      };
      console.log(`🔧 [envelopeBuilder] [${traceId}] Limb mass envelope from DB fallback`, {
        limbKey,
        archetypeValuesCount: archetypeValues.length,
        dbRange: [
          dbRange.min.toFixed(3),
          dbRange.max.toFixed(3)
        ],
        reason: 'insufficient_archetype_data'
      });
    }
  });
  const envelope = {
    shape_params_envelope,
    limb_masses_envelope,
    envelope_metadata: {
      archetypes_used: selectedArchetypes.map((a)=>a.id),
      total_keys_processed: Object.keys(shape_params_envelope).length + Object.keys(limb_masses_envelope).length,
      keys_with_archetype_data,
      keys_using_db_fallback,
      envelope_generation_timestamp: new Date().toISOString(),
      envelope_version: 'v1.0-phase-a3'
    }
  };
  console.log(`✅ [envelopeBuilder] [${traceId}] PHASE A.3: K=5 envelope built successfully`, {
    shapeParamsKeys: Object.keys(shape_params_envelope).length,
    limbMassesKeys: Object.keys(limb_masses_envelope).length,
    keysWithArchetypeData: keys_with_archetype_data,
    keysUsingDBFallback: keys_using_db_fallback,
    archetypesUsed: selectedArchetypes.map((a)=>a.id),
    philosophy: 'k5_envelope_construction_complete'
  });
  return envelope;
}
/**
 * Validate envelope integrity and apply corrections if needed
 */ export function validateEnvelopeIntegrity(envelope, traceId) {
  console.log(`🔍 [envelopeBuilder] [${traceId}] PHASE A.3: Validating envelope integrity`);
  const issues = [];
  const correctedEnvelope = JSON.parse(JSON.stringify(envelope)); // Deep copy
  let correctionsMade = 0;
  // Validate shape parameters envelope
  Object.entries(envelope.shape_params_envelope).forEach(([key, range])=>{
    if (range.min > range.max) {
      issues.push(`Invalid shape param range: ${key} min > max`);
      correctedEnvelope.shape_params_envelope[key] = {
        ...range,
        min: Math.min(range.min, range.max),
        max: Math.max(range.min, range.max)
      };
      correctionsMade++;
    }
    if (!Number.isFinite(range.min) || !Number.isFinite(range.max)) {
      issues.push(`Non-finite values in shape param range: ${key}`);
      correctedEnvelope.shape_params_envelope[key] = {
        ...range,
        min: Number.isFinite(range.min) ? range.min : -1,
        max: Number.isFinite(range.max) ? range.max : 1
      };
      correctionsMade++;
    }
  });
  // Validate limb masses envelope
  Object.entries(envelope.limb_masses_envelope).forEach(([key, range])=>{
    if (range.min > range.max) {
      issues.push(`Invalid limb mass range: ${key} min > max`);
      correctedEnvelope.limb_masses_envelope[key] = {
        ...range,
        min: Math.min(range.min, range.max),
        max: Math.max(range.min, range.max)
      };
      correctionsMade++;
    }
    if (!Number.isFinite(range.min) || !Number.isFinite(range.max)) {
      issues.push(`Non-finite values in limb mass range: ${key}`);
      correctedEnvelope.limb_masses_envelope[key] = {
        ...range,
        min: Number.isFinite(range.min) ? range.min : 0.8,
        max: Number.isFinite(range.max) ? range.max : 1.2
      };
      correctionsMade++;
    }
  });
  const isValid = issues.length === 0;
  console.log(`${isValid ? '✅' : '⚠️'} [envelopeBuilder] [${traceId}] PHASE A.3: Envelope integrity validation`, {
    isValid,
    issuesCount: issues.length,
    correctionsMade,
    issues: issues.slice(0, 5),
    philosophy: 'envelope_integrity_validation'
  });
  return {
    isValid,
    issues,
    correctedEnvelope: correctionsMade > 0 ? correctedEnvelope : undefined
  };
}
