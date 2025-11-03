/**
 * Shared Fallback Mapping - Local Copy for scan-match
 * Provides hardcoded fallback mapping data when database is empty
 */ /**
 * Hardcoded fallback mapping (Strategy 3)
 * Used when both Edge Function and direct DB query fail
 */ export function getHardcodedMappingFallback() {
  console.warn('🔧 [getHardcodedMappingFallback] Using hardcoded fallback mapping');
  return {
    mapping_masculine: {
      levels: [
        "Émacié",
        "Mince",
        "Normal",
        "Obèse",
        "Obèse morbide",
        "Obèse sévère",
        "Surpoids"
      ],
      obesity: [
        "Non obèse",
        "Obèse",
        "Obésité morbide",
        "Surpoids"
      ],
      morphotypes: [
        "OVA",
        "POI",
        "POM",
        "REC",
        "SAB",
        "TRI"
      ],
      muscularity: [
        "Atrophié sévère",
        "Légèrement atrophié",
        "Moyen musclé",
        "Musclé",
        "Normal costaud"
      ],
      gender_codes: [
        "MAS"
      ],
      bmi_range: {
        min: 15.9,
        max: 48.1
      },
      height_range: {
        min: 164,
        max: 191
      },
      weight_range: {
        min: 50,
        max: 175
      },
      morph_index: {
        min: -0.6,
        max: 2
      },
      muscle_index: {
        min: -0.92,
        max: 1.45
      },
      abdomen_round: {
        min: -0.3,
        max: 1
      },
      morph_values: {
        bigHips: {
          max: 1,
          min: -0.5
        },
        nipples: {
          max: 0,
          min: 0
        },
        assLarge: {
          max: 1.1,
          min: -0.6
        },
        dollBody: {
          max: 0.7,
          min: 0
        },
        pregnant: {
          max: 0,
          min: 0
        },
        animeNeck: {
          max: 0.8,
          min: 0
        },
        emaciated: {
          max: 1.5,
          min: -2.2
        },
        animeWaist: {
          max: 1,
          min: -1
        },
        breastsSag: {
          max: 1.3,
          min: -1
        },
        pearFigure: {
          max: 2,
          min: -0.5
        },
        narrowWaist: {
          max: 0,
          min: -2
        },
        superBreast: {
          max: 0,
          min: -0.5
        },
        breastsSmall: {
          max: 2,
          min: 0
        },
        animeProportion: {
          max: 0,
          min: 0
        },
        bodybuilderSize: {
          max: 1.5,
          min: -0.8
        },
        bodybuilderDetails: {
          max: 2.5,
          min: -1.5
        },
        FaceLowerEyelashLength: {
          max: 1,
          min: 0
        }
      },
      limb_masses: {
        gate: {
          max: 1,
          min: 1
        },
        armMass: {
          max: 1.8,
          min: 0.3
        },
        calfMass: {
          max: 1.75,
          min: 0.3
        },
        neckMass: {
          max: 1.6,
          min: 0.2
        },
        thighMass: {
          max: 1.95,
          min: 0.4
        },
        torsoMass: {
          max: 1.95,
          min: 0.3
        },
        forearmMass: {
          max: 1.6,
          min: 0.2
        }
      }
    },
    mapping_feminine: {
      levels: [
        "Émacié",
        "Normal",
        "Obèse",
        "Obèse morbide",
        "Obèse sévère",
        "Surpoids"
      ],
      obesity: [
        "Non obèse",
        "Obèse",
        "Obésité morbide",
        "Surpoids"
      ],
      morphotypes: [
        "OVA",
        "POI",
        "POM",
        "REC",
        "SAB",
        "TRI"
      ],
      muscularity: [
        "Atrophiée sévère",
        "Moins musclée",
        "Moyennement musclée",
        "Musclée",
        "Normal costaud"
      ],
      gender_codes: [
        "FEM"
      ],
      bmi_range: {
        min: 16.5,
        max: 47
      },
      height_range: {
        min: 158,
        max: 178
      },
      weight_range: {
        min: 43,
        max: 140
      },
      morph_index: {
        min: -0.16,
        max: 1.92
      },
      muscle_index: {
        min: -0.79,
        max: 1.08
      },
      abdomen_round: {
        min: -0.08,
        max: 0.96
      },
      morph_values: {
        bigHips: {
          max: 0.9,
          min: -1
        },
        nipples: {
          max: 0,
          min: 0
        },
        assLarge: {
          max: 1.2,
          min: -0.8
        },
        dollBody: {
          max: 0.6,
          min: 0
        },
        pregnant: {
          max: 0,
          min: 0
        },
        animeNeck: {
          max: 0,
          min: 0
        },
        emaciated: {
          max: 0.3,
          min: -2.3
        },
        animeWaist: {
          max: 0.8,
          min: -0.5
        },
        breastsSag: {
          max: 0.95,
          min: -0.8
        },
        pearFigure: {
          max: 1.8,
          min: -0.4
        },
        narrowWaist: {
          max: 1,
          min: -1.8
        },
        superBreast: {
          max: 0.3,
          min: 0
        },
        breastsSmall: {
          max: 1,
          min: 0
        },
        animeProportion: {
          max: 0,
          min: 0
        },
        bodybuilderSize: {
          max: 1.2,
          min: -0.8
        },
        bodybuilderDetails: {
          max: 0.8,
          min: -1
        },
        FaceLowerEyelashLength: {
          max: 1,
          min: 1
        }
      },
      limb_masses: {
        gate: {
          max: 1,
          min: 1
        },
        armMass: {
          max: 1.325,
          min: 0.862
        },
        calfMass: {
          max: 1.35,
          min: 0.9
        },
        neckMass: {
          max: 1.25,
          min: 0.889
        },
        thighMass: {
          max: 1.525,
          min: 0.935
        },
        torsoMass: {
          max: 1.375,
          min: 0.745
        },
        forearmMass: {
          max: 1.2,
          min: 0.759
        }
      }
    }
  };
}
