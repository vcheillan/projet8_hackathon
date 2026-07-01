import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, ZoomControl, useMap } from 'react-leaflet'
import L from 'leaflet'
import { STATUSES } from '../data/mines'

const STATUS_COLOR = Object.fromEntries(STATUSES.map(s => [s.value, s.color]))

function createPinIcon(status, isSelected) {
  const color = STATUS_COLOR[status] || '#6b7280'
  const size = isSelected ? 20 : 10

  return L.divIcon({
    html: `
      <div style="width:${size + 12}px;height:${size + 12}px;display:flex;align-items:center;justify-content:center;cursor:pointer;">
        <div style="
          width:${size}px;
          height:${size}px;
          border-radius:50%;
          background:${color};
          border:2px solid ${isSelected ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.6)'};
          box-shadow:0 1px 3px rgba(0,0,0,0.25);
        "></div>
      </div>
    `,
    className: '',
    iconSize: [size + 12, size + 12],
    iconAnchor: [(size + 12) / 2, (size + 12) / 2],
  })
}

function FlyTo({ mine }) {
  const map = useMap()
  useEffect(() => {
    if (mine) {
      map.flyTo(mine.coordinates, Math.max(map.getZoom(), 9), { duration: 0.9, easeLinearity: 0.4 })
    }
  }, [mine, map])
  return null
}

function Legend() {
  return (
    <div className="absolute bottom-8 left-4 z-[1000] bg-white/90 backdrop-blur-md border border-gray-200 rounded-lg px-3.5 py-3 space-y-2 shadow-sm">
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Statut</p>
      {STATUSES.map(s => (
        <div key={s.value} className="flex items-center gap-2.5">
          <div
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: s.color }}
          />
          <span className="text-xs text-gray-600">{s.label}</span>
        </div>
      ))}
    </div>
  )
}

export default function MapView({ mines, selectedMine, onMineSelect }) {
  const europeBounds = [[34, -12], [55, 30]]

  return (
    <div className="relative h-full w-full">
      <MapContainer
        bounds={europeBounds}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
        minZoom={4}
        maxZoom={18}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
          subdomains="abcd"
          maxZoom={19}
        />

        <ZoomControl position="bottomright" />

        {mines
          .filter(mine => {
            const [lat, lon] = mine.coordinates ?? []
            return lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180
          })
          .map(mine => (
            <Marker
              key={mine.id}
              position={mine.coordinates}
              icon={createPinIcon(mine.status, selectedMine?.id === mine.id)}
              eventHandlers={{ click: () => onMineSelect(mine) }}
            />
          ))}

        {selectedMine && <FlyTo mine={selectedMine} />}
      </MapContainer>

      <Legend />
    </div>
  )
}
