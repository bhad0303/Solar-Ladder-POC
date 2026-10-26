import { useEffect, useState } from 'react'
import { isValidLatLng } from '../types/project'
import { useProjectStore } from '../store/useProjectStore'

export function LocationInput() {
  const lat = useProjectStore((s) => s.location.lat)
  const lng = useProjectStore((s) => s.location.lng)
  const setLatLng = useProjectStore((s) => s.setLatLng)
  const findHouse = useProjectStore((s) => s.findHouse)
  const lookingUp = useProjectStore((s) => s.lookingUp)

  const [latText, setLatText] = useState(String(lat))
  const [lngText, setLngText] = useState(String(lng))
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    setLatText(String(lat))
    setLngText(String(lng))
  }, [lat, lng])

  const apply = () => {
    const nextLat = Number(latText)
    const nextLng = Number(lngText)
    if (!isValidLatLng(nextLat, nextLng)) {
      setLocalError('Lat must be −90…90 and lng −180…180.')
      return
    }
    setLocalError(null)
    setLatLng(nextLat, nextLng)
    void findHouse()
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-sky-300/90">
        Location
      </h2>
      <label className="block text-sm text-slate-300">
        Latitude
        <input
          type="number"
          step="any"
          min={-90}
          max={90}
          value={latText}
          onChange={(e) => setLatText(e.target.value)}
          className="mt-1 w-full rounded border border-slate-600 bg-slate-900 px-2 py-1.5 text-slate-100"
        />
      </label>
      <label className="block text-sm text-slate-300">
        Longitude
        <input
          type="number"
          step="any"
          min={-180}
          max={180}
          value={lngText}
          onChange={(e) => setLngText(e.target.value)}
          className="mt-1 w-full rounded border border-slate-600 bg-slate-900 px-2 py-1.5 text-slate-100"
        />
      </label>
      {localError ? (
        <p className="text-sm text-rose-400">{localError}</p>
      ) : null}
      <button
        type="button"
        onClick={apply}
        disabled={lookingUp}
        className="w-full rounded bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:cursor-wait disabled:opacity-60"
      >
        {lookingUp ? 'Finding OSM outline…' : 'Find house'}
      </button>
      <p className="text-xs text-slate-500">
        Map pe pin roof ke upar rakho, Find house dabao — area OSM se calculate
        hoti hai (Google image se outline nahi kaatte).
      </p>
    </section>
  )
}
