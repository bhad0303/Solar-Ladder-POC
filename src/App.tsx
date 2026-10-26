import { MapView } from './components/MapView'
import { Sidebar } from './components/Sidebar'
import { SolarViewer } from './components/SolarViewer'

function App() {
  return (
    <div className="flex min-h-screen bg-slate-900 text-slate-100">
      <Sidebar />
      <main className="flex min-h-screen flex-1 flex-col gap-3 p-3 md:flex-row">
        <div className="min-h-[40vh] flex-1 md:min-h-0">
          <MapView />
        </div>
        <div className="min-h-[40vh] flex-1 md:min-h-0">
          <SolarViewer />
        </div>
      </main>
    </div>
  )
}

export default App
