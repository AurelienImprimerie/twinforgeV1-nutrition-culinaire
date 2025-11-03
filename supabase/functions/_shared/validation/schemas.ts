/**
 * Validation Schemas - Définition des contraintes
 *
 * RÈGLE CRITIQUE: Ce fichier définit UNIQUEMENT les contraintes sur les INPUTS utilisateur.
 * NE JAMAIS valider les outputs des AI agents.
 */

export const ValidationRules = {
  // User ID validation
  userId: {
    pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    errorMessage: 'Invalid user ID format (expected UUID v4)'
  },

  // Image validation
  image: {
    maxSizeBytes: 20 * 1024 * 1024, // 20 MB
    allowedFormats: ['jpeg', 'jpg', 'png', 'webp'],
    base64Pattern: /^data:image\/(jpeg|jpg|png|webp);base64,/,
    errorMessage: 'Invalid image format or size'
  },

  // Text input validation
  text: {
    maxLengths: {
      short: 200,        // Names, labels
      medium: 2000,      // Descriptions
      long: 5000,        // Transcriptions
      extraLong: 10000   // Chat messages
    },
    errorMessage: 'Text exceeds maximum length'
  },

  // Numeric ranges (physiological bounds)
  ranges: {
    weight_kg: { min: 20, max: 300 },
    height_cm: { min: 100, max: 250 },
    age_years: { min: 13, max: 120 },
    bmi: { min: 10, max: 60 },
    temperature_c: { min: 35, max: 42 },
    heart_rate_bpm: { min: 30, max: 220 },
    blood_pressure_systolic: { min: 60, max: 250 },
    blood_pressure_diastolic: { min: 40, max: 150 },
    oxygen_saturation: { min: 70, max: 100 },
    duration_minutes: { min: 1, max: 1440 }, // Max 24h
    intensity: { min: 1, max: 10 },
    morph_value: { min: 0, max: 1 }, // Morphology values are 0-1
    limb_mass_kg: { min: 0.1, max: 100 }
  },

  // Barcode validation
  barcode: {
    pattern: /^[0-9]{8,13}$/,
    errorMessage: 'Invalid barcode format'
  },

  // Timestamp validation
  timestamp: {
    pattern: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/,
    errorMessage: 'Invalid ISO 8601 timestamp'
  },

  // URL validation (for image URLs)
  url: {
    pattern: /^https?:\/\/.+/,
    maxLength: 2048,
    errorMessage: 'Invalid URL format'
  }
};

export type ValidationRule = keyof typeof ValidationRules;
