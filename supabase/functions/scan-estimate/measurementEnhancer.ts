/**
 * Measurement Enhancer - FIXED
 * Validates measurements from vision analysis and only applies fallbacks when truly needed
 * CRITICAL FIX: No longer artificially inflates measurements or degrades accurate AI values
 */
export function enhanceMeasurements(visionAnalysis, userMetrics) {
  const processingNotes = visionAnalysis.processing_notes || [];

  // Enhanced scale handling with fallbacks
  let finalPixelPerCm = visionAnalysis.pixel_per_cm;
  let scaleMethod = visionAnalysis.scale_method;

  if (!finalPixelPerCm || !isFinite(finalPixelPerCm) || finalPixelPerCm <= 0) {
    // Fallback: estimate from user height and image dimensions
    const estimatedBodyHeightPixels = 1000 * 0.8; // Assume body takes 80% of 1000px image height
    finalPixelPerCm = estimatedBodyHeightPixels / userMetrics.height_cm;
    scaleMethod = 'user_height_fallback';
    processingNotes.push(`Scale fallback applied: ${finalPixelPerCm.toFixed(2)} px/cm`);

    console.log('🔍 [measurementEnhancer] Applied scale fallback', {
      originalScale: visionAnalysis.pixel_per_cm,
      fallbackScale: finalPixelPerCm,
      method: scaleMethod,
      userHeight: userMetrics.height_cm
    });
  }

  // CRITICAL FIX: Check if AI Vision provided high-quality measurements
  const aiConfidence = visionAnalysis.confidence?.vision || 0;
  const hasMeasurements = visionAnalysis.measurements && typeof visionAnalysis.measurements === 'object';
  const hasWaist = hasMeasurements && typeof visionAnalysis.measurements.waist_cm === 'number';
  const hasHips = hasMeasurements && typeof visionAnalysis.measurements.hips_cm === 'number';
  const hasChest = hasMeasurements && typeof visionAnalysis.measurements.chest_cm === 'number';
  const hasBodyFat = hasMeasurements && typeof visionAnalysis.measurements.estimated_body_fat_perc === 'number';
  const hasMuscleMass = hasMeasurements && typeof visionAnalysis.measurements.estimated_muscle_mass_kg === 'number';

  // CRITICAL FIX: If AI confidence is high (>0.8) and measurements exist, TRUST THEM
  const trustAIMeasurements = aiConfidence >= 0.8 && hasMeasurements;

  if (trustAIMeasurements) {
    console.log('✅ [measurementEnhancer] HIGH CONFIDENCE AI measurements - using raw values without degradation', {
      aiConfidence: aiConfidence.toFixed(3),
      waist_cm: visionAnalysis.measurements.waist_cm?.toFixed(1),
      hips_cm: visionAnalysis.measurements.hips_cm?.toFixed(1),
      chest_cm: visionAnalysis.measurements.chest_cm?.toFixed(1),
      body_fat_perc: visionAnalysis.measurements.estimated_body_fat_perc?.toFixed(1),
      muscle_mass_kg: visionAnalysis.measurements.estimated_muscle_mass_kg?.toFixed(1),
      philosophy: 'trust_high_confidence_ai_no_enhancement'
    });
  }

  // Use AI measurements if available and trusted, otherwise apply smart fallbacks
  const enhancedMeasurements = {
    ...visionAnalysis.measurements || {},
    waist_cm: hasWaist ? visionAnalysis.measurements.waist_cm : calculateFallbackWaist(userMetrics),
    hips_cm: hasHips ? visionAnalysis.measurements.hips_cm : calculateFallbackHips(userMetrics),
    chest_cm: hasChest ? visionAnalysis.measurements.chest_cm : calculateFallbackChest(userMetrics),
    height_cm: visionAnalysis.measurements?.height_cm || userMetrics.height_cm,
    weight_kg: visionAnalysis.measurements?.weight_kg || userMetrics.weight_kg,
    estimated_body_fat_perc: hasBodyFat ? visionAnalysis.measurements.estimated_body_fat_perc : calculateFallbackBodyFat(userMetrics),
    estimated_muscle_mass_kg: hasMuscleMass ? visionAnalysis.measurements.estimated_muscle_mass_kg : calculateFallbackMuscleMass(userMetrics)
  };

  // CRITICAL FIX: Only validate anatomical consistency if confidence is LOW or measurements missing
  // High-confidence AI measurements should NOT be "corrected"
  if (!trustAIMeasurements) {
    // Validate measurements consistency only for low-confidence or fallback measurements
    if (enhancedMeasurements.hips_cm < enhancedMeasurements.waist_cm) {
      enhancedMeasurements.hips_cm = enhancedMeasurements.waist_cm + 5;
      processingNotes.push('Corrected hips measurement (anatomical consistency - low AI confidence)');
    }

    if (enhancedMeasurements.chest_cm < enhancedMeasurements.waist_cm - 20) {
      enhancedMeasurements.chest_cm = enhancedMeasurements.waist_cm - 10;
      processingNotes.push('Corrected chest measurement (anatomical consistency - low AI confidence)');
    }
  } else {
    processingNotes.push('High-confidence AI measurements - no enhancement applied');
  }

  // CRITICAL FIX: Validate that enhancement didn't DEGRADE measurements
  if (trustAIMeasurements && hasMeasurements) {
    const originalWaist = visionAnalysis.measurements.waist_cm;
    const originalHips = visionAnalysis.measurements.hips_cm;
    const originalBodyFat = visionAnalysis.measurements.estimated_body_fat_perc;

    const waistIncrease = enhancedMeasurements.waist_cm - originalWaist;
    const hipsIncrease = enhancedMeasurements.hips_cm - originalHips;
    const bodyFatIncrease = enhancedMeasurements.estimated_body_fat_perc - originalBodyFat;

    // If enhancement INCREASED measurements by more than 10%, REJECT IT
    if (Math.abs(waistIncrease) > originalWaist * 0.10 ||
        Math.abs(hipsIncrease) > originalHips * 0.10 ||
        Math.abs(bodyFatIncrease) > originalBodyFat * 0.20) {
      console.warn('⚠️ [measurementEnhancer] ENHANCEMENT REJECTED - degradation detected', {
        waistIncrease: waistIncrease.toFixed(1),
        hipsIncrease: hipsIncrease.toFixed(1),
        bodyFatIncrease: bodyFatIncrease.toFixed(1),
        philosophy: 'reject_degrading_enhancement'
      });

      // REVERT to original AI measurements
      enhancedMeasurements.waist_cm = originalWaist;
      enhancedMeasurements.hips_cm = originalHips;
      enhancedMeasurements.estimated_body_fat_perc = originalBodyFat;
      processingNotes.push('Enhancement rejected - original AI measurements preserved');
    }
  }

  // Update vision analysis with enhanced data
  visionAnalysis.measurements = enhancedMeasurements;
  visionAnalysis.pixel_per_cm = finalPixelPerCm;
  visionAnalysis.scale_method = scaleMethod;
  visionAnalysis.processing_notes = processingNotes;

  return enhancedMeasurements;
}

/**
 * Calculate fallback measurements based on BMI and gender
 * These are only used when AI Vision fails to provide measurements
 */
function calculateFallbackWaist(userMetrics) {
  const bmi = userMetrics.weight_kg / Math.pow(userMetrics.height_cm / 100, 2);
  const baseWaist = userMetrics.gender === 'feminine' ? 70 : 85;

  // IMPROVED: More conservative BMI adjustment (no artificial inflation)
  const bmiAdjustment = Math.max(0.85, Math.min(1.15, bmi / 22));
  return baseWaist * bmiAdjustment;
}

function calculateFallbackChest(userMetrics) {
  const bmi = userMetrics.weight_kg / Math.pow(userMetrics.height_cm / 100, 2);
  const baseChest = userMetrics.gender === 'feminine' ? 88 : 100;

  // IMPROVED: More conservative BMI adjustment
  const bmiAdjustment = Math.max(0.85, Math.min(1.15, bmi / 22));
  return baseChest * bmiAdjustment;
}

function calculateFallbackHips(userMetrics) {
  const bmi = userMetrics.weight_kg / Math.pow(userMetrics.height_cm / 100, 2);
  const baseHips = 95;

  // IMPROVED: More conservative BMI adjustment
  const bmiAdjustment = Math.max(0.85, Math.min(1.15, bmi / 22));
  const waist = calculateFallbackWaist(userMetrics);
  return Math.max(waist + 5, baseHips * bmiAdjustment);
}

function calculateFallbackBodyFat(userMetrics) {
  const bmi = userMetrics.weight_kg / Math.pow(userMetrics.height_cm / 100, 2);

  // IMPROVED: More realistic body fat estimation
  // BMI 22 = ~15% body fat, BMI 25 = ~18%, BMI 30 = ~25%
  return Math.max(8, Math.min(35, 12 + (bmi - 22) * 1.2));
}

function calculateFallbackMuscleMass(userMetrics) {
  const bmi = userMetrics.weight_kg / Math.pow(userMetrics.height_cm / 100, 2);

  // IMPROVED: More realistic muscle mass estimation
  // Higher BMI doesn't automatically mean less muscle (could be athletic)
  const baseMusclePercentage = 0.40; // 40% of body weight is muscle (average)
  const bmiBonus = Math.max(0, (bmi - 22) / 40) * 0.05; // Small bonus for higher BMI
  return userMetrics.weight_kg * (baseMusclePercentage + bmiBonus);
}
