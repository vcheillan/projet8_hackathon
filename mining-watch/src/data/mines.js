export const STATUSES = [
  { value: 'mine active',                      label: 'Mine active',         color: '#059669' },
  { value: 'demande initiale',                  label: 'Demande initiale',    color: '#2563eb' },
  { value: 'valide',                            label: 'Valide',              color: '#16a34a' },
  { value: 'valide - modification en instance', label: 'En modification',     color: '#ea580c' },
  { value: 'valide - survie provisoire',         label: 'Survie provisoire',   color: '#dc2626' },
]

export const KNOWN_STATUSES = new Set(STATUSES.map(s => s.value))

// Substances considérées comme métaux (métaux de base, précieux, critiques, terres rares)
export const METALLIC_SUBSTANCES = new Set([
  'fer', 'cuivre', 'zinc', 'plomb', 'étain', 'aluminium', 'nickel', 'cobalt',
  'chrome', 'manganèse', 'titane', 'vanadium', 'molybdène', 'tungstène',
  'or', 'argent', 'platine', 'palladium', 'rhodium', 'iridium', 'osmium', 'ruthénium',
  'lithium', 'niobium', 'tantale', 'béryllium', 'scandium', 'indium', 'gallium',
  'germanium', 'sélénium', 'tellure', 'rhénium', 'uranium', 'thorium',
  'bismuth', 'antimoine', 'arsenic', 'mercure', 'zinc-plomb', 'minerai de fer', 'minerai', 'terres rares'
])
