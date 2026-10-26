import { LocationInput } from './LocationInput'
import { useProjectStore } from '../store/useProjectStore'

export function Sidebar() {
  const statusMessage = useProjectStore((s) => s.statusMessage)
  const error = useProjectStore((s) => s.error)
  const lat = useProjectStore((s) => s.location.lat)
  const lng = useProjectStore((s) => s.location.lng)
  const footprint = useProjectStore((s) => s.footprint)
  const mapReady = useProjectStore((s) => s.mapReady)
  const lookingUp = useProjectStore((s) => s.lookingUp)
  const scenePhase = useProjectStore((s) => s.scenePhase)
  const startBuild3D = useProjectStore((s) => s.startBuild3D)

  return (
    <aside className="flex w-full max-w-sm shrink-0 flex-col gap-5 overflow-y-auto border-r border-slate-700 bg-slate-950 p-4 text-slate-100">
      <header>
        <h1 className="text-lg font-semibold text-white">Solar Roof Preview</h1>
        <p className="mt-1 text-xs text-slate-400">
          Frontend-only POC · OSM footprints · Google satellite background
        </p>
      </header>

      <LocationInput />

      <section className="space-y-2 text-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-sky-300/90">
          Status
        </h2>
        <p className="text-slate-300">
          Pin:{' '}
          <span className="font-mono text-sky-200">
            {lat.toFixed(5)}, {lng.toFixed(5)}
          </span>
        </p>
        <p className="text-slate-400">
          Map: {mapReady ? 'ready' : 'loading…'}
          {lookingUp ? ' · looking up OSM…' : ''}
        </p>
        <p className="text-slate-400">
          Footprint:{' '}
          {footprint
            ? `${footprint.quality.footprint} (${footprint.selection})`
            : 'none yet — Find house'}
        </p>
        {footprint ? (
          <p className="rounded border border-amber-800/60 bg-amber-950/40 p-2 text-xs text-amber-100">
            <span className="font-semibold text-amber-200">Roof area: </span>
            {footprint.areaM2.toFixed(0)} m²
            {footprint.osmId ? (
              <span className="mt-1 block font-mono text-[10px] text-amber-200/70">
                {footprint.osmId}
                {footprint.tags.building
                  ? ` · building=${footprint.tags.building}`
                  : ''}
              </span>
            ) : null}
          </p>
        ) : null}

        <button
          type="button"
          disabled={!footprint || scenePhase === 'building'}
          onClick={() => startBuild3D()}
          className="w-full rounded bg-emerald-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {scenePhase === 'building'
            ? 'Building 3D…'
            : scenePhase === 'ready'
              ? 'Rebuild 3D house'
              : 'Build 3D house'}
        </button>
        <p className="text-[11px] text-slate-500">
          3D:{' '}
          {scenePhase === 'idle' && !footprint
            ? 'waiting for footprint'
            : scenePhase === 'idle'
              ? 'ready to start — button dabao'
              : scenePhase === 'building'
                ? 'loading…'
                : scenePhase === 'ready'
                  ? 'ready (right panel)'
                  : 'error'}
        </p>
        {statusMessage ? (
          <p className="rounded border border-slate-700 bg-slate-900/80 p-2 text-xs text-slate-300">
            {statusMessage}
          </p>
        ) : null}
        {error ? (
          <p className="rounded border border-rose-800 bg-rose-950/50 p-2 text-xs text-rose-300">
            {error}
          </p>
        ) : null}
      </section>

      <section className="mt-auto space-y-1 border-t border-slate-800 pt-3 text-[11px] text-slate-500">
        <p>
          Outline ={' '}
          <a
            className="underline hover:text-slate-300"
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noreferrer"
          >
            OpenStreetMap
          </a>
          . 3D ground = Esri World Imagery at your pin (Demo Key Static Maps
          limited). Panels + sun path auto after Build.
        </p>
        <p>Google Maps JS = left satellite basemap only.</p>
      </section>
    </aside>
  )
}
