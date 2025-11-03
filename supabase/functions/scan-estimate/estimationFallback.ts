/**
 * Estimation Fallback
 * Creates fallback estimation when OpenAI Vision fails
 */ /**
 * Create fallback estimation when OpenAI Vision fails
 */ export async function createFallbackEstimation(userMetrics) {
  const heightM = userMetrics.height_cm / 100;
  const bmi = userMetrics.weight_kg / (heightM * heightM);
  const { fallbackStrategy } = userMetrics;
  console.log('🔍 [estimationFallback] Creating fallback with BMI', {
    height_cm: userMetrics.height_cm,
    weight_kg: userMetrics.weight_kg,
    bmi: bmi.toFixed(2),
    gender: userMetrics.gender,
    fallbackStrategy: fallbackStrategy?.type,
    hasMorphologyMapping: !!fallbackStrategy?.morphologyMapping
  });
  // Apply fallback strategy
  let measurements;
  let confidence = {
    vision: 0.3,
    fit: 0.4
  };
  switch(fallbackStrategy?.type){
    case 'last_scan':
      measurements = interpolateFromLastScan(userMetrics, fallbackStrategy.data, bmi);
      confidence = {
        vision: 0.5,
        fit: 0.6
      }; // Higher confidence with historical data
      break;
    case 'default_archetype':
      measurements = interpolateFromArchetype(userMetrics, fallbackStrategy.data, bmi, fallbackStrategy.morphologyMapping);
      confidence = {
        vision: 0.4,
        fit: 0.5
      }; // Moderate confidence with archetype
      break;
    default:
      measurements = calculateFallbackMeasurements(userMetrics, bmi, fallbackStrategy?.morphologyMapping);
      confidence = {
        vision: 0.3,
        fit: 0.4
      }; // Low confidence with heuristics
  }
  // Generate plausible fallback keypoints (normalized coordinates)
  const fallbackKeypoints = {
    front: [
      [
        0.5,
        0.15,
        0.8
      ],
      [
        0.3,
        0.25,
        0.7
      ],
      [
        0.7,
        0.25,
        0.7
      ],
      [
        0.5,
        0.45,
        0.8
      ],
      [
        0.4,
        0.55,
        0.7
      ],
      [
        0.6,
        0.55,
        0.7
      ],
      [
        0.5,
        0.9,
        0.6
      ]
    ],
    profile: [
      [
        0.5,
        0.15,
        0.8
      ],
      [
        0.5,
        0.25,
        0.7
      ],
      [
        0.5,
        0.45,
        0.8
      ],
      [
        0.5,
        0.55,
        0.7
      ],
      [
        0.5,
        0.9,
        0.6
      ]
    ]
  };
  // Use fallback scale from photo reports if available
  const fallbackPixelPerCm = userMetrics.frontReport.scale?.pixel_per_cm_estimate || userMetrics.profileReport.scale?.pixel_per_cm_estimate || userMetrics.frontReport.image?.height / userMetrics.height_cm * 0.8;
  console.log('🔍 [estimationFallback] Calculated measurements', {
    finalMeasurements: measurements,
    bmi: bmi.toFixed(2),
    gender: userMetrics.gender
  });
  return {
    keypoints: fallbackKeypoints,
    measurements: measurements,
    confidence,
    quality_assessment: {
      photo_quality: Math.max(userMetrics.frontReport.quality?.blur_score || 0.5, userMetrics.profileReport.quality?.blur_score || 0.5),
      pose_quality: 0.5 // Moderate fallback
    },
    scale_method: "fallback_estimation",
    pixel_per_cm: fallbackPixelPerCm,
    processing_notes: [
      `Fallback estimation applied: ${fallbackStrategy?.type || 'bmi_heuristic'}`
    ]
  };
}
/**
 * Interpolate measurements from last scan
 */ function interpolateFromLastScan(userMetrics, lastScanData, currentBMI) {
  const lastMeasurements = lastScanData.raw_measurements;
  const lastBMI = lastScanData.estimated_bmi || 22;
  // Calculate BMI adjustment factor
  const bmiAdjustment = currentBMI / lastBMI;
  return {
    waist_cm: lastMeasurements.waist_cm * bmiAdjustment,
    chest_cm: lastMeasurements.chest_cm * Math.sqrt(bmiAdjustment),
    hips_cm: lastMeasurements.hips_cm * bmiAdjustment,
    height_cm: userMetrics.height_cm,
    weight_kg: userMetrics.weight_kg,
    estimated_body_fat_perc: Math.max(8, Math.min(35, lastMeasurements.estimated_body_fat_perc * bmiAdjustment)),
    estimated_muscle_mass_kg: userMetrics.weight_kg * 0.4
  };
}
/**
 * Interpolate measurements from default archetype
 */ function interpolateFromArchetype(userMetrics, archetype, currentBMI, morphologyMapping) {
  // Use archetype as base and adjust for user's BMI
  const archetypeBMI = (parseFloat(archetype.bmi_range[0]) + parseFloat(archetype.bmi_range[1])) / 2;
  const bmiAdjustment = currentBMI / archetypeBMI;
  // Base measurements using DB ranges if available
  let baseMeasurements;
  if (morphologyMapping) {
    const genderMapping = userMetrics.gender === 'feminine' ? morphologyMapping?.mapping_feminine : morphologyMapping?.mapping_masculine;
    // Use DB height and weight ranges for more accurate base measurements
    if (genderMapping?.height_range && genderMapping?.weight_range) {
      const avgHeight = (genderMapping.height_range.min + genderMapping.height_range.max) / 2;
      const avgWeight = (genderMapping.weight_range.min + genderMapping.weight_range.max) / 2;
      const avgBMI = avgWeight / Math.pow(avgHeight / 100, 2);
      baseMeasurements = userMetrics.gender === 'feminine' ? {
        waist: 70 * (avgBMI / 22),
        chest: 88 * (avgBMI / 22),
        hips: 95 * (avgBMI / 22)
      } : {
        waist: 85 * (avgBMI / 22),
        chest: 100 * (avgBMI / 22),
        hips: 95 * (avgBMI / 22)
      };
      console.log('🔍 [estimationFallback] Using DB-informed base measurements', {
        avgHeight,
        avgWeight,
        avgBMI: avgBMI.toFixed(2),
        baseMeasurements
      });
    } else {
      // Fallback to hardcoded values if DB data is incomplete
      baseMeasurements = userMetrics.gender === 'feminine' ? {
        waist: 75,
        chest: 90,
        hips: 95
      } : {
        waist: 85,
        chest: 100,
        hips: 95
      };
    }
  } else {
    // Fallback to hardcoded values
    baseMeasurements = userMetrics.gender === 'feminine' ? {
      waist: 75,
      chest: 90,
      hips: 95
    } : {
      waist: 85,
      chest: 100,
      hips: 95
    };
  }
  return {
    waist_cm: baseMeasurements.waist * bmiAdjustment,
    chest_cm: baseMeasurements.chest * Math.sqrt(bmiAdjustment),
    hips_cm: baseMeasurements.hips * bmiAdjustment,
    height_cm: userMetrics.height_cm,
    weight_kg: userMetrics.weight_kg,
    estimated_body_fat_perc: Math.max(8, Math.min(35, 15 + (currentBMI - 22) * 1.5)),
    estimated_muscle_mass_kg: userMetrics.weight_kg * 0.4
  };
}
/**
 * Calculate fallback measurements when OpenAI fails or data is incomplete
 */ function calculateFallbackMeasurements(userMetrics, bmi, morphologyMapping) {
  let baseMeasurements;
  if (morphologyMapping) {
    const genderMapping = userMetrics.gender === 'feminine' ? morphologyMapping?.mapping_feminine : morphologyMapping?.mapping_masculine;
    // Use DB ranges for more accurate fallback
    if (genderMapping?.height_range && genderMapping?.weight_range) {
      const avgHeight = (genderMapping.height_range.min + genderMapping.height_range.max) / 2;
      const avgWeight = (genderMapping.weight_range.min + genderMapping.weight_range.max) / 2;
      const avgBMI = avgWeight / Math.pow(avgHeight / 100, 2);
      baseMeasurements = userMetrics.gender === 'feminine' ? {
        waist: 70 * (avgBMI / 22),
        chest: 88 * (avgBMI / 22),
        hips: 95 * (avgBMI / 22)
      } : {
        waist: 85 * (avgBMI / 22),
        chest: 100 * (avgBMI / 22),
        hips: 95 * (avgBMI / 22)
      };
      console.log('🔍 [estimationFallback] Using DB-informed fallback measurements', {
        avgHeight,
        avgWeight,
        avgBMI: avgBMI.toFixed(2),
        baseMeasurements
      });
    } else {
      // Fallback to hardcoded values if DB data is incomplete
      baseMeasurements = userMetrics.gender === 'feminine' ? {
        waist: 70,
        chest: 88,
        hips: 95
      } : {
        waist: 85,
        chest: 100,
        hips: 95
      };
    }
  } else {
    // Base measurements for average BMI (22), then adjust for actual BMI
    baseMeasurements = userMetrics.gender === 'feminine' ? {
      waist: 70,
      chest: 88,
      hips: 95
    } : {
      waist: 85,
      chest: 100,
      hips: 95
    };
  }
  // BMI adjustment factor (more conservative)
  const bmiAdjustment = Math.max(0.8, Math.min(1.3, bmi / 22));
  const measurements = {
    waist_cm: baseMeasurements.waist * bmiAdjustment,
    chest_cm: baseMeasurements.chest * bmiAdjustment,
    hips_cm: Math.max(baseMeasurements.waist * bmiAdjustment + 5, baseMeasurements.hips * bmiAdjustment),
    height_cm: userMetrics.height_cm,
    weight_kg: userMetrics.weight_kg,
    estimated_body_fat_perc: Math.max(8, Math.min(35, 15 + (bmi - 22) * 1.5)),
    estimated_muscle_mass_kg: userMetrics.weight_kg * (0.4 + Math.max(0, (25 - bmi) / 20) * 0.2)
  };
  return measurements;
}
