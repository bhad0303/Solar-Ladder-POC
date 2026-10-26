import {
  formatDayOfYear,
  formatMinuteOfDay,
} from '../geo/coordinates'
import { allPanels, zoneStats } from '../data/types'
import { usePreviewStore } from '../state/usePreviewStore'

type Props = {
  capsLabel: string | null
  onRunSunAccess: () => void
  sunAccessBusy: boolean
}

/**
 * Solar preview controls — day/time, panels, sun access, measurements.
 * Ground imagery = local company satellite photo (no paid map APIs).
 */
export function Sidebar({ capsLabel, onRunSunAccess, sunAccessBusy }: Props) {
  const project = usePreviewStore((s) => s.project)
  const settings = usePreviewStore((s) => s.settings)
  const patchSettings = usePreviewStore((s) => s.patchSettings)
  const setDay = usePreviewStore((s) => s.setDay)
  const setTime = usePreviewStore((s) => s.setTime)
  const presetJune = usePreviewStore((s) => s.presetJune)
  const presetDec = usePreviewStore((s) => s.presetDec)
  const totalKw = usePreviewStore((s) => s.totalKw)

  const panels = allPanels(project)
  const zones = zoneStats(project)

  return (
    <aside className="sidebar w-full max-w-sm shrink-0">
      <header className="sidebar-header">
        <h1>{project.name}</h1>
        <p className="muted">{project.subtitle}</p>
        <p className="kw">{totalKw().toFixed(1)} kW · {panels.length} panels</p>
      </header>

      <section>
        <h2>Solar array</h2>
        <ul className="zone-list">
          {zones.map((z) => (
            <li key={z.id}>
              <span>{z.name}</span>
              <span className="muted">
                {z.count} panels · {z.kw.toFixed(1)} kW
              </span>
            </li>
          ))}
        </ul>
        <p className="muted" style={{ marginTop: '0.5rem' }}>
          Each panel sits on 4 pillars and a rack (raised, tilted). Panel Info
          shows the labels.
        </p>
      </section>

      <section>
        <h2>Sun path</h2>
        <label className="field">
          <span>Date: {formatDayOfYear(settings.dayOfYear)}</span>
          <input
            type="range"
            min={1}
            max={365}
            value={settings.dayOfYear}
            onChange={(e) => setDay(Number(e.target.value))}
          />
        </label>
        <label className="field">
          <span>Time: {formatMinuteOfDay(settings.minuteOfDay)}</span>
          <input
            type="range"
            min={0}
            max={1439}
            step={5}
            value={settings.minuteOfDay}
            onChange={(e) => setTime(Number(e.target.value))}
          />
        </label>
        <div className="btn-row">
          <button
            type="button"
            onClick={() => patchSettings({ playing: !settings.playing })}
          >
            {settings.playing ? 'Pause' : 'Play day'}
          </button>
          <button type="button" onClick={presetJune}>
            June 21, noon
          </button>
          <button type="button" onClick={presetDec}>
            Dec 21, noon
          </button>
        </div>
      </section>

      <section>
        <h2>Preview</h2>
        <label className="toggle">
          <span>Panel info</span>
          <input
            type="checkbox"
            checked={settings.panelInfo}
            onChange={(e) => patchSettings({ panelInfo: e.target.checked })}
          />
        </label>
        <label className="toggle">
          <span>Sun access colours</span>
          <input
            type="checkbox"
            checked={settings.sunAccess}
            onChange={(e) => {
              patchSettings({ sunAccess: e.target.checked })
              if (e.target.checked) onRunSunAccess()
            }}
          />
        </label>
        {settings.sunAccess ? (
          <p className="disclaimer">
            Geometric sun-access sample (not engineering-grade).
            {sunAccessBusy ? ' Computing…' : ''}
          </p>
        ) : null}
        <label className="toggle">
          <span>Measurements</span>
          <input
            type="checkbox"
            checked={settings.measurements}
            onChange={(e) =>
              patchSettings({ measurements: e.target.checked })
            }
          />
        </label>
        <label className="toggle">
          <span>Length in feet</span>
          <input
            type="checkbox"
            checked={settings.lengthUnit === 'ft'}
            onChange={(e) =>
              patchSettings({ lengthUnit: e.target.checked ? 'ft' : 'm' })
            }
          />
        </label>
      </section>

      <section className="disclaimer-block">
        <p>
          Ground is an Unsplash aerial of a red-roof house. The 3D house sits
          on that roof, with panels on 4 pillars. Source:{' '}
          <code>welcome-4KG9VicLWQY-unsplash.jpg</code>
        </p>
        {capsLabel ? <p className="muted">{capsLabel}</p> : null}
        <p className="muted">Timezone: {project.location.timeZone}</p>
      </section>
    </aside>
  )
}
