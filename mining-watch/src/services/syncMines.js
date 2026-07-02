import { supabase } from './supabaseClient'
import { fetchMines } from './caminoApi'
import { fetchGtkMines } from './gtkApi'
import { fetchNlogMines } from './nlogApi'
import { fetchMidasMines } from './midasMinesApi'
import { fetchDmfMines } from './dmfApi'
import { fetchIgmeMines } from './igmeApi'
import { fetchGeosphereMines } from './geosphereApi'
import { fetchCgsMines } from './cgsApi'
import { fetchSwisstopoMines } from './swisstopoApi'
import { fetchSguMines } from './sguApi'
import { enrichMineLinks } from '../utils/companyLinks'
import { normalizeSubstances, mapStatus } from '../utils/classifyMine'

function mineToRow(mine) {
  const links = enrichMineLinks(mine)

  return {
    id:                       mine.id,
    name:                     mine.name,
    status:                   mapStatus(mine.status) ?? mine.status,
    mineral_type:             mine.mineral_type,
    substances:               normalizeSubstances(mine.substances),
    domaine:                  mine.domaine ?? null,
    type_titre:               mine.type_titre ?? null,
    country:                  mine.country,
    region:                   mine.region ?? null,
    communes:                 mine.communes ?? [],
    lat:                      mine.coordinates?.[0] ?? null,
    lon:                      mine.coordinates?.[1] ?? null,
    company:                  mine.company ?? null,
    surface_ha:               mine.surface_ha ?? null,
    permits:                  mine.permits ?? [],
    last_update:              mine.last_update ?? null,
    links,
    source:                   mine.source ?? 'camino',
    mine_status_raw:          mine.mine_status_raw ?? null,
    mining_start_year:        mine.mining_start_year ?? null,
    mining_end_year:          mine.mining_end_year ?? null,
    size_category:            mine.size_category ?? null,
    main_commodities_deposit: mine.main_commodities_deposit ?? null,
    other_commodities:        mine.other_commodities ?? null,
    resources_total:          mine.resources_total != null ? String(mine.resources_total) : null,
    reserves_total:           mine.reserves_total  != null ? String(mine.reserves_total)  : null,
    total_ore_mined:          mine.total_ore_mined != null ? String(mine.total_ore_mined) : null,
  }
}

export async function syncFromApis() {
  const [caminoResult, gtkResult, nlogResult, midasResult, dmfResult, igmeResult, geosphereResult, cgsResult, swissResult, sguResult] = await Promise.allSettled([
    fetchMines(),
    fetchGtkMines(),
    fetchNlogMines(),
    fetchMidasMines(),
    fetchDmfMines(),
    fetchIgmeMines(),
    fetchGeosphereMines(),
    fetchCgsMines(),
    fetchSwisstopoMines(),
    fetchSguMines(),
  ])

  const caminoMines    = caminoResult.status    === 'fulfilled' ? caminoResult.value    : []
  const gtkMines       = gtkResult.status       === 'fulfilled' ? gtkResult.value       : []
  const nlogMines      = nlogResult.status      === 'fulfilled' ? nlogResult.value      : []
  const midasMines     = midasResult.status     === 'fulfilled' ? midasResult.value     : []
  const dmfMines       = dmfResult.status       === 'fulfilled' ? dmfResult.value       : []
  const igmeMines      = igmeResult.status      === 'fulfilled' ? igmeResult.value      : []
  const geosphereMines = geosphereResult.status === 'fulfilled' ? geosphereResult.value : []
  const cgsMines       = cgsResult.status       === 'fulfilled' ? cgsResult.value       : []
  const swissMines     = swissResult.status     === 'fulfilled' ? swissResult.value     : []
  const sguMines       = sguResult.status       === 'fulfilled' ? sguResult.value       : []

  if (caminoResult.status    === 'rejected') console.error('Camino sync failed:',     caminoResult.reason)
  if (gtkResult.status       === 'rejected') console.error('GTK sync failed:',        gtkResult.reason)
  if (nlogResult.status      === 'rejected') console.error('NLOG sync failed:',       nlogResult.reason)
  if (midasResult.status     === 'rejected') console.error('MIDAS-OG sync failed:',   midasResult.reason)
  if (dmfResult.status       === 'rejected') console.error('DMF sync failed:',        dmfResult.reason)
  if (igmeResult.status      === 'rejected') console.error('IGME sync failed:',       igmeResult.reason)
  if (geosphereResult.status === 'rejected') console.error('GeoSphere sync failed:',  geosphereResult.reason)
  if (cgsResult.status       === 'rejected') console.error('CGS sync failed:',        cgsResult.reason)
  if (swissResult.status     === 'rejected') console.error('Swisstopo sync failed:',  swissResult.reason)
  if (sguResult.status       === 'rejected') console.error('SGU sync failed:',         sguResult.reason)

  const allMines = [...caminoMines, ...gtkMines, ...nlogMines, ...midasMines, ...dmfMines, ...igmeMines, ...geosphereMines, ...cgsMines, ...swissMines, ...sguMines]
  // Deduplicate by id — keeps last occurrence (most recent source wins)
  const rows = [...new Map(allMines.map(mineToRow).map(r => [r.id, r])).values()]
  console.log(`[sync] ${allMines.length} mines total → ${rows.length} après déduplication`)

  const BATCH = 500
  for (let i = 0; i < rows.length; i += BATCH) {
    const { error } = await supabase
      .from('mines')
      .upsert(rows.slice(i, i + BATCH), { onConflict: 'id' })
    if (error) {
      console.error('Supabase upsert error:', JSON.stringify(error))
      throw new Error(`Supabase upsert failed: ${error.message}`)
    }
  }

  await supabase.from('sync_log').insert({
    source:      'camino+gtk+nlog+midas-og+dmf+igme+geosphere+cgs+swisstopo+sgu',
    finished_at: new Date().toISOString(),
    mines_count: rows.length,
    success:     true,
  })

  return rows.length
}

export async function loadMinesFromDb() {
  const { data, error } = await supabase
    .from('mines')
    .select('*')

  if (error) throw new Error(`Supabase select failed: ${error.message}`)

  return (data ?? []).map(row => ({
    id:                       row.id,
    name:                     row.name,
    status:                   row.status,
    mineral_type:             row.mineral_type,
    substances:               row.substances ?? [],
    domaine:                  row.domaine,
    type_titre:               row.type_titre,
    country:                  row.country,
    region:                   row.region ?? '',
    communes:                 row.communes ?? [],
    coordinates:              row.lat && row.lon ? [row.lat, row.lon] : null,
    company:                  row.company,
    surface_ha:               row.surface_ha,
    permits:                  row.permits ?? [],
    last_update:              row.last_update,
    links:                    enrichMineLinks({ links: row.links ?? [], company: row.company }),
    source:                   row.source,
    mine_status_raw:          row.mine_status_raw,
    mining_start_year:        row.mining_start_year,
    mining_end_year:          row.mining_end_year,
    size_category:            row.size_category,
    main_commodities_deposit: row.main_commodities_deposit,
    other_commodities:        row.other_commodities,
    resources_total:          row.resources_total,
    reserves_total:           row.reserves_total,
    total_ore_mined:          row.total_ore_mined,
  })).filter(m => m.coordinates)
}
