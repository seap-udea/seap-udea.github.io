# Developer notes — Preset configurations

The "Preset configuration" dropdown in the simulator is populated at runtime from
[`public/presets.json`](public/presets.json). This file is plain JSON, is **not**
part of the TypeScript/React source, and is copied as-is into the static export
(`_site/apps/photoring-simulator/presets.json`). Anyone can add, remove, or edit a
preset by editing this single file — no code changes or rebuild logic are required
beyond redeploying the site.

## How it works

- On load, `PhotoRingSimulator.tsx` fetches `/apps/photoring-simulator/presets.json`.
- Each entry in the `presets` array becomes one option in the dropdown, in the same
  order as they appear in the file.
- If the file fails to load or fails validation, the app silently falls back to a
  single built-in "Default configuration" option (the values used before this file
  existed) and logs an error to the browser console.
- Selecting a preset overwrites all current System Parameters, star/orbit
  assumptions, and display toggles with the values from that preset. Any manual
  change to a slider afterwards switches the dropdown to "Custom configuration".
- The URL query parameter `?preset=<preset_id>` loads a preset directly on page load (e.g. `?preset=toi2449b`). Additional URL parameters in the same URL can override specific parameters on top of the preset.

## Same keys and rules as the "Copy configuration" link

`presets.json` intentionally reuses the exact same field names and derivation
rules as the query-string parameters produced by the "Copy configuration"
button (e.g. `?p=0.084&fi=1.58&...&mstar=1&aau=0.45`). If you know how to build
a shareable link for a configuration, you already know how to write a preset:
copy the values from the URL into the matching JSON fields below.

This also means the same **inference rules** apply:

- If `star.rstar` is omitted, the star radius is estimated from `star.mstar`
  using a main-sequence mass–radius relation.
- If both `star.mstar` and `orbit.aau` are given, the orbital period is derived
  from Kepler's third law.
- If both `orbit.porb` and `orbit.aau` are given (but not `star.mstar`), the
  star mass is derived instead, from the period and the semi-major axis.
- If only `orbit.porb` is given (no `aau`), the semi-major axis defaults to 1 AU.
- If `planet.mpjup` is omitted, the planet mass is estimated assuming a
  density of 1 g/cm³.
- `parameters.pjup` (planet radius in Jupiter radii) is an alternative to `p`
  (planet radius in stellar radii): if `p` is given it always wins; `pjup` is
  only used when `p` is omitted, and is converted to stellar radii using the
  resolved star radius.

## File structure

```json
{
  "presets": [
    {
      "id": "toi2449b",
      "label": "TOI-2449b hypothetical rings",
      "parameters": {
        "p": 0.0967,
        "fi": 1.526,
        "fe": 2.269,
        "tilt": 25,
        "ir": 55,
        "b": 0.704,
        "alpha": 0.36787944117144233
      },
      "star": {
        "mstar": 1.079,
        "rstar": 1.065
      },
      "orbit": {
        "aau": 0.45
      },
      "planet": {
        "mpjup": 0.70
      },
      "display": {
        "showEquivalentPlanet": false,
        "showPlanetToScale": true,
        "zoomIn": false,
        "flipPlanet": false,
        "autoScaleDepth": true,
        "showEquivalentCurve": true
      }
    }
  ]
}
```

The top-level object has a single key, `presets`, containing an array of preset
objects. **The order of the array is the order shown in the dropdown.**

### Preset object

| Property | Type | Required | Description |
|---|---|---|---|
| `id` | string | yes | Unique, stable identifier for the preset (letters/digits/hyphen, no spaces). Used internally to track the selected option; it is never shown to the user. Keep it unchanged once published, since deep links may store it. |
| `label` | string | yes | The text shown in the "Preset configuration" dropdown menu. This is the only preset text visible to users, so make it descriptive (e.g. include the source figure or paper). |
| `parameters` | object | no | The ring/planet transit geometry, i.e. the same values controlled by the "System Parameters" sliders. Any omitted field falls back to the app's built-in default. See table below. |
| `star` | object | no | Assumed host star properties. Omit fields to have them estimated/derived — see the rules above. |
| `orbit` | object | no | Orbital properties of the planet. Provide `aau`, `porb`, or both — see the rules above. |
| `planet` | object | no | Physical properties of the ringed planet. Omit `mpjup` to have it estimated. |
| `display` | object | no | Toggle switches for the visualization, matching the checkboxes in the transit scene and light curve panels. Any omitted field falls back to the app's built-in default. |

### `parameters` (ring/transit geometry)

All of these correspond 1:1 with the sliders in "System Parameters", and use the
same short codes as the "Copy configuration" URL. Any value outside the listed
range is clamped to the slider's min/max, exactly like the URL parameters.

| Property | URL equivalent | Units | Range | Description |
|---|---|---|---|---|
| `p` | `p` | stellar radii (R★) | 0.03 – 0.16 | Planet radius relative to the star. A larger planet blocks more light during transit. Takes priority over `pjup` if both are given. |
| `pjup` | `pjup` | Jupiter radii (Rjup) | — | Alternative way to set the planet radius, in Jupiter radii instead of stellar radii. Only used when `p` is omitted; converted internally using the resolved star radius. |
| `fi` | `fi` | planet radii (Rₚ) | 1 – 2.8 | Inner edge of the ring system, measured in planet radii from the planet center. Must be smaller than `fe`. When `fe` is 1, `fi` is also set to 1. |
| `fe` | `fe` | planet radii (Rₚ) | 1 – 4 | Outer edge of the ring system, measured in planet radii from the planet center. Must be larger than `fi`. A value of 1 removes the ring and simulates a spherical planet. |
| `tilt` | `tilt` | degrees | 0 – 90 | Rotation of the ring plane around the planet's apparent axis. Changes the ring orientation across the transit. |
| `ir` | `ir` | degrees | 0 – 90 | Angle between the ring plane and the line of sight (ring inclination). 0° = rings seen edge-on, 90° = face-on. |
| `b` | `b` | dimensionless | 0 – 0.85 | Impact parameter: distance between the transit path and the stellar disk center, in stellar radii. 0 is a central transit. |
| `alpha` | `alpha` | dimensionless | 0 – 1 | `alpha = exp(-τ)`, the fraction of light transmitted through the ring along its normal. `0` = completely opaque rings, `1` = fully transparent rings. The reference value `exp(-1) ≈ 0.36787944117144233` corresponds to optical depth τ = 1. |

### `star` (host star assumptions)

| Property | URL equivalent | Units | Description |
|---|---|---|---|
| `mstar` | `mstar` | solar masses (M☉) | Assumed mass of the host star. Defaults to 1 M☉ if omitted. |
| `rstar` | `rstar` | solar radii (R☉) | Assumed radius of the host star. If omitted, it is estimated from `mstar` via a main-sequence mass–radius relation. |

### `orbit` (orbital assumptions)

| Property | URL equivalent | Units | Description |
|---|---|---|---|
| `aau` | `aau` | astronomical units (AU) | Orbital semi-major axis. |
| `porb` | `porb` | days | Orbital period. |

Provide at least one of `aau`/`porb`; see the derivation rules above for how the
missing value (period, semi-major axis, or star mass) is filled in.

### `planet` (physical planet assumptions)

| Property | URL equivalent | Units | Description |
|---|---|---|---|
| `mpjup` | `mpjup` | Jupiter masses (Mjup) | Assumed mass of the ringed planet, used only to display the true vs. observed planet density metrics. If omitted, it is estimated from the planet's physical radius assuming a density of 1 g/cm³. The legacy URL parameter `mplanet` is still accepted as a fallback but no longer used in `presets.json`. |

### `display` (visualization toggles)

| Property | Description |
|---|---|
| `showEquivalentPlanet` | Show the ringless "equivalent" planet silhouette overlaid on the transit scene. |
| `showPlanetToScale` | Render the planet and rings to the true relative scale in the transit scene (instead of an enlarged view). |
| `zoomIn` | Start the transit scene zoomed in. |
| `flipPlanet` | Flip the planet/ring silhouette vertically in the transit scene and light curve. |
| `autoScaleDepth` | Automatically rescale the light-curve y-axis to the transit depth of this preset. |
| `showEquivalentCurve` | Show the ringless-equivalent light curve alongside the ringed light curve. |
| `residualsInAbsoluteUnits` | Display residuals in absolute units (flux difference) instead of ppm. |

## Adding a new preset

1. Duplicate one of the existing objects inside the `presets` array in
   [`public/presets.json`](public/presets.json).
2. Give it a unique `id` and a descriptive `label`.
3. Fill in `parameters`, `star`, `orbit`, `planet`, and `display` following the
   tables above. Fields you omit are estimated/derived or fall back to defaults
   — see "Same keys and rules as the Copy configuration link" above.
4. Validate that the file is well-formed JSON (no trailing commas, all keys
   quoted). Invalid JSON causes the app to silently fall back to the built-in
   default preset only, with an error logged in the browser console.
5. Reload the app locally (`npm run dev`) and confirm the new option appears in
   the "Preset configuration" dropdown and produces the expected transit shape.

## Removing or reordering presets

Simply delete an object from the array, or reorder the array — no other code
changes are needed. The `"default"` entry does not need to be first
programmatically, but keeping it first matches the historical dropdown order.

## Pryngles / Colab export

Before changing `buildPrynglesColabCode` or `buildPypplussColabCode` in
`PhotoRingSimulator.tsx`, edit and run the matching cell in
[`dev/pryngles_colab_export.ipynb`](dev/pryngles_colab_export.ipynb) (one
linear cell per package, no helper functions).
