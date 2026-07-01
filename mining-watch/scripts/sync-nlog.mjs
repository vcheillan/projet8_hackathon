import https from 'https'

const SUPABASE_URL = 'https://rgeahzadkqeovprwbmzq.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJnZWFoemFka3Flb3ZwcndibXpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI3Mzc4NTAsImV4cCI6MjA5ODMxMzg1MH0.okJoAwJxRAx3WdGwqEfb7mAAWimy_7aytxS1G_8ODKc'

const EXCLUDED = new Set(['COAL', 'CO2', 'EARTHHEAT', 'NITROGEN', 'HYDROCARBONS', 'GASOIL'])

const STATUS_MAP = {
  EFFECTIVE: 'valide', VALID: 'valide',
  EXTENDED: 'valide - survie provisoire', EXTENDEDWVA: 'valide - survie provisoire',
  APPLIED: 'demande initiale',
}

const RESOURCE_FR = { SALT: 'sel', HYDROCARBONS: 'hydrocarbures', GASOIL: 'pétrole/gaz' }

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { rejectUnauthorized: false }, res => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => { try { resolve(JSON.parse(data)) } catch(e) { reject(e) } })
    }).on('error', reject)
  })
}

function centroid(rings) {
  const ring = rings?.[0]
  if (!ring?.length) return null
  return [
    ring.reduce((s, p) => s + p[1], 0) / ring.length,
    ring.reduce((s, p) => s + p[0], 0) / ring.length,
  ]
}

async function fetchAll() {
  const all = []
  let offset = 0
  while (true) {
    const url = `https://www.nlog.nl/standalone/rest/services/nlog_gdn/gdw_ng_licence_utm_v1/MapServer/0/query?f=json&where=licence_status_cd+IN+(%27EFFECTIVE%27,%27VALID%27,%27EXTENDED%27,%27EXTENDEDWVA%27,%27APPLIED%27)&outFields=*&returnGeometry=true&outSR=4326&resultRecordCount=200&resultOffset=${offset}`
    const data = await fetchJson(url)
    if (data.error) throw new Error(data.error.message)
    all.push(...(data.features || []))
    if (!data.exceededTransferLimit || (data.features || []).length < 200) break
    offset += 200
  }
  return all
}

function transform(f) {
  const a = f.attributes
  if (EXCLUDED.has(a.licence_resource_cd)) return null
  const status = STATUS_MAP[a.licence_status_cd]
  if (!status) return null
  const coords = centroid(f.geometry?.rings)
  if (!coords) return null
  const sub = RESOURCE_FR[a.licence_resource_cd] || a.licence_resource_cd?.toLowerCase()
  return {
    id: `nlog-${a.gdnr_object_id}`,
    name: a.licence_nm || a.licence_cd,
    status,
    mineral_type: sub || 'inconnu',
    substances: sub ? [sub] : [],
    domaine: 'mines', type_titre: a.licence_type_cd || '',
    country: 'Pays-Bas', region: a.licenced_area_nm || '',
    communes: [], lat: coords[0], lon: coords[1],
    company: null, surface_ha: null,
    permits: a.licence_cd ? [a.licence_cd] : [],
    last_update: null, links: [],
    source: 'nlog',
    mine_status_raw: a.licence_status_cd,
    mining_start_year: null, mining_end_year: null,
    size_category: null, main_commodities_deposit: a.licence_resource_cd || null,
    other_commodities: null, resources_total: null, reserves_total: null, total_ore_mined: null,
    fetched_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }
}

async function upsert(rows) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/mines`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates',
    },
    body: JSON.stringify(rows),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Supabase error ${res.status}: ${err}`)
  }
}

const features = await fetchAll()
console.log(`Fetched ${features.length} features from NLOG`)

const rowMap = new Map()
for (const f of features) {
  const row = transform(f)
  if (row) rowMap.set(row.id, row)
}
const rows = [...rowMap.values()]
console.log(`Transformed ${rows.length} mines (after filtering + dedup)`)

await upsert(rows)
console.log(`Inserted ${rows.length} NLOG mines into Supabase`)
