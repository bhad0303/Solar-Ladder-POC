import { BabylonRoofCanvas } from './BabylonRoofCanvas'
import { EnergyEstimatePanel } from './EnergyEstimatePanel'
import { EnergyResultsStrip } from './EnergyResultsStrip'
import { HouseForm } from './HouseForm'
import { useEnergyEstimate } from './useEnergyEstimate'

/** Fixed strip height — keep in sync with absolute bottom offsets below. */
const RESULTS_STRIP_VH = 30

/**
 * Root layout (absolute panes).
 *
 * Root cause of the “everything jumps up / blank grey” bug:
 * 1) Flex/grid + unbounded canvas let Babylon’s canvas width/height attributes
 *    expand the document when the parent height briefly collapsed.
 * 2) Input focus / unit toggles then scrolled that overflowing document so
 *    System Summary appeared pinned to the top and the 3D view vanished.
 *
 * Absolute panes + overflow:hidden on the shell stop both failure modes.
 */
export function RoofPreviewPage() {
  useEnergyEstimate()

  return (
    <div
      className="roof-preview-shell relative overflow-hidden bg-slate-100"
      style={{ height: '100dvh', width: '100%', maxHeight: '100dvh' }}
    >
      <aside
        className="absolute bottom-0 left-0 top-0 flex w-[360px] flex-col overflow-hidden border-r border-slate-200 bg-gradient-to-b from-white to-slate-50 shadow-[1px_0_0_0_rgb(226_232_240)]"
        style={{ width: 360 }}
      >
        <HouseForm />
      </aside>

      <main
        className="absolute bottom-0 right-0 top-0 overflow-hidden bg-slate-800"
        style={{ left: 360 }}
      >
        {/* 3D viewport — always fills space above the results strip */}
        <div
          className="absolute left-0 right-0 top-0 overflow-hidden"
          style={{ bottom: `${RESULTS_STRIP_VH}vh` }}
        >
          <BabylonRoofCanvas />
        </div>

        {/* Results — fixed band at bottom; scrolls inside only */}
        <div
          className="absolute bottom-0 left-0 right-0 overflow-y-auto overscroll-y-contain border-t border-slate-200 bg-white"
          style={{ height: `${RESULTS_STRIP_VH}vh`, maxHeight: 280 }}
        >
          <EnergyResultsStrip />
          <EnergyEstimatePanel />
        </div>
      </main>
    </div>
  )
}
