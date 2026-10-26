# Solar Roof Preview — Technical Guide

Developer-oriented reference for the form-driven 3D roof preview. For end-user steps, see [`USER_GUIDE.md`](./USER_GUIDE.md).

---

## 1. Stack

| Layer | Choice |
|-------|--------|
| UI | React 19 + Vite 8 + TypeScript |
| State | Zustand 5 (`useRoofStore`) |
| 3D | `@babylonjs/core` / `gui` / `materials` **6.46.0** |
| Styling | Tailwind CSS 4 |
| Sun | `suncalc` 1.9.0 (via `sunPath.ts`) |
| Tests | Vitest |

**Hard constraints for this POC**

- No Google Maps / Solar API / online tiles / backend.
- Ground texture is local: `public/assets/site-satellite.jpg` (and related aerial assets).
- **Authoritative lengths in the store are always meters.** UI may show feet; convert at the form boundary (`mToDisplay` / `displayToM` in `types.ts`).

---

## 2. Entry & layout

```
src/App.tsx
  └── roofPreview/RoofPreviewPage.tsx
        ├── HouseForm.tsx          (left sidebar controls)
        └── BabylonRoofCanvas.tsx  (Babylon canvas + store sync)
              └── babylon/RoofScene.ts
```

`App.tsx` mounts only `RoofPreviewPage` (older map/OSM paths under `src/` are legacy / unused by the current app shell).

---

## 3. Architecture overview

```
┌─────────────────┐     Zustand      ┌──────────────────┐
│   HouseForm     │ ◄──────────────► │  useRoofStore    │
└─────────────────┘   patch / CRUD   │  house, footprint│
                                     │  panels, obstacles│
┌─────────────────┐                  └────────┬─────────┘
│BabylonRoofCanvas│ ◄── subscribe + sync() ───┘
└────────┬────────┘
         │ owns RoofScene (Engine + Scene)
         ▼
┌─────────────────────────────────────────────┐
│ buildMassing → roof / details / obstacles / │
│ panels / measurements / sunPath             │
└─────────────────────────────────────────────┘
```

**Data flow**

1. Form / drag callbacks mutate `useRoofStore`.
2. Store recomputes `footprint`, revalidates panels/obstacles, sets `validationMessage` when needed.
3. `BabylonRoofCanvas` reacts to store slices and calls `RoofScene.sync(state)`.
4. `sync` disposes the previous content root and rebuilds meshes (except during active drag, when rebuild is deferred).

---

## 4. Domain types (`src/roofPreview/types.ts`)

| Type | Role |
|------|------|
| `HouseConfig` | Shape (`rectangle` \| `l` \| `u` \| `t`), dims, floors (1–4), floor height, roof type, overhang |
| `PanelSettings` | Panel W/H, watt, setback, tilt, orientation, row spacing, obstacle clearance |
| `RoofPanel` | `id`, `position {x,y,z}` (XZ on roof plane), `azimuthDeg`, `tiltDeg`, `conflict?` |
| `FootprintPoint` | `{ x, z }` polygon in local meters (Y-up world; roof plane uses XZ) |
| `LengthUnit` | `'m' \| 'ft'` — display only |

Helpers: `activeShapeDims`, `wallHeightM`, `supportedRoofTypes`, `DEFAULT_HOUSE`, `DEFAULT_PANEL_SETTINGS`.

Obstacles live in `geometry/obstacleTypes.ts` (`RoofObstacle`, presets, size limits).

---

## 5. Store (`store/useRoofStore.ts`)

Central API surface:

| Action group | Examples |
|--------------|----------|
| House | `patchHouse`, `setShape`, `setRoofType`, floors clamp via `MAX_FLOORS` (4) |
| Panels | `autoFill`, `addPanel`, `setPanelCount`, `updatePanel`, `deleteSelected`, `clearPanels` |
| Obstacles | `addObstacle`, `updateObstacle`, `deleteSelectedObstacle`, `clearObstacles` |
| Conflicts | `removePanelsOverlappingObstacles`, clearance-aware revalidation |
| Preview | `setShowMeasurements`, `setSunMinuteOfDay`, `setSunDayOfYear` |
| UX | `validationMessage`, `trimUndo` / `undoTrim`, `dismissValidation` |

**Important behaviors**

- Invalid house dims: store still updates `house` + message (no silent auto-fix of user numbers beyond floors clamp).
- Switching to **gable** drops `water_tank` / `stair_room` and may strip overlapping panels.
- `addObstacle` rejects tank/stair on gable with a validation message.
- Placement search for new obstacles uses rectangular **sections** (`findFreeObstacleSlot`), not L/U cutout centroids.

---

## 6. Geometry modules (`src/roofPreview/geometry/`)

| File | Responsibility |
|------|----------------|
| `footprints.ts` | Shape → outer polygon + `rectangularSections` for fill/placement |
| `validateDims.ts` | House config rules (floors 1–4, floor height 2.7–3.6 m, cut-out vs totals, roof vs shape) |
| `panelValidator.ts` | Setback, footprint containment, obstacle clearance, `autoFill` / `autoFillBySections`, `nextAvailablePanels` |
| `obstacleValidator.ts` | Obstacle vs footprint/setback/other obstacles; panel–obstacle AABB clearance; conflict flags |
| `obstacleTypes.ts` | Types, presets, size limits, corner helpers |
| `gableMount.ts` | Map XZ → height / rotations on a 25° gable pitch |
| `polygon.ts` | Bounds, containment, polygon helpers |

**Convention:** validation is pure functions; Babylon builders trust store state and only visualize.

---

## 7. Babylon scene (`src/roofPreview/babylon/`)

### `RoofScene.ts`

- Creates `Engine`, `Scene`, `ArcRotateCamera`, lights, shadows, materials.
- `sync(state)`: rebuilds house content under a transform root; sun update can be lighter-weight.
- `setDragging(true)` during panel/obstacle drag to avoid tearing down meshes mid-gesture.

### Builders

| Builder | Output |
|---------|--------|
| `aerialGround.ts` | Local satellite/aerial ground plane |
| `buildMassing.ts` | Plinth + wall boxes from rectangular sections; returns `wallHeight`, `roofY` |
| `buildSlopedRoof.ts` | Gable roof meshes |
| `buildDetails.ts` | Door / windows per floor (no auto tanks) |
| `buildObstacles.ts` | Tank / stair / chimney / AC meshes + `PointerDragBehavior` |
| `buildPanels.ts` | Flat **canopy** (equal posts + rack + tilted module) or gable **flush** mount; pick via near-opaque hit mesh |
| `measurements.ts` | Optional dimension overlay |
| `sunPath.ts` | Directional light + sun path visualization from day-of-year + minute-of-day |
| `materials.ts` | Shared PBR/standard materials + optional albedo textures |

### Panel mount modes

```ts
mode: 'canopy' | 'flush'  // flat vs gable
```

- **Canopy (flat):** equal-height pillars → horizontal beams → tilt node raised by `edgeDrop + MODULE_CLEAR` so the module does not pierce posts.
- **Flush (gable):** no pillars; panel follows `resolveGableMount` pitch/yaw.

**Picking note:** Babylon ignores `visibility === 0` for picks. Hit proxies use tiny alpha (`~0.001`) and `visibility = 1`.

---

## 8. UI (`HouseForm.tsx`)

- Controlled fields bound to Zustand.
- `NumField` converts display unit ↔ meters on change.
- `FloorsField` uses draft string state so typing 1–4 commits cleanly; store still clamps.
- Gable: Water tank / Stair room buttons `disabled`; chimney & AC remain available.

---

## 9. Coordinate & unit rules

| Concern | Rule |
|---------|------|
| Store / validators / Babylon local house | **meters** |
| Form display | `unit === 'ft'` → multiply/divide by `FT_PER_M` |
| Horizontal plane | X / Z; Y up |
| Panel/obstacle drag | Update XZ; Y reassigned on rebuild from roof height / gable mount |

Do not store feet in `HouseConfig` or panel positions.

---

## 10. Product rules encoded in code

1. Floors integer **1…4**; floor height **2.7…3.6 m**.
2. Gable: no water tank / stair room (UI + store + import-time filter when that path existed).
3. Panels must respect setback and obstacle clearance; conflicts mark `panel.conflict` (red edges).
4. Obstacle sizes clamped by `OBSTACLE_SIZE_LIMITS`.
5. Flat-roof panels use canopy geometry; gable panels sit flush on the slope.
6. No auto-placed tanks in `buildDetails` — obstacles are user-driven only.

---

## 11. Scripts

```bash
npm install
npm run dev          # Vite dev server
npm run build        # tsc -b && vite build
npm run test         # vitest run
npm run test:watch
npm run lint
```

---

## 12. Tests (relevant to roof preview)

| Test file | Focus |
|-----------|--------|
| `tests/footprints.test.ts` | Footprint / sections |
| `tests/panelValidator.test.ts` | Placement, fill, clearance |
| `tests/obstacleValidator.test.ts` | Obstacle slots, overlap |
| `tests/layoutPanels.test.ts` | Layout helpers / yaw |
| `tests/polygonMath.roof.test.ts` | Roof polygon math |

Older tests under `tests/` may still cover legacy `src/geo`, OSM, sun-access paths not used by `RoofPreviewPage`.

---

## 13. Extending safely

| Goal | Where to change |
|------|-----------------|
| New house shape | `types.ts` dims + `footprints.ts` + `HouseForm` + `validateDims` |
| New obstacle type | `obstacleTypes.ts` preset/limits + `buildObstacles.ts` mesh + form buttons |
| Stricter panel rules | `panelValidator.ts` (+ tests) before touching Babylon |
| Visual-only tweak | `buildPanels.ts` / `materials.ts` without changing store units |
| Sun / shadows | `sunPath.ts` + `RoofScene` lights |

**Avoid**

- Mixing feet into store state.
- Rebuilding the whole scene every pointer-move (use drag callbacks + `setDragging`).
- Invisible pick meshes with `visibility: 0`.

---

## 14. Key file map

```
src/roofPreview/
  RoofPreviewPage.tsx
  HouseForm.tsx
  BabylonRoofCanvas.tsx
  types.ts
  store/useRoofStore.ts
  geometry/
    footprints.ts
    validateDims.ts
    panelValidator.ts
    obstacleValidator.ts
    obstacleTypes.ts
    gableMount.ts
    polygon.ts
  babylon/
    RoofScene.ts
    buildMassing.ts
    buildPanels.ts
    buildObstacles.ts
    buildSlopedRoof.ts
    buildDetails.ts
    materials.ts
    sunPath.ts
    aerialGround.ts
    measurements.ts
```

---

## 15. Energy estimate module

| Path | Role |
|------|------|
| `src/roofPreview/energy/` | Domain types, units, capacity, calendar, format, Zod schema, PVGIS + Fallback providers, estimate controller |
| `SolarPanelSetupForm.tsx` | Draft RHF+Zod form; Apply Layout only mutates scene via store |
| `EnergyResultsStrip.tsx` / `EnergyEstimatePanel.tsx` | Capacity + kWh UI under the viewer |
| `useEnergyEstimate.ts` | Debounced try-PVGIS → fallback on CORS/errors |

**Capacity:** `installedCapacityKw = panelCount * ratedPowerW / 1000` (never a separately edited total kW).

**Fallback daily kWh:** `capacityKw × peakSunHoursPerDay × (1 − systemLossPercent/100)`.

**PVGIS:** `GET https://re.jrc.ec.europa.eu/api/v5_3/PVcalc` — browser CORS usually blocks; UI falls back with a clear warning. Aspect is south-relative (convert from compass azimuth).

## 16. Related docs

- [`USER_GUIDE.md`](./USER_GUIDE.md) — non-technical how-to  
- [`README.md`](./README.md) — POC rules / older phase checklist (may lag the roof-preview feature set)
