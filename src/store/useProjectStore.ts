import { create } from 'zustand'
import { prefetchSatelliteBlob } from '../imagery/satelliteGround'
import { findBuildingFootprint } from '../osm/findBuildingFootprint'
import {
  isValidLatLng,
  type BuildingFootprint,
  type SolarRoofProject,
} from '../types/project'

/** Default demo point (Mumbai) — user can change. */
export const DEFAULT_LAT = 19.076
export const DEFAULT_LNG = 72.8777

export type ScenePhase = 'idle' | 'building' | 'ready' | 'error'

type ProjectState = SolarRoofProject & {
  mapReady: boolean
  lookingUp: boolean
  scenePhase: ScenePhase
  sceneError: string | null
  /** Bumped when user asks to (re)build 3D — SolarViewer reacts. */
  buildRequestId: number
  setLatLng: (lat: number, lng: number) => void
  setStatus: (message: string | null) => void
  setError: (error: string | null) => void
  setFootprint: (footprint: BuildingFootprint | null) => void
  setMapReady: (ready: boolean) => void
  setScenePhase: (phase: ScenePhase, error?: string | null) => void
  /** Overpass OSM building outline near the pin. */
  findHouse: () => Promise<void>
  /** Start Babylon 3D house from current OSM footprint. */
  startBuild3D: () => void
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  location: {
    lat: DEFAULT_LAT,
    lng: DEFAULT_LNG,
    timeZone: null,
  },
  footprint: null,
  statusMessage:
    'Place the pin on the roof and choose Find house — free OSM outline and Esri satellite (no paid API).',
  error: null,
  mapReady: false,
  lookingUp: false,
  scenePhase: 'idle',
  sceneError: null,
  buildRequestId: 0,

  setLatLng: (lat, lng) => {
    if (!isValidLatLng(lat, lng)) {
      set({ error: 'Latitude must be −90…90 and longitude −180…180.' })
      return
    }
    set({
      location: { ...get().location, lat, lng },
      error: null,
      footprint: null,
      scenePhase: 'idle',
      sceneError: null,
      statusMessage:
        'Location updated. Choose Find house to load the OSM footprint and area.',
    })
  },

  setStatus: (statusMessage) => set({ statusMessage }),
  setError: (error) => set({ error }),
  setFootprint: (footprint) => set({ footprint }),
  setMapReady: (mapReady) => set({ mapReady }),

  setScenePhase: (scenePhase, sceneError = null) => {
    set({ scenePhase, sceneError })
    if (scenePhase === 'building') {
      set({
        statusMessage:
          'Building 3D… satellite, house, panels, and sun path',
      })
    } else if (scenePhase === 'ready') {
      const area = get().footprint?.areaM2
      set({
        statusMessage: area
          ? `3D ready — ${area.toFixed(0)} m² · panels + sun path on.`
          : '3D ready.',
      })
    } else if (scenePhase === 'error') {
      set({
        statusMessage: '3D build failed.',
        error: sceneError,
      })
    }
  },

  findHouse: async () => {
    const { location, lookingUp } = get()
    if (lookingUp) return
    if (!isValidLatLng(location.lat, location.lng)) {
      set({ error: 'Invalid latitude or longitude.' })
      return
    }

    set({
      lookingUp: true,
      error: null,
      scenePhase: 'idle',
      sceneError: null,
      statusMessage:
        'Free OSM Map API se outline… (Overpass backup)',
    })

    const result = await findBuildingFootprint({
      lat: location.lat,
      lng: location.lng,
    })

    if (!result.ok) {
      set({
        lookingUp: false,
        footprint: null,
        error: result.message,
        statusMessage:
          result.reason === 'not_found'
            ? 'No footprint found. Place the pin in the middle of the roof, inside the OSM outline.'
            : 'OSM servers are busy. Try Find house again in 10 seconds.',
      })
      return
    }

    const { footprint, areaM2 } = result
    set({
      lookingUp: false,
      footprint: { ...footprint, areaM2 },
      error: null,
      scenePhase: 'idle',
      statusMessage: `Footprint (${footprint.source}/${footprint.selection}): ${areaM2.toFixed(0)} m². Preloading satellite, then choose Build.`,
      location: {
        ...get().location,
        timeZone: get().location.timeZone ?? 'Asia/Kolkata',
      },
    })

    // Warm satellite cache while user reads status (Build becomes faster)
    void prefetchSatelliteBlob({
      lat: location.lat,
      lng: location.lng,
    }).then(() => {
      if (get().footprint?.osmId !== footprint.osmId) return
      set({
        statusMessage: `Ready — ${areaM2.toFixed(0)} m² (${footprint.selection}). Choose “Build 3D house”.`,
      })
    })
  },

  startBuild3D: () => {
    const { footprint, scenePhase } = get()
    if (!footprint) {
      set({
        error: 'Find the house first to load the OSM footprint.',
        statusMessage: 'A footprint is required for the 3D view.',
      })
      return
    }
    if (scenePhase === 'building') return
    set({
      buildRequestId: get().buildRequestId + 1,
      scenePhase: 'building',
      sceneError: null,
      error: null,
      statusMessage:
        'Building 3D… loading satellite ground, panels, and sun path',
    })
  },
}))
