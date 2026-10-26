import { create } from 'zustand'
import projectData from '../data/project.json'
import type {
  LengthUnit,
  PreviewSettings,
  SolarProject,
} from '../data/types'
import { totalRatedKw } from '../data/types'
import {
  DEC_21_DOY,
  JUNE_21_DOY,
  NOON_MINUTE,
} from '../geo/coordinates'

const STORAGE_KEY = 'solar-preview-poc-settings-v3'

const defaultSettings: PreviewSettings = {
  dayOfYear: JUNE_21_DOY,
  minuteOfDay: NOON_MINUTE,
  playing: false,
  panelInfo: true,
  sunAccess: false,
  measurements: false,
  lengthUnit: 'm',
  autoRotate: false,
  showGrid: false,
  calibration: {
    offsetX: 0,
    offsetZ: 0,
    rotationDeg: 0,
    scale: 1,
  },
}

function loadSettings(): PreviewSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return structuredClone(defaultSettings)
    return { ...structuredClone(defaultSettings), ...JSON.parse(raw) }
  } catch {
    return structuredClone(defaultSettings)
  }
}

type PreviewState = {
  project: SolarProject
  settings: PreviewSettings
  imageryMissing: boolean
  imageryMessage: string | null
  setProject: (p: SolarProject) => void
  patchSettings: (partial: Partial<PreviewSettings>) => void
  setDay: (dayOfYear: number) => void
  setTime: (minuteOfDay: number) => void
  presetJune: () => void
  presetDec: () => void
  setImageryStatus: (missing: boolean, message: string | null) => void
  patchCalibration: (
    partial: Partial<PreviewSettings['calibration']>,
  ) => void
  totalKw: () => number
  formatLength: (meters: number, unit?: LengthUnit) => string
}

let playTimer: number | null = null

function syncPlayTimer(
  playing: boolean,
  patchSettings: PreviewState['patchSettings'],
) {
  if (playTimer != null) {
    window.clearInterval(playTimer)
    playTimer = null
  }
  if (!playing) return
  playTimer = window.setInterval(() => {
    patchSettings({
      minuteOfDay:
        ((usePreviewStore.getState().settings.minuteOfDay + 5) % 1440),
    })
  }, 200)
}

export const usePreviewStore = create<PreviewState>((set, get) => {
  const initial = loadSettings()

  // Hot-reload project.json so imagery/offset edits apply without full remount lag
  if (import.meta.hot) {
    import.meta.hot.accept('../data/project.json', (mod) => {
      const next = mod?.default
      if (next) set({ project: structuredClone(next) as SolarProject })
    })
  }

  const patchSettings = (partial: Partial<PreviewSettings>) => {
    set((s) => {
      const next = { ...s.settings, ...partial }
      if (partial.calibration) {
        next.calibration = { ...s.settings.calibration, ...partial.calibration }
      }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        /* ignore quota */
      }
      return { settings: next }
    })
    if (partial.playing !== undefined) {
      syncPlayTimer(get().settings.playing, patchSettings)
    }
  }

  // Start play loop if restored as playing
  if (initial.playing) {
    queueMicrotask(() => syncPlayTimer(true, patchSettings))
  }

  return {
    project: structuredClone(projectData) as SolarProject,
    settings: initial,
    imageryMissing: false,
    imageryMessage: null,

    setProject: (p) => set({ project: p }),

    patchSettings,

    setDay: (dayOfYear) => patchSettings({ dayOfYear }),
    setTime: (minuteOfDay) => patchSettings({ minuteOfDay }),
    presetJune: () =>
      patchSettings({ dayOfYear: JUNE_21_DOY, minuteOfDay: NOON_MINUTE }),
    presetDec: () =>
      patchSettings({ dayOfYear: DEC_21_DOY, minuteOfDay: NOON_MINUTE }),

    setImageryStatus: (missing, message) =>
      set({ imageryMissing: missing, imageryMessage: message }),

    patchCalibration: (partial) =>
      patchSettings({
        calibration: { ...get().settings.calibration, ...partial },
      }),

    totalKw: () => totalRatedKw(get().project),

    formatLength: (meters, unit) => {
      const u = unit ?? get().settings.lengthUnit
      if (u === 'ft') return `${(meters * 3.28084).toFixed(1)} ft`
      return `${meters.toFixed(1)} m`
    },
  }
})
