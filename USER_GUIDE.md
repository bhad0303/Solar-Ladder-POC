# Solar Roof Preview — How to Use

This guide is for everyday users. It explains what the app does and how to use each part of the screen.

---

## What this app is for

**Solar Roof Preview** lets you build a simple 3D picture of a house roof, place solar panels, and see a **rough energy estimate**.

You can:

- Choose the house shape and size  
- Add roof items (water tank, stair room, chimney, AC unit)  
- Place solar panels by hand or fill the roof automatically  
- Choose module type (how panels look) and layout settings  
- Move the sun through the day to see light and shadow  
- Read **System Summary** under the 3D view (capacity and estimated kWh)

The left side of the screen is the **control panel** (scroll this list). The right side is the **3D view**, with **System Summary** and **Energy Estimate** in a strip below it (scroll that strip only — the whole page should not scroll).

---

## Moving around in the 3D view

| Action | How |
|--------|-----|
| Turn the view | Drag with the mouse (or finger) on the empty sky / ground |
| Zoom in or out | Scroll the mouse wheel (or pinch on touch) |
| Move a panel or roof item | Drag it on the roof |

A short tip at the top of the 3D view reminds you of these controls.

---

## Units (Meters or Feet)

At the top of the control panel, choose **Meters** or **Feet**.

All size fields (house size, spacing, and so on) will show numbers in the unit you pick.

---

## House shape

This section sets the outline of the building as seen from above.

### Footprint options

| Shape | Meaning |
|-------|---------|
| **Rectangle** | A simple box house |
| **L-shape** | Like the letter L |
| **U-shape** | Like the letter U |
| **T-shape** | Like the letter T |

### Size fields

Depending on the shape, you will see fields such as:

- **Length / Width** — overall size of a rectangle  
- **Total length / Total width** — full outer size for L, U, or T  
- **Cut-out length / Cut-out width** — the missing corner or open part of L or U shapes  
- **Cut-out corner** — which corner is cut out (for L-shape)  
- **Stem width / Crossbar depth** — for T-shape  

Change a number and the house in the 3D view updates right away.

**Tip — typing numbers:** You can clear a field and type a new value (for example change `1` to `7`). Press **Enter** or click outside the field to save the number.

---

## Massing (building height and roof)

| Control | What it does |
|---------|----------------|
| **Floors (1–4)** | How many storeys the house has. Type **1**, **2**, **3**, or **4**. |
| **Floor height** | How tall each storey is. |
| **Roof type** | **Flat** or **Gable** (sloped roof with a ridge). |
| **Roof overhang** | How far the roof edge sticks out past the walls. |

**Note on gable roofs:** On a gable roof you can only add a **chimney** or **AC unit**. Water tank and stair room are turned off for that roof type.

---

## Solar Panel Setup

This section sits near the top of the sidebar (after Massing). Use it to set how panels look and how they are laid out.

### Common settings (top)

| Control | What it does |
|---------|----------------|
| **Module type** | **Standard** (blue cell grid), **Premium** (near-black), or **Thin-film** (smooth purple-teal). Changing this updates the **look of the panels already on the roof** right away. It does **not** add or remove panels. |
| **Panel tilt (°)** | How much panels tilt up from flat (0–90). |
| **Panel azimuth (°)** | Compass direction the panel faces: **0° North**, **90° East**, **180° South**, **270° West**. |
| **Roof edge setback (m)** | Empty border from the roof edge where panels should not sit. |
| **Gap between panels (m)** | Space between panels side by side. |
| **Row spacing (m)** | Space between rows of panels. |

Then use the buttons:

| Button | What it does |
|--------|----------------|
| **Apply Layout** | Saves your draft settings. If panels are already placed, it **keeps the same number and positions** and updates size/tilt/etc. on those panels. If there are **no** panels yet, it places a first automatic layout. |
| **Reset Defaults** | Puts the form back to default numbers. |
| **Cancel Changes** | Puts the form back to the last applied settings. |

### Advanced (size, power, losses)

Open **Advanced (size, power, losses)** for less-used fields:

| Control | What it does |
|---------|----------------|
| **Panel model name** | Optional label (for your notes). |
| **Panel width / height** | Physical size of one module. Switch unit with **m** or **mm**. |
| **Rated power per panel** | Power of one module (for example **540 W**). Switch **W** / **kW**. |
| **System losses (%)** | Extra losses (inverter, wiring, dirt, etc.). Often around **14%**. |

**Capacity:** Total system kW is always **number of panels × rated power per panel**. You do not type total kW yourself.

**Important:**

- Most draft fields do **not** rebuild the roof until **Apply Layout** (module type look is the main exception).  
- To fill the whole roof again from scratch, use **Layout tools → Auto-fill** (below).

---

## Layout tools

| Control | What it does |
|---------|----------------|
| **Panel count** | Shows how many panels are on the roof. You can type a new count (within limits). |
| **Auto-fill** | Rebuilds a full automatic layout from the **last applied** settings (panel count may change). |
| **+ Panel** | Adds one more panel if there is space. |
| **Delete** | Removes the panel you selected in the 3D view. |
| **Clear** | Removes all panels. |

### Moving panels

Click a panel to select it (blue outline), then drag it on the roof. If you drop it in a bad place, it returns to the last good spot and a short message may appear.

---

## Roof obstacles

These are things that sit on the roof and take space away from panels.

### Add an item

Use the buttons:

- **+ Water tank**  
- **+ Stair room**  
- **+ Chimney**  
- **+ AC unit**  

Drag the item on the roof. If the spot is not allowed, it snaps back.

### Clearance

**Obstacle clearance** is the empty gap that must stay between panels and roof items (default often **0.3** in your unit).

### Edit size

1. Click the item in the 3D view.  
2. Size fields appear (width, depth or diameter, height).  
3. Change the numbers (each type has a maximum size).

### Remove items

- **Delete obstacle** — removes the selected item  
- **Clear obstacles** — removes all roof items  

### Panel conflicts

Panels too close to a roof item may show a **red outline**. Use **Remove overlapping panels** to clear those panels in one step.

---

## Preview (sun and measurements)

| Control | What it does |
|---------|----------------|
| **Measurements overlay** | Turns size labels on or off in the 3D view |
| **Sun time** | Moves the sun along the yellow path (light and shadows). This is **visual only** — it does **not** change the kWh numbers in System Summary |
| **Date** | Picks a day of the year (label like **12 Jun · day 164**). This also sets the **Selected month** used in the energy summary |

---

## System Summary & Energy Estimate (below the 3D view)

Scroll **inside this bottom strip** to see everything. The rest of the page stays fixed.

### System Summary cards

| Card | Meaning |
|------|---------|
| **Panels** | How many panels are placed |
| **Installed capacity** | Total kW (panels × rated power) |
| **Panel-covered roof area** | Area covered by panels |
| **Average daily generation** | Rough average kWh per day |
| **Selected month generation** | Rough kWh for the month linked to **Date** / Selected month |
| **Annual generation** | Rough kWh for a full year |

A small label shows the data source, for example:

- **PVGIS estimate** — European PVGIS data (often works on your own computer via the local app)  
- **NASA POWER estimate** — NASA location weather/insolation (often used on the live website when PVGIS is blocked)  
- **Approximate energy (fallback)** — simple formula only, when live data is unavailable  

### Energy Estimate (expandable)

Open **Energy Estimate** for:

- **Latitude / Longitude** — site location for the estimate  
- **Selected month** — which month’s kWh card to highlight  
- **Peak sun hours / day** — only used in the simple **fallback** formula  
- Monthly table (when PVGIS or NASA POWER data is available)  
- Assumptions, warnings, and **“Estimated, not guaranteed.”**

Estimates update when panel count, capacity, losses, location, or month change (after a short pause).

---

## Messages and warnings

Yellow or red boxes in the control panel explain problems, for example:

- A size that does not fit the house shape  
- Panels that overlap a water tank or other item  
- Something that is not allowed on a gable roof  

You can **Dismiss** the message, or use **Undo** if the app offers it after a change that removed panels.

---

## Suggested first walkthrough

1. Choose **Meters** or **Feet**.  
2. Set **Footprint** to Rectangle (or L-shape if you prefer).  
3. Set **Floors** to 1 or 2.  
4. Keep **Roof type** as Flat for the first try.  
5. In **Solar Panel Setup**, pick a **Module type**, check tilt / setback, then **Apply Layout** (or use **Auto-fill** in Layout tools).  
6. Optionally add a **water tank** and drag it to a corner.  
7. Look at **System Summary** under the 3D view for capacity and estimated kWh.  
8. Move **Date** to change the selected month estimate; move **Sun time** to see shadows.  
9. Orbit the 3D view to look at the roof from different angles.

---

## Quick tips

- Start with a **flat** roof if you are new — it is simpler for panels and tanks.  
- Use **Auto-fill** to cover the roof; use **Apply Layout** to update settings **without** changing how many panels you already have.  
- Change **Module type** anytime to restyle existing panels (count stays the same).  
- Keep **setback** and **obstacle clearance** in mind if panels will not fit.  
- On a **gable** roof, use only chimney or AC as roof items.  
- **Sun time** = shadows only; **Date** = which month’s energy card.  
- If something looks wrong after a change, read the yellow message and use Undo when it is offered.

---

## What this app does *not* do

- It does not book installers or sell panels.  
- It is **not** a final engineering drawing, bill of materials, or sales quote.  
- Energy numbers are **estimates** (PVGIS, NASA POWER, or a simple fallback). They are **not guaranteed** production.  
- Optional photo textures for walls/grass may be missing; the house still shows with solid colours.

If you need changes to how the tools work, ask your project contact or developer.
