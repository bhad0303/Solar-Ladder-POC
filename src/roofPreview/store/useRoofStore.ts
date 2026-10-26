import { create } from 'zustand'
import { footprintFromShape } from '../geometry/footprints'
import {
  validateObstacleSize,
  type ObstacleType,
  type RoofObstacle,
} from '../geometry/obstacleTypes'
import {
  filterPanelsClearOfObstacles,
  findFreeObstacleSlot,
  panelsConflictingWithObstacles,
  validateObstaclePlacement,
} from '../geometry/obstacleValidator'
import {
  autoFillBySections,
  nextAvailablePanels,
  totalKw,
  validatePanelPlacement,
} from '../geometry/panelValidator'
import { validateHouseConfig } from '../geometry/validateDims'
import {
  activeShapeDims,
  DEFAULT_HOUSE,
  DEFAULT_PANEL_SETTINGS,
  type FootprintPoint,
  type HouseConfig,
  type HouseShape,
  type LengthUnit,
  type PanelSettings,
  type RoofPanel,
  type RoofType,
  wallHeightM,
} from '../types'

export const MAX_FLOORS = 4

export type TrimUndoSnapshot = {
  house: HouseConfig
  footprint: FootprintPoint[]
  panels: RoofPanel[]
  selectedPanelId: string | null
}

export type RoofStore = {
  unit: LengthUnit
  house: HouseConfig
  validationMessage: string | null
  trimUndo: TrimUndoSnapshot | null
  footprint: FootprintPoint[]
  panelSettings: PanelSettings
  panels: RoofPanel[]
  obstacles: RoofObstacle[]
  selectedPanelId: string | null
  selectedObstacleId: string | null
  showMeasurements: boolean
  sunMinuteOfDay: number
  sunDayOfYear: number

  setUnit: (u: LengthUnit) => void
  patchHouse: (
    partial: Partial<Omit<HouseConfig, 'rectangle' | 'l' | 'u' | 't'>> & {
      rectangle?: Partial<HouseConfig['rectangle']>
      l?: Partial<HouseConfig['l']>
      u?: Partial<HouseConfig['u']>
      t?: Partial<HouseConfig['t']>
    },
  ) => void
  setShape: (shape: HouseShape) => void
  setRoofType: (roofType: RoofType) => void
  patchPanelSettings: (partial: Partial<PanelSettings>) => void
  autoFill: () => void
  addPanel: () => void
  deleteSelected: () => void
  clearPanels: () => void
  selectPanel: (id: string | null) => void
  updatePanel: (id: string, partial: Partial<RoofPanel>) => void
  setPanelCount: (count: number) => void
  addObstacle: (type: ObstacleType) => void
  selectObstacle: (id: string | null) => void
  updateObstacle: (id: string, partial: Partial<RoofObstacle>) => void
  deleteSelectedObstacle: () => void
  clearObstacles: () => void
  /** Drop panels that overlap obstacles (clearance included). */
  removePanelsOverlappingObstacles: () => void
  setShowMeasurements: (v: boolean) => void
  setSunMinuteOfDay: (m: number) => void
  setSunDayOfYear: (d: number) => void
  undoTrim: () => void
  dismissValidation: () => void
  totalKw: () => number
}

function computeFootprint(house: HouseConfig): FootprintPoint[] {
  return footprintFromShape(activeShapeDims(house))
}

function obstacleOpts(
  obstacles: RoofObstacle[],
): { obstacles: RoofObstacle[] } | undefined {
  return obstacles.length > 0 ? { obstacles } : undefined
}

function revalidatePanelConflicts(
  panels: RoofPanel[],
  obstacles: RoofObstacle[],
  clearanceM: number,
): { panels: RoofPanel[]; conflictCount: number } {
  const next = panelsConflictingWithObstacles(
    panels,
    obstacles,
    clearanceM,
  )
  const conflictCount = next.filter((p) => p.conflict).length
  return { panels: next, conflictCount }
}

function conflictMessage(n: number): string | null {
  return n > 0 ? `${n} panel(s) conflict with obstacles.` : null
}

/** Keep panels that still fit inside footprint (ignore obstacles — those are marked). */
function keepPanelsInsideFootprint(
  panels: RoofPanel[],
  footprint: FootprintPoint[],
  setbackM: number,
): RoofPanel[] {
  const kept: RoofPanel[] = []
  for (const p of panels) {
    const check = validatePanelPlacement(
      footprint,
      setbackM,
      {
        x: p.position.x,
        z: p.position.z,
        widthM: p.widthM,
        heightM: p.heightM,
        yawRad: (p.azimuthDeg * Math.PI) / 180,
      },
      kept,
      p.id,
    )
    if (check.ok) kept.push(p)
  }
  return kept
}

function keepValidObstacles(
  obstacles: RoofObstacle[],
  footprint: FootprintPoint[],
  setbackM: number,
): RoofObstacle[] {
  const kept: RoofObstacle[] = []
  for (const o of obstacles) {
    const check = validateObstaclePlacement(
      footprint,
      setbackM,
      o,
      kept,
      o.id,
    )
    if (check.ok) kept.push(o)
  }
  return kept
}

export const useRoofStore = create<RoofStore>((set, get) => ({
  unit: 'm',
  house: structuredClone(DEFAULT_HOUSE),
  validationMessage: null,
  trimUndo: null,
  footprint: computeFootprint(DEFAULT_HOUSE),
  panelSettings: structuredClone(DEFAULT_PANEL_SETTINGS),
  panels: [],
  obstacles: [],
  selectedPanelId: null,
  selectedObstacleId: null,
  showMeasurements: false,
  sunMinuteOfDay: 12 * 60,
  sunDayOfYear: 172,

  setUnit: (unit) => set({ unit }),

  patchHouse: (partial) => {
    const prev = get().house
    const prevPanels = get().panels
    const prevFootprint = get().footprint
    const prevSelected = get().selectedPanelId
    const { obstacles, panelSettings } = get()
    let floors = partial.floors ?? prev.floors
    if (partial.floors !== undefined) {
      floors = Math.min(MAX_FLOORS, Math.max(1, Math.round(partial.floors)))
    }
    const house: HouseConfig = {
      ...prev,
      ...partial,
      floors,
      rectangle: partial.rectangle
        ? { ...prev.rectangle, ...partial.rectangle }
        : prev.rectangle,
      l: partial.l ? { ...prev.l, ...partial.l } : prev.l,
      u: partial.u ? { ...prev.u, ...partial.u } : prev.u,
      t: partial.t ? { ...prev.t, ...partial.t } : prev.t,
    }
    const result = validateHouseConfig(house)
    if (!result.ok) {
      set({ house, validationMessage: result.message, trimUndo: null })
      return
    }
    const footprint = computeFootprint(house)
    const panelsInside = keepPanelsInsideFootprint(prevPanels, footprint, 0)
    const removed = prevPanels.length - panelsInside.length
    const nextObstacles = keepValidObstacles(
      obstacles,
      footprint,
      panelSettings.setbackM,
    )
    const { panels, conflictCount } = revalidatePanelConflicts(
      panelsInside,
      nextObstacles,
      panelSettings.obstacleClearanceM ?? 0.3,
    )
    const msgs: string[] = []
    if (removed > 0) {
      msgs.push(`${removed} panel(s) removed (outside new footprint).`)
    }
    if (conflictCount > 0) {
      msgs.push(`${conflictCount} panel(s) conflict with obstacles.`)
    }
    set({
      house,
      validationMessage: msgs.length ? msgs.join(' ') : null,
      trimUndo:
        removed > 0
          ? {
              house: structuredClone(prev),
              footprint: prevFootprint.map((p) => ({ ...p })),
              panels: prevPanels.map((p) => structuredClone(p)),
              selectedPanelId: prevSelected,
            }
          : null,
      footprint,
      panels,
      obstacles: nextObstacles,
      selectedPanelId: panels.some((p) => p.id === prevSelected)
        ? prevSelected
        : null,
      selectedObstacleId: nextObstacles.some(
        (o) => o.id === get().selectedObstacleId,
      )
        ? get().selectedObstacleId
        : null,
    })
  },

  setShape: (shape) => get().patchHouse({ shape }),
  setRoofType: (roofType) => {
    get().patchHouse({ roofType })
    if (roofType !== 'gable') return
    // Drop gable-incompatible obstacles (tank / stair)
    const { obstacles, panels, panelSettings } = get()
    const keptObs = obstacles.filter(
      (o) => o.type !== 'water_tank' && o.type !== 'stair_room',
    )
    if (keptObs.length === obstacles.length) return
    const removedObs = obstacles.length - keptObs.length
    const clearance = panelSettings.obstacleClearanceM ?? 0.3
    const { kept, removed } = filterPanelsClearOfObstacles(
      panels,
      keptObs,
      clearance,
    )
    const msgs = [
      `${removedObs} obstacle(s) removed (not allowed on gable).`,
    ]
    if (removed > 0) {
      msgs.push(`${removed} panel(s) removed (overlap with obstacle + clearance).`)
    }
    set({
      obstacles: keptObs,
      panels: kept,
      selectedObstacleId: null,
      validationMessage: msgs.join(' '),
    })
  },

  patchPanelSettings: (partial) => {
    set((s) => {
      const panelSettings = { ...s.panelSettings, ...partial }
      if (partial.obstacleClearanceM !== undefined) {
        const { panels, conflictCount } = revalidatePanelConflicts(
          s.panels,
          s.obstacles,
          panelSettings.obstacleClearanceM ?? 0.3,
        )
        return {
          panelSettings,
          panels,
          validationMessage: conflictMessage(conflictCount),
        }
      }
      return { panelSettings }
    })
  },

  autoFill: () => {
    const { footprint, house, panelSettings, obstacles } = get()
    if (!validateHouseConfig(house).ok) return
    const y = wallHeightM(house) + 0.12
    const panels = autoFillBySections(
      activeShapeDims(house),
      footprint,
      panelSettings,
      y,
      {
        gable: house.roofType === 'gable',
        ...obstacleOpts(obstacles),
      },
    )
    set({
      panels,
      selectedPanelId: null,
      validationMessage:
        panels.length === 0
          ? 'No panels fit — try smaller setback, panel size, or fewer obstacles.'
          : null,
    })
  },

  addPanel: () => {
    const { footprint, house, panelSettings, panels, obstacles } = get()
    if (!validateHouseConfig(house).ok) return
    const y = wallHeightM(house) + 0.12
    const added = nextAvailablePanels(
      activeShapeDims(house),
      footprint,
      panelSettings,
      y,
      panels,
      1,
      {
        gable: house.roofType === 'gable',
        ...obstacleOpts(obstacles),
      },
    )
    if (added.length === 0) {
      set({
        validationMessage:
          'No free roof slot — roof full, setback too large, or blocked by obstacles.',
      })
      return
    }
    const id = added[0]!.id
    set({
      panels: [...panels, ...added],
      selectedPanelId: id,
      selectedObstacleId: null,
      validationMessage: null,
    })
  },

  deleteSelected: () => {
    const { selectedPanelId, panels, selectedObstacleId } = get()
    if (selectedObstacleId) {
      get().deleteSelectedObstacle()
      return
    }
    if (!selectedPanelId) return
    set({
      panels: panels.filter((p) => p.id !== selectedPanelId),
      selectedPanelId: null,
    })
  },

  clearPanels: () => set({ panels: [], selectedPanelId: null }),

  selectPanel: (id) =>
    set({
      selectedPanelId: id,
      selectedObstacleId: id ? null : get().selectedObstacleId,
    }),

  updatePanel: (id, partial) =>
    set((s) => {
      const panels = s.panels.map((p) =>
        p.id === id
          ? {
              ...p,
              ...partial,
              position: partial.position
                ? { ...p.position, ...partial.position }
                : p.position,
            }
          : p,
      )
      const { panels: marked, conflictCount } = revalidatePanelConflicts(
        panels,
        s.obstacles,
        s.panelSettings.obstacleClearanceM ?? 0.3,
      )
      return {
        panels: marked,
        validationMessage:
          conflictCount > 0 ? conflictMessage(conflictCount) : null,
      }
    }),

  setPanelCount: (count) => {
    if (!Number.isFinite(count) || count < 0) return
    const n = Math.floor(count)
    const { panels, footprint, house, panelSettings, obstacles } = get()
    if (n === panels.length) return
    if (n < panels.length) {
      set({
        panels: panels.slice(0, n),
        selectedPanelId: null,
        validationMessage: null,
      })
      return
    }
    const y = wallHeightM(house) + 0.12
    const need = n - panels.length
    const added = nextAvailablePanels(
      activeShapeDims(house),
      footprint,
      panelSettings,
      y,
      panels,
      need,
      {
        gable: house.roofType === 'gable',
        ...obstacleOpts(obstacles),
      },
    )
    set({
      panels: [...panels, ...added],
      selectedPanelId: null,
      validationMessage:
        added.length < need
          ? `Only ${panels.length + added.length} panels fit (requested ${n}).`
          : null,
    })
  },

  addObstacle: (type) => {
    const { footprint, panelSettings, obstacles, house, panels } = get()
    if (!validateHouseConfig(house).ok) return
    if (
      house.roofType === 'gable' &&
      (type === 'water_tank' || type === 'stair_room')
    ) {
      set({
        validationMessage:
          'Water tank and stair room are not available on gable roofs — use chimney or AC unit.',
      })
      return
    }
    const y = wallHeightM(house) + 0.15
    const clearance = panelSettings.obstacleClearanceM ?? 0.3
    const slot = findFreeObstacleSlot(
      type,
      footprint,
      activeShapeDims(house),
      panelSettings.setbackM,
      obstacles,
      y,
      { panels, clearanceM: clearance },
    )
    if (!slot.ok) {
      set({ validationMessage: slot.reason })
      return
    }
    const candidate = slot.obstacle
    const sizeCheck = validateObstacleSize(candidate)
    if (!sizeCheck.ok) {
      set({ validationMessage: sizeCheck.reason })
      return
    }
    // Keep panels that stay clear; never leave modules sitting on the tank
    const { kept, removed } = filterPanelsClearOfObstacles(
      panels,
      [...obstacles, candidate],
      clearance,
    )
    const msgs: string[] = []
    if (removed > 0) {
      msgs.push(
        `${removed} panel(s) removed (overlap with obstacle + clearance).`,
      )
    }
    set({
      obstacles: [...obstacles, candidate],
      panels: kept,
      selectedObstacleId: candidate.id,
      selectedPanelId: null,
      validationMessage: msgs.length ? msgs.join(' ') : null,
    })
  },

  selectObstacle: (id) =>
    set({
      selectedObstacleId: id,
      selectedPanelId: id ? null : get().selectedPanelId,
    }),

  updateObstacle: (id, partial) => {
    const s = get()
    const clearance = s.panelSettings.obstacleClearanceM ?? 0.3
    const obstacles = s.obstacles.map((o) => {
      if (o.id !== id) return o
      const next: RoofObstacle = {
        ...o,
        ...partial,
        position: partial.position
          ? { ...o.position, ...partial.position }
          : o.position,
      }
      if (next.type === 'water_tank') {
        next.depthM = next.widthM
        next.yawRad = 0
      }
      return next
    })
    const moved = obstacles.find((o) => o.id === id)
    if (moved) {
      const sizeCheck = validateObstacleSize(moved)
      if (!sizeCheck.ok) {
        set({ validationMessage: sizeCheck.reason })
        return
      }
      // Size-only edits: allow even if under panels, then strip overlapping panels.
      // Position moves from 3D drag already validated against panels in buildObstacles.
      const isMove =
        partial.position !== undefined &&
        (partial.position.x !== undefined || partial.position.z !== undefined)
      if (isMove) {
        const check = validateObstaclePlacement(
          s.footprint,
          s.panelSettings.setbackM,
          moved,
          obstacles,
          id,
          { panels: s.panels, clearanceM: clearance },
        )
        if (!check.ok) {
          set({ validationMessage: check.reason })
          return
        }
      }
    }
    const { kept, removed } = filterPanelsClearOfObstacles(
      s.panels,
      obstacles,
      clearance,
    )
    set({
      obstacles,
      panels: kept,
      validationMessage:
        removed > 0
          ? `${removed} panel(s) removed (overlap with obstacle + clearance).`
          : null,
    })
  },

  deleteSelectedObstacle: () => {
    const { selectedObstacleId, obstacles, panels, panelSettings } = get()
    if (!selectedObstacleId) return
    const next = obstacles.filter((o) => o.id !== selectedObstacleId)
    const { panels: marked, conflictCount } = revalidatePanelConflicts(
      panels,
      next,
      panelSettings.obstacleClearanceM ?? 0.3,
    )
    set({
      obstacles: next,
      panels: marked,
      selectedObstacleId: null,
      validationMessage: conflictMessage(conflictCount),
    })
  },

  clearObstacles: () => {
    const { panels } = get()
    set({
      obstacles: [],
      selectedObstacleId: null,
      panels: panels.map((p) => ({ ...p, conflict: false })),
      validationMessage: null,
    })
  },

  removePanelsOverlappingObstacles: () => {
    const { panels, obstacles, panelSettings } = get()
    const { kept, removed } = filterPanelsClearOfObstacles(
      panels,
      obstacles,
      panelSettings.obstacleClearanceM ?? 0.3,
    )
    set({
      panels: kept,
      selectedPanelId: null,
      validationMessage:
        removed > 0
          ? `${removed} panel(s) removed (overlap with obstacle + clearance).`
          : 'No overlapping panels.',
    })
  },

  setShowMeasurements: (showMeasurements) => set({ showMeasurements }),
  setSunMinuteOfDay: (sunMinuteOfDay) => set({ sunMinuteOfDay }),
  setSunDayOfYear: (sunDayOfYear) => set({ sunDayOfYear }),

  undoTrim: () => {
    const snap = get().trimUndo
    if (!snap) {
      set({ validationMessage: null })
      return
    }
    set({
      house: snap.house,
      footprint: snap.footprint,
      panels: snap.panels,
      selectedPanelId: snap.selectedPanelId,
      validationMessage: null,
      trimUndo: null,
    })
  },

  dismissValidation: () => set({ validationMessage: null, trimUndo: null }),

  totalKw: () => totalKw(get().panels, get().panelSettings.watt),
}))
