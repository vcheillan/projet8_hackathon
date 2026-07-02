import { useEffect, useState } from 'react'
import { supabase } from '../services/supabaseClient'
import { STATUSES } from '../data/mines'
import { hasMetalSubstance, normalizeSubstances } from '../utils/classifyMine'

export default function AddMineForm({ coords, onClose, onAdded, onSaved, mode = 'add', initialMine = null }) {
  const [name, setName] = useState(initialMine?.name || '')
  const [company, setCompany] = useState(initialMine?.company || '')
  const [mineral, setMineral] = useState(initialMine?.mineral_type || '')
  const [substances, setSubstances] = useState((initialMine?.substances || []).join(', '))
  const [surface, setSurface] = useState(initialMine?.surface_ha != null ? String(initialMine.surface_ha) : '')
  const [status, setStatus] = useState(initialMine?.status || 'mine active')
  const [latInput, setLatInput] = useState('')
  const [lonInput, setLonInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    const initialLat = initialMine?.coordinates?.[0] ?? initialMine?.lat ?? coords?.[0]
    const initialLon = initialMine?.coordinates?.[1] ?? initialMine?.lon ?? coords?.[1]
    setLatInput(initialLat != null ? String(initialLat) : '')
    setLonInput(initialLon != null ? String(initialLon) : '')
  }, [coords, initialMine])

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      setErrorMsg('')
      const parsedSubstances = normalizeSubstances(substances)
      const metalOk = hasMetalSubstance(parsedSubstances)
      const parsedLat = latInput === '' ? null : Number(latInput)
      const parsedLon = lonInput === '' ? null : Number(lonInput)

      if (!metalOk) {
        setErrorMsg('Veuillez indiquer au moins une substance métallique reconnue (ex: cuivre, or, zinc, lithium).')
        setLoading(false)
        return
      }

      if (parsedLat == null || parsedLon == null || !Number.isFinite(parsedLat) || !Number.isFinite(parsedLon) || parsedLat < -90 || parsedLat > 90 || parsedLon < -180 || parsedLon > 180) {
        setErrorMsg('Veuillez saisir des coordonnées GPS valides (latitude entre -90 et 90, longitude entre -180 et 180).')
        setLoading(false)
        return
      }

      const basePayload = {
        name: name || `Nouvelle mine ${initialMine?.id || Date.now()}`,
        status: status || 'mine active',
        mineral_type: mineral || null,
        substances: parsedSubstances,
        country: initialMine?.country || null,
        region: initialMine?.region || null,
        communes: initialMine?.communes || [],
        lat: parsedLat,
        lon: parsedLon,
        company: company || null,
        surface_ha: surface ? Number(surface) : null,
        permits: initialMine?.permits || [],
        last_update: new Date().toISOString().slice(0,10),
        links: initialMine?.links || (company ? [{ label: `Rechercher ${company}`, url: `https://www.google.com/search?q=${encodeURIComponent(company)}` }] : []),
        source: initialMine?.source || 'user',
      }

      if (mode === 'edit' && initialMine?.id) {
        const { error } = await supabase.from('mines').update(basePayload).eq('id', initialMine.id)
        if (error) throw error
        if (onSaved) onSaved({
          ...initialMine,
          ...basePayload,
          id: initialMine.id,
          coordinates: [parsedLat, parsedLon],
        })
      } else {
        const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `new-${Date.now()}`
        const row = { id, ...basePayload }
        const { error } = await supabase.from('mines').insert([row])
        if (error) throw error
        if (onAdded) onAdded({
          id: row.id,
          name: row.name,
          status: row.status,
          mineral_type: row.mineral_type,
          substances: row.substances,
          country: row.country,
          region: row.region,
          communes: row.communes,
          coordinates: row.lat != null && row.lon != null ? [row.lat, row.lon] : null,
          company: row.company,
          surface_ha: row.surface_ha,
          permits: row.permits,
          last_update: row.last_update,
          links: row.links,
          source: row.source,
        })
      }
      onClose()
    } catch (err) {
      console.error('Insert mine failed', err)
      alert('Échec de l\'ajout en base : ' + (err.message || err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/40">
      <form onSubmit={handleSubmit} className="bg-white rounded-lg w-[520px] p-5 shadow-lg">
        <h3 className="text-lg font-semibold mb-3">{mode === 'edit' ? 'Modifier la mine' : 'Ajouter une mine'}</h3>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <div className="text-xs text-gray-500">Nom</div>
            <input className="w-full border px-2 py-1 rounded" value={name} onChange={e => setName(e.target.value)} />
          </label>
          <label className="block">
            <div className="text-xs text-gray-500">Titulaire</div>
            <input className="w-full border px-2 py-1 rounded" value={company} onChange={e => setCompany(e.target.value)} />
          </label>
          <label className="block">
            <div className="text-xs text-gray-500">Mineral type</div>
            <input className="w-full border px-2 py-1 rounded" value={mineral} onChange={e => setMineral(e.target.value)} />
          </label>
          <label className="block">
            <div className="text-xs text-gray-500">Substances (virgule)</div>
            <input className="w-full border px-2 py-1 rounded" value={substances} onChange={e => setSubstances(e.target.value)} />
          </label>
          <label className="block">
            <div className="text-xs text-gray-500">Surface (ha)</div>
            <input type="number" step="0.01" className="w-full border px-2 py-1 rounded" value={surface} onChange={e => setSurface(e.target.value)} />
          </label>
          <label className="block">
            <div className="text-xs text-gray-500">Statut</div>
            <select className="w-full border px-2 py-1 rounded" value={status} onChange={e => setStatus(e.target.value)}>
              {STATUSES.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <div className="text-xs text-gray-500">Latitude</div>
            <input type="number" step="0.000001" className="w-full border px-2 py-1 rounded" value={latInput} onChange={e => setLatInput(e.target.value)} />
          </label>
          <label className="block">
            <div className="text-xs text-gray-500">Longitude</div>
            <input type="number" step="0.000001" className="w-full border px-2 py-1 rounded" value={lonInput} onChange={e => setLonInput(e.target.value)} />
          </label>
        </div>

        {errorMsg && (
          <div className="mt-3 text-sm text-red-600">{errorMsg}</div>
        )}

        <div className="flex justify-end gap-2 mt-4">
          <button type="button" onClick={onClose} className="px-3 py-1 rounded border">Annuler</button>
          <button type="submit" disabled={loading} className="px-4 py-1 rounded bg-sky-600 text-white">{loading ? (mode === 'edit' ? 'Enregistrement...' : 'Ajout...') : (mode === 'edit' ? 'Enregistrer' : 'Ajouter')}</button>
        </div>
      </form>
    </div>
  )
}
