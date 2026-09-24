"use client";

import { useEffect, useMemo, useState } from "react";
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
  alpha: 0,
};

type ParameterKey = keyof RingParameters;

const CONTROLS: {
  key: ParameterKey;
  symbol: string;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
}[] = [
  {
    key: "planetRadius",
    symbol: "p",
    label: "Planet radius",
    min: 0.03,
    max: 0.16,
    step: 0.001,
    unit: " R★",
  },
  {
    key: "innerRingRadius",
    symbol: "fᵢ",
    label: "Inner ring radius",
    min: 1.05,
    max: 2.8,
    step: 0.01,
    unit: " Rₚ",
  },
  {
    key: "outerRingRadius",
    symbol: "fₑ",
    label: "Outer ring radius",
    min: 1.2,
    max: 4,
    step: 0.01,
    unit: " Rₚ",
  },
  {
    key: "tilt",
    symbol: "θᵣ",
    label: "Ring tilt",
    min: 0,
    max: 90,
    step: 1,
    unit: "°",
  },
  {
    key: "inclination",
    symbol: "iᵣ",
    label: "Ring inclination",
    min: 0,
    max: 90,
    step: 1,
    unit: "°",
  },
  {
    key: "impact",
    symbol: "b",
    label: "Impact parameter",
    min: 0,
    max: 0.85,
    step: 0.01,
    unit: "",
  },
  {
    key: "alpha",
    symbol: "α",
    label: "Normal attenuation",
    min: 0,
    max: 1,
    step: 0.01,
    unit: "",
  },
];

function formatControlValue(key: ParameterKey, value: number, unit: string) {
  const digits =
    key === "planetRadius" ? 3 : key === "tilt" || key === "inclination" ? 0 : 2;
  return `${value.toFixed(digits)}${unit}`;
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

function ParameterControls({
  parameters,
  onChange,
}: {
  parameters: RingParameters;
  onChange: (key: ParameterKey, value: number) => void;
}) {
  return (
    <div className="parameter-list">
      {CONTROLS.map((control) => {
        const progress =
          ((parameters[control.key] - control.min) /
            (control.max - control.min)) *
          100;
        return (
          <label className="parameter" key={control.key}>
            <span className="parameter-title">
              <i>{control.symbol}</i>
              <span>{control.label}</span>
              <output>
                {formatControlValue(
                  control.key,
                  parameters[control.key],
                  control.unit,
                )}
              </output>
            </span>
            <input
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
          </label>
        );
      })}
    </div>
  );
}

function TransitScene({
  parameters,
  model,
  phase,
  playing,
  onPhase,
  onToggle,
}: {
  parameters: RingParameters;
  model: TransitModel;
  phase: number;
  playing: boolean;
  onPhase: (phase: number) => void;
  onToggle: () => void;
}) {
  const starX = 400;
  const starY = 165;
  const starR = 116;
  const planetR = Math.max(8, starR * parameters.planetRadius * 1.85);
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

  return (
    <section className="scene-card" aria-label="Ringed planet transit geometry">
      <div className="card-heading">
        <p className="eyebrow">TRANSIT GEOMETRY</p>
        <span className="scale-note">Planet enlarged × visual scale</span>
      </div>
      <svg
        className="transit-scene"
        viewBox="0 0 800 330"
        role="img"
        aria-label="Schematic transit of a ringed planet"
      >
        <defs>
          <radialGradient id="starSurface" cx="42%" cy="38%">
            <stop offset="0" stopColor="#fff9cf" />
            <stop offset="0.55" stopColor="#ffc85c" />
            <stop offset="1" stopColor="#e86f2a" />
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
          fill="#ff9d36"
          opacity="0.22"
          filter="url(#starGlow)"
        />
        <circle cx={starX} cy={starY} r={starR} fill="url(#starSurface)" />
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
    </section>
  );
}

function LightCurve({
  model,
  phase,
}: {
  model: TransitModel;
  phase: number;
}) {
  const [showEquivalent, setShowEquivalent] = useState(true);
  const width = 900;
  const height = 270;
  const margin = { left: 60, right: 28, top: 22, bottom: 42 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;
  const first = model.lightCurve[0];
  const last = model.lightCurve[model.lightCurve.length - 1];
  const tMin = first.time;
  const tMax = last.time;
  const yMin = 1 - Math.max(model.verticalScaleDepth, model.depth * 1.08);
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
    <section className="curve-card" aria-labelledby="curve-title">
      <div className="card-heading curve-heading">
        <div>
          <p className="eyebrow">SYNTHETIC PHOTOMETRY</p>
          <h2 id="curve-title">Light curve</h2>
        </div>
        <div className="curve-legend">
          <span className="legend-item">
            <i className="ring-swatch" /> Ringed planet
          </span>
          <button
            type="button"
            className={`legend-item legend-toggle ${showEquivalent ? "active" : "inactive"}`}
            onClick={() => setShowEquivalent((prev) => !prev)}
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
    </section>
  );
}

function Metric({
  label,
  value,
  note,
  accent,
}: {
  label: React.ReactNode;
  value: string;
  note: string;
  accent?: boolean;
}) {
  return (
    <div className={`metric${accent ? " metric--accent" : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  );
}

const SATURN_TRUE_DENSITY_G_CM3 = 0.687;

function PhotoRingSummaryCard({
  model,
  equivalentPlanetRadius,
  equivalentRadiusRatio,
  observedPlanetDensityRatio,
  observedPlanetDensityGcm3,
  densityClass,
}: {
  model: TransitModel;
  equivalentPlanetRadius: number;
  equivalentRadiusRatio: number;
  observedPlanetDensityRatio: number;
  observedPlanetDensityGcm3: number;
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
            <span>PR Anomaly</span>
            <span className="summary-metric-tag">{densityClass}</span>
          </div>
          <strong>
            {model.prAnomaly >= 0 ? "+" : ""}
            {model.prAnomaly.toFixed(2)} dB
          </strong>
          <small>10 log₁₀(ρobs / ρtrue) · asterodensity</small>
        </div>

        <div className="summary-metric">
          <div className="summary-metric-header">
            <span>Equivalent Planet Radius</span>
          </div>
          <strong>{equivalentPlanetRadius.toFixed(3)} R★</strong>
          <small>
            {equivalentRadiusRatio.toFixed(2)} Rₚ · {(100 * (equivalentRadiusRatio - 1)).toFixed(0)}% larger from depth
          </small>
        </div>

        <div className="summary-metric">
          <div className="summary-metric-header">
            <span>Planet observed density</span>
          </div>
          <strong>{observedPlanetDensityGcm3.toFixed(3)} g/cm³</strong>
          <small>
            {(observedPlanetDensityRatio * 100).toFixed(0)}% of true ρₚ (Saturn = {SATURN_TRUE_DENSITY_G_CM3} g/cm³)
          </small>
        </div>
      </div>
    </aside>
  );
}

export default function PhotoRingSimulator() {
  const [parameters, setParameters] = useState(DEFAULTS);
  const [phase, setPhase] = useState(-0.76);
  const [playing, setPlaying] = useState(false);
  const model = useMemo(() => computeTransit(parameters), [parameters]);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      setPhase((current) => (current >= 1 ? -1 : current + 0.008));
    }, 32);
    return () => window.clearInterval(timer);
  }, [playing]);

  const changeParameter = (key: ParameterKey, value: number) => {
    setParameters((current) => {
      const next = { ...current, [key]: value };
      if (key === "innerRingRadius" && value >= next.outerRingRadius) {
        next.outerRingRadius = Math.min(4, value + 0.1);
      }
      if (key === "outerRingRadius" && value <= next.innerRingRadius) {
        next.innerRingRadius = Math.max(1.05, value - 0.1);
      }
      return next;
    });
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
  const observedPlanetDensityRatio = equivalentRadiusRatio ** -3;
  const observedPlanetDensityGcm3 =
    SATURN_TRUE_DENSITY_G_CM3 * observedPlanetDensityRatio;

  return (
    <div className="app">
      <header className="hero">
        <div>
          <p className="hero-kicker">INTERACTIVE ASTERODENSITY LAB</p>
          <h1><strong>PhotoRing Effect Simulator</strong></h1>
          <p className="byline">
            By{" "}
            <a
              href="https://scholar.google.com/citations?user=qpGVqNwAAAAJ&hl=en"
              target="_blank"
              rel="noreferrer"
            >
              Jorge I. Zuluaga, Ph.D.
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
            src="/assets/seap-symbol.webp"
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
              </div>
              <button
                type="button"
                className="reset-button"
                onClick={() => setParameters(DEFAULTS)}
              >
                Reset
              </button>
            </div>
            <ParameterControls
              parameters={parameters}
              onChange={changeParameter}
            />
            <p className="model-note">
              Geometrically thin ring · α = exp(−τ) · circular 1-year orbit ·
              solar-density star
            </p>
          </aside>

          <div className="visual-stack">
            <div className="simulation-row">
              <TransitScene
                parameters={parameters}
                model={model}
                phase={phase}
                playing={playing}
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
                densityClass={densityClass}
              />
            </div>
            <LightCurve model={model} phase={phase} />
          </div>
        </div>

        <section className="metrics" aria-label="Transit measurements">
          <Metric
            label="T₁₄"
            value={`${model.durations.total.toFixed(2)} h`}
            note="total transit duration"
          />
          <Metric
            label="T₂₃"
            value={`${model.durations.full.toFixed(2)} h`}
            note="full transit duration"
          />
          <Metric
            label="Transit depth"
            value={`${(model.depth * 1e6).toFixed(0)} ppm`}
            note="maximum blocked flux"
          />
          <Metric
            label={<>(a/R★)<sub>obs</sub></>}
            value={`${model.observedA.toFixed(1)}`}
            note={`scaled semi-major axis · Eq. 13 (true ${model.aOverR.toFixed(1)})`}
          />
          <Metric
            label={<>b<sub>obs</sub></>}
            value={`${model.observedB.toFixed(2)}`}
            note={`impact parameter · Eq. 14 (true ${parameters.impact.toFixed(2)})`}
          />
          <Metric
            label="Inferred density"
            value={`${model.observedDensityRatio.toFixed(3)} ρtrue`}
            note={`stellar density ${densityClass}`}
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
              e.currentTarget.src = "/assets/LogoSEAP-BannerNegro.png";
            }}
            alt="SEAP Universidad de Antioquia"
          />
        </a>
        <div>
          <strong>
            Developed by{" "}
            <a
              href="https://scholar.google.com/citations?user=qpGVqNwAAAAJ&hl=en"
              target="_blank"
              rel="noreferrer"
            >
              Jorge I. Zuluaga
            </a>{" "}
            in Cursor with the assistance of AI.
          </strong>
          <p>
            Based on Zuluaga et al. (2015) and the PRisma PhotoRing model.
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
