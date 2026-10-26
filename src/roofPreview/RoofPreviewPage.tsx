import { BabylonRoofCanvas } from './BabylonRoofCanvas'
import { HouseForm } from './HouseForm'

export function RoofPreviewPage() {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-100">
      <aside className="flex w-[360px] shrink-0 flex-col border-r border-slate-200 bg-gradient-to-b from-white to-slate-50 shadow-[1px_0_0_0_rgb(226_232_240)]">
        <HouseForm />
      </aside>
      <main className="min-w-0 flex-1 bg-slate-200/40">
        <BabylonRoofCanvas />
      </main>
    </div>
  )
}
