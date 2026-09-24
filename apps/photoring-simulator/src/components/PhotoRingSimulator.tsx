"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import {
  computeTransit,
  type RingParameters,
  type TransitModel,
} from "../lib/photoring";

const DEFAULTS: RingParameters = {
  planetRadius: 0.084,
  innerRingRadius: 1.58,
  outerRingRadius: 2.35,
  tilt: 25,
  inclination: 55,
  impact: 0.25,
  alpha: Math.exp(-1),
};

const ASSUMED_STAR_MASS_SOLAR = 1;
const ASSUMED_STAR_RADIUS_SOLAR = 1;
const SOLAR_RADIUS_AU = 0.00465047;
const DEFAULT_PERIOD_DAYS = 365.25;
const SOLAR_MASS_KG = 1.98847e30;
const AU_METERS = 1.495978707e11;
const GRAVITATIONAL_CONSTANT = 6.6743e-11;
const SOLAR_DENSITY_KG_M3 = 1408;
const DEFAULT_SEMI_MAJOR_AXIS_AU = 0.9999974887698985;
const JUPITER_TO_SUN_RADIUS = 0.10045;
const JUPITER_DENSITY_G_CM3 = 1.326;
const SATURN_MASS_JUPITER = 0.2994;
const DEFAULT_PLANET_DENSITY_G_CM3 = 1;

type ParameterKey = keyof RingParameters;

const CONTROLS: {
  key: ParameterKey;
  symbol: string;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
  help: string;
}[] = [
  {
    key: "planetRadius",
    symbol: "p",
    label: "Planet radius",
    min: 0.03,
    max: 0.16,
    step: 0.001,
    unit: " R★",
    help: "Planet radius relative to the star. A larger planet blocks more light during transit.",
  },
  {
    key: "innerRingRadius",
    symbol: "fᵢ",
    label: "Inner ring radius",
    min: 1.05,
    max: 2.8,
    step: 0.01,
    unit: " Rₚ",
    help: "Inner edge of the ring system, measured in planet radii from the planet center.",
  },
  {
    key: "outerRingRadius",
    symbol: "fₑ",
    label: "Outer ring radius",
    min: 1.2,
    max: 4,
    step: 0.01,
    unit: " Rₚ",
    help: "Outer edge of the ring system, measured in planet radii from the planet center.",
  },
  {
    key: "tilt",
    symbol: "θᵣ",
    label: "Ring tilt",
    min: 0,
    max: 90,
    step: 1,
    unit: "°",
    help: "Rotation of the ring plane around the planet's apparent axis. It changes the ring orientation across the transit.",
  },
  {
    key: "inclination",
    symbol: "iᵣ",
    label: "Ring inclination",
    min: 0,
    max: 90,
    step: 1,
    unit: "°",
    help: "Angle between the ring plane and the line of sight. At 0°, the rings are seen edge-on; at 90°, face-on.",
  },
  {
    key: "impact",
    symbol: "b",
    label: "Impact parameter",
    min: 0,
    max: 0.85,
    step: 0.01,
    unit: "",
    help: "Distance between the transit path and the stellar disk center, in stellar radii. Zero is a central transit.",
  },
  {
    key: "alpha",
    symbol: "α",
    label: "Normal attenuation",
    min: 0,
    max: 1,
    step: 0.01,
    unit: "",
    help: "alpha = exp(-τ) is the fraction of light transmitted through the ring along its normal. alpha = 0 is completely opaque, alpha = 1 is transparent. The default alpha = exp(-1) corresponds to τ = 1.",
  },
];

const URL_PARAMETER_KEYS: Record<ParameterKey, string> = {
  planetRadius: "p",
  innerRingRadius: "fi",
  outerRingRadius: "fe",
  tilt: "tilt",
  inclination: "ir",
  impact: "b",
  alpha: "alpha",
};

const URL_ASSUMPTION_KEYS = {
  starMass: "mstar",
  starRadius: "rstar",
  semiMajorAxisAu: "aau",
  periodDays: "porb",
} as const;

const URL_OPTION_KEYS = {
  showEquivalentPlanet: "showRingless",
  showPlanetToScale: "planetToScale",
  zoomIn: "zoom2",
  autoScaleDepth: "autoDepth",
  showEquivalentCurve: "showEquivalent",
} as const;

type UrlConfiguration = {
  parameters: RingParameters;
  starMassSolar: number;
  starRadiusSolar: number;
  semiMajorAxisAu: number;
  periodDays: number;
  densityKgM3: number;
  planetMassJupiter: number;
  showEquivalentPlanet: boolean;
  showPlanetToScale: boolean;
  zoomIn: boolean;
  autoScaleDepth: boolean;
  showEquivalentCurve: boolean;
};

function estimateMainSequenceRadiusSolar(massSolar: number) {
  return massSolar <= 1 ? massSolar ** 0.8 : massSolar ** 0.57;
}

const DEFAULT_CONFIGURATION: UrlConfiguration = {
  parameters: DEFAULTS,
  starMassSolar: ASSUMED_STAR_MASS_SOLAR,
  starRadiusSolar: ASSUMED_STAR_RADIUS_SOLAR,
  semiMajorAxisAu: DEFAULT_SEMI_MAJOR_AXIS_AU,
  periodDays: DEFAULT_PERIOD_DAYS,
  densityKgM3: SOLAR_DENSITY_KG_M3,
  planetMassJupiter: SATURN_MASS_JUPITER,
  showEquivalentPlanet: false,
  showPlanetToScale: false,
  zoomIn: false,
  autoScaleDepth: false,
  showEquivalentCurve: true,
};

type PresetKey = "default" | "toi2449b" | "kepler51b" | "kepler51d";

const PRESET_LABELS: Record<PresetKey, string> = {
  default: "Default configuration",
  toi2449b: "TOI-2449b reference configuration",
  kepler51b: "Kepler-51b Figure 6 configuration",
  kepler51d: "Kepler-51d Figure 7 configuration",
};

function createPresetConfiguration(
  parameters: RingParameters,
  starMassSolar: number,
  starRadiusSolar: number,
  semiMajorAxisAu: number,
  planetMassJupiter: number,
  options: Pick<
    UrlConfiguration,
    "showEquivalentPlanet" | "showPlanetToScale" | "zoomIn" | "autoScaleDepth" | "showEquivalentCurve"
  >,
): UrlConfiguration {
  const periodDays =
    2 *
    Math.PI *
    Math.sqrt(
      (semiMajorAxisAu * AU_METERS) ** 3 /
        (GRAVITATIONAL_CONSTANT * starMassSolar * SOLAR_MASS_KG),
    ) /
    86400;
  return {
    parameters,
    starMassSolar,
    starRadiusSolar,
    semiMajorAxisAu,
    periodDays,
    densityKgM3: SOLAR_DENSITY_KG_M3 * starMassSolar / starRadiusSolar ** 3,
    planetMassJupiter,
    ...options,
  };
}

const PRESET_CONFIGURATIONS: Record<PresetKey, UrlConfiguration> = {
  default: DEFAULT_CONFIGURATION,
  toi2449b: createPresetConfiguration(
    {
      planetRadius: 0.0967,
      innerRingRadius: 1.526,
      outerRingRadius: 2.269,
      tilt: 25,
      inclination: 55,
      impact: 0.704,
      alpha: Math.exp(-1),
    },
    1.079,
    1.065,
    0.45,
    0.70,
    {
      showEquivalentPlanet: false,
      showPlanetToScale: true,
      zoomIn: false,
      autoScaleDepth: true,
      showEquivalentCurve: true,
    },
  ),
  kepler51b: createPresetConfiguration(
    {
      planetRadius: 0.058,
      innerRingRadius: 1,
      outerRingRadius: 1.93,
      tilt: 78.8,
      inclination: 65.8,
      impact: 0.33,
      alpha: 0.33,
    },
    0.9834202,
    0.869,
    0.2467834,
    6.9 / 317.8,
    {
      showEquivalentPlanet: false,
      showPlanetToScale: true,
      zoomIn: false,
      autoScaleDepth: false,
      showEquivalentCurve: true,
    },
  ),
  kepler51d: createPresetConfiguration(
    {
      planetRadius: 0.081,
      innerRingRadius: 1,
      outerRingRadius: 1.73,
      tilt: 67.39,
      inclination: 70.87,
      impact: 0.28,
      alpha: 0.34,
    },
    0.9974025,
    0.869,
    0.5022714,
    6.9 / 317.8,
    {
      showEquivalentPlanet: false,
      showPlanetToScale: true,
      zoomIn: false,
      autoScaleDepth: false,
      showEquivalentCurve: true,
    },
  ),
};

function readBooleanParameter(
  searchParams: URLSearchParams,
  key: string,
  fallback: boolean,
) {
  const value = searchParams.get(key);
  if (value === "1" || value === "true") return true;
  if (value === "0" || value === "false") return false;
  return fallback;
}

function readConfigurationFromUrl(search: string): UrlConfiguration | null {
  const searchParams = new URLSearchParams(search);
  const hasConfiguration = [
    ...Object.values(URL_PARAMETER_KEYS),
    ...Object.values(URL_ASSUMPTION_KEYS),
    ...Object.values(URL_OPTION_KEYS),
    "mplanet",
    "aRstar",
  ].some((key) => searchParams.has(key));
  if (!hasConfiguration) return null;

  const next = { ...DEFAULTS };
  for (const control of CONTROLS) {
    const rawValue = searchParams.get(URL_PARAMETER_KEYS[control.key]);
    if (rawValue === null) continue;
    const value = Number(rawValue);
    if (Number.isFinite(value)) {
      next[control.key] = Math.min(
        control.max,
        Math.max(control.min, value),
      );
    }
  }

  const rawMass = Number(searchParams.get(URL_ASSUMPTION_KEYS.starMass));
  const rawRadius = Number(searchParams.get(URL_ASSUMPTION_KEYS.starRadius));
  const rawPeriod = Number(searchParams.get(URL_ASSUMPTION_KEYS.periodDays));
  const rawPlanetMass = Number(searchParams.get("mplanet"));
  const rawAu = Number(searchParams.get(URL_ASSUMPTION_KEYS.semiMajorAxisAu));
  const rawRStar = Number(searchParams.get("aRstar"));
  const hasMass = Number.isFinite(rawMass) && rawMass > 0;
  const hasPeriod = Number.isFinite(rawPeriod) && rawPeriod > 0;
  const hasAu = Number.isFinite(rawAu) && rawAu > 0;
  const hasRStarAxis = Number.isFinite(rawRStar) && rawRStar > 0;
  const starMassSolar = hasMass ? rawMass : ASSUMED_STAR_MASS_SOLAR;
  const starRadiusSolar = Number.isFinite(rawRadius) && rawRadius > 0
    ? rawRadius
    : estimateMainSequenceRadiusSolar(starMassSolar);
  let semiMajorAxisAu = hasAu
    ? rawAu
    : hasRStarAxis
      ? rawRStar * starRadiusSolar * SOLAR_RADIUS_AU
      : 1;
  let periodDays = hasPeriod ? rawPeriod : DEFAULT_PERIOD_DAYS;
  let resolvedMassSolar = starMassSolar;

  const isLegacyDefault =
    !hasPeriod &&
    hasMass &&
    hasAu &&
    Math.abs(starMassSolar - ASSUMED_STAR_MASS_SOLAR) < 1e-9 &&
    Math.abs(starRadiusSolar - ASSUMED_STAR_RADIUS_SOLAR) < 1e-9 &&
    Math.abs(semiMajorAxisAu - 0.999566) < 0.001;
  if (isLegacyDefault) {
    semiMajorAxisAu = DEFAULT_SEMI_MAJOR_AXIS_AU;
  }

  if (!isLegacyDefault && hasMass && (hasAu || hasRStarAxis)) {
    periodDays =
      2 * Math.PI *
      Math.sqrt(
        (semiMajorAxisAu * AU_METERS) ** 3 /
          (GRAVITATIONAL_CONSTANT * resolvedMassSolar * SOLAR_MASS_KG),
      ) /
      86400;
  } else if (hasPeriod && (hasAu || hasRStarAxis)) {
    resolvedMassSolar =
      (4 * Math.PI ** 2 * (semiMajorAxisAu * AU_METERS) ** 3) /
      (GRAVITATIONAL_CONSTANT * (periodDays * 86400) ** 2 * SOLAR_MASS_KG);
  } else if (hasPeriod && !hasAu && !hasRStarAxis) {
    semiMajorAxisAu = 1;
  }

  const densityKgM3 =
    SOLAR_DENSITY_KG_M3 * resolvedMassSolar / starRadiusSolar ** 3;
  const planetRadiusJupiter =
    next.planetRadius * starRadiusSolar / JUPITER_TO_SUN_RADIUS;
  const planetMassJupiter = Number.isFinite(rawPlanetMass) && rawPlanetMass > 0
    ? rawPlanetMass
    : DEFAULT_PLANET_DENSITY_G_CM3 * planetRadiusJupiter ** 3 /
      JUPITER_DENSITY_G_CM3;

  if (next.innerRingRadius >= next.outerRingRadius) {
    next.outerRingRadius = Math.min(4, next.innerRingRadius + 0.1);
    if (next.innerRingRadius >= next.outerRingRadius) {
      next.innerRingRadius = Math.max(1.05, next.outerRingRadius - 0.1);
    }
  }
  return {
    parameters: next,
    starMassSolar: resolvedMassSolar,
    starRadiusSolar,
    semiMajorAxisAu,
    periodDays,
    densityKgM3,
    planetMassJupiter,
    showEquivalentPlanet: readBooleanParameter(
      searchParams,
      URL_OPTION_KEYS.showEquivalentPlanet,
      DEFAULT_CONFIGURATION.showEquivalentPlanet,
    ),
    showPlanetToScale: readBooleanParameter(
      searchParams,
      URL_OPTION_KEYS.showPlanetToScale,
      DEFAULT_CONFIGURATION.showPlanetToScale,
    ),
    zoomIn: readBooleanParameter(
      searchParams,
      URL_OPTION_KEYS.zoomIn,
      DEFAULT_CONFIGURATION.zoomIn,
    ),
    autoScaleDepth: readBooleanParameter(
      searchParams,
      URL_OPTION_KEYS.autoScaleDepth,
      DEFAULT_CONFIGURATION.autoScaleDepth,
    ),
    showEquivalentCurve: readBooleanParameter(
      searchParams,
      URL_OPTION_KEYS.showEquivalentCurve,
      DEFAULT_CONFIGURATION.showEquivalentCurve,
    ),
  };
}

function buildConfigurationUrl(configuration: UrlConfiguration, aInAu: number) {
  const url = new URL(window.location.href);
  for (const [parameter, key] of Object.entries(URL_PARAMETER_KEYS) as [
    ParameterKey,
    string,
  ][]) {
    url.searchParams.set(key, String(configuration.parameters[parameter]));
  }
  url.searchParams.set(URL_ASSUMPTION_KEYS.starMass, String(configuration.starMassSolar));
  url.searchParams.set(URL_ASSUMPTION_KEYS.starRadius, String(configuration.starRadiusSolar));
  url.searchParams.set("mplanet", String(configuration.planetMassJupiter));
  url.searchParams.set(URL_ASSUMPTION_KEYS.semiMajorAxisAu, String(aInAu));
  url.searchParams.delete(URL_ASSUMPTION_KEYS.periodDays);
  url.searchParams.delete("aRstar");
  url.searchParams.set(
    URL_OPTION_KEYS.showEquivalentPlanet,
    configuration.showEquivalentPlanet ? "1" : "0",
  );
  url.searchParams.set(
    URL_OPTION_KEYS.showPlanetToScale,
    configuration.showPlanetToScale ? "1" : "0",
  );
  url.searchParams.set(URL_OPTION_KEYS.zoomIn, configuration.zoomIn ? "1" : "0");
  url.searchParams.set(
    URL_OPTION_KEYS.autoScaleDepth,
    configuration.autoScaleDepth ? "1" : "0",
  );
  url.searchParams.set(
    URL_OPTION_KEYS.showEquivalentCurve,
    configuration.showEquivalentCurve ? "1" : "0",
  );
  return url.toString();
}

function formatControlValue(key: ParameterKey, value: number, unit: string) {
  const digits =
    key === "planetRadius" ? 3 : key === "tilt" || key === "inclination" ? 0 : 2;
  const formattedValue = `${value.toFixed(digits)}${unit}`;
  return key === "planetRadius"
    ? `${formattedValue} (${(value / JUPITER_TO_SUN_RADIUS).toFixed(2)} Rjup)`
    : formattedValue;
}

function ellipseSupport(
  nx: number,
  ny: number,
  semimajor: number,
  semiminor: number,
  angle: number,
) {
  const major = nx * Math.cos(angle) + ny * Math.sin(angle);
  const minor = -nx * Math.sin(angle) + ny * Math.cos(angle);
  return Math.sqrt((semimajor * major) ** 2 + (semiminor * minor) ** 2);
}

function mapThroughContacts(
  value: number,
  physicalAnchors: number[],
  visualAnchors: number[],
) {
  for (let index = 0; index < physicalAnchors.length - 1; index += 1) {
    const start = physicalAnchors[index];
    const end = physicalAnchors[index + 1];
    if (value > end && index < physicalAnchors.length - 2) continue;
    const fraction = end === start ? 0 : (value - start) / (end - start);
    return (
      visualAnchors[index] +
      Math.max(0, Math.min(1, fraction)) *
        (visualAnchors[index + 1] - visualAnchors[index])
    );
  }
  return visualAnchors[visualAnchors.length - 1];
}

function getSpectralAppearance(starMassSolar: number) {
  if (starMassSolar <= 0.6) {
    return {
      type: "M",
      core: "#ffb08a",
      middle: "#d9573f",
      edge: "#7d1f2a",
      glow: "#e34b32",
    };
  }
  if (starMassSolar <= 0.9) {
    return {
      type: "K",
      core: "#fff0b0",
      middle: "#f5a33b",
      edge: "#b84b24",
      glow: "#ed8a2f",
    };
  }
  if (starMassSolar <= 1.1) {
    return {
      type: "G",
      core: "#fff9cf",
      middle: "#ffc85c",
      edge: "#e86f2a",
      glow: "#ff9d36",
    };
  }
  return {
    type: "F",
    core: "#ffffff",
    middle: "#f5f4dc",
    edge: "#d8c98c",
    glow: "#fff3b0",
  };
}

function ParameterControls({
  parameters,
  onChange,
}: {
  parameters: RingParameters;
  onChange: (key: ParameterKey, value: number) => void;
}) {
  const [openHelp, setOpenHelp] = useState<ParameterKey | null>(null);
  const [helpSide, setHelpSide] = useState<"left" | "right">("right");

  return (
    <div className="parameter-list">
      {CONTROLS.map((control) => {
        const progress =
          ((parameters[control.key] - control.min) /
            (control.max - control.min)) *
          100;
        return (
          <div className="parameter" key={control.key}>
            <span className="parameter-title">
              <i>{control.symbol}</i>
              <label htmlFor={`parameter-${control.key}`}>{control.label}</label>
              <button
                type="button"
                className="parameter-help-button"
                aria-label={`Help: ${control.label}`}
                aria-expanded={openHelp === control.key}
                aria-controls={`help-${control.key}`}
                onClick={(event) => {
                  if (openHelp !== control.key) {
                    setHelpSide(
                      event.currentTarget.getBoundingClientRect().right >
                        window.innerWidth / 2
                        ? "left"
                        : "right",
                    );
                  }
                  setOpenHelp((current) =>
                    current === control.key ? null : control.key,
                  );
                }}
              >
                ?
              </button>
              <output>
                {formatControlValue(
                  control.key,
                  parameters[control.key],
                  control.unit,
                )}
              </output>
            </span>
            {openHelp === control.key && (
              <div
                className={`parameter-help parameter-help--${helpSide}`}
                id={`help-${control.key}`}
                role="dialog"
                aria-label={`Help: ${control.label}`}
              >
                <span>{control.help}</span>
                <button
                  type="button"
                  className="parameter-help-close"
                  aria-label={`Close help: ${control.label}`}
                  onClick={() => setOpenHelp(null)}
                >
                  ×
                </button>
              </div>
            )}
            <input
              id={`parameter-${control.key}`}
              type="range"
              min={control.min}
              max={control.max}
              step={control.step}
              value={parameters[control.key]}
              style={{ "--progress": `${progress}%` } as React.CSSProperties}
              onChange={(event) =>
                onChange(control.key, Number(event.currentTarget.value))
              }
            />
          </div>
        );
      })}
    </div>
  );
}

function TransitScene({
  parameters,
  model,
  starMassSolar,
  phase,
  playing,
  showEquivalentPlanet,
  showPlanetToScale,
  zoomIn,
  onShowEquivalentPlanetChange,
  onShowPlanetToScaleChange,
  onZoomInChange,
  onPhase,
  onToggle,
}: {
  parameters: RingParameters;
  model: TransitModel;
  starMassSolar: number;
  phase: number;
  playing: boolean;
  showEquivalentPlanet: boolean;
  showPlanetToScale: boolean;
  zoomIn: boolean;
  onShowEquivalentPlanetChange: (value: boolean) => void;
  onShowPlanetToScaleChange: (value: boolean) => void;
  onZoomInChange: (value: boolean) => void;
  onPhase: (phase: number) => void;
  onToggle: () => void;
}) {
  const spectralAppearance = getSpectralAppearance(starMassSolar);
  const starX = 400;
  const starY = 165;
  const starR = 116;
  const visualScale = showPlanetToScale ? 1 : 1.85;
  const planetR = showPlanetToScale
    ? starR * parameters.planetRadius
    : Math.max(8, starR * parameters.planetRadius * visualScale);
  const outerR = planetR * parameters.outerRingRadius;
  const innerR = planetR * parameters.innerRingRadius;
  const projected = Math.max(
    0.055,
    Math.cos((parameters.inclination * Math.PI) / 180),
  );
  const ringOpacity =
    parameters.alpha >= 1
      ? 0
      : parameters.alpha <= 0
        ? 0.88
        : 0.88 * (1 - parameters.alpha ** (1 / projected));
  const firstCurveX = model.lightCurve[0].x;
  const lastCurveX = model.lightCurve[model.lightCurve.length - 1].x;
  const physicalX =
    firstCurveX + ((phase + 1) / 2) * (lastCurveX - firstCurveX);
  const visualPlanetRadius = planetR / starR;
  const visualOuterRadius = outerR / starR;
  const equivalentPlanetR = showPlanetToScale
    ? starR * model.equivalentPlanetRadius
    : Math.max(8, starR * model.equivalentPlanetRadius * visualScale);
  const equivalentPlanetY = starY - parameters.impact * starR;
  const theta = (parameters.tilt * Math.PI) / 180;
  const limbX = Math.sqrt(Math.max(0, 1 - parameters.impact ** 2));
  const hLeft = ellipseSupport(
    -limbX,
    parameters.impact,
    visualOuterRadius,
    visualOuterRadius * projected,
    theta,
  );
  const hRight = ellipseSupport(
    limbX,
    parameters.impact,
    visualOuterRadius,
    visualOuterRadius * projected,
    theta,
  );
  const visualRingContacts = [
    -Math.sqrt(Math.max(0, (1 + hLeft) ** 2 - parameters.impact ** 2)),
    -Math.sqrt(Math.max(0, (1 - hLeft) ** 2 - parameters.impact ** 2)),
    Math.sqrt(Math.max(0, (1 - hRight) ** 2 - parameters.impact ** 2)),
    Math.sqrt(Math.max(0, (1 + hRight) ** 2 - parameters.impact ** 2)),
  ];
  const visualPlanetContacts = [
    -Math.sqrt(
      Math.max(0, (1 + visualPlanetRadius) ** 2 - parameters.impact ** 2),
    ),
    -Math.sqrt(
      Math.max(0, (1 - visualPlanetRadius) ** 2 - parameters.impact ** 2),
    ),
    Math.sqrt(
      Math.max(0, (1 - visualPlanetRadius) ** 2 - parameters.impact ** 2),
    ),
    Math.sqrt(
      Math.max(0, (1 + visualPlanetRadius) ** 2 - parameters.impact ** 2),
    ),
  ];
  const visualContacts =
    ringOpacity > 1e-4
      ? [
          Math.min(visualRingContacts[0], visualPlanetContacts[0]),
          Math.max(visualRingContacts[1], visualPlanetContacts[1]),
          Math.min(visualRingContacts[2], visualPlanetContacts[2]),
          Math.max(visualRingContacts[3], visualPlanetContacts[3]),
        ]
      : visualPlanetContacts;
  const visualPadding = 0.16;
  const visualX = mapThroughContacts(
    physicalX,
    [firstCurveX, ...model.contacts, lastCurveX],
    [
      visualContacts[0] - visualPadding,
      ...visualContacts,
      visualContacts[3] + visualPadding,
    ],
  );
  const planetX = starX + visualX * starR;
  const planetY = starY + parameters.impact * starR;
  const equivalentVisualRadius = equivalentPlanetR / starR;
  const equivalentVisualContacts = [
    -Math.sqrt(
      Math.max(
        0,
        (1 + equivalentVisualRadius) ** 2 -
          ((equivalentPlanetY - starY) / starR) ** 2,
      ),
    ),
    -Math.sqrt(
      Math.max(
        0,
        (1 - equivalentVisualRadius) ** 2 -
          ((equivalentPlanetY - starY) / starR) ** 2,
      ),
    ),
    Math.sqrt(
      Math.max(
        0,
        (1 - equivalentVisualRadius) ** 2 -
          ((equivalentPlanetY - starY) / starR) ** 2,
      ),
    ),
    Math.sqrt(
      Math.max(
        0,
        (1 + equivalentVisualRadius) ** 2 -
          ((equivalentPlanetY - starY) / starR) ** 2,
      ),
    ),
  ];
  const equivalentVisualX = mapThroughContacts(
    physicalX,
    [firstCurveX, ...model.equivalentContacts, lastCurveX],
    [
      equivalentVisualContacts[0] - visualPadding,
      ...equivalentVisualContacts,
      equivalentVisualContacts[3] + visualPadding,
    ],
  );
  const equivalentPlanetX = starX + equivalentVisualX * starR;

  return (
    <section className="scene-card" aria-label="Ringed planet transit geometry">
      <div className="card-heading">
        <h2>Transit geometry</h2>
        <span className="scale-note">
          {showPlanetToScale ? "Planet to scale" : "Planet enlarged × visual scale"}
        </span>
      </div>
      <svg
        className="transit-scene"
        viewBox={zoomIn ? "200 82.5 400 165" : "0 0 800 330"}
        role="img"
        aria-label="Schematic transit of a ringed planet"
      >
        <defs>
          <radialGradient id="starSurface" cx="42%" cy="38%">
            <stop offset="0" stopColor={spectralAppearance.core} />
            <stop offset="0.55" stopColor={spectralAppearance.middle} />
            <stop offset="1" stopColor={spectralAppearance.edge} />
          </radialGradient>
          <filter id="starGlow" x="-70%" y="-70%" width="240%" height="240%">
            <feGaussianBlur stdDeviation="13" />
          </filter>
          <mask id="ringMask">
            <rect width="800" height="330" fill="black" />
            <ellipse
              suppressHydrationWarning
              cx={planetX}
              cy={planetY}
              rx={outerR}
              ry={outerR * projected}
              fill="white"
              transform={`rotate(${parameters.tilt} ${planetX} ${planetY})`}
            />
            <ellipse
              suppressHydrationWarning
              cx={planetX}
              cy={planetY}
              rx={innerR}
              ry={innerR * projected}
              fill="black"
              transform={`rotate(${parameters.tilt} ${planetX} ${planetY})`}
            />
          </mask>
          <linearGradient id="ringColor" x1="0" x2="1">
            <stop stopColor="#bc7941" />
            <stop offset="0.5" stopColor="#f2c87c" />
            <stop offset="1" stopColor="#9e5f35" />
          </linearGradient>
          <radialGradient id="planetSurface" cx="32%" cy="28%">
            <stop stopColor="#8cc7d4" />
            <stop offset="0.55" stopColor="#397486" />
            <stop offset="1" stopColor="#142e3b" />
          </radialGradient>
        </defs>

        <circle
          cx={starX}
          cy={starY}
          r={starR + 13}
          fill={spectralAppearance.glow}
          opacity="0.22"
          filter="url(#starGlow)"
        />
        <circle
          cx={starX}
          cy={starY}
          r={starR}
          fill="url(#starSurface)"
        >
          <title>{`Spectral type ${spectralAppearance.type} star`}</title>
        </circle>
        <line
          x1="0"
          x2="800"
          y1={starY}
          y2={starY}
          stroke="#d7e2e0"
          strokeDasharray="4 9"
          opacity="0.2"
        />
        <line
          x1="0"
          x2="800"
          y1={planetY}
          y2={planetY}
          stroke="#66dfd0"
          strokeDasharray="5 8"
          opacity="0.32"
        />
        {showEquivalentPlanet && (
          <line
            x1="0"
            x2="800"
            y1={equivalentPlanetY}
            y2={equivalentPlanetY}
            stroke="#fb7185"
            strokeDasharray="3 8"
            opacity="0.28"
          />
        )}
        <line
          x1="48"
          x2="48"
          y1={starY}
          y2={planetY}
          stroke="#66dfd0"
          opacity="0.65"
        />
        <text
          x="37"
          y={(starY + planetY) / 2 + 4}
          fill="#66dfd0"
          fontSize="12"
          textAnchor="end"
        >
          b
        </text>
        <rect
          x={planetX - outerR - 4}
          y={planetY - outerR - 4}
          width={2 * outerR + 8}
          height={2 * outerR + 8}
          fill="url(#ringColor)"
          mask="url(#ringMask)"
          opacity={ringOpacity}
        />
        <circle
          cx={planetX}
          cy={planetY}
          r={planetR}
          fill="url(#planetSurface)"
          stroke="#a9e1e8"
          strokeWidth="1"
        />
        <path
          d={`M${planetX - planetR * 0.8} ${planetY - 3} Q ${planetX} ${planetY + 3} ${planetX + planetR * 0.8} ${planetY - 2}`}
          fill="none"
          stroke="#b7d9dc"
          strokeWidth="2"
          opacity="0.35"
        />
        {showEquivalentPlanet && (
          <circle
            cx={equivalentPlanetX}
            cy={equivalentPlanetY}
            r={equivalentPlanetR}
            fill="none"
            stroke="#fb7185"
            strokeWidth="2"
            strokeDasharray="5 4"
            opacity="0.95"
          >
            <title>
              Equivalent ringless planet, radius {model.equivalentPlanetRadius.toFixed(3)} R★
            </title>
          </circle>
        )}
      </svg>
      <div className="playback">
        <button type="button" onClick={onToggle} aria-label={playing ? "Pause transit" : "Play transit"}>
          {playing ? "Ⅱ" : "▶"}
        </button>
        <input
          aria-label="Transit position"
          type="range"
          min="-1"
          max="1"
          step="0.002"
          value={phase}
          onChange={(event) => onPhase(Number(event.currentTarget.value))}
        />
        <span>{model.timeAtX(physicalX).toFixed(2)} h</span>
      </div>
      <div className="simulation-options">
        <p className="simulation-options-title">Options</p>
        <label className="simulation-option">
          <input
            type="checkbox"
            checked={showEquivalentPlanet}
            onChange={(event) => onShowEquivalentPlanetChange(event.currentTarget.checked)}
          />
          <span>Show ringless planet in simulation</span>
        </label>
        <label className="simulation-option">
          <input
            type="checkbox"
            checked={showPlanetToScale}
            onChange={(event) => onShowPlanetToScaleChange(event.currentTarget.checked)}
          />
          <span>Show planet to scale</span>
        </label>
        <label className="simulation-option">
          <input
            type="checkbox"
            checked={zoomIn}
            onChange={(event) => onZoomInChange(event.currentTarget.checked)}
          />
          <span>Zoom in x2</span>
        </label>
      </div>
    </section>
  );
}

function LightCurve({
  model,
  phase,
  autoScaleDepth,
  showEquivalent,
  onAutoScaleDepthChange,
  onShowEquivalentChange,
}: {
  model: TransitModel;
  phase: number;
  autoScaleDepth: boolean;
  showEquivalent: boolean;
  onAutoScaleDepthChange: (value: boolean) => void;
  onShowEquivalentChange: (value: boolean) => void;
}) {
  const width = 900;
  const height = 270;
  const margin = { left: 60, right: 28, top: 22, bottom: 42 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;
  const first = model.lightCurve[0];
  const last = model.lightCurve[model.lightCurve.length - 1];
  const tMin = first.time;
  const tMax = last.time;
  const yMin = 1 - (autoScaleDepth
    ? Math.max(model.depth * 1.08, 1e-6)
    : Math.max(model.verticalScaleDepth, model.depth * 1.08));
  const xScale = (time: number) =>
    margin.left + ((time - tMin) / (tMax - tMin)) * plotW;
  const yScale = (flux: number) =>
    margin.top + ((1 - flux) / (1 - yMin)) * plotH;
  const path = model.lightCurve
    .map(
      (point, index) =>
        `${index ? "L" : "M"} ${xScale(point.time).toFixed(2)} ${yScale(point.flux).toFixed(2)}`,
    )
    .join(" ");
  const equivalentPath = model.lightCurve
    .map(
      (point, index) =>
        `${index ? "L" : "M"} ${xScale(point.time).toFixed(2)} ${yScale(point.equivalentFlux).toFixed(2)}`,
    )
    .join(" ");
  const currentIndex = Math.round(
    ((phase + 1) / 2) * (model.lightCurve.length - 1),
  );
  const current = model.lightCurve[
    Math.max(0, Math.min(model.lightCurve.length - 1, currentIndex))
  ];
  const events = model.contacts.map((x, index) => ({
    x,
    label: `T${index + 1}`,
    anchor: index < 2 ? ("start" as const) : ("end" as const),
  }));
  const equivalentEvents = [
    { x: model.equivalentContacts[0], label: "T1" },
    ...(model.hasFullEquivalentTransit
      ? [
          { x: model.equivalentContacts[1], label: "T2" },
          { x: model.equivalentContacts[2], label: "T3" },
        ]
      : []),
    { x: model.equivalentContacts[3], label: "T4" },
  ];

  return (
    <section className="curve-card" aria-label="Synthetic light curve">
      <div className="card-heading curve-heading">
        <div>
          <h2>Synthetic light curve</h2>
        </div>
        <div className="curve-legend">
          <span className="legend-item">
            <i className="ring-swatch" /> Ringed planet
          </span>
          <button
            type="button"
            className={`legend-item legend-toggle ${showEquivalent ? "active" : "inactive"}`}
            onClick={() => onShowEquivalentChange(!showEquivalent)}
            aria-pressed={showEquivalent}
            title="Toggle equivalent ringless planet curve and contact lines (T1-T4)"
          >
            <i className="equivalent-swatch" /> Ringless planet (R = {model.equivalentPlanetRadius.toFixed(3)} R★)
          </button>
          <span className="legend-item">
            <i className="cursor-swatch" /> Current position
          </span>
        </div>
      </div>
      <svg
        className="light-curve"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Synthetic transit light curve with contact markers"
      >
        {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
          const y = margin.top + fraction * plotH;
          const flux = 1 - fraction * (1 - yMin);
          return (
            <g key={fraction}>
              <line
                x1={margin.left}
                x2={width - margin.right}
                y1={y}
                y2={y}
                className="chart-grid"
              />
              <text x={margin.left - 10} y={y + 4} className="axis-label" textAnchor="end">
                {flux.toFixed(4)}
              </text>
            </g>
          );
        })}
        {events.map((event) => {
          const time = model.timeAtX(event.x);
          const x = xScale(time);
          return (
            <g key={event.label}>
              <title>{`${event.label} (ringed planet): ${time.toFixed(2)} h`}</title>
              <line
                x1={x}
                x2={x}
                y1={margin.top}
                y2={height - margin.bottom}
                className="event-line"
              />
              <text
                x={x + (event.anchor === "start" ? 6 : -6)}
                y={height - margin.bottom + 16}
                className="event-label"
                textAnchor={event.anchor}
              >
                {event.label}
              </text>
            </g>
          );
        })}
        {showEquivalent &&
          equivalentEvents.map((event) => {
            const time = model.timeAtX(event.x);
            const x = xScale(time);
            return (
              <g key={`eq-${event.label}`}>
                <title>{`${event.label} (ringless planet): ${time.toFixed(2)} h`}</title>
                <line
                  x1={x}
                  x2={x}
                  y1={margin.top}
                  y2={height - margin.bottom}
                  className="event-line-equivalent"
                />
                <text
                  x={x}
                  y={margin.top - 8}
                  className="event-label-equivalent"
                  textAnchor="middle"
                >
                  {event.label}
                </text>
              </g>
            );
          })}
        {showEquivalent && (
          <>
            <path
              d={equivalentPath}
              className="curve-path-equivalent curve-glow-equivalent"
            />
            <path d={equivalentPath} className="curve-path-equivalent" />
          </>
        )}
        <path d={path} className="curve-path curve-glow" />
        <path d={path} className="curve-path" />
        <line
          x1={xScale(current.time)}
          x2={xScale(current.time)}
          y1={margin.top}
          y2={height - margin.bottom}
          className="position-line"
        />
        {showEquivalent && (
          <circle
            cx={xScale(current.time)}
            cy={yScale(current.equivalentFlux)}
            r="4"
            className="position-dot-equivalent"
          />
        )}
        <circle
          cx={xScale(current.time)}
          cy={yScale(current.flux)}
          r="4.5"
          className="position-dot"
        />
        <text x={width / 2} y={height - 8} className="axis-title" textAnchor="middle">
          Time from mid-transit [hours]
        </text>
        <text
          x="15"
          y={height / 2}
          className="axis-title"
          textAnchor="middle"
          transform={`rotate(-90 15 ${height / 2})`}
        >
          Relative flux
        </text>
      </svg>
      <div className="curve-options">
        <p className="simulation-options-title">Options</p>
        <label className="simulation-option">
          <input
            type="checkbox"
            checked={autoScaleDepth}
            onChange={(event) => onAutoScaleDepthChange(event.currentTarget.checked)}
          />
          <span>Auto scale depth</span>
        </label>
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
  note,
  accent,
  help,
  helpId,
}: {
  label: React.ReactNode;
  value: string;
  note: string;
  accent?: boolean;
  help: string;
  helpId: string;
}) {
  return (
    <div className={`metric${accent ? " metric--accent" : ""}`}>
      <span className="metric-label">
        {label}
        <CalculatedHelp help={help} helpId={helpId} label={String(label)} />
      </span>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  );
}

function CalculatedHelp({
  help,
  helpId,
  label,
}: {
  help: string;
  helpId: string;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [helpSide, setHelpSide] = useState<"left" | "right">("right");

  return (
    <span className="calculated-help">
      <button
        type="button"
        className="calculated-help-button"
        aria-label={`Help: ${label}`}
        aria-expanded={open}
        aria-controls={helpId}
        onClick={(event) => {
          if (!open) {
            setHelpSide(
              event.currentTarget.getBoundingClientRect().right >
                window.innerWidth / 2
                ? "left"
                : "right",
            );
          }
          setOpen((current) => !current);
        }}
      >
        ?
      </button>
      {open && (
        <span
          className={`calculated-help-tooltip calculated-help-tooltip--${helpSide}`}
          id={helpId}
          role="dialog"
        >
          <span>{help}</span>
          <button
            type="button"
            className="calculated-help-close"
            aria-label={`Close help: ${label}`}
            onClick={() => setOpen(false)}
          >
            ×
          </button>
        </span>
      )}
    </span>
  );
}

function PhotoRingSummaryCard({
  model,
  equivalentPlanetRadius,
  equivalentRadiusRatio,
  observedPlanetDensityRatio,
  observedPlanetDensityGcm3,
  planetTrueDensityGcm3,
  densityClass,
}: {
  model: TransitModel;
  equivalentPlanetRadius: number;
  equivalentRadiusRatio: number;
  observedPlanetDensityRatio: number;
  observedPlanetDensityGcm3: number;
  planetTrueDensityGcm3: number;
  densityClass: string;
}) {
  return (
    <aside className="simulation-summary-card" aria-label="PR observables">
      <div className="card-heading">
        <div>
          <h2>PR observables</h2>
        </div>
      </div>
      <div className="summary-metrics-list">
        <div className="summary-metric summary-metric--accent">
          <div className="summary-metric-header">
            <span className="summary-metric-label">
              PR Anomaly
              <CalculatedHelp
                help="PR anomaly = 10 log10(rho_obs / rho★). It is the logarithmic difference between the stellar density inferred from the ringed transit and the true stellar density."
                helpId="help-pr-anomaly"
                label="PR anomaly"
              />
            </span>
            <span className="summary-metric-tag">{densityClass}</span>
          </div>
          <strong>
            {model.prAnomaly >= 0 ? "+" : ""}
            {model.prAnomaly.toFixed(2)}
          </strong>
          <small>10 log₁₀(ρobs / ρ★) · asterodensity</small>
        </div>

        <div className="summary-metric">
          <div className="summary-metric-header">
            <span className="summary-metric-label">
              Equivalent Planet Radius
              <CalculatedHelp
                help="Radius of a ringless planet that would block the same total amount of light as the ringed planet."
                helpId="help-equivalent-radius"
                label="equivalent planet radius"
              />
            </span>
          </div>
          <strong>{equivalentPlanetRadius.toFixed(3)} R★</strong>
          <small>
            {equivalentRadiusRatio.toFixed(2)} Rₚ · {(100 * (equivalentRadiusRatio - 1)).toFixed(0)}% larger from depth
          </small>
        </div>

        <div className="summary-metric">
          <div className="summary-metric-header">
            <span className="summary-metric-label">
              Planet true density
              <CalculatedHelp
                help="Bulk density of the physical ringed planet. It is higher than the observed density because the latter assumes a much larger ringless planet whose apparent size includes the rings."
                helpId="help-planet-true-density"
                label="planet true density"
              />
            </span>
          </div>
          <strong>{planetTrueDensityGcm3.toFixed(3)} g/cm³</strong>
          <small>density from Mp and Rp</small>
        </div>

        <div className="summary-metric">
          <div className="summary-metric-header">
            <span className="summary-metric-label">
              Planet observed density
              <CalculatedHelp
                help="Density inferred by treating the equivalent transit radius as the planet radius. Rings make this apparent density lower than the true planetary density."
                helpId="help-planet-density"
                label="planet observed density"
              />
            </span>
          </div>
          <strong>{observedPlanetDensityGcm3.toFixed(3)} g/cm³</strong>
          <small>
            {(observedPlanetDensityRatio * 100).toFixed(0)}% of true ρₚ
          </small>
        </div>
      </div>
    </aside>
  );
}

export default function PhotoRingSimulator() {
  const [configuration, setConfiguration] =
    useState<UrlConfiguration>(DEFAULT_CONFIGURATION);
  const [selectedPreset, setSelectedPreset] = useState<PresetKey | "custom">(
    "default",
  );
  const [phase, setPhase] = useState(-0.76);
  const [playing, setPlaying] = useState(false);
  const [copyLinkFeedback, setCopyLinkFeedback] = useState<string | null>(null);
  const {
    parameters,
    starMassSolar,
    starRadiusSolar,
    periodDays,
    densityKgM3,
    planetMassJupiter,
    showEquivalentPlanet,
    showPlanetToScale,
    zoomIn,
    autoScaleDepth,
    showEquivalentCurve,
  } = configuration;
  const model = useMemo(
    () => computeTransit(parameters, periodDays, densityKgM3),
    [parameters, periodDays, densityKgM3],
  );

  useEffect(() => {
    const urlConfiguration = readConfigurationFromUrl(window.location.search);
    if (!urlConfiguration) return;
    startTransition(() => {
      setSelectedPreset("custom");
      setConfiguration(urlConfiguration);
    });
  }, []);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      setPhase((current) => (current >= 1 ? -1 : current + 0.008));
    }, 32);
    return () => window.clearInterval(timer);
  }, [playing]);

  const changeParameter = (key: ParameterKey, value: number) => {
    setSelectedPreset("custom");
    setConfiguration((currentConfiguration) => {
      const current = currentConfiguration.parameters;
      const next = { ...current, [key]: value };
      if (key === "innerRingRadius" && value >= next.outerRingRadius) {
        next.outerRingRadius = Math.min(4, value + 0.1);
      }
      if (key === "outerRingRadius" && value <= next.innerRingRadius) {
        next.innerRingRadius = Math.max(1.05, value - 0.1);
      }
      return { ...currentConfiguration, parameters: next };
    });
  };

  const resetConfiguration = () => {
    setSelectedPreset("default");
    setConfiguration(DEFAULT_CONFIGURATION);
  };

  const selectPreset = (preset: PresetKey | "custom") => {
    if (preset === "custom") return;
    setSelectedPreset(preset);
    setConfiguration(PRESET_CONFIGURATIONS[preset]);
  };

  const handleCopyConfiguration = async () => {
    try {
      await navigator.clipboard.writeText(
        buildConfigurationUrl(configuration, aInAu),
      );
      setCopyLinkFeedback("Link copied");
    } catch {
      setCopyLinkFeedback("Could not copy link");
    }
    window.setTimeout(() => setCopyLinkFeedback(null), 2500);
  };

  const densityClass =
    model.observedDensityRatio < 0.98
      ? "underestimated"
      : model.observedDensityRatio > 1.02
        ? "overestimated"
        : "unchanged";
  const equivalentPlanetRadius = model.equivalentPlanetRadius;
  const equivalentRadiusRatio =
    equivalentPlanetRadius / parameters.planetRadius;
  const planetRadiusJupiter =
    parameters.planetRadius * starRadiusSolar / JUPITER_TO_SUN_RADIUS;
  const planetTrueDensityGcm3 =
    planetMassJupiter * JUPITER_DENSITY_G_CM3 / planetRadiusJupiter ** 3;
  const observedPlanetDensityRatio =
    equivalentRadiusRatio ** -3;
  const observedPlanetDensityGcm3 =
    planetTrueDensityGcm3 * observedPlanetDensityRatio;
  const aInAu = configuration.semiMajorAxisAu;
  const aInRStar = aInAu / (starRadiusSolar * SOLAR_RADIUS_AU);

  return (
    <div className="app">
      <header className="hero">
        <div>
          <p className="hero-kicker">INTERACTIVE ASTERODENSITY LAB</p>
          <h1><strong>PhotoRing Effect Simulator</strong></h1>
          <p className="byline">
            By{" "}
            <a
              href="https://jorgezuluaga.github.io/index.html?lang=en"
              target="_blank"
              rel="noreferrer"
            >
              Jorge I. Zuluaga
            </a>
            {", "}
            <a
              href="https://orcid.org/0000-0002-6140-3116"
              target="_blank"
              rel="noreferrer"
            >
              Ph.D.
            </a>
          </p>
          <p className="hero-description">
            This app lets you explore the PhotoRing effect, introduced in the paper{" "}
            <a
              href="https://doi.org/10.1088/2041-8205/803/1/L14"
              target="_blank"
              rel="noreferrer"
            >
              A Novel Method for Identifying Exoplanetary Rings
            </a>{" "}
            and developed further in the paper{" "}
            <a
              href="https://arxiv.org/abs/2609.25234"
              target="_blank"
              rel="noreferrer"
            >
              Probing Exoplanetary Rings with Asterodensity Profiling: A PhotoRing Analysis of Kepler-51
            </a>
            . The effect occurs when rings change the transit silhouette and duration, making the
            inferred stellar density differ from its true value.
            Change the System Parameters values and observe how the PR anomaly changes.
            <br />
            <a href="https://github.com/seap-udea/seap-udea.github.io/blob/main/apps/photoring-simulator/README.md">
              Want to know how PR is calculated? See the README.md
            </a>
          </p>
        </div>
        <a
          href="https://seap-udea.github.io/"
          target="_blank"
          rel="noreferrer"
          className="hero-logo-link"
          aria-label="SEAP - Solar, Earth and Planetary Physics"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="hero-seap-logo"
            src="/apps/photoring-simulator/seap-symbol.webp"
            alt="SEAP Logo Símbolo"
          />
        </a>
      </header>

      <main>
        <div className="workspace">
          <aside className="controls-card">
            <div className="controls-heading">
              <div>
                <p className="eyebrow">SYSTEM PARAMETERS</p>
                <h2>Shape the transit</h2>
                <p className="parameter-assumptions">
                  M★ = {starMassSolar.toFixed(2)} M☉ · R★ ={" "}
                  {starRadiusSolar.toFixed(2)} R☉ · Mp = {planetMassJupiter.toFixed(3)} Mjup · a = {aInAu.toFixed(3)} AU ={" "}
                  {aInRStar.toFixed(1)} R★ · Porb = {periodDays.toFixed(2)} days
                </p>
              </div>
            </div>
            <ParameterControls
              parameters={parameters}
              onChange={changeParameter}
            />
            <div className="controls-actions controls-actions--bottom">
              <button
                type="button"
                className="config-link-button"
                onClick={() => void handleCopyConfiguration()}
              >
                Copy configuration
              </button>
              <button
                type="button"
                className="reset-button"
                onClick={resetConfiguration}
              >
                Reset
              </button>
              {copyLinkFeedback && (
                <span className="config-link-feedback" role="status">
                  {copyLinkFeedback}
                </span>
              )}
            </div>
            <label className="preset-selector">
              <span>Preset configuration</span>
              <select
                value={selectedPreset}
                onChange={(event) =>
                  selectPreset(event.currentTarget.value as PresetKey | "custom")
                }
              >
                {selectedPreset === "custom" && (
                  <option value="custom">Custom configuration</option>
                )}
                {Object.entries(PRESET_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </aside>

          <div className="visual-stack">
            <div className="simulation-row">
              <TransitScene
                parameters={parameters}
                model={model}
                starMassSolar={starMassSolar}
                phase={phase}
                playing={playing}
                showEquivalentPlanet={showEquivalentPlanet}
                showPlanetToScale={showPlanetToScale}
                zoomIn={zoomIn}
                onShowEquivalentPlanetChange={(value) =>
                  setConfiguration((current) => ({
                    ...current,
                    showEquivalentPlanet: value,
                  }))
                }
                onShowPlanetToScaleChange={(value) =>
                  setConfiguration((current) => ({
                    ...current,
                    showPlanetToScale: value,
                  }))
                }
                onZoomInChange={(value) =>
                  setConfiguration((current) => ({
                    ...current,
                    zoomIn: value,
                  }))
                }
                onPhase={(value) => {
                  setPhase(value);
                  setPlaying(false);
                }}
                onToggle={() => setPlaying((current) => !current)}
              />
              <PhotoRingSummaryCard
                model={model}
                equivalentPlanetRadius={equivalentPlanetRadius}
                equivalentRadiusRatio={equivalentRadiusRatio}
                observedPlanetDensityRatio={observedPlanetDensityRatio}
                observedPlanetDensityGcm3={observedPlanetDensityGcm3}
                planetTrueDensityGcm3={planetTrueDensityGcm3}
                densityClass={densityClass}
              />
            </div>
            <LightCurve
              model={model}
              phase={phase}
              autoScaleDepth={autoScaleDepth}
              showEquivalent={showEquivalentCurve}
              onAutoScaleDepthChange={(value) =>
                setConfiguration((current) => ({
                  ...current,
                  autoScaleDepth: value,
                }))
              }
              onShowEquivalentChange={(value) =>
                setConfiguration((current) => ({
                  ...current,
                  showEquivalentCurve: value,
                }))
              }
            />
          </div>
        </div>

        <h2 id="other-observables-title" className="other-observables-title">
          Other observables
        </h2>
        <section className="metrics" aria-labelledby="other-observables-title">
          <Metric
            label="T₁₄"
            value={`${model.durations.total.toFixed(2)} h`}
            note="total transit duration"
            help="T14 is the total duration from first contact to fourth contact, including the ring system."
            helpId="help-t14"
          />
          <Metric
            label="T₂₃"
            value={`${model.durations.full.toFixed(2)} h`}
            note="full transit duration"
            help="T23 is the duration between second and third contact, when the full occulting silhouette is inside the stellar disk."
            helpId="help-t23"
          />
          <Metric
            label="Transit depth"
            value={`${(model.depth * 1e6).toFixed(0)} ppm`}
            note="maximum blocked flux"
            help="Transit depth is the maximum fraction of stellar light blocked by the planet and its rings."
            helpId="help-transit-depth"
          />
          <Metric
            label={<>(a/R★)<sub>obs</sub></>}
            value={`${model.observedA.toFixed(1)}`}
            note={`scaled semi-major axis · Eq. 13 (true ${model.aOverR.toFixed(1)})`}
            help="a/R★ inferred from the observed transit durations and depth. The true value is shown in the note."
            helpId="help-observed-a"
          />
          <Metric
            label={<>b<sub>obs</sub></>}
            value={`${model.observedB.toFixed(2)}`}
            note={`impact parameter · Eq. 14 (true ${parameters.impact.toFixed(2)})`}
            help="b_obs is the impact parameter inferred under the ringless-planet assumption. The true input b is shown in the note."
            helpId="help-observed-b"
          />
          <Metric
            label="Inferred density"
            value={`${model.observedDensityRatio.toFixed(3)} ρ★`}
            note={`stellar density ${densityClass}`}
            help="Inferred density is the stellar density estimated from the ringless interpretation of the transit, relative to the true density used by the model."
            helpId="help-inferred-density"
          />
        </section>
      </main>

      <footer>
        <a
          href="https://seap-udea.github.io/"
          target="_blank"
          rel="noreferrer"
          aria-label="SEAP Universidad de Antioquia"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="footer-logo"
            src="https://seap-udea.github.io/assets/LogoSEAP-BannerNegro.png"
            onError={(e) => {
              e.currentTarget.src = "/apps/photoring-simulator/seap-symbol.webp";
            }}
            alt="SEAP Universidad de Antioquia"
          />
        </a>
        <div>
          <strong>
            Developed by{" "}
            <a
              href="https://jorgezuluaga.github.io/index.html?lang=en"
              target="_blank"
              rel="noreferrer"
            >
              Jorge I. Zuluaga
            </a>{" "}
            with the assistance of AI.
          </strong>
          <p>
            Based on{" "}
            <a
              href="https://doi.org/10.1088/2041-8205/803/1/L14"
              target="_blank"
              rel="noreferrer"
            >
              Zuluaga et al. (2015)
            </a>{" "}
            and the{" "}
            <a
              href="https://arxiv.org/abs/2609.25234"
              target="_blank"
              rel="noreferrer"
            >
              PRisma PhotoRing model in Zuluaga et al. (2026) / arXiv:2609.25234
            </a>
            .
          </p>
        </div>
        <nav aria-label="Project links">
          <a href="https://seap-udea.github.io/">SEAP</a>
          <a href="https://github.com/seap-udea/seap-udea.github.io/tree/main/apps/photoring-simulator">
            Source
          </a>
        </nav>
      </footer>
    </div>
  );
}
