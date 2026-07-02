import { useState, useCallback, useEffect, useRef } from 'react'
import { X, Satellite, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Pencil } from 'lucide-react'
import { STATUSES } from '../data/mines'
import { buildCompanyLinks } from '../utils/companyLinks'
import AddMineForm from './AddMineForm'

const COPERNICUS_INSTANCE_ID = 'c28e4744-c9d0-4ca3-9003-70089fdddbef'
const YEAR_MIN = 2018
const YEAR_MAX = 2025
// Index 0 = zoomed out, index max = zoomed in. Slider goes left→right = out→in.
const ZOOM_DELTAS = [0.50, 0.30, 0.18, 0.10, 0.06, 0.035, 0.020, 0.012, 0.007, 0.004]
const ZOOM_DEFAULT = 4

function buildSentinelUrl(lat, lon, year, delta, offsetLat = 0, offsetLon = 0) {
  const cLat = lat + offsetLat
  const cLon = lon + offsetLon
  const bbox = `${cLat - delta},${cLon - delta},${cLat + delta},${cLon + delta}`
  const params = new URLSearchParams({
    SERVICE: 'WMS',
    VERSION: '1.3.0',
    REQUEST: 'GetMap',
    LAYERS: 'TRUE-COLOR-S2L2A',
    BBOX: bbox,
    WIDTH: 360,
    HEIGHT: 360,
    CRS: 'EPSG:4326',
    FORMAT: 'image/png',
    TIME: `${year}-01-01/${year}-12-31`,
    PRIORITY: 'leastCC',
    MAXCC: 30,
  })
  return `https://sh.dataspace.copernicus.eu/ogc/wms/${COPERNICUS_INSTANCE_ID}?${params}`
}

function PanButton({ onClick, children }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center w-7 h-7 rounded bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-colors"
    >
      {children}
    </button>
  )
}

function SatelliteViewer({ mine }) {
  const [lat, lon] = mine.coordinates ?? []
  const [year, setYear] = useState(2024)
  const [zoomIdx, setZoomIdx] = useState(ZOOM_DEFAULT)
  const [offset, setOffset] = useState([0, 0])
  const [status, setStatus] = useState('loading')
  // Map<url, HTMLImageElement> — kept alive to prevent GC-cancellation of in-flight requests
  const cacheRef = useRef(new Map())

  const delta = ZOOM_DELTAS[zoomIdx]
  const step = delta * 0.6

  const url = lat != null && lon != null
    ? buildSentinelUrl(lat, lon, year, delta, offset[0], offset[1])
    : null

  const isCached = useCallback(u => {
    const img = cacheRef.current.get(u)
    return !!(img?.complete && img?.naturalWidth > 0)
  }, [])

  const preloadOne = useCallback(u => {
    if (cacheRef.current.has(u)) return
    const img = new Image()
    img.src = u
    cacheRef.current.set(u, img)
  }, [])

  // Show spinner only when target isn't already in cache
  useEffect(() => {
    if (!url) return
    if (isCached(url)) setStatus('ok')
    else setStatus('loading')
  }, [url, isCached])

  // Preload 4 pan neighbors + adjacent zoom levels
  useEffect(() => {
    if (lat == null || lon == null) return
    const [oLat, oLon] = offset
    const urls = [
      buildSentinelUrl(lat, lon, year, delta, oLat + step, oLon),
      buildSentinelUrl(lat, lon, year, delta, oLat - step, oLon),
      buildSentinelUrl(lat, lon, year, delta, oLat, oLon - step),
      buildSentinelUrl(lat, lon, year, delta, oLat, oLon + step),
    ]
    if (zoomIdx > 0)
      urls.push(buildSentinelUrl(lat, lon, year, ZOOM_DELTAS[zoomIdx - 1], oLat, oLon))
    if (zoomIdx < ZOOM_DELTAS.length - 1)
      urls.push(buildSentinelUrl(lat, lon, year, ZOOM_DELTAS[zoomIdx + 1], oLat, oLon))
    urls.forEach(preloadOne)
  }, [lat, lon, year, delta, step, offset, zoomIdx, preloadOne])

  const pan = useCallback((dLat, dLon) => {
    setOffset(([oLat, oLon]) => [oLat + dLat, oLon + dLon])
  }, [])

  const handleYearChange = useCallback(e => {
    setYear(Number(e.target.value))
  }, [])

  const handleZoomChange = useCallback(e => {
    setZoomIdx(Number(e.target.value))
    setOffset([0, 0])
  }, [])

  if (!url) return null

  return (
    <Section>
      <div className="flex items-center justify-between mb-3">
        <SectionTitle>
          <span className="flex items-center gap-1.5">
            <Satellite className="w-3 h-3" />Image satellite
          </span>
        </SectionTitle>
        <span className="text-xs font-semibold text-slate-600">{year}</span>
      </div>

      {/* Image + pan overlay */}
      <div className="relative w-full aspect-square rounded overflow-hidden bg-gray-100">
        {status === 'loading' && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="w-6 h-6 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin" />
          </div>
        )}
        {status === 'error' && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <p className="text-xs text-gray-400 text-center px-4">Image indisponible pour cette période</p>
          </div>
        )}
        {/* No key= : React réutilise le même élément DOM → l'ancienne image reste visible pendant le chargement */}
        <img
          src={url}
          alt={`Sentinel-2 ${year}`}
          className={`w-full h-full object-cover transition-opacity duration-300 ${status === 'ok' ? 'opacity-100' : 'opacity-0'}`}
          onLoad={() => setStatus('ok')}
          onError={() => setStatus('error')}
        />

        {/* Pan arrows overlay */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-2 left-1/2 -translate-x-1/2 pointer-events-auto">
            <PanButton onClick={() => pan(step, 0)}><ChevronUp className="w-4 h-4" /></PanButton>
          </div>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 pointer-events-auto">
            <PanButton onClick={() => pan(-step, 0)}><ChevronDown className="w-4 h-4" /></PanButton>
          </div>
          <div className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-auto">
            <PanButton onClick={() => pan(0, -step)}><ChevronLeft className="w-4 h-4" /></PanButton>
          </div>
          <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-auto">
            <PanButton onClick={() => pan(0, step)}><ChevronRight className="w-4 h-4" /></PanButton>
          </div>
        </div>
      </div>

      {/* Zoom slider */}
      <div className="mt-3 px-0.5">
        <span className="text-[10px] text-gray-400 uppercase tracking-wider">Zoom</span>
        <input
          type="range"
          min={0}
          max={ZOOM_DELTAS.length - 1}
          step={1}
          value={zoomIdx}
          onChange={handleZoomChange}
          className="w-full mt-1 accent-slate-600 cursor-pointer"
        />
        <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
          <span>–</span>
          <span>+</span>
        </div>
      </div>

      {/* Year slider */}
      <div className="mt-3 px-0.5">
        <span className="text-[10px] text-gray-400 uppercase tracking-wider">Année</span>
        <input
          type="range"
          min={YEAR_MIN}
          max={YEAR_MAX}
          value={year}
          onChange={handleYearChange}
          className="w-full mt-1 accent-slate-600 cursor-pointer"
        />
        <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
          <span>{YEAR_MIN}</span>
          <span>{YEAR_MAX}</span>
        </div>
      </div>

      <p className="mt-2 text-[10px] text-gray-400 leading-relaxed">
        Sentinel-2 L2A · Copernicus Data Space · image la moins nuageuse de l'année
      </p>
    </Section>
  )
}

const SOURCE_LABELS = {
  camino:      'Camino · France',
  gtk:         'GTK · Finlande',
  dmf:         'DMF · Norvège',
  nlog:        'NLOG · Pays-Bas',
  'midas-og':  'MIDAS · Pologne',
  igme:        'IGME · Espagne',
  geosphere:   'GeoSphere · Autriche',
  cgs:         'CGS · Rép. tchèque',
  swisstopo:   'Swisstopo · Suisse',
  sgu:         'SGU MRR · Suède',
}

export default function MineDetailPanel({ mine, onClose, onMineUpdate }) {
  return (
    <div
      className={`
        absolute top-0 right-0 h-full w-[380px] z-[1000]
        bg-white border-l border-gray-200
        flex flex-col shadow-lg
        transform transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]
        ${mine ? 'translate-x-0' : 'translate-x-full'}
      `}
    >
      {mine && <Content mine={mine} onClose={onClose} />}
    </div>
  )
}

function Content({ mine, onClose, onMineUpdate }) {
  const [isEditing, setIsEditing] = useState(false)
  const status = STATUSES.find(s => s.value === mine.status)
  const links = Array.isArray(mine.links) ? [...mine.links] : []
  const fallbackLinks = buildCompanyLinks(mine.company || mine.name)
  const allLinks = [...links]
  fallbackLinks.forEach(link => {
    if (!allLinks.some(existing => existing?.url === link.url)) {
      allLinks.push(link)
    }
  })

  return (
    <>
      {/* ── Header ── */}
      <div className="px-5 pt-5 pb-4 border-b border-gray-200">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-gray-900 font-semibold text-lg leading-snug">{mine.name}</h2>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {mine.country && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-medium">
                  {mine.country}
                </span>
              )}
              <span className="text-xs font-medium" style={{ color: status?.color || '#6b7280' }}>
                {status?.label || mine.status}
              </span>
              {mine.substances?.length > 0 && (
                <>
                  <span className="text-gray-300">·</span>
                  <span className="text-xs text-gray-500 capitalize">{mine.substances.join(', ')}</span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsEditing(true)}
              className="flex-shrink-0 p-1.5 text-gray-400 hover:text-gray-700 transition-colors"
              title="Modifier la mine"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="flex-shrink-0 p-1.5 text-gray-400 hover:text-gray-700 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div className="flex-1 overflow-y-auto">

        {/* Key info grid */}
        <Section>
          <SectionTitle>Informations clés</SectionTitle>
          <div className="grid grid-cols-2 gap-2 mt-2.5">
            <InfoCard label="Région" value={mine.region || '—'} />
            <InfoCard label="Titulaire" value={mine.company || '—'} />
            <InfoCard
              label="Surface totale"
              value={mine.surface_ha != null ? `${mine.surface_ha.toLocaleString('fr-FR')} ha` : '—'}
            />
            <InfoCard label="Type de titre" value={mine.type_titre || '—'} />
          </div>
        </Section>

        {/* Source badge */}
        {SOURCE_LABELS[mine.source] && (
          <Section>
            <span className="text-xs text-sky-600 font-medium">
              Source : {SOURCE_LABELS[mine.source]}
            </span>
          </Section>
        )}

        {/* Satellite image viewer */}
        <SatelliteViewer mine={mine} />

        {/* GTK: exploitation */}
        {mine.source === 'gtk' && (
          <Section>
            <SectionTitle>Exploitation</SectionTitle>
            <div className="grid grid-cols-2 gap-2 mt-2.5">
              <InfoCard label="Taille du gisement" value={mine.size_category || '—'} />
              <InfoCard
                label="Années d'exploitation"
                value={mine.mining_start_year
                  ? `${mine.mining_start_year}${mine.mining_end_year ? ' – ' + mine.mining_end_year : ' →'}`
                  : '—'}
              />
            </div>
            {mine.main_commodities_deposit && (
              <p className="mt-2 text-xs text-gray-600">
                <span className="text-gray-400 uppercase text-[10px] tracking-wider">Commodités principales : </span>
                {mine.main_commodities_deposit}
              </p>
            )}
            {mine.other_commodities && (
              <p className="mt-1 text-xs text-gray-600">
                <span className="text-gray-400 uppercase text-[10px] tracking-wider">Autres : </span>
                {mine.other_commodities}
              </p>
            )}
          </Section>
        )}

        {/* GTK: ressources & réserves */}
        {mine.source === 'gtk' && (mine.resources_total || mine.reserves_total || mine.total_ore_mined) && (
          <Section>
            <SectionTitle>Ressources & réserves</SectionTitle>
            <div className="mt-2.5 space-y-2">
              {mine.resources_total && (
                <div className="bg-gray-50 rounded px-3 py-2.5">
                  <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Ressources totales</p>
                  <p className="text-xs text-gray-800 font-mono">{mine.resources_total}</p>
                </div>
              )}
              {mine.reserves_total && (
                <div className="bg-gray-50 rounded px-3 py-2.5">
                  <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Réserves totales</p>
                  <p className="text-xs text-gray-800 font-mono">{mine.reserves_total}</p>
                </div>
              )}
              {mine.total_ore_mined && (
                <div className="bg-gray-50 rounded px-3 py-2.5">
                  <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Minerai extrait total</p>
                  <p className="text-xs text-gray-800 font-mono">{mine.total_ore_mined}</p>
                </div>
              )}
            </div>
          </Section>
        )}

        {/* Domaine */}
        {mine.domaine && mine.source !== 'gtk' && (
          <Section>
            <SectionTitle>Domaine</SectionTitle>
            <p className="mt-2 text-sm text-gray-700 capitalize">{mine.domaine}</p>
          </Section>
        )}

        {/* Communes */}
        {mine.communes?.length > 0 && (
          <Section>
            <SectionTitle>Communes concernées</SectionTitle>
            <p className="mt-2 text-sm text-gray-600 leading-relaxed">
              {mine.communes.join(', ')}
            </p>
          </Section>
        )}

        {/* Références */}
        {mine.permits?.length > 0 && (
          <Section>
            <SectionTitle>Références</SectionTitle>
            <ul className="mt-2.5 space-y-2">
              {mine.permits.map((p, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span
                    className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: status?.color || '#94a3b8' }}
                  />
                  <span className="text-xs text-gray-700 leading-relaxed font-mono">{p}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Liens */}
        {(() => {
          const links = Array.isArray(mine.links) ? [...mine.links] : []
          const fallbackLinks = buildCompanyLinks(mine.company || mine.name)
          const allLinks = [...links]
          fallbackLinks.forEach(link => {
            if (!allLinks.some(existing => existing?.url === link.url)) {
              allLinks.push(link)
            }
          })

          return allLinks.length > 0 ? (
            <Section>
              <SectionTitle>Sources & liens</SectionTitle>
              <div className="mt-2.5 space-y-1.5">
                {allLinks.map((link, i) => (
                  <a
                    key={i}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-xs text-slate-600 underline hover:text-slate-900 transition-colors"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            </Section>
          ) : null
        })()}
      </div>

      {isEditing && (
        <AddMineForm
          mode="edit"
          initialMine={mine}
          coords={mine.coordinates}
          onClose={() => setIsEditing(false)}
          onSaved={(updatedMine) => {
            onMineUpdate?.(updatedMine)
            setIsEditing(false)
          }}
        />
      )}
    </>
  )
}

function Section({ children }) {
  return <div className="px-5 py-4 border-b border-gray-100">{children}</div>
}

function SectionTitle({ children }) {
  return (
    <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
      {children}
    </div>
  )
}

function InfoCard({ label, value }) {
  return (
    <div className="bg-gray-50 rounded px-3 py-2.5">
      <span className="text-[10px] uppercase tracking-wider text-gray-400 block mb-1">{label}</span>
      <p className="text-sm text-gray-800 font-medium leading-snug">{value}</p>
    </div>
  )
}
