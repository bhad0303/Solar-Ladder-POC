# Solar Roof Preview — How to Use

This guide is for everyday users. It explains what the app does and how to use each part of the screen.

---

## What this app is for

**Solar Roof Preview** lets you build a simple 3D picture of a house roof and place solar panels on it. You can:

- Choose the house shape and size  
- Add roof items (water tank, stair room, chimney, AC unit)  
- Place solar panels by hand or fill the roof automatically  
- Move the sun through the day to see light and shadow  

The left side of the screen is the **control panel**. The right side is the **3D view** of the house.

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

All size fields (house size, panel size, spacing, and so on) will show numbers in the unit you pick. Pick the one you are comfortable with.

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

## Roof obstacles

These are things that sit on the roof and take space away from panels.

### Add an item

Use the buttons:

- **+ Water tank**  
- **+ Stair room**  
- **+ Chimney**  
- **+ AC unit**  

The item appears on the roof. You can **drag** it to a new spot. If the spot is not allowed (for example, too close to the edge or overlapping something badly), it will snap back.

### Clearance

**Obstacle clearance** is the empty gap that must stay between panels and roof items. The usual default is **0.3** (in your chosen unit). Larger clearance means panels stay farther from tanks and other items.

### Edit size

1. Click the item in the 3D view.  
2. Size fields appear (width, depth or diameter, height).  
3. Change the numbers. Each item type has a maximum size.

### Remove items

- **Delete obstacle** — removes the one you selected  
- **Clear obstacles** — removes all roof items  

### Panel conflicts

If a panel sits too close to (or on top of) a roof item, it may show with a **red outline**. You can use **Remove overlapping panels** to clear those panels in one step.

---

## Solar Panel Setup

Use the collapsible **Solar Panel Setup** section to draft panel size, rated power (W), tilt, azimuth, setback, gaps, system losses, and module type.

Important:

- Changing fields does **not** update the 3D roof until you press **Apply Layout**.
- **Reset Defaults** restores the draft form to defaults.
- **Cancel Changes** restores the draft to the last applied settings.
- Total system capacity (kW) is calculated as panel count × rated power — you do not enter total kW yourself.

### Layout tools

After applying a layout you can still:

| Button | What it does |
|--------|----------------|
| **Auto-fill** | Re-runs layout with the last applied settings |
| **+ Panel** | Adds one panel |
| **Delete** | Removes the panel you selected in the 3D view |
| **Clear** | Removes all panels |

### Energy results (below the 3D view)

Cards show panel count, installed capacity (kW), covered area, and estimated generation (kWh):

- Average daily generation  
- Selected month estimate  
- Annual estimate  

Open **Energy Estimate** for location (latitude / longitude), month, assumptions, warnings, and the “Estimated, not guaranteed” note. If live weather data is unavailable, the app shows an approximate fallback.

### Moving panels

Click a panel to select it (it gets a blue outline), then drag it on the roof. If you drop it in a bad place, it returns to the last good spot and a short message may appear.

---

## Preview

| Control | What it does |
|---------|----------------|
| **Measurements overlay** | Turns size labels on or off in the 3D view |
| **Sun time** | Slide to change the time of day (light and shadows move) |
| **Date** | Slide to pick a day through the year. The label shows the calendar date (for example **20 Jun · day 172**) so you know which day it is |

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
5. Optionally add a **water tank** and drag it to a corner of the roof.  
6. Press **Auto-fill** to place panels.  
7. Drag the **Sun time** slider to see shadows.  
8. Orbit the 3D view to look at the roof from different angles.

---

## Quick tips

- Start with a **flat** roof if you are new — it is simpler for panels and tanks.  
- Use **Auto-fill** first, then delete or move individual panels.  
- Keep **setback** and **obstacle clearance** in mind if panels will not fit.  
- On a **gable** roof, use only chimney or AC as roof items.  
- If something looks wrong after a change, read the yellow message and use Undo when it is offered.

---

## What this app does *not* do

- It does not book installers or sell panels.  
- It does not connect to live maps or weather services by itself in this preview.  
- It is a **visual planning helper**, not a final engineering or quote tool.

If you need changes to how the tools work, ask your project contact or developer.
