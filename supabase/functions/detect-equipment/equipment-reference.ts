/**
 * Catalogue Exhaustif d'Équipements de Fitness et Musculation
 * Référence complète de 200+ équipements organisés par catégories
 * Mapping FR → EN pour cohérence des IDs en base de données
 */

export interface EquipmentItem {
  id: string;
  nameFr: string;
  nameEn: string;
  category: string;
  subcategory?: string;
  synonyms?: string[];
}

export interface EquipmentCategory {
  id: string;
  label: string;
  description: string;
  equipment: EquipmentItem[];
}

// CARDIO - 19 types (ajout de 5 nouveaux équipements)
const CARDIO_EQUIPMENT: EquipmentItem[] = [
  { id: 'treadmill', nameFr: 'Tapis de course motorisé', nameEn: 'Motorized treadmill', category: 'cardio', subcategory: 'treadmills' },
  { id: 'curved-treadmill', nameFr: 'Tapis de course courbé', nameEn: 'Curved treadmill', category: 'cardio', subcategory: 'treadmills' },
  { id: 'stationary-bike', nameFr: 'Vélo stationnaire', nameEn: 'Stationary bike', category: 'cardio', subcategory: 'bikes' },
  { id: 'spin-bike', nameFr: 'Vélo de spinning', nameEn: 'Spin bike', category: 'cardio', subcategory: 'bikes' },
  { id: 'recumbent-bike', nameFr: 'Vélo semi-allongé', nameEn: 'Recumbent bike', category: 'cardio', subcategory: 'bikes' },
  { id: 'assault-bike', nameFr: 'Assault bike / Air bike', nameEn: 'Assault bike', category: 'cardio', subcategory: 'bikes' },
  { id: 'fan-bike', nameFr: 'Vélo à air', nameEn: 'Fan bike', category: 'cardio', subcategory: 'bikes' },
  { id: 'rowing-machine', nameFr: 'Rameur / Aviron', nameEn: 'Rowing machine', category: 'cardio', subcategory: 'rowing' },
  { id: 'elliptical', nameFr: 'Vélo elliptique', nameEn: 'Elliptical trainer', category: 'cardio', subcategory: 'ellipticals' },
  { id: 'arc-trainer', nameFr: 'Arc trainer', nameEn: 'Arc trainer', category: 'cardio', subcategory: 'ellipticals' },
  { id: 'air-walker', nameFr: 'Air walker / Glider extérieur', nameEn: 'Air walker (outdoor glider)', category: 'cardio', subcategory: 'ellipticals' },
  { id: 'stair-climber', nameFr: 'Simulateur d\'escalier', nameEn: 'Stair climber', category: 'cardio', subcategory: 'climbers' },
  { id: 'stairmaster', nameFr: 'Stairmaster', nameEn: 'Stairmaster', category: 'cardio', subcategory: 'climbers' },
  { id: 'versa-climber', nameFr: 'VersaClimber', nameEn: 'VersaClimber', category: 'cardio', subcategory: 'climbers' },
  { id: 'jacob-ladder', nameFr: 'Jacob\'s Ladder', nameEn: 'Jacob\'s Ladder', category: 'cardio', subcategory: 'climbers' },
  { id: 'ski-erg', nameFr: 'Ski-erg', nameEn: 'Ski erg', category: 'cardio', subcategory: 'ergs' },
  { id: 'arm-ergometer', nameFr: 'Ergomètre bras / Hand bike', nameEn: 'Upper body ergometer (arm bike)', category: 'cardio', subcategory: 'ergs' },
  { id: 'rider-machine', nameFr: 'Rider extérieur', nameEn: 'Outdoor rider', category: 'cardio', subcategory: 'others' },
  { id: 'waist-twister-station', nameFr: 'Station twister taille', nameEn: 'Waist twister station', category: 'cardio', subcategory: 'spinners' }
];

// PECTORAUX - 6 machines
const CHEST_EQUIPMENT: EquipmentItem[] = [
  { id: 'chest-press-machine', nameFr: 'Machine presse pectoraux', nameEn: 'Chest press machine', category: 'machines', subcategory: 'chest' },
  { id: 'pec-deck', nameFr: 'Pec deck / Butterfly', nameEn: 'Pec deck machine', category: 'machines', subcategory: 'chest' },
  { id: 'cable-crossover', nameFr: 'Poulie vis-à-vis', nameEn: 'Cable crossover', category: 'cables', subcategory: 'chest' },
  { id: 'incline-press-machine', nameFr: 'Machine presse inclinée', nameEn: 'Incline press machine', category: 'machines', subcategory: 'chest' },
  { id: 'decline-press-machine', nameFr: 'Machine presse déclinée', nameEn: 'Decline press machine', category: 'machines', subcategory: 'chest' },
  { id: 'chest-fly-machine', nameFr: 'Machine écarté couché', nameEn: 'Chest fly machine', category: 'machines', subcategory: 'chest' }
];

// DOS - 9 machines (ajout de 1 nouveau)
const BACK_EQUIPMENT: EquipmentItem[] = [
  { id: 'lat-pulldown', nameFr: 'Machine tirage vertical / Lat pulldown', nameEn: 'Lat pulldown machine', category: 'cables', subcategory: 'back' },
  { id: 'seated-row', nameFr: 'Machine tirage horizontal assis', nameEn: 'Seated row machine', category: 'cables', subcategory: 'back' },
  { id: 'low-row-machine', nameFr: 'Machine tirage bas', nameEn: 'Low row machine', category: 'machines', subcategory: 'back' },
  { id: 't-bar-row', nameFr: 'T-bar row', nameEn: 'T-bar row', category: 'machines', subcategory: 'back' },
  { id: 'assisted-pull-up-machine', nameFr: 'Machine tractions assistées', nameEn: 'Assisted pull-up machine', category: 'machines', subcategory: 'back' },
  { id: 'back-extension-bench', nameFr: 'Banc extension lombaires', nameEn: 'Back extension bench', category: 'benches', subcategory: 'back' },
  { id: 'hyperextension-bench', nameFr: 'Banc hyperextension / Roman chair', nameEn: 'Hyperextension bench', category: 'benches', subcategory: 'back' },
  { id: 'reverse-hyperextension-machine', nameFr: 'Machine reverse hyper', nameEn: 'Reverse hyperextension machine', category: 'machines', subcategory: 'back' },
  { id: 'reverse-fly-machine', nameFr: 'Machine écarté postérieur', nameEn: 'Reverse fly machine', category: 'machines', subcategory: 'back' }
];

// ÉPAULES - 5 machines
const SHOULDERS_EQUIPMENT: EquipmentItem[] = [
  { id: 'shoulder-press-machine', nameFr: 'Machine développé épaules', nameEn: 'Shoulder press machine', category: 'machines', subcategory: 'shoulders' },
  { id: 'lateral-raise-machine', nameFr: 'Machine élévations latérales', nameEn: 'Lateral raise machine', category: 'machines', subcategory: 'shoulders' },
  { id: 'rear-delt-machine', nameFr: 'Machine deltoïdes postérieurs', nameEn: 'Rear delt machine', category: 'machines', subcategory: 'shoulders' },
  { id: 'front-raise-machine', nameFr: 'Machine élévations frontales', nameEn: 'Front raise machine', category: 'machines', subcategory: 'shoulders' },
  { id: 'shrug-machine', nameFr: 'Machine shrugs / Trapèzes', nameEn: 'Shrug machine', category: 'machines', subcategory: 'shoulders' }
];

// BRAS - 6 machines
const ARMS_EQUIPMENT: EquipmentItem[] = [
  { id: 'bicep-curl-machine', nameFr: 'Machine curl biceps', nameEn: 'Bicep curl machine', category: 'machines', subcategory: 'arms' },
  { id: 'preacher-curl-bench', nameFr: 'Pupitre curl / Preacher curl', nameEn: 'Preacher curl bench', category: 'benches', subcategory: 'arms' },
  { id: 'tricep-extension-machine', nameFr: 'Machine extension triceps', nameEn: 'Tricep extension machine', category: 'machines', subcategory: 'arms' },
  { id: 'tricep-dip-machine', nameFr: 'Machine dips triceps', nameEn: 'Tricep dip machine', category: 'machines', subcategory: 'arms' },
  { id: 'arm-curl-station', nameFr: 'Station curl bras', nameEn: 'Arm curl station', category: 'machines', subcategory: 'arms' },
  { id: 'cable-bicep-station', nameFr: 'Poulie biceps', nameEn: 'Cable bicep station', category: 'cables', subcategory: 'arms' }
];

// JAMBES ET FESSIERS - 22 machines (ajout de 4 nouveaux équipements)
const LEGS_EQUIPMENT: EquipmentItem[] = [
  { id: 'leg-press', nameFr: 'Presse à cuisses / Leg press', nameEn: 'Leg press', category: 'machines', subcategory: 'legs' },
  { id: 'leg-press-45', nameFr: 'Presse à cuisses 45 degrés', nameEn: '45-degree leg press', category: 'machines', subcategory: 'legs' },
  { id: 'vertical-leg-press', nameFr: 'Presse à cuisses verticale', nameEn: 'Vertical leg press', category: 'machines', subcategory: 'legs' },
  { id: 'hack-squat', nameFr: 'Hack squat', nameEn: 'Hack squat machine', category: 'machines', subcategory: 'legs' },
  { id: 'pendulum-squat', nameFr: 'Squat pendulaire', nameEn: 'Pendulum squat', category: 'machines', subcategory: 'legs' },
  { id: 'belt-squat-machine', nameFr: 'Machine squat à ceinture', nameEn: 'Belt squat machine', category: 'machines', subcategory: 'legs' },
  { id: 'leg-extension', nameFr: 'Machine extension jambes / Quadriceps', nameEn: 'Leg extension machine', category: 'machines', subcategory: 'legs' },
  { id: 'leg-curl', nameFr: 'Machine curl jambes / Ischio', nameEn: 'Leg curl machine', category: 'machines', subcategory: 'legs' },
  { id: 'seated-leg-curl', nameFr: 'Machine curl jambes assis', nameEn: 'Seated leg curl', category: 'machines', subcategory: 'legs' },
  { id: 'lying-leg-curl', nameFr: 'Machine curl jambes allongé', nameEn: 'Lying leg curl', category: 'machines', subcategory: 'legs' },
  { id: 'standing-leg-curl', nameFr: 'Machine curl jambes debout', nameEn: 'Standing leg curl', category: 'machines', subcategory: 'legs' },
  { id: 'calf-raise-machine', nameFr: 'Machine mollets / Calf raise', nameEn: 'Calf raise machine', category: 'machines', subcategory: 'legs' },
  { id: 'standing-calf-raise', nameFr: 'Machine mollets debout', nameEn: 'Standing calf raise', category: 'machines', subcategory: 'legs' },
  { id: 'seated-calf-raise', nameFr: 'Machine mollets assis', nameEn: 'Seated calf raise', category: 'machines', subcategory: 'legs' },
  { id: 'donkey-calf-raise', nameFr: 'Machine mollets donkey', nameEn: 'Donkey calf raise machine', category: 'machines', subcategory: 'legs' },
  { id: 'hip-abduction-machine', nameFr: 'Machine abduction hanches', nameEn: 'Hip abduction machine', category: 'machines', subcategory: 'legs' },
  { id: 'hip-adduction-machine', nameFr: 'Machine adduction hanches', nameEn: 'Hip adduction machine', category: 'machines', subcategory: 'legs' },
  { id: 'hip-thrust-machine', nameFr: 'Machine hip thrust', nameEn: 'Hip thrust machine', category: 'machines', subcategory: 'legs' },
  { id: 'glute-machine', nameFr: 'Machine fessiers', nameEn: 'Glute machine', category: 'machines', subcategory: 'legs' },
  { id: 'glute-kickback-machine', nameFr: 'Machine kickback fessiers', nameEn: 'Glute kickback machine', category: 'machines', subcategory: 'legs' },
  { id: 'smith-machine', nameFr: 'Smith machine / Cadre guidé', nameEn: 'Smith machine', category: 'racks', subcategory: 'legs' }
];

// TRONC / ABDOS - 8 machines (ajout de 3 nouveaux équipements)
const CORE_EQUIPMENT: EquipmentItem[] = [
  { id: 'ab-crunch-machine', nameFr: 'Machine crunch abdominaux', nameEn: 'Ab crunch machine', category: 'machines', subcategory: 'core' },
  { id: 'ab-coaster', nameFr: 'Machine Ab Coaster', nameEn: 'Ab Coaster machine', category: 'machines', subcategory: 'core' },
  { id: 'torso-rotation-machine', nameFr: 'Machine rotation du tronc', nameEn: 'Torso rotation machine', category: 'machines', subcategory: 'core' },
  { id: 'ab-bench', nameFr: 'Banc abdominaux', nameEn: 'Ab bench', category: 'benches', subcategory: 'core' },
  { id: 'decline-sit-up-bench', nameFr: 'Banc sit-up décliné', nameEn: 'Decline sit-up bench', category: 'benches', subcategory: 'core' },
  { id: 'roman-chair', nameFr: 'Chaise romaine', nameEn: 'Roman chair', category: 'benches', subcategory: 'core' },
  { id: 'glute-ham-developer', nameFr: 'GHD / Glute-Ham Developer', nameEn: 'Glute-Ham Developer (GHD)', category: 'benches', subcategory: 'specialty' },
  { id: 'ab-mat', nameFr: 'Ab mat', nameEn: 'Ab mat', category: 'accessories', subcategory: 'core' }
];

// STATIONS ET RACKS - 21 structures (ajout de 6 nouveaux équipements)
const RACKS_STATIONS_EQUIPMENT: EquipmentItem[] = [
  { id: 'squat-rack', nameFr: 'Rack à squat', nameEn: 'Squat rack', category: 'racks', subcategory: 'racks' },
  { id: 'power-rack', nameFr: 'Cage à squat / Power rack', nameEn: 'Power rack', category: 'racks', subcategory: 'racks' },
  { id: 'half-rack', nameFr: 'Half-rack', nameEn: 'Half rack', category: 'racks', subcategory: 'racks' },
  { id: 'squat-stand', nameFr: 'Support de squat', nameEn: 'Squat stand', category: 'racks', subcategory: 'racks' },
  { id: 'pull-up-bar', nameFr: 'Barre de traction', nameEn: 'Pull-up bar', category: 'racks', subcategory: 'bars' },
  { id: 'wall-mounted-pull-up-bar', nameFr: 'Barre de traction murale', nameEn: 'Wall-mounted pull-up bar', category: 'racks', subcategory: 'bars' },
  { id: 'doorway-pull-up-bar', nameFr: 'Barre de traction de porte', nameEn: 'Doorway pull-up bar', category: 'racks', subcategory: 'bars' },
  { id: 'dip-station', nameFr: 'Station de dips', nameEn: 'Dip station', category: 'racks', subcategory: 'bars' },
  { id: 'wall-mounted-dip-bars', nameFr: 'Barres de dips murales', nameEn: 'Wall-mounted dip bars', category: 'racks', subcategory: 'bars' },
  { id: 'power-tower', nameFr: 'Power tower / Chaise du capitaine', nameEn: 'Power tower', category: 'racks', subcategory: 'bars' },
  { id: 'captains-chair', nameFr: 'Chaise du capitaine', nameEn: 'Captain\'s chair', category: 'racks', subcategory: 'bars' },
  { id: 'monkey-bars', nameFr: 'Barres de singe', nameEn: 'Monkey bars', category: 'racks', subcategory: 'bars' },
  { id: 'rig', nameFr: 'Rig de crossfit', nameEn: 'CrossFit rig', category: 'racks', subcategory: 'structures' },
  { id: 'functional-trainer', nameFr: 'Entraîneur fonctionnel / Station complète', nameEn: 'Functional trainer', category: 'cables', subcategory: 'stations' },
  { id: 'multi-gym', nameFr: 'Multi-gym / Station multifonction', nameEn: 'Multi-gym', category: 'machines', subcategory: 'stations' },
  { id: 'bench-press-station', nameFr: 'Station bench press', nameEn: 'Bench press station', category: 'racks', subcategory: 'stations' },
  { id: 'cable-machine', nameFr: 'Machine à câbles', nameEn: 'Cable machine', category: 'cables', subcategory: 'stations' },
  { id: 'landmine-station', nameFr: 'Station landmine', nameEn: 'Landmine station', category: 'racks', subcategory: 'accessories' },
  { id: 'landmine-viking-handle', nameFr: 'Poignée Viking (landmine)', nameEn: 'Viking press landmine handle', category: 'racks', subcategory: 'accessories' },
  { id: 'landmine-tbar-row-handle', nameFr: 'Poignée T-bar row (landmine)', nameEn: 'T-bar row landmine handle', category: 'racks', subcategory: 'accessories' },
  { id: 'weightlifting-platform', nameFr: 'Plateforme d\'haltérophilie', nameEn: 'Weightlifting platform', category: 'racks', subcategory: 'platforms' }
];

// BANCS - 11 types (ajout de 2 nouveaux équipements spécialisés)
const BENCHES_EQUIPMENT: EquipmentItem[] = [
  { id: 'flat-bench', nameFr: 'Banc plat', nameEn: 'Flat bench', category: 'benches', subcategory: 'standard' },
  { id: 'adjustable-bench', nameFr: 'Banc ajustable', nameEn: 'Adjustable bench', category: 'benches', subcategory: 'standard' },
  { id: 'incline-bench', nameFr: 'Banc incliné', nameEn: 'Incline bench', category: 'benches', subcategory: 'standard' },
  { id: 'decline-bench', nameFr: 'Banc décliné', nameEn: 'Decline bench', category: 'benches', subcategory: 'standard' },
  { id: 'olympic-bench', nameFr: 'Banc olympique', nameEn: 'Olympic bench', category: 'benches', subcategory: 'standard' },
  { id: 'utility-bench', nameFr: 'Banc utilitaire', nameEn: 'Utility bench', category: 'benches', subcategory: 'standard' },
  { id: 'fid-bench', nameFr: 'Banc FID (Flat/Incline/Decline)', nameEn: 'FID bench', category: 'benches', subcategory: 'standard' },
  { id: 'hip-thrust-bench', nameFr: 'Banc hip thrust', nameEn: 'Hip thrust bench', category: 'benches', subcategory: 'specialty' },
  { id: 'sissy-squat-bench', nameFr: 'Banc sissy squat', nameEn: 'Sissy squat bench', category: 'benches', subcategory: 'specialty' },
  { id: 'plyometric-box', nameFr: 'Box de pliométrie / Plyo box', nameEn: 'Plyometric box', category: 'accessories', subcategory: 'plyo' },
  { id: 'step-platform', nameFr: 'Step / Plateforme aérobic', nameEn: 'Step platform', category: 'accessories', subcategory: 'cardio' }
];

// POIDS LIBRES - 18 types (ajout de 6 nouveaux équipements)
const FREE_WEIGHTS_EQUIPMENT: EquipmentItem[] = [
  { id: 'dumbbells', nameFr: 'Haltères', nameEn: 'Dumbbells', category: 'weights', subcategory: 'dumbbells' },
  { id: 'adjustable-dumbbells', nameFr: 'Haltères ajustables', nameEn: 'Adjustable dumbbells', category: 'weights', subcategory: 'dumbbells' },
  { id: 'dumbbell-rack', nameFr: 'Rack à haltères', nameEn: 'Dumbbell rack', category: 'storage', subcategory: 'racks' },
  { id: 'barbell', nameFr: 'Barre olympique', nameEn: 'Olympic barbell', category: 'weights', subcategory: 'barbells' },
  { id: 'technique-bar', nameFr: 'Barre technique (apprentissage)', nameEn: 'Technique barbell', category: 'weights', subcategory: 'barbells' },
  { id: 'ez-bar', nameFr: 'Barre EZ / Barre coudée', nameEn: 'EZ curl bar', category: 'weights', subcategory: 'barbells' },
  { id: 'curl-bar', nameFr: 'Barre de curl', nameEn: 'Curl bar', category: 'weights', subcategory: 'barbells' },
  { id: 'trap-bar', nameFr: 'Trap bar / Barre hexagonale', nameEn: 'Trap bar', category: 'weights', subcategory: 'barbells' },
  { id: 'kettlebells', nameFr: 'Kettlebells', nameEn: 'Kettlebells', category: 'weights', subcategory: 'kettlebells' },
  { id: 'weight-plates', nameFr: 'Disques de poids', nameEn: 'Weight plates', category: 'weights', subcategory: 'plates' },
  { id: 'bumper-plates', nameFr: 'Disques bumper', nameEn: 'Bumper plates', category: 'weights', subcategory: 'plates' },
  { id: 'barbell-collars', nameFr: 'Colliers de barre', nameEn: 'Barbell collars', category: 'weights', subcategory: 'accessories' },
  { id: 'lifting-chains', nameFr: 'Chaînes de lest / Lifting chains', nameEn: 'Lifting chains', category: 'weights', subcategory: 'accessories' },
  { id: 'barbell-jack', nameFr: 'Levier pour barre / Bar jack', nameEn: 'Barbell jack', category: 'accessories', subcategory: 'tools' },
  { id: 'jerk-blocks', nameFr: 'Jerk blocks', nameEn: 'Jerk blocks', category: 'accessories', subcategory: 'blocks' },
  { id: 'weight-tree', nameFr: 'Arbre à disques', nameEn: 'Weight tree', category: 'storage', subcategory: 'racks' },
  { id: 'barbell-holder', nameFr: 'Support de barres', nameEn: 'Barbell holder', category: 'storage', subcategory: 'racks' }
];

// ACCESSOIRES POULIE - 13 types (ajout de 3 nouveaux accessoires)
const CABLE_ATTACHMENTS_EQUIPMENT: EquipmentItem[] = [
  { id: 'cable-rope', nameFr: 'Corde triceps', nameEn: 'Cable rope', category: 'accessories', subcategory: 'cables' },
  { id: 'tricep-rope', nameFr: 'Corde à triceps', nameEn: 'Tricep rope', category: 'accessories', subcategory: 'cables' },
  { id: 'straight-bar-attachment', nameFr: 'Barre droite pour poulie', nameEn: 'Straight bar attachment', category: 'accessories', subcategory: 'cables' },
  { id: 'ez-bar-attachment', nameFr: 'Barre EZ pour poulie', nameEn: 'EZ bar attachment', category: 'accessories', subcategory: 'cables' },
  { id: 'lat-bar', nameFr: 'Barre de tirage', nameEn: 'Lat bar', category: 'accessories', subcategory: 'cables' },
  { id: 'multi-grip-lat-bar', nameFr: 'Barre lat multi-prises', nameEn: 'Multi-grip lat pulldown bar', category: 'accessories', subcategory: 'cables' },
  { id: 'v-bar-attachment', nameFr: 'Barre en V', nameEn: 'V-bar attachment', category: 'accessories', subcategory: 'cables' },
  { id: 'close-grip-row-handle', nameFr: 'Poignée tirage serré', nameEn: 'Close-grip row handle', category: 'accessories', subcategory: 'cables' },
  { id: 'single-handle', nameFr: 'Poignée simple', nameEn: 'Single handle', category: 'accessories', subcategory: 'cables' },
  { id: 'd-handle', nameFr: 'Poignée en D', nameEn: 'D-handle', category: 'accessories', subcategory: 'cables' },
  { id: 'mag-grip', nameFr: 'Poignée MAG', nameEn: 'MAG grip', category: 'accessories', subcategory: 'cables' },
  { id: 'ankle-strap', nameFr: 'Sangle de cheville', nameEn: 'Ankle strap', category: 'accessories', subcategory: 'cables' },
  { id: 'ab-crunch-strap', nameFr: 'Sangle abdos pour poulie', nameEn: 'Ab crunch strap', category: 'accessories', subcategory: 'cables' }
];

// FONCTIONNEL / CROSS-TRAINING - 36 items (ajout de 14 nouveaux équipements)
const FUNCTIONAL_EQUIPMENT: EquipmentItem[] = [
  { id: 'battle-ropes', nameFr: 'Cordes ondulatoires / Battle ropes', nameEn: 'Battle ropes', category: 'functional', subcategory: 'conditioning' },
  { id: 'sled', nameFr: 'Traîneau de poussée / Sled', nameEn: 'Sled', category: 'functional', subcategory: 'conditioning' },
  { id: 'prowler', nameFr: 'Prowler', nameEn: 'Prowler sled', category: 'functional', subcategory: 'conditioning' },
  { id: 'sled-harness', nameFr: 'Harnais de traction (sled)', nameEn: 'Sled pulling harness', category: 'functional', subcategory: 'conditioning' },
  { id: 'sledgehammer', nameFr: 'Masse / Sledgehammer', nameEn: 'Sledgehammer', category: 'functional', subcategory: 'conditioning' },
  { id: 'sprint-parachute', nameFr: 'Parachute de sprint', nameEn: 'Speed chute', category: 'functional', subcategory: 'conditioning' },
  { id: 'bulgarian-bag', nameFr: 'Bulgarian bag', nameEn: 'Bulgarian bag', category: 'functional', subcategory: 'conditioning' },
  { id: 'slam-ball', nameFr: 'Slam ball', nameEn: 'Slam ball', category: 'functional', subcategory: 'balls' },
  { id: 'wall-ball', nameFr: 'Wall ball / Medecine ball', nameEn: 'Wall ball', category: 'functional', subcategory: 'balls' },
  { id: 'medicine-ball', nameFr: 'Medecine ball', nameEn: 'Medicine ball', category: 'functional', subcategory: 'balls' },
  { id: 'trx', nameFr: 'TRX / Sangles de suspension', nameEn: 'TRX suspension trainer', category: 'functional', subcategory: 'suspension' },
  { id: 'tire', nameFr: 'Pneu de tracteur', nameEn: 'Tractor tire', category: 'functional', subcategory: 'strongman' },
  { id: 'sandbag', nameFr: 'Sac de sable', nameEn: 'Sandbag', category: 'functional', subcategory: 'strongman' },
  { id: 'atlas-stone', nameFr: 'Pierre d\'Atlas', nameEn: 'Atlas stone', category: 'functional', subcategory: 'strongman' },
  { id: 'strongman-log', nameFr: 'Log de strongman', nameEn: 'Strongman log', category: 'functional', subcategory: 'strongman' },
  { id: 'axle-bar', nameFr: 'Barre axle (épaisse)', nameEn: 'Axle bar', category: 'functional', subcategory: 'strongman' },
  { id: 'circus-dumbbell', nameFr: 'Haltère circus', nameEn: 'Circus dumbbell', category: 'functional', subcategory: 'strongman' },
  { id: 'keg', nameFr: 'Fût de strongman (keg)', nameEn: 'Strongman keg', category: 'functional', subcategory: 'strongman' },
  { id: 'husafell-stone', nameFr: 'Pierre Husafell', nameEn: 'Husafell stone', category: 'functional', subcategory: 'strongman' },
  { id: 'farmers-walk-handles', nameFr: 'Poignées farmer walk', nameEn: 'Farmer\'s walk handles', category: 'functional', subcategory: 'strongman' },
  { id: 'yoke', nameFr: 'Yoke / Joug', nameEn: 'Yoke', category: 'functional', subcategory: 'strongman' },
  { id: 'gymnastic-rings', nameFr: 'Anneaux de gymnastique', nameEn: 'Gymnastic rings', category: 'functional', subcategory: 'calisthenics' },
  { id: 'parallettes', nameFr: 'Parallettes', nameEn: 'Parallettes', category: 'calisthenics', subcategory: 'bars' },
  { id: 'push-up-bars', nameFr: 'Barres de pompes', nameEn: 'Push-up bars', category: 'functional', subcategory: 'calisthenics' },
  { id: 'ninja-grips', nameFr: 'Prises ninja (boules, cônes, nunchucks)', nameEn: 'Ninja grips (balls, cones, nunchucks)', category: 'functional', subcategory: 'calisthenics' },
  { id: 'balance-board', nameFr: 'Planche d\'équilibre', nameEn: 'Balance board', category: 'accessories', subcategory: 'balance' },
  { id: 'bosu-ball', nameFr: 'Bosu ball', nameEn: 'BOSU ball', category: 'accessories', subcategory: 'balance' },
  { id: 'slackline', nameFr: 'Slackline', nameEn: 'Slackline', category: 'functional', subcategory: 'balance' },
  { id: 'balance-beam-gym', nameFr: 'Poutre d\'équilibre (gym)', nameEn: 'Balance beam', category: 'functional', subcategory: 'balance' },
  { id: 'resistance-bands', nameFr: 'Bandes de résistance', nameEn: 'Resistance bands', category: 'accessories', subcategory: 'bands' },
  { id: 'pull-up-assist-band', nameFr: 'Bande d\'assistance tractions', nameEn: 'Pull-up assist band', category: 'accessories', subcategory: 'bands' },
  { id: 'jump-rope', nameFr: 'Corde à sauter', nameEn: 'Jump rope', category: 'accessories', subcategory: 'cardio' },
  { id: 'speed-ladder', nameFr: 'Échelle d\'agilité', nameEn: 'Agility ladder', category: 'accessories', subcategory: 'agility' },
  { id: 'agility-cones', nameFr: 'Plots de marquage', nameEn: 'Agility cones', category: 'accessories', subcategory: 'agility' },
  { id: 'agility-poles', nameFr: 'Piquets d\'agilité', nameEn: 'Agility poles', category: 'accessories', subcategory: 'agility' },
  { id: 'mini-hurdles', nameFr: 'Mini-haies d\'agilité', nameEn: 'Mini agility hurdles', category: 'accessories', subcategory: 'agility' },
  { id: 'hurdles', nameFr: 'Haies', nameEn: 'Hurdles', category: 'accessories', subcategory: 'agility' }
];

// CALISTHENIE / EXTÉRIEUR - 18 items (ajout de 8 nouveaux équipements)
const CALISTHENICS_EQUIPMENT: EquipmentItem[] = [
  { id: 'parallel-bars', nameFr: 'Barres parallèles', nameEn: 'Parallel bars', category: 'calisthenics', subcategory: 'bars' },
  { id: 'dip-bars', nameFr: 'Barres de dips', nameEn: 'Dip bars', category: 'calisthenics', subcategory: 'bars' },
  { id: 'stall-bars', nameFr: 'Espalier', nameEn: 'Stall bars', category: 'calisthenics', subcategory: 'bars' },
  { id: 'pegboard', nameFr: 'Pegboard', nameEn: 'Pegboard', category: 'calisthenics', subcategory: 'climbing' },
  { id: 'climbing-rope', nameFr: 'Corde de grimpe', nameEn: 'Climbing rope', category: 'calisthenics', subcategory: 'climbing' },
  { id: 'cargo-net', nameFr: 'Filet d\'escalade (cargo net)', nameEn: 'Cargo net climb', category: 'calisthenics', subcategory: 'climbing' },
  { id: 'salmon-ladder', nameFr: 'Échelle de saumon', nameEn: 'Salmon ladder', category: 'calisthenics', subcategory: 'climbing' },
  { id: 'traverse-climbing-wall', nameFr: 'Mur de traversée (prises d\'escalade)', nameEn: 'Traverse climbing wall', category: 'calisthenics', subcategory: 'climbing' },
  { id: 'bouldering-wall', nameFr: 'Mur de bloc / Bouldering', nameEn: 'Bouldering wall', category: 'calisthenics', subcategory: 'climbing' },
  { id: 'warped-wall', nameFr: 'Mur incurvé (warped wall)', nameEn: 'Warped wall', category: 'calisthenics', subcategory: 'obstacles' },
  { id: 'parkour-vault-box', nameFr: 'Box de parkour (vault)', nameEn: 'Parkour vault box', category: 'calisthenics', subcategory: 'obstacles' },
  { id: 'precision-trainers', nameFr: 'Plots/rails de précision', nameEn: 'Precision trainers (rails/pods)', category: 'calisthenics', subcategory: 'obstacles' },
  { id: 'outdoor-gym-station', nameFr: 'Station de street workout', nameEn: 'Outdoor gym station', category: 'outdoor', subcategory: 'stations' },
  { id: 'public-pull-up-bar', nameFr: 'Barre de traction publique', nameEn: 'Public pull-up bar', category: 'outdoor', subcategory: 'bars' },
  { id: 'public-bench', nameFr: 'Banc public', nameEn: 'Public bench', category: 'outdoor', subcategory: 'furniture' },
  { id: 'stairs', nameFr: 'Escaliers', nameEn: 'Stairs', category: 'outdoor', subcategory: 'terrain' }
];

// COMBAT / BOXE - 13 items (ajout de 5 nouveaux équipements)
const COMBAT_EQUIPMENT: EquipmentItem[] = [
  { id: 'heavy-bag', nameFr: 'Sac de frappe lourd', nameEn: 'Heavy punching bag', category: 'combat', subcategory: 'bags' },
  { id: 'speed-bag', nameFr: 'Poire de vitesse / Speed bag', nameEn: 'Speed bag', category: 'combat', subcategory: 'bags' },
  { id: 'double-end-bag', nameFr: 'Ballon double attache', nameEn: 'Double-end bag', category: 'combat', subcategory: 'bags' },
  { id: 'free-standing-bag', nameFr: 'Sac de frappe sur pied', nameEn: 'Free-standing bag', category: 'combat', subcategory: 'bags' },
  { id: 'uppercut-bag', nameFr: 'Sac uppercut', nameEn: 'Uppercut bag', category: 'combat', subcategory: 'bags' },
  { id: 'aqua-bag', nameFr: 'Sac à eau / Aqua bag', nameEn: 'Aqua bag', category: 'combat', subcategory: 'bags' },
  { id: 'cobra-reflex-bag', nameFr: 'Sac reflex (cobra bag)', nameEn: 'Cobra reflex bag', category: 'combat', subcategory: 'bags' },
  { id: 'focus-mitts', nameFr: 'Pattes d\'ours', nameEn: 'Focus mitts', category: 'combat', subcategory: 'pads' },
  { id: 'thai-pads', nameFr: 'Paos thaï', nameEn: 'Thai pads', category: 'combat', subcategory: 'pads' },
  { id: 'kick-shield', nameFr: 'Bouclier de frappe', nameEn: 'Kick shield', category: 'combat', subcategory: 'pads' },
  { id: 'boxing-ring', nameFr: 'Ring de boxe', nameEn: 'Boxing ring', category: 'combat', subcategory: 'structures' },
  { id: 'mma-cage', nameFr: 'Cage MMA / Octogone', nameEn: 'MMA cage', category: 'combat', subcategory: 'structures' },
  { id: 'grappling-dummy', nameFr: 'Mannequin de grappling', nameEn: 'Grappling dummy', category: 'combat', subcategory: 'structures' }
];

// PILATES / YOGA / MOBILITÉ - 14 items (ajout de 6 nouveaux équipements)
const MOBILITY_EQUIPMENT: EquipmentItem[] = [
  { id: 'yoga-mat', nameFr: 'Tapis de yoga', nameEn: 'Yoga mat', category: 'accessories', subcategory: 'mats' },
  { id: 'yoga-block', nameFr: 'Brique de yoga', nameEn: 'Yoga block', category: 'mobility', subcategory: 'accessories' },
  { id: 'yoga-strap', nameFr: 'Sangle de yoga', nameEn: 'Yoga strap', category: 'mobility', subcategory: 'accessories' },
  { id: 'yoga-wheel', nameFr: 'Roue de yoga', nameEn: 'Yoga wheel', category: 'mobility', subcategory: 'accessories' },
  { id: 'foam-roller', nameFr: 'Rouleau de massage / Foam roller', nameEn: 'Foam roller', category: 'recovery', subcategory: 'massage' },
  { id: 'peanut-roller', nameFr: 'Rouleau "cacahuète"', nameEn: 'Peanut massage roller', category: 'recovery', subcategory: 'massage' },
  { id: 'massage-ball', nameFr: 'Balle de massage', nameEn: 'Massage ball', category: 'recovery', subcategory: 'massage' },
  { id: 'massage-stick', nameFr: 'Bâton de massage', nameEn: 'Massage stick', category: 'recovery', subcategory: 'massage' },
  { id: 'pilates-reformer', nameFr: 'Reformer Pilates', nameEn: 'Pilates reformer', category: 'pilates', subcategory: 'machines' },
  { id: 'pilates-chair', nameFr: 'Chaise Pilates', nameEn: 'Pilates chair', category: 'pilates', subcategory: 'machines' },
  { id: 'pilates-cadillac', nameFr: 'Cadillac Pilates', nameEn: 'Pilates Cadillac', category: 'pilates', subcategory: 'machines' },
  { id: 'pilates-ring', nameFr: 'Cercle Pilates', nameEn: 'Pilates ring (magic circle)', category: 'mobility', subcategory: 'machines' },
  { id: 'exercise-ball', nameFr: 'Swiss ball / Ballon de gym', nameEn: 'Exercise ball', category: 'accessories', subcategory: 'balls' },
  { id: 'ab-wheel', nameFr: 'Roue abdominale', nameEn: 'Ab wheel', category: 'accessories', subcategory: 'core' }
];

// ACCESSOIRES DIVERS - 12 items
const MISC_ACCESSORIES_EQUIPMENT: EquipmentItem[] = [
  { id: 'dip-belt', nameFr: 'Ceinture de lest', nameEn: 'Dip belt', category: 'accessories', subcategory: 'belts' },
  { id: 'weight-belt', nameFr: 'Ceinture de musculation', nameEn: 'Weight belt', category: 'accessories', subcategory: 'belts' },
  { id: 'lifting-straps', nameFr: 'Sangles de tirage', nameEn: 'Lifting straps', category: 'accessories', subcategory: 'grips' },
  { id: 'wrist-wraps', nameFr: 'Bandages de poignet', nameEn: 'Wrist wraps', category: 'accessories', subcategory: 'support' },
  { id: 'knee-sleeves', nameFr: 'Manchons de genou', nameEn: 'Knee sleeves', category: 'accessories', subcategory: 'support' },
  { id: 'weighted-vest', nameFr: 'Gilet lesté', nameEn: 'Weighted vest', category: 'accessories', subcategory: 'weights' },
  { id: 'ankle-weights', nameFr: 'Poids pour chevilles', nameEn: 'Ankle weights', category: 'accessories', subcategory: 'weights' },
  { id: 'wrist-weights', nameFr: 'Poids pour poignets', nameEn: 'Wrist weights', category: 'accessories', subcategory: 'weights' },
  { id: 'grip-strengthener', nameFr: 'Pince de force', nameEn: 'Grip strengthener', category: 'accessories', subcategory: 'grips' },
  { id: 'fat-gripz', nameFr: 'Fat Gripz', nameEn: 'Fat Gripz', category: 'accessories', subcategory: 'grips' },
  { id: 'plate-storage-rack', nameFr: 'Rack de rangement disques', nameEn: 'Plate storage rack', category: 'storage', subcategory: 'racks' },
  { id: 'accessory-rack', nameFr: 'Rack accessoires', nameEn: 'Accessory rack', category: 'storage', subcategory: 'racks' }
];

// MEUBLES ET OBJETS MAISON (FURNITURE) - 35+ items
// Objets du quotidien utilisables pour l'entraînement à domicile
const HOME_FURNITURE_EQUIPMENT: EquipmentItem[] = [
  // Chaises et sièges
  { id: 'sturdy-chair', nameFr: 'Chaise solide', nameEn: 'Sturdy chair', category: 'home-furniture', subcategory: 'chairs', synonyms: ['Chaise en bois', 'Chaise stable'] },
  { id: 'dining-chair', nameFr: 'Chaise de salle à manger', nameEn: 'Dining chair', category: 'home-furniture', subcategory: 'chairs' },
  { id: 'kitchen-chair', nameFr: 'Chaise de cuisine', nameEn: 'Kitchen chair', category: 'home-furniture', subcategory: 'chairs' },
  { id: 'armchair', nameFr: 'Fauteuil', nameEn: 'Armchair', category: 'home-furniture', subcategory: 'chairs' },
  { id: 'office-chair-stable', nameFr: 'Chaise de bureau stable', nameEn: 'Stable office chair', category: 'home-furniture', subcategory: 'chairs' },

  // Tables
  { id: 'sturdy-table', nameFr: 'Table solide', nameEn: 'Sturdy table', category: 'home-furniture', subcategory: 'tables', synonyms: ['Table en bois massif'] },
  { id: 'coffee-table', nameFr: 'Table basse', nameEn: 'Coffee table', category: 'home-furniture', subcategory: 'tables' },
  { id: 'dining-table', nameFr: 'Table de salle à manger', nameEn: 'Dining table', category: 'home-furniture', subcategory: 'tables' },
  { id: 'kitchen-counter', nameFr: 'Plan de travail cuisine', nameEn: 'Kitchen counter', category: 'home-furniture', subcategory: 'tables' },
  { id: 'desk', nameFr: 'Bureau', nameEn: 'Desk', category: 'home-furniture', subcategory: 'tables' },

  // Canapés et lits
  { id: 'solid-couch', nameFr: 'Canapé solide', nameEn: 'Solid couch', category: 'home-furniture', subcategory: 'sofas' },
  { id: 'sofa-edge', nameFr: 'Rebord de canapé', nameEn: 'Sofa edge', category: 'home-furniture', subcategory: 'sofas' },
  { id: 'bed-frame', nameFr: 'Cadre de lit', nameEn: 'Bed frame', category: 'home-furniture', subcategory: 'beds' },

  // Escaliers et marches
  { id: 'indoor-stairs', nameFr: 'Escaliers intérieurs', nameEn: 'Indoor stairs', category: 'home-furniture', subcategory: 'stairs' },
  { id: 'stair-step', nameFr: 'Marche d\'escalier', nameEn: 'Stair step', category: 'home-furniture', subcategory: 'stairs' },
  { id: 'staircase', nameFr: 'Cage d\'escalier', nameEn: 'Staircase', category: 'home-furniture', subcategory: 'stairs' },

  // Murs et portes
  { id: 'wall-support', nameFr: 'Mur porteur', nameEn: 'Support wall', category: 'home-furniture', subcategory: 'walls' },
  { id: 'door-frame', nameFr: 'Cadre de porte', nameEn: 'Door frame', category: 'home-furniture', subcategory: 'doors' },
  { id: 'sturdy-door', nameFr: 'Porte solide', nameEn: 'Sturdy door', category: 'home-furniture', subcategory: 'doors' },

  // Étagères et rangements
  { id: 'bookshelf', nameFr: 'Bibliothèque', nameEn: 'Bookshelf', category: 'home-furniture', subcategory: 'storage' },
  { id: 'shelf', nameFr: 'Étagère murale', nameEn: 'Wall shelf', category: 'home-furniture', subcategory: 'storage' },
  { id: 'storage-box', nameFr: 'Boîte de rangement', nameEn: 'Storage box', category: 'home-furniture', subcategory: 'storage' },

  // Objets lourds utilisables
  { id: 'water-jug', nameFr: 'Bidon d\'eau', nameEn: 'Water jug', category: 'home-objects', subcategory: 'weights', synonyms: ['Bouteille d\'eau grande', 'Jerrycan'] },
  { id: 'backpack-loaded', nameFr: 'Sac à dos chargé', nameEn: 'Loaded backpack', category: 'home-objects', subcategory: 'weights' },
  { id: 'heavy-book', nameFr: 'Gros livre', nameEn: 'Heavy book', category: 'home-objects', subcategory: 'weights' },
  { id: 'laundry-detergent', nameFr: 'Bidon de lessive', nameEn: 'Laundry detergent jug', category: 'home-objects', subcategory: 'weights' },
  { id: 'paint-can', nameFr: 'Pot de peinture', nameEn: 'Paint can', category: 'home-objects', subcategory: 'weights' },

  // Surfaces et tapis
  { id: 'carpet', nameFr: 'Tapis', nameEn: 'Carpet', category: 'home-surfaces', subcategory: 'floors' },
  { id: 'rug', nameFr: 'Tapis épais', nameEn: 'Thick rug', category: 'home-surfaces', subcategory: 'floors' },
  { id: 'hardwood-floor', nameFr: 'Parquet', nameEn: 'Hardwood floor', category: 'home-surfaces', subcategory: 'floors' },
  { id: 'tile-floor', nameFr: 'Carrelage', nameEn: 'Tile floor', category: 'home-surfaces', subcategory: 'floors' },

  // Objets spéciaux
  { id: 'window-sill', nameFr: 'Rebord de fenêtre', nameEn: 'Window sill', category: 'home-furniture', subcategory: 'ledges' },
  { id: 'towel', nameFr: 'Serviette', nameEn: 'Towel', category: 'home-objects', subcategory: 'accessories', synonyms: ['Serviette de bain'] },
  { id: 'broom-handle', nameFr: 'Manche à balai', nameEn: 'Broom handle', category: 'home-objects', subcategory: 'poles' },
  { id: 'pillow', nameFr: 'Coussin', nameEn: 'Pillow', category: 'home-objects', subcategory: 'soft' }
];

// ÉLÉMENTS NATURELS OUTDOOR - 25+ items
// Éléments naturels trouvés en extérieur
const OUTDOOR_NATURAL_EQUIPMENT: EquipmentItem[] = [
  // Arbres et bois
  { id: 'tree-trunk', nameFr: 'Tronc d\'arbre', nameEn: 'Tree trunk', category: 'outdoor-natural', subcategory: 'trees', synonyms: ['Arbre debout', 'Tronc vertical'] },
  { id: 'fallen-log', nameFr: 'Tronc d\'arbre couché', nameEn: 'Fallen log', category: 'outdoor-natural', subcategory: 'trees', synonyms: ['Bûche géante', 'Tronc au sol'] },
  { id: 'tree-branch-low', nameFr: 'Branche d\'arbre basse', nameEn: 'Low tree branch', category: 'outdoor-natural', subcategory: 'trees' },
  { id: 'tree-branch-high', nameFr: 'Branche d\'arbre haute', nameEn: 'High tree branch', category: 'outdoor-natural', subcategory: 'trees' },
  { id: 'tree-stump', nameFr: 'Souche d\'arbre', nameEn: 'Tree stump', category: 'outdoor-natural', subcategory: 'trees' },
  { id: 'thick-branch', nameFr: 'Grosse branche', nameEn: 'Thick branch', category: 'outdoor-natural', subcategory: 'trees' },
  { id: 'deadwood', nameFr: 'Bois mort', nameEn: 'Dead wood', category: 'outdoor-natural', subcategory: 'trees' },

  // Roches et pierres
  { id: 'large-rock', nameFr: 'Grosse roche', nameEn: 'Large rock', category: 'outdoor-natural', subcategory: 'rocks', synonyms: ['Pierre volumineuse', 'Rocher'] },
  { id: 'medium-rock', nameFr: 'Roche moyenne', nameEn: 'Medium rock', category: 'outdoor-natural', subcategory: 'rocks' },
  { id: 'boulder', nameFr: 'Rocher', nameEn: 'Boulder', category: 'outdoor-natural', subcategory: 'rocks' },
  { id: 'stone-slab', nameFr: 'Dalle de pierre', nameEn: 'Stone slab', category: 'outdoor-natural', subcategory: 'rocks' },
  { id: 'rock-pile', nameFr: 'Tas de pierres', nameEn: 'Rock pile', category: 'outdoor-natural', subcategory: 'rocks' },

  // Terrain et relief
  { id: 'hill-slope', nameFr: 'Pente de colline', nameEn: 'Hill slope', category: 'outdoor-terrain', subcategory: 'slopes', synonyms: ['Montée', 'Côte'] },
  { id: 'steep-incline', nameFr: 'Pente raide', nameEn: 'Steep incline', category: 'outdoor-terrain', subcategory: 'slopes' },
  { id: 'grassy-hill', nameFr: 'Colline herbeuse', nameEn: 'Grassy hill', category: 'outdoor-terrain', subcategory: 'slopes' },
  { id: 'dirt-path', nameFr: 'Chemin de terre', nameEn: 'Dirt path', category: 'outdoor-terrain', subcategory: 'paths' },
  { id: 'sand-area', nameFr: 'Zone sablonneuse', nameEn: 'Sandy area', category: 'outdoor-terrain', subcategory: 'surfaces', synonyms: ['Plage', 'Sable'] },
  { id: 'grass-field', nameFr: 'Champ d\'herbe', nameEn: 'Grass field', category: 'outdoor-terrain', subcategory: 'surfaces', synonyms: ['Pelouse', 'Prairie'] },
  { id: 'gravel-area', nameFr: 'Zone de gravier', nameEn: 'Gravel area', category: 'outdoor-terrain', subcategory: 'surfaces' },

  // Autres éléments naturels
  { id: 'park-grass', nameFr: 'Pelouse de parc', nameEn: 'Park grass', category: 'outdoor-terrain', subcategory: 'surfaces' },
  { id: 'forest-ground', nameFr: 'Sol forestier', nameEn: 'Forest ground', category: 'outdoor-terrain', subcategory: 'surfaces' },
  { id: 'tree-root', nameFr: 'Racine d\'arbre', nameEn: 'Tree root', category: 'outdoor-natural', subcategory: 'obstacles' },
  { id: 'mud-patch', nameFr: 'Zone boueuse', nameEn: 'Mud patch', category: 'outdoor-terrain', subcategory: 'surfaces' },
  { id: 'creek-bed', nameFr: 'Lit de ruisseau', nameEn: 'Creek bed', category: 'outdoor-natural', subcategory: 'water' },
  { id: 'natural-ledge', nameFr: 'Rebord naturel', nameEn: 'Natural ledge', category: 'outdoor-natural', subcategory: 'obstacles' }
];

// STRUCTURES URBAINES OUTDOOR - 34 items (ajout de 4 nouveaux équipements)
// Infrastructures et équipements publics urbains
const OUTDOOR_URBAN_EQUIPMENT: EquipmentItem[] = [
  // Bancs et sièges publics
  { id: 'park-bench', nameFr: 'Banc de parc', nameEn: 'Park bench', category: 'outdoor-urban', subcategory: 'benches', synonyms: ['Banc public'] },
  { id: 'concrete-bench', nameFr: 'Banc en béton', nameEn: 'Concrete bench', category: 'outdoor-urban', subcategory: 'benches' },
  { id: 'wooden-bench', nameFr: 'Banc en bois', nameEn: 'Wooden bench', category: 'outdoor-urban', subcategory: 'benches' },
  { id: 'picnic-table', nameFr: 'Table de pique-nique', nameEn: 'Picnic table', category: 'outdoor-urban', subcategory: 'tables' },

  // Escaliers et marches extérieurs
  { id: 'outdoor-stairs', nameFr: 'Escaliers extérieurs', nameEn: 'Outdoor stairs', category: 'outdoor-urban', subcategory: 'stairs', synonyms: ['Escalier public'] },
  { id: 'concrete-steps', nameFr: 'Marches en béton', nameEn: 'Concrete steps', category: 'outdoor-urban', subcategory: 'stairs' },
  { id: 'stadium-stairs', nameFr: 'Gradins de stade', nameEn: 'Stadium stairs', category: 'outdoor-urban', subcategory: 'stairs', synonyms: ['Escaliers de stade'] },
  { id: 'amphitheater-steps', nameFr: 'Gradins d\'amphithéâtre', nameEn: 'Amphitheater steps', category: 'outdoor-urban', subcategory: 'stairs' },

  // Murs et structures verticales
  { id: 'concrete-wall', nameFr: 'Mur en béton', nameEn: 'Concrete wall', category: 'outdoor-urban', subcategory: 'walls' },
  { id: 'brick-wall', nameFr: 'Mur en briques', nameEn: 'Brick wall', category: 'outdoor-urban', subcategory: 'walls' },
  { id: 'retaining-wall', nameFr: 'Mur de soutènement', nameEn: 'Retaining wall', category: 'outdoor-urban', subcategory: 'walls' },
  { id: 'low-wall', nameFr: 'Muret', nameEn: 'Low wall', category: 'outdoor-urban', subcategory: 'walls' },

  // Rampes et pentes
  { id: 'wheelchair-ramp', nameFr: 'Rampe d\'accès', nameEn: 'Wheelchair ramp', category: 'outdoor-urban', subcategory: 'ramps' },
  { id: 'parking-ramp', nameFr: 'Rampe de parking', nameEn: 'Parking ramp', category: 'outdoor-urban', subcategory: 'ramps' },
  { id: 'skateboard-ramp', nameFr: 'Rampe de skate', nameEn: 'Skateboard ramp', category: 'outdoor-urban', subcategory: 'ramps' },

  // Poteaux et colonnes
  { id: 'light-post', nameFr: 'Lampadaire', nameEn: 'Light post', category: 'outdoor-urban', subcategory: 'poles', synonyms: ['Poteau d\'éclairage'] },
  { id: 'signpost', nameFr: 'Poteau de signalisation', nameEn: 'Sign post', category: 'outdoor-urban', subcategory: 'poles' },
  { id: 'metal-pole', nameFr: 'Poteau métallique', nameEn: 'Metal pole', category: 'outdoor-urban', subcategory: 'poles' },
  { id: 'fence-post', nameFr: 'Poteau de clôture', nameEn: 'Fence post', category: 'outdoor-urban', subcategory: 'poles' },
  { id: 'slackline-posts', nameFr: 'Poteaux pour slackline', nameEn: 'Slackline posts', category: 'outdoor-urban', subcategory: 'poles' },

  // Barrières et rampes de sécurité
  { id: 'metal-railing', nameFr: 'Rampe métallique', nameEn: 'Metal railing', category: 'outdoor-urban', subcategory: 'railings' },
  { id: 'fence', nameFr: 'Clôture', nameEn: 'Fence', category: 'outdoor-urban', subcategory: 'barriers' },
  { id: 'guardrail', nameFr: 'Garde-corps', nameEn: 'Guardrail', category: 'outdoor-urban', subcategory: 'railings' },
  { id: 'bollard', nameFr: 'Potelet urbain', nameEn: 'Bollard', category: 'outdoor-urban', subcategory: 'barriers' },
  { id: 'bike-rack', nameFr: 'Arceau vélo', nameEn: 'Bike rack', category: 'outdoor-urban', subcategory: 'barriers' },
  { id: 'curb', nameFr: 'Bordure de trottoir', nameEn: 'Sidewalk curb', category: 'outdoor-urban', subcategory: 'surfaces' },

  // Équipements sportifs publics
  { id: 'basketball-court', nameFr: 'Terrain de basket', nameEn: 'Basketball court', category: 'outdoor-urban', subcategory: 'sports' },
  { id: 'soccer-field', nameFr: 'Terrain de football', nameEn: 'Soccer field', category: 'outdoor-urban', subcategory: 'sports' },
  { id: 'running-track', nameFr: 'Piste de course', nameEn: 'Running track', category: 'outdoor-urban', subcategory: 'sports' },
  { id: 'tennis-court', nameFr: 'Court de tennis', nameEn: 'Tennis court', category: 'outdoor-urban', subcategory: 'sports' },

  // Structures de jeux
  { id: 'playground-structure', nameFr: 'Structure de jeux', nameEn: 'Playground structure', category: 'outdoor-urban', subcategory: 'playground' },
  { id: 'monkey-bars-playground', nameFr: 'Échelle horizontale de jeux', nameEn: 'Playground monkey bars', category: 'outdoor-urban', subcategory: 'playground' },
  { id: 'playground-slide', nameFr: 'Toboggan', nameEn: 'Playground slide', category: 'outdoor-urban', subcategory: 'playground' },

  // Surfaces
  { id: 'asphalt-surface', nameFr: 'Surface asphaltée', nameEn: 'Asphalt surface', category: 'outdoor-urban', subcategory: 'surfaces', synonyms: ['Bitume', 'Goudron'] },
  { id: 'concrete-surface', nameFr: 'Surface bétonnée', nameEn: 'Concrete surface', category: 'outdoor-urban', subcategory: 'surfaces' },
  { id: 'rubber-surface', nameFr: 'Surface caoutchoutée', nameEn: 'Rubber surface', category: 'outdoor-urban', subcategory: 'surfaces' }
];

// Catalogue complet organisé par catégories
export const EQUIPMENT_CATALOG: EquipmentCategory[] = [
  {
    id: 'cardio',
    label: 'Cardio',
    description: 'Équipements cardiovasculaires et d\'endurance',
    equipment: CARDIO_EQUIPMENT
  },
  {
    id: 'chest',
    label: 'Pectoraux',
    description: 'Machines et équipements pour les pectoraux',
    equipment: CHEST_EQUIPMENT
  },
  {
    id: 'back',
    label: 'Dos',
    description: 'Machines et équipements pour le dos',
    equipment: BACK_EQUIPMENT
  },
  {
    id: 'shoulders',
    label: 'Épaules',
    description: 'Machines et équipements pour les épaules',
    equipment: SHOULDERS_EQUIPMENT
  },
  {
    id: 'arms',
    label: 'Bras',
    description: 'Machines et équipements pour les bras',
    equipment: ARMS_EQUIPMENT
  },
  {
    id: 'legs',
    label: 'Jambes et Fessiers',
    description: 'Machines et équipements pour les jambes et fessiers',
    equipment: LEGS_EQUIPMENT
  },
  {
    id: 'core',
    label: 'Tronc et Abdos',
    description: 'Machines et équipements pour le tronc et abdominaux',
    equipment: CORE_EQUIPMENT
  },
  {
    id: 'racks',
    label: 'Racks et Stations',
    description: 'Racks, cages et stations multifonctions',
    equipment: RACKS_STATIONS_EQUIPMENT
  },
  {
    id: 'benches',
    label: 'Bancs',
    description: 'Bancs de musculation et accessoires',
    equipment: BENCHES_EQUIPMENT
  },
  {
    id: 'weights',
    label: 'Poids Libres',
    description: 'Haltères, barres, disques et poids libres',
    equipment: FREE_WEIGHTS_EQUIPMENT
  },
  {
    id: 'cables',
    label: 'Accessoires Câbles',
    description: 'Accessoires pour machines à câbles',
    equipment: CABLE_ATTACHMENTS_EQUIPMENT
  },
  {
    id: 'functional',
    label: 'Fonctionnel et CrossFit',
    description: 'Équipements de training fonctionnel et CrossFit',
    equipment: FUNCTIONAL_EQUIPMENT
  },
  {
    id: 'calisthenics',
    label: 'Callisthénie et Outdoor',
    description: 'Équipements de callisthénie et extérieur',
    equipment: CALISTHENICS_EQUIPMENT
  },
  {
    id: 'combat',
    label: 'Sports de Combat',
    description: 'Sacs de frappe et équipements de boxe',
    equipment: COMBAT_EQUIPMENT
  },
  {
    id: 'mobility',
    label: 'Pilates, Yoga et Mobilité',
    description: 'Équipements de Pilates, yoga et récupération',
    equipment: MOBILITY_EQUIPMENT
  },
  {
    id: 'accessories',
    label: 'Accessoires Divers',
    description: 'Accessoires de musculation et rangement',
    equipment: MISC_ACCESSORIES_EQUIPMENT
  },
  {
    id: 'home-furniture',
    label: 'Meubles et Objets Maison',
    description: 'Meubles et objets du quotidien utilisables pour l\'entraînement',
    equipment: HOME_FURNITURE_EQUIPMENT
  },
  {
    id: 'outdoor-natural',
    label: 'Éléments Naturels Extérieurs',
    description: 'Arbres, roches, terrain et éléments naturels outdoor',
    equipment: OUTDOOR_NATURAL_EQUIPMENT
  },
  {
    id: 'outdoor-urban',
    label: 'Structures Urbaines Extérieures',
    description: 'Bancs, escaliers, murs et infrastructures publiques',
    equipment: OUTDOOR_URBAN_EQUIPMENT
  }
];

// Map plat de tous les équipements pour recherche rapide
export const ALL_EQUIPMENT_MAP = new Map<string, EquipmentItem>();
EQUIPMENT_CATALOG.forEach(category => {
  category.equipment.forEach(item => {
    ALL_EQUIPMENT_MAP.set(item.id, item);
  });
});

/**
 * Récupère la liste des équipements en français selon le type de lieu
 * Mise à jour avec support complet des 300+ équipements
 */
export function getEquipmentListForLocationType(locationType: 'home' | 'gym' | 'outdoor'): string[] {
  const relevantCategories: string[] = [];

  if (locationType === 'gym') {
    // Toutes les catégories pour une salle de sport (élargi avec nouveaux équipements)
    relevantCategories.push(
      'cardio',        // 19 items (incluant arm-ergometer, arc-trainer, etc.)
      'chest',         // 6 items
      'back',          // 9 items (incluant reverse-hyperextension)
      'shoulders',     // 5 items
      'arms',          // 6 items
      'legs',          // 22 items (incluant hip-thrust-machine, vertical-leg-press)
      'core',          // 8 items (incluant GHD, ab-coaster)
      'racks',         // 21 items (incluant landmine handles, wall-mounted bars)
      'benches',       // 11 items (incluant hip-thrust-bench, sissy-squat-bench)
      'weights',       // 18 items (incluant lifting chains, technique bar)
      'cables',        // 13 items (incluant multi-grip lat bar)
      'functional',    // 36 items (incluant strongman: log, axle-bar, husafell-stone)
      'calisthenics',  // 18 items (incluant cargo-net, warped-wall)
      'combat',        // 13 items (incluant thai-pads, grappling-dummy)
      'mobility',      // 14 items (incluant yoga-block, pilates-ring)
      'accessories'
    );
  } else if (locationType === 'home') {
    // Équipements fitness + meubles et objets utilisables à la maison
    relevantCategories.push(
      'cardio',          // Cardio compact pour maison
      'weights',         // Haltères, kettlebells, bandes
      'benches',         // Bancs ajustables et plyo boxes
      'racks',           // Doorway bars, wall-mounted equipment
      'functional',      // TRX, resistance bands, jump rope, gymnastic rings
      'calisthenics',    // Parallettes, push-up bars
      'accessories',     // Tous les petits accessoires
      'mobility',        // Yoga, Pilates, foam rollers
      'home-furniture'   // Chaises, tables, escaliers intérieurs
    );
  } else if (locationType === 'outdoor') {
    // Équipements extérieurs + éléments naturels + structures urbaines
    relevantCategories.push(
      'calisthenics',    // 18 items (street workout, climbing walls, obstacles)
      'functional',      // Sleds, battle ropes, agility equipment
      'outdoor-natural', // Arbres, roches, terrains, éléments naturels
      'outdoor-urban'    // 34 items (bancs publics, escaliers, murs, poteaux)
    );
  }

  const equipmentList: string[] = [];
  EQUIPMENT_CATALOG
    .filter(cat => relevantCategories.includes(cat.id))
    .forEach(category => {
      category.equipment.forEach(item => {
        equipmentList.push(item.nameFr);
      });
    });

  return equipmentList;
}

/**
 * Récupère le mapping ID → Nom français
 */
export function getEquipmentFrenchName(equipmentId: string): string {
  return ALL_EQUIPMENT_MAP.get(equipmentId)?.nameFr || equipmentId;
}

/**
 * Récupère le mapping Nom français → ID
 */
export function getEquipmentIdFromFrenchName(frenchName: string): string | null {
  const normalizedInput = frenchName.toLowerCase().trim();

  for (const [id, item] of ALL_EQUIPMENT_MAP.entries()) {
    if (item.nameFr.toLowerCase() === normalizedInput) {
      return id;
    }
  }

  return null;
}

/**
 * Compteur total d'équipements dans le catalogue
 */
export function getTotalEquipmentCount(): number {
  return ALL_EQUIPMENT_MAP.size;
}
