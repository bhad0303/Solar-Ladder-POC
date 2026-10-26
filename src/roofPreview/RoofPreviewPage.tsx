import { BabylonRoofCanvas } from './BabylonRoofCanvas'
import { EnergyEstimatePanel } from './EnergyEstimatePanel'
import { EnergyResultsStrip } from './EnergyResultsStrip'
import { HouseForm } from './HouseForm'
import { useEnergyEstimate } from './useEnergyEstimate'

export function RoofPreviewPage() {
  useEnergyEstimate()

  return (
    <div className="flex h-full max-h-full w-full overflow-hidden bg-slate-100">
      <aside className="flex h-full min-h-0 w-[360px] shrink-0 flex-col overflow-hidden border-r border-slate-200 bg-gradient-to-b from-white to-slate-50 shadow-[1px_0_0_0_rgb(226_232_240)]">
        <HouseForm />
      </aside>
      <main className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-slate-200/40">
        <div className="min-h-0 flex-1 overflow-hidden">
          <BabylonRoofCanvas />
        </div>
        {/* Only this strip scrolls — page / canvas do not */}
        <div className="max-h-[36vh] shrink-0 overflow-y-auto overscroll-y-contain border-t border-slate-200 bg-white">
          <EnergyResultsStrip />
          <EnergyEstimatePanel />
        </div>
      </main>
    </div>
  )
}
