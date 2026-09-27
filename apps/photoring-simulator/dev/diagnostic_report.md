# Diagnostic Report: Photoring Simulator — Model Comparison

## Summary

Three models are compared across all 8 presets in `presets.json`:

| Model | Geometry | Integration | $a/R_\star$ Source |
|---|---|---|---|
| **App API** | Sky-plane (tilt, ir) | 150×150 Monte-Carlo pixel grid | Derived from stellar density: $(G\rho_\star P^2 / 3\pi)^{1/3}$ |
| **pyPplusS** | Sky-plane (tilt, ir) | Exact analytic/segmented integrals | Unified $a/R_\star$ identical to App API |
| **Pryngles** | 3D physical (i_pr, roll_pr) | Spangle-based (300 samples/body) + REBOUND orbit | $a_{\rm pr} = (a/R_\star) \cdot R_{\star,\rm pr}$, identical $a/R_\star$ |

---

## Files Created / Modified

| File | Change |
|---|---|
| [`dev/preset_comparison.ipynb`](file:///Users/jzuluaga/dev/seap-udea.github.io/apps/photoring-simulator/dev/preset_comparison.ipynb) | **UPDATED & VALIDATED** — Full comparative notebook with all 8 presets executed and outputs saved. |
| [`dev/model_code_pryngles.ipynb`](file:///Users/jzuluaga/dev/seap-udea.github.io/apps/photoring-simulator/dev/model_code_pryngles.ipynb) | **UPDATED** — Uses exact $a/R_\star$ formula derived from stellar density matching the App API. |
| [`dev/model_code_pyppluss.ipynb`](file:///Users/jzuluaga/dev/seap-udea.github.io/apps/photoring-simulator/dev/model_code_pyppluss.ipynb) | **UPDATED** — Uses exact $a/R_\star$ formula derived from stellar density matching the App API. |
| `dev/tmp/model_code_pryngles.ipynb` | **NOT TOUCHED** |
| `dev/tmp/model_code_pyppluss.ipynb` | **NOT TOUCHED** |
| `src/*` (Web Application) | **NOT TOUCHED** |

---

## Validation: $a/R_\star$ Equality Across All Models

The semi-major axis in units of stellar radius ($a/R_\star$) is calculated identically across all three implementations using:
$$\rho_\star = \rho_\odot \cdot \frac{M_\star / M_\odot}{(R_\star / R_\odot)^3}, \qquad \frac{a}{R_\star} = \left( \frac{G \rho_\star P^2}{3\pi} \right)^{1/3}$$

Results from running [`preset_comparison.ipynb`](file:///Users/jzuluaga/dev/seap-udea.github.io/apps/photoring-simulator/dev/preset_comparison.ipynb) across all 8 presets:

| Preset ID | App API $a/R_\star$ | pyPplusS $a/R_\star$ | Pryngles $a/R_\star$ | Equality Status ($\Delta < 10^{-12}$) |
|---|---|---|---|---|
| `saturn-sun` | 214.938920 | 214.938920 | 214.938920 | ✓ IDENTICAL |
| `saturn-Mdwarf` | 41.378453 | 41.378453 | 41.378453 | ✓ IDENTICAL |
| `toi2449b` | 90.819490 | 90.819490 | 90.819490 | ✓ IDENTICAL |
| `kepler51b` | 61.039690 | 61.039690 | 61.039690 | ✓ IDENTICAL |
| `kepler51d` | 124.232386 | 124.232386 | 124.232386 | ✓ IDENTICAL |
| `ringless-saturn-demo` | 214.938920 | 214.938920 | 214.938920 | ✓ IDENTICAL |
| `face-on-ringed-saturn-demo` | 214.938920 | 214.938920 | 214.938920 | ✓ IDENTICAL |
| `face-on-opaque-saturn-demo` | 214.938920 | 214.938920 | 214.938920 | ✓ IDENTICAL |

---

## Light Curve Comparison Summary

Summary of residuals against App API when running all 8 presets on identical time grids (with observer elevation properly passed in **degrees** to Pryngles):

| Preset ID | $a/R_\star$ | pyPplusS RMS [ppm] | pyPplusS Max [ppm] | Pryngles RMS [ppm] | Pryngles Max [ppm] |
|---|---|---|---|---|---|
| `saturn-sun` | 214.9389 | 49.7 | 183.3 | 206.3 | 547.6 |
| `saturn-Mdwarf` | 41.3785 | 196.6 | 840.6 | 1300.2 | 4043.3 |
| `toi2449b` | 90.8195 | 99.7 | 160.1 | 160.5 | 449.8 |
| `kepler51b` | 61.0397 | 172.5 | 1238.6 | 118.4 | 491.4 |
| `kepler51d` | 124.2324 | 301.1 | 1973.9 | 291.1 | 752.2 |
| `ringless-saturn-demo` | 214.9389 | 0.0 | 0.0 | 131.4 | 426.9 |
| `face-on-ringed-saturn-demo` | 214.9389 | 71.3 | 140.7 | 322.6 | 780.2 |
| `face-on-opaque-saturn-demo` | 214.9389 | 111.1 | 207.8 | 421.7 | 1004.9 |

> [!NOTE]
> **Resolution of the TOI-2449b discrepancy**: In Pryngles, `Science.direction(lamb, beta)` expects elevation in **degrees** (`args[1] * Consts.deg`). Previously passing radians caused the observer elevation $\beta$ to be divided by $57.3$, simulating an impact parameter $b \approx 0.012$ instead of $b = 0.704$. Passing `elev_deg = (np.pi/2 - iorb) * (180/np.pi)` reduced the TOI-2449b RMS from **3,942.9 ppm to 160.5 ppm** (a **96% reduction**), bringing Pryngles into excellent agreement with the App API and pyPplusS.

---

## Why Differences Exist

### 1. pyPplusS vs App API (Agreement within ~50–300 ppm)
- Both operate purely in sky-plane projection $(x, y)$.
- pyPplusS uses exact analytic circular/elliptical segment geometry.
- App API uses a numerical 150×150 pixel grid on the star disk.
- For `ringless-saturn-demo`, pyPplusS and App API match with **0.0 ppm RMS** (analytic Mandel-Agol circle overlap). Residuals on ringed presets are purely numerical grid discretisation in the App.

### 2. Pryngles vs App API / pyPplusS (Agreement within ~100–450 ppm for most presets)
- Pryngles models the planet and ring in **full 3D** with REBOUND Keplerian dynamics:
  - Ring normal is oriented in 3D: $i_{\rm pr} = \arccos(\sin(i_r)\cos(\text{tilt}))$, $\text{roll}_{\rm pr} = \arctan2(\sin(i_r)\sin(\text{tilt}), \cos(i_r))$.
  - Observer is placed at elevation $\beta = (\pi/2 - i_{\rm orb}) \times (180/\pi)$ in degrees.
- Pryngles discretises the surface into triangular/polygonal **spangles** (`nspangles=300`).
- Because of spangle boundaries and slight 3D perspective projection effects (the projection of ring normal onto sky plane changes slightly when observer elevation $\beta > 0$, by $\lesssim 0.4^\circ$), small sub-percent residuals occur around ring edges during ingress and egress.
- **Pryngles is physically the most realistic model**: it includes true orbital motion, perspective, and 3D illumination.
