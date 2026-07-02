import { useState } from 'react'
import { supabase } from '../services/supabaseClient'
import { hasMetalSubstance, normalizeSubstances } from '../utils/classifyMine'

export default function AddMineForm({ coords, onClose, onAdded }) {
  const [name, setName] = useState('')
  const [company, setCompany] = useState('')
  const [mineral, setMineral] = useState('')
  const [substances, setSubstances] = useState('')
  const [surface, setSurface] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const lat = coords?.[0]
  const lon = coords?.[1]

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      setErrorMsg('')
      const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `new-${Date.now()}`
      const parsedSubstances = normalizeSubstances(substances)
      const metalOk = hasMetalSubstance(parsedSubstances)

      if (!metalOk) {
        setErrorMsg('Veuillez indiquer au moins une substance métallique reconnue (ex: cuivre, or, zinc, lithium).')
        setLoading(false)
        return
      }

      const row = {
        id,
        name: name || `Nouvelle mine ${id}`,
        status: 'mine active',
        mineral_type: mineral || null,
        substances: parsedSubstances,
        country: null,
        region: null,
        communes: [],
        lat: lat != null ? Number(lat) : null,
        lon: lon != null ? Number(lon) : null,
        company: company || null,
        surface_ha: surface ? Number(surface) : null,
        permits: [],
        last_update: new Date().toISOString().slice(0,10),
        links: company ? [{ label: `Rechercher ${company}`, url: `https://www.google.com/search?q=${encodeURIComponent(company)}` }] : [],
        source: 'user',
      }

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
        <h3 className="text-lg font-semibold mb-3">Ajouter une mine</h3>
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
          <div className="block">
            <div className="text-xs text-gray-500">Coordonnées</div>
            <div className="text-sm text-gray-700">{lat ?? '–'}, {lon ?? '–'}</div>
          </div>
        </div>

        {errorMsg && (
          <div className="mt-3 text-sm text-red-600">{errorMsg}</div>
        )}

        <div className="flex justify-end gap-2 mt-4">
          <button type="button" onClick={onClose} className="px-3 py-1 rounded border">Annuler</button>
          <button type="submit" disabled={loading} className="px-4 py-1 rounded bg-sky-600 text-white">{loading ? 'Ajout...' : 'Ajouter'}</button>
        </div>
      </form>
    </div>
  )
}
