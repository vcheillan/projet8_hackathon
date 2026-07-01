import https from 'https'

const SUPABASE_URL = 'https://rgeahzadkqeovprwbmzq.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJnZWFoemFka3Flb3ZwcndibXpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI3Mzc4NTAsImV4cCI6MjA5ODMxMzg1MH0.okJoAwJxRAx3WdGwqEfb7mAAWimy_7aytxS1G_8ODKc'

const KOPALINA_FR = {
  'rudy miedzi': 'cuivre', 'rudy cynku': 'zinc', 'rudy ołowiu': 'plomb',
  'rudy żelaza': 'fer', 'rudy niklu': 'nickel', 'rudy złota': 'or',
  'rudy arsenu': 'arsenic', 'rudy cyny': 'étain', 'rudy chromu': 'chrome',
}

function parseSubstances(kopalina) {
  if (!kopalina) return []
  return [...new Set(kopalina.split(',').map(s => KOPALINA_FR[s.trim().toLowerCase()]).filter(Boolean))]
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { rejectUnauthorized: false }, res => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => { try { resolve(JSON.parse(data)) } catch(e) { reject(e) } })
    }).on('error', reject)
  })
}

function parseDDMMYYYY(str) {
  if (!str) return null
  const [d, m, y] = str.split('/')
  if (!d || !m || !y) return null
  return new Date(`${y}-${m}-${d}`)
}

function centroid(rings) {
  const ring = rings?.[0]
  if (!ring?.length) return null
  return [ring.reduce((s, p) => s + p[1], 0) / ring.length, ring.reduce((s, p) => s + p[0], 0) / ring.length]
}

const url = `https://cbdgmapa.pgi.gov.pl/arcgis/rest/services/midas/MapServer/1/query?f=json&where=KOPALINA+LIKE+'%25RUDY%25'+AND+STATUS='aktualny'&outFields=*&returnGeometry=true&outSR=4326`
const data = await fetchJson(url)
if (data.error) throw new Error(data.error.message)

const rows = (data.features || []).map(f => {
  const a = f.attributes
  const substances = parseSubstances(a.KOPALINA)
  if (!substances.length) return null
  const coords = centroid(f.geometry?.rings)
  if (!coords) return null
  return {
    id: `midas-og-${a.ID_KONTURU}`,
    name: a.NAZWA_OG || a.NAZWA_ZLOZA || `Concession ${a.ID_KONTURU}`,
    status: 'valide',
    mineral_type: substances[0],
    substances,
    domaine: 'mines', type_titre: 'concession minière',
    country: 'Pologne', region: a.WYD_WYZN || '',
    communes: [], lat: coords[0], lon: coords[1],
    company: a.NADZOR_OUG || null,
    surface_ha: a.POWIERZCHNIA ? Math.round(a.POWIERZCHNIA / 10000) : null,
    permits: a.NR_REJESTR ? [a.NR_REJESTR] : [],
    last_update: parseDDMMYYYY(a.DATA_USTANOWIENIA)?.toISOString().slice(0, 10) ?? null,
    links: [], source: 'midas-og',
    mine_status_raw: a.STATUS,
    mining_start_year: parseDDMMYYYY(a.DATA_USTANOWIENIA)?.getFullYear() ?? null,
    mining_end_year: parseDDMMYYYY(a.DATA_WAZNOSCI)?.getFullYear() ?? null,
    size_category: null, main_commodities_deposit: a.KOPALINA || null,
    other_commodities: null, resources_total: null, reserves_total: null, total_ore_mined: null,
    fetched_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }
}).filter(Boolean)

console.log(`Fetched ${data.features?.length} features → ${rows.length} mines de métaux`)

const res = await fetch(`${SUPABASE_URL}/rest/v1/mines`, {
  method: 'POST',
  headers: {
    'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates',
  },
  body: JSON.stringify(rows),
})
if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`)
console.log(`Inséré ${rows.length} mines polonaises (cuivre) dans Supabase`)
