export const STATUSES = [
  { value: 'demande initiale',                  label: 'Demande initiale',    color: '#2563eb' },
  { value: 'valide',                            label: 'Valide',              color: '#16a34a' },
  { value: 'valide - modification en instance', label: 'En modification',     color: '#ea580c' },
  { value: 'valide - survie provisoire',         label: 'Survie provisoire',   color: '#dc2626' },
]

export const KNOWN_STATUSES = new Set(STATUSES.map(s => s.value))

// Substances considérées comme métaux (métaux de base, précieux, critiques, terres rares)
export const METALLIC_SUBSTANCES = new Set([
  // métaux de base
  'fer', 'cuivre', 'zinc', 'plomb', 'étain', 'aluminium', 'nickel', 'cobalt',
  'chrome', 'manganèse', 'titane', 'vanadium', 'molybdène', 'tungstène',
  // métaux précieux
  'or', 'argent', 'platine', 'palladium', 'rhodium', 'iridium', 'osmium', 'ruthénium',
  // métaux critiques
  'lithium', 'niobium', 'tantale', 'béryllium', 'scandium', 'indium', 'gallium',
  'germanium', 'sélénium', 'tellure', 'rhénium',
  // radioactifs
  'uranium', 'thorium',
  // autres
  'bismuth', 'antimoine', 'arsenic', 'mercure',
  // combinaisons fréquentes
  'zinc-plomb', 'minerai de fer', 'minerai',
  // terres rares (groupe)
  'terres rares',
])
