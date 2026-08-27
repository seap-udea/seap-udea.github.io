"use client";

import Image from "next/image";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import packageJson from "../../package.json";
import Starfield from "./Starfield";
import NumberField from "./NumberField";
import { FlightProfileChart, SpacetimeChart, type ChartAxis } from "./FlightCharts";
import {
  computeFlight,
  formatDistance,
  formatHudDistance,
  formatHudGamma,
  formatHudSpeed,
  formatHudYears,
  formatSpeed,
  formatYears,
  humanizeYears,
  sampleFlightAt,
  G_LIGHT,
  G_M_S2,
  type FlightLeg,
  type FlightPlan,
  type LegResult,
  type StopMode,
} from "../lib/relativity";
import {
  DEFAULT_ACCEL_G,
  DESTINATIONS,
  PRESETS,
  STOP_MODE_LABELS,
  STOP_MODE_UNITS,
  decodePlan,
  encodePlan,
  makeLeg,
} from "../lib/flightPlans";

const GITHUB_APP_URL =
  process.env.NEXT_PUBLIC_GITHUB_APP_URL ??
  "https://github.com/seap-udea/seap-udea.github.io/tree/main/apps/star-trek";

const WHATSNEW_URL = `${GITHUB_APP_URL.replace("/tree/", "/blob/")}/WHATSNEW.md`;

/** Duración en segundos de la reproducción completa del viaje a velocidad ×1. */
const PLAYBACK_SECONDS = 18;

const PLAYBACK_RATES = [0.5, 1, 2, 4];

const ACCEL_CHIPS = [
  { label: "−1 g", value: -1 },
  { label: "−1/6 g", value: -DEFAULT_ACCEL_G },
  { label: "1/6 g", value: DEFAULT_ACCEL_G },
  { label: "1 g", value: 1 },
];

const STOP_MODES: StopMode[] = [
  "remaining",
  "distance",
  "fraction",
  "shipTime",
  "earthTime",
];

function formatLastPushDate(isoDate: string) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "America/Bogota",
  }).format(date);
}

function AcademyFooter() {
  const lastPushLabel = formatLastPushDate(
    process.env.NEXT_PUBLIC_LAST_PUSH_DATE ?? "",
  );

  return (
    <footer className="academy-footer">
      <Image
        src={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/drz.png`}
        alt="Dr. Z Academy"
        width={58}
        height={58}
      />
      <p>
        <i>
          Desarrollado por{" "}
          <a href="https://drz.academy" target="_blank" rel="noreferrer">
            Jorge I. Zuluaga (Dr. Z)
          </a>{" "}
          en Cursor.
        </i>
      </p>
      <div className="footer-meta">
        <div className="version">
          Versión {packageJson.version}
          {lastPushLabel ? <> · {lastPushLabel}</> : null}
        </div>
        <a
          className="footer-repo-link"
          href={GITHUB_APP_URL}
          target="_blank"
          rel="noreferrer"
        >
          Código y README en GitHub
        </a>
        <a
          className="footer-repo-link"
          href={WHATSNEW_URL}
          target="_blank"
          rel="noreferrer"
        >
          Novedades (WHATSNEW)
        </a>
      </div>
    </footer>
  );
}

export default function StarshipBridge() {
  const [plan, setPlan] = useState<FlightPlan>(() => PRESETS[0].build());
  const [activePreset, setActivePreset] = useState<string | null>(PRESETS[0].id);
  const [chartTab, setChartTab] = useState<"profile" | "spacetime">("profile");
  const [chartAxis, setChartAxis] = useState<ChartAxis>("ship");
  const [progress, setProgress] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const [skyAnimated, setSkyAnimated] = useState(false);
  const [shareState, setShareState] = useState<"idle" | "copied" | "error">(
    "idle",
  );

  const progressRef = useRef(1);

  const setProgressValue = useCallback((value: number) => {
    progressRef.current = value;
    setProgress(value);
  }, []);

  /**
   * Al cambiar el plan la reproducción salta al final: el tablero muestra de
   * inmediato el estado de llegada, que es lo que el capitán quiere ver.
   */
  const rewindToArrival = useCallback(() => {
    setPlaying(false);
    setProgressValue(1);
    setSkyAnimated(false);
  }, [setProgressValue]);

  // El plan compartido vive en la URL, un sistema externo que solo puede leerse
  // ya montado el componente sin romper la hidratación del export estático.
  useEffect(() => {
    const readSharedPlan = () => {
      const shared = decodePlan(window.location.search);
      if (!shared) return;
      setPlan(shared);
      setActivePreset(null);
      rewindToArrival();
    };

    readSharedPlan();
    window.addEventListener("popstate", readSharedPlan);
    return () => window.removeEventListener("popstate", readSharedPlan);
  }, [rewindToArrival]);

  const flight = useMemo(() => computeFlight(plan), [plan]);
  const totalTau = flight.totals.shipYears;

  useEffect(() => {
    if (!playing) return;

    let raf = 0;
    let last = performance.now();

    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const next = Math.min(
        1,
        progressRef.current + (dt * rate) / PLAYBACK_SECONDS,
      );
      progressRef.current = next;
      setProgress(next);
      if (next >= 1) {
        setPlaying(false);
        // Llegada a destino: motores apagados y el cielo queda quieto para que
        // el capitán pueda leer el tablero sin el campo estelar en movimiento.
        setSkyAnimated(false);
        return;
      }
      raf = window.requestAnimationFrame(step);
    };

    raf = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(raf);
  }, [playing, rate]);

  const current = useMemo(
    () => sampleFlightAt(flight.samples, progress * totalTau),
    [flight.samples, progress, totalTau],
  );

  const updatePlan = useCallback(
    (updater: (draft: FlightPlan) => FlightPlan) => {
      setPlan((previous) => updater(previous));
      setActivePreset(null);
      setShareState("idle");
      rewindToArrival();
    },
    [rewindToArrival],
  );

  const updateLeg = useCallback(
    (id: string, patch: Partial<FlightLeg>) => {
      updatePlan((previous) => ({
        ...previous,
        legs: previous.legs.map((leg) =>
          leg.id === id ? { ...leg, ...patch } : leg,
        ),
      }));
    },
    [updatePlan],
  );

  const addLeg = useCallback(() => {
    updatePlan((previous) => {
      const legs = [...previous.legs];
      const lastLeg = legs[legs.length - 1];
      // El tramo que era "lo que falte" pasa a ser explícito para dejarle ese
      // papel al tramo nuevo.
      if (lastLeg && lastLeg.stopMode === "remaining") {
        legs[legs.length - 1] = {
          ...lastLeg,
          stopMode: "fraction",
          stopValue: 50,
        };
      }
      legs.push(makeLeg({ accelG: -DEFAULT_ACCEL_G, stopMode: "remaining" }));
      return { ...previous, legs };
    });
  }, [updatePlan]);

  const removeLeg = useCallback(
    (id: string) => {
      updatePlan((previous) => {
        if (previous.legs.length <= 1) return previous;
        return {
          ...previous,
          legs: previous.legs.filter((leg) => leg.id !== id),
        };
      });
    },
    [updatePlan],
  );

  const moveLeg = useCallback(
    (index: number, delta: number) => {
      updatePlan((previous) => {
        const target = index + delta;
        if (target < 0 || target >= previous.legs.length) return previous;
        const legs = [...previous.legs];
        [legs[index], legs[target]] = [legs[target], legs[index]];
        return { ...previous, legs };
      });
    },
    [updatePlan],
  );

  const applyPreset = useCallback(
    (presetId: string) => {
      const preset = PRESETS.find((item) => item.id === presetId);
      if (!preset) return;
      setPlan((previous) => {
        const next = preset.build();
        return { ...next, targetDistanceLy: previous.targetDistanceLy };
      });
      setActivePreset(presetId);
      setShareState("idle");
      rewindToArrival();
    },
    [rewindToArrival],
  );

  const share = useCallback(async () => {
    const url = `${window.location.origin}${window.location.pathname}?${encodePlan(plan)}`;
    try {
      await navigator.clipboard.writeText(url);
      setShareState("copied");
      window.setTimeout(() => setShareState("idle"), 2400);
    } catch {
      setShareState("error");
    }
  }, [plan]);

  const destinationMatch = DESTINATIONS.find(
    (destination) =>
      Math.abs(destination.distanceLy - plan.targetDistanceLy) < 1e-6,
  );

  const profileMarker = chartAxis === "ship" ? current.tau : current.t;

  return (
    <div className="bridge">
      <Starfield speed={current.v} running={skyAnimated} />
      <div className="bridge-veil" aria-hidden="true" />

      <div className="bridge-inner">
        <header className="bridge-header">
          <p className="eyebrow">Cinemática relativista interactiva</p>
          <h1>Viaje a las estrellas</h1>
          <p className="byline">
            Por{" "}
            <a
              href="https://jorgezuluaga.github.io"
              target="_blank"
              rel="noreferrer"
            >
              Jorge I. Zuluaga
            </a>
          </p>
          <p className="intro">
            Diseña el plan de vuelo de una nave que acelera con aceleración
            propia constante, y descubre por qué el tiempo del capitán y el de
            quienes se quedaron en casa dejan de coincidir.
          </p>
        </header>

        <Canopy
          current={current}
          totalTau={totalTau}
          progress={progress}
          playing={playing}
          rate={rate}
          skyAnimated={skyAnimated}
          onRateChange={setRate}
          onToggleSky={() => setSkyAnimated((value) => !value)}
          onTogglePlay={() => {
            if (!playing) {
              if (progressRef.current >= 1) setProgressValue(0);
              setSkyAnimated(true);
            }
            setPlaying((value) => !value);
          }}
          onScrub={(value) => {
            setPlaying(false);
            setProgressValue(value);
            setSkyAnimated(value < 1);
          }}
        />

        <div className="bridge-grid">
          <section className="console console--plan" aria-label="Plan de vuelo">
            <h2 className="console-title">
              <span>Plan de vuelo</span>
              <small>entrada del capitán</small>
            </h2>

            <div className="panel">
              <h3 className="panel-title">Destino</h3>
              <div className="destination-row">
                <div className="field">
                  <label className="field-label" htmlFor="destination-select">
                    Objetivo
                  </label>
                  <div className="field-input">
                    <select
                      id="destination-select"
                      value={destinationMatch?.name ?? "custom"}
                      onChange={(event) => {
                        const found = DESTINATIONS.find(
                          (destination) => destination.name === event.target.value,
                        );
                        if (!found) return;
                        updatePlan((previous) => ({
                          ...previous,
                          targetDistanceLy: found.distanceLy,
                        }));
                      }}
                    >
                      {!destinationMatch && (
                        <option value="custom">Destino personalizado</option>
                      )}
                      {DESTINATIONS.map((destination) => (
                        <option key={destination.name} value={destination.name}>
                          {destination.name} · {destination.note}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <NumberField
                  label="Distancia"
                  value={plan.targetDistanceLy}
                  onCommit={(value) =>
                    updatePlan((previous) => ({
                      ...previous,
                      targetDistanceLy: value,
                    }))
                  }
                  min={0.0001}
                  max={1e9}
                  step={0.1}
                  suffix="a-l"
                />
              </div>
            </div>

            <div className="panel">
              <h3 className="panel-title">Planes de vuelo típicos</h3>
              <div className="preset-grid">
                {PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className={`preset${activePreset === preset.id ? " preset--active" : ""}`}
                    onClick={() => applyPreset(preset.id)}
                    aria-pressed={activePreset === preset.id}
                  >
                    <strong>{preset.name}</strong>
                    <span>{preset.summary}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="panel">
              <h3 className="panel-title">
                Tramos
                <span className="panel-note">
                  se ejecutan en orden, de arriba abajo
                </span>
              </h3>

              <div className="leg-list">
                {plan.legs.map((leg, index) => (
                  <LegCard
                    key={leg.id}
                    leg={leg}
                    index={index}
                    total={plan.legs.length}
                    result={flight.legs[index] ?? null}
                    onChange={(patch) => updateLeg(leg.id, patch)}
                    onRemove={() => removeLeg(leg.id)}
                    onMove={(delta) => moveLeg(index, delta)}
                  />
                ))}
              </div>

              <div className="plan-actions">
                <button type="button" className="button" onClick={addLeg}>
                  + Añadir tramo
                </button>
                <button
                  type="button"
                  className="button button--ghost"
                  onClick={() => applyPreset(PRESETS[0].id)}
                >
                  Reiniciar
                </button>
                <button
                  type="button"
                  className="button button--ghost"
                  onClick={share}
                >
                  {shareState === "copied"
                    ? "¡Enlace copiado!"
                    : shareState === "error"
                      ? "No se pudo copiar"
                      : "Compartir plan"}
                </button>
              </div>
            </div>
          </section>

          <section
            className="console console--report"
            aria-label="Reporte de vuelo"
          >
            <h2 className="console-title">
              <span>Reporte de vuelo</span>
              <small>salida de la computadora de a bordo</small>
            </h2>

            <FlightSummary flight={flight} />

            {flight.warnings.length > 0 && (
              <ul className="warning-list">
                {flight.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            )}

            <LegTable legs={flight.legs} plan={plan} flightTotals={flight} />

            <div className="panel">
              <div className="chart-toolbar">
                <div className="tab-group" role="tablist" aria-label="Gráficos">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={chartTab === "profile"}
                    className={`tab${chartTab === "profile" ? " tab--active" : ""}`}
                    onClick={() => setChartTab("profile")}
                  >
                    Perfil de vuelo
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={chartTab === "spacetime"}
                    className={`tab${chartTab === "spacetime" ? " tab--active" : ""}`}
                    onClick={() => setChartTab("spacetime")}
                  >
                    Espacio-tiempo
                  </button>
                </div>

                {chartTab === "profile" && (
                  <div className="tab-group tab-group--small">
                    <button
                      type="button"
                      className={`tab${chartAxis === "ship" ? " tab--active" : ""}`}
                      onClick={() => setChartAxis("ship")}
                    >
                      vs. τ nave
                    </button>
                    <button
                      type="button"
                      className={`tab${chartAxis === "earth" ? " tab--active" : ""}`}
                      onClick={() => setChartAxis("earth")}
                    >
                      vs. t Tierra
                    </button>
                  </div>
                )}
              </div>

              <div className="chart-holder">
                {chartTab === "profile" ? (
                  <FlightProfileChart
                    samples={flight.samples}
                    legs={flight.legs}
                    axis={chartAxis}
                    markerX={profileMarker}
                  />
                ) : (
                  <SpacetimeChart
                    samples={flight.samples}
                    legs={flight.legs}
                    markerX={current.t}
                  />
                )}
              </div>

              <p className="chart-caption">
                {chartTab === "profile"
                  ? "Las líneas verticales tenues separan los tramos; la línea punteada marca el instante que muestra el visor."
                  : "La diagonal es la trayectoria de un rayo de luz. La línea de universo de la nave nunca puede cruzarla."}
              </p>
            </div>
          </section>
        </div>

        <TheoryPanel />

        <AcademyFooter />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function Canopy({
  current,
  totalTau,
  progress,
  playing,
  rate,
  skyAnimated,
  onTogglePlay,
  onRateChange,
  onToggleSky,
  onScrub,
}: {
  current: { tau: number; t: number; x: number; v: number; gamma: number };
  totalTau: number;
  progress: number;
  playing: boolean;
  rate: number;
  skyAnimated: boolean;
  onTogglePlay: () => void;
  onRateChange: (rate: number) => void;
  onToggleSky: () => void;
  onScrub: (value: number) => void;
}) {
  // El avance es lineal en tiempo propio, así que este ritmo es constante
  // durante todo el viaje.
  const shipYearsPerSecond = (totalTau * rate) / PLAYBACK_SECONDS;

  return (
    <section className="canopy" aria-label="Visor de la cabina">
      <div className="canopy-glass">
        <div className="canopy-mullions" aria-hidden="true" />
        <div className="canopy-vignette" aria-hidden="true" />

        <button
          type="button"
          className="sky-toggle"
          onClick={onToggleSky}
          aria-pressed={skyAnimated}
        >
          {skyAnimated ? "Congelar cielo" : "Animar cielo"}
        </button>
      </div>

      <p className="sky-caption">
        Al acercarnos a <em>c</em> la <strong>aberración de la luz</strong>{" "}
        concentra las estrellas hacia la proa y el Doppler las corre al azul:
        es el <strong>efecto túnel</strong> (beaming relativista). Si el cielo
        está congelado no hay vuelo a través del campo, solo ese corrimiento
        angular: las estrellas parecen recogerse al centro.
      </p>

      <div className="hud" aria-label="Telemetría en vivo">
        <HudReadout label="Velocidad" value={formatHudSpeed(current.v)} unit="c" />
        <HudReadout
          label="Factor de Lorentz"
          value={formatHudGamma(current.gamma)}
          unit=""
        />
        <HudReadout
          label="Recorrido"
          value={formatHudDistance(current.x)}
          unit="a-l"
        />
        <HudReadout
          label="Reloj de la nave"
          value={formatHudYears(current.tau)}
          unit="a"
        />
        <HudReadout
          label="Reloj en la Tierra"
          value={formatHudYears(current.t)}
          unit="a"
        />
      </div>

      <div className="canopy-controls">
        <div className="transport">
          <button
            type="button"
            className="play-button"
            onClick={onTogglePlay}
            aria-label={playing ? "Pausar el viaje" : "Iniciar el viaje"}
          >
            {playing ? "❚❚" : "▶"}
          </button>

          <div
            className="tab-group tab-group--small rate-group"
            role="group"
            aria-label="Velocidad de la simulación"
          >
            {PLAYBACK_RATES.map((option) => (
              <button
                key={option}
                type="button"
                className={`tab${rate === option ? " tab--active" : ""}`}
                aria-pressed={rate === option}
                onClick={() => onRateChange(option)}
              >
                ×{option}
              </button>
            ))}
          </div>

          <input
            className="scrubber"
            type="range"
            min={0}
            max={1}
            step={0.001}
            value={progress}
            onChange={(event) => onScrub(Number(event.target.value))}
            aria-label="Avance del viaje en tiempo propio de la nave"
          />
          <span className="scrub-readout">
            τ = {formatHudYears(current.tau)} / {formatHudYears(totalTau)} a
          </span>
        </div>

        <p className="playback-note">
          {rate === 1 ? "A ×1" : `A ×${rate}`} transcurren{" "}
          <strong>{shipYearsPerSecond.toFixed(3)} a</strong> en la nave por cada
          segundo en pantalla.
        </p>
      </div>
    </section>
  );
}

function HudReadout({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <div className="hud-item">
      <span className="hud-label">{label}</span>
      <span className="hud-value">
        {value}
        {unit ? <em>{unit}</em> : null}
      </span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function LegCard({
  leg,
  index,
  total,
  result,
  onChange,
  onRemove,
  onMove,
}: {
  leg: FlightLeg;
  index: number;
  total: number;
  result: LegResult | null;
  onChange: (patch: Partial<FlightLeg>) => void;
  onRemove: () => void;
  onMove: (delta: number) => void;
}) {
  const isBurn = leg.kind === "burn";
  const alpha = leg.accelG * G_LIGHT;
  const status = result?.status ?? "ok";
  // leg.id identifica el tramo en el modelo; para el DOM se usa useId porque
  // es estable entre el render del servidor y el del navegador.
  const stopId = useId();

  return (
    <article
      className={`leg leg--${leg.kind}${status === "failed" ? " leg--failed" : ""}`}
    >
      <header className="leg-head">
        <span className="leg-index">Tramo {index + 1}</span>

        <div className="kind-switch" role="group" aria-label="Tipo de tramo">
          <button
            type="button"
            className={`kind-option${isBurn ? " kind-option--active" : ""}`}
            aria-pressed={isBurn}
            onClick={() => onChange({ kind: "burn" })}
          >
            Impulso
          </button>
          <button
            type="button"
            className={`kind-option${!isBurn ? " kind-option--active" : ""}`}
            aria-pressed={!isBurn}
            onClick={() => onChange({ kind: "coast" })}
          >
            Crucero
          </button>
        </div>

        <div className="leg-tools">
          <button
            type="button"
            className="icon-button"
            onClick={() => onMove(-1)}
            disabled={index === 0}
            aria-label={`Subir el tramo ${index + 1}`}
          >
            ↑
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={() => onMove(1)}
            disabled={index === total - 1}
            aria-label={`Bajar el tramo ${index + 1}`}
          >
            ↓
          </button>
          <button
            type="button"
            className="icon-button icon-button--danger"
            onClick={onRemove}
            disabled={total === 1}
            aria-label={`Eliminar el tramo ${index + 1}`}
          >
            ×
          </button>
        </div>
      </header>

      {isBurn ? (
        <div className="leg-body">
          <NumberField
            label="Aceleración propia"
            value={leg.accelG}
            onCommit={(value) => onChange({ accelG: value })}
            min={-10}
            max={10}
            step={0.01}
            suffix="g"
            hint={`${(leg.accelG * G_M_S2).toFixed(2)} m/s² · α = ${alpha.toFixed(4)} a-l/a²`}
          />
          <input
            className="slider"
            type="range"
            min={-2}
            max={2}
            step={0.01}
            value={Math.max(-2, Math.min(2, leg.accelG))}
            onChange={(event) => onChange({ accelG: Number(event.target.value) })}
            aria-label={`Aceleración del tramo ${index + 1}`}
          />
          <div className="chip-row">
            {ACCEL_CHIPS.map((chip) => (
              <button
                key={chip.label}
                type="button"
                className={`chip${Math.abs(leg.accelG - chip.value) < 1e-6 ? " chip--active" : ""}`}
                onClick={() => onChange({ accelG: chip.value })}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="leg-body">
          <label className="checkbox">
            <input
              type="checkbox"
              checked={leg.inheritSpeed}
              onChange={(event) =>
                onChange({ inheritSpeed: event.target.checked })
              }
            />
            <span>Mantener la velocidad ya alcanzada</span>
          </label>

          {!leg.inheritSpeed && (
            <>
              <NumberField
                label="Velocidad de crucero"
                value={leg.speedC}
                onCommit={(value) => onChange({ speedC: value })}
                min={0.000001}
                max={0.999999}
                step={0.01}
                suffix="c"
                hint={`γ = ${(1 / Math.sqrt(1 - leg.speedC ** 2)).toFixed(3)}`}
              />
              <input
                className="slider"
                type="range"
                min={0.01}
                max={0.999}
                step={0.001}
                value={leg.speedC}
                onChange={(event) =>
                  onChange({ speedC: Number(event.target.value) })
                }
                aria-label={`Velocidad de crucero del tramo ${index + 1}`}
              />
            </>
          )}
        </div>
      )}

      <div className="leg-stop">
        <div className="field">
          <label className="field-label" htmlFor={stopId}>
            Hasta cubrir
          </label>
          <div className="field-input">
            <select
              id={stopId}
              value={leg.stopMode}
              onChange={(event) => {
                const mode = event.target.value as StopMode;
                const defaults: Record<StopMode, number> = {
                  remaining: 0,
                  distance: 1,
                  fraction: 50,
                  shipTime: 1,
                  earthTime: 1,
                };
                onChange({ stopMode: mode, stopValue: defaults[mode] });
              }}
            >
              {STOP_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {STOP_MODE_LABELS[mode]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {leg.stopMode !== "remaining" ? (
          <NumberField
            label="Valor"
            value={leg.stopValue}
            onCommit={(value) => onChange({ stopValue: value })}
            min={0.000001}
            max={leg.stopMode === "fraction" ? 100 : 1e9}
            step={leg.stopMode === "fraction" ? 5 : 0.5}
            suffix={STOP_MODE_UNITS[leg.stopMode]}
          />
        ) : (
          <p className="stop-hint">
            El tramo se extiende hasta completar la distancia al destino.
          </p>
        )}
      </div>

      {result?.note ? (
        <p className={`leg-note leg-note--${status}`}>{result.note}</p>
      ) : null}
    </article>
  );
}

/* -------------------------------------------------------------------------- */

function FlightSummary({ flight }: { flight: ReturnType<typeof computeFlight> }) {
  const { totals } = flight;
  const saved = totals.earthYears - totals.shipYears;

  return (
    <div className="summary-grid">
      <SummaryTile
        label="Distancia cubierta"
        value={formatDistance(totals.distanceLy)}
        unit="a-l"
        tone="cyan"
      />
      <SummaryTile
        label="Reloj en la Tierra"
        value={formatYears(totals.earthYears)}
        unit="a"
        tone="amber"
      />
      <SummaryTile
        label="Reloj de la nave"
        value={formatYears(totals.shipYears)}
        unit="a"
        tone="green"
      />
      <SummaryTile
        label="Tiempo que la tripulación no envejece"
        value={formatYears(saved)}
        unit="a"
        tone="magenta"
        hint={`t/τ = ${totals.dilation.toFixed(3)}`}
      />
      <SummaryTile
        label="Velocidad máxima"
        value={formatSpeed(totals.vMax, totals.oneMinusVMax)}
        unit="c"
        tone="cyan"
      />
      <SummaryTile
        label="Factor de Lorentz máximo"
        value={
          totals.gammaMax >= 1000
            ? totals.gammaMax.toExponential(2)
            : totals.gammaMax.toFixed(3)
        }
        unit="γ"
        tone="amber"
      />
    </div>
  );
}

function SummaryTile({
  label,
  value,
  unit,
  tone,
  hint,
}: {
  label: string;
  value: string;
  unit: string;
  tone: string;
  hint?: string;
}) {
  return (
    <div className={`tile tile--${tone}`}>
      <span className="tile-label">{label}</span>
      <span className="tile-value">
        {value}
        <em>{unit}</em>
      </span>
      {hint ? <span className="tile-hint">{hint}</span> : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/** Traduce a días u horas los tramos que duran menos de un año. */
function SubYearHint({ years }: { years: number }) {
  if (Math.abs(years) >= 1) return null;
  return <small>{humanizeYears(years)}</small>;
}

function LegTable({
  legs,
  plan,
  flightTotals,
}: {
  legs: LegResult[];
  plan: FlightPlan;
  flightTotals: ReturnType<typeof computeFlight>;
}) {
  return (
    <div className="panel">
      <h3 className="panel-title">Bitácora por tramo</h3>
      <div className="table-scroll">
        <table className="leg-table">
          <thead>
            <tr>
              <th scope="col">Tramo</th>
              <th scope="col">Motor</th>
              <th scope="col">Distancia</th>
              <th scope="col">Tiempo Tierra</th>
              <th scope="col">Tiempo nave</th>
              <th scope="col">Velocidad</th>
            </tr>
          </thead>
          <tbody>
            {legs.map((leg) => {
              const source = plan.legs[leg.index];
              const engine =
                leg.kind === "burn"
                  ? `${leg.accelG >= 0 ? "+" : "−"}${Math.abs(leg.accelG).toFixed(3)} g`
                  : `crucero a ${formatSpeed(leg.vStart)} c`;

              if (leg.status === "failed") {
                return (
                  <tr key={source?.id ?? leg.index} className="row--failed">
                    <th scope="row">{leg.index + 1}</th>
                    <td data-label="Motor">{engine}</td>
                    <td data-label="Resultado" colSpan={4}>
                      Tramo imposible con estos parámetros.
                    </td>
                  </tr>
                );
              }

              return (
                <tr key={source?.id ?? leg.index}>
                  <th scope="row">{leg.index + 1}</th>
                  <td data-label="Motor">{engine}</td>
                  <td data-label="Distancia">
                    {formatDistance(leg.distanceLy)} <em>a-l</em>
                  </td>
                  <td data-label="Tiempo Tierra">
                    {formatYears(leg.earthYears)} <em>a</em>
                    <SubYearHint years={leg.earthYears} />
                  </td>
                  <td data-label="Tiempo nave">
                    {formatYears(leg.shipYears)} <em>a</em>
                    <SubYearHint years={leg.shipYears} />
                  </td>
                  <td data-label="Velocidad">
                    {formatSpeed(leg.vMin)} → {formatSpeed(leg.vMax, leg.oneMinusVEnd)} <em>c</em>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" colSpan={2}>
                Totales
              </th>
              <td data-label="Distancia">
                {formatDistance(flightTotals.totals.distanceLy)} <em>a-l</em>
              </td>
              <td data-label="Tiempo Tierra">
                {formatYears(flightTotals.totals.earthYears)} <em>a</em>
              </td>
              <td data-label="Tiempo nave">
                {formatYears(flightTotals.totals.shipYears)} <em>a</em>
              </td>
              <td data-label="Velocidad">
                máx {formatSpeed(flightTotals.totals.vMax, flightTotals.totals.oneMinusVMax)} <em>c</em>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function TheoryPanel() {
  return (
    <section className="console console--theory" aria-label="Origen de los números">
      <h2 className="console-title">
        <span>¿De dónde salen estos números?</span>
        <small>cinemática en unidades luz</small>
      </h2>
      <div className="theory-body">
        <div className="theory-text">
          <p>
            Todo se calcula en <strong>unidades luz</strong>: distancias en
            años-luz (a-l), tiempos en años (a) y velocidades en fracciones de{" "}
            <em>c</em>, de modo que <em>c</em> = 1. En esas unidades 1 g
            equivale a α = {G_LIGHT.toFixed(4)} a-l/a².
          </p>
          <p>
            Con la rapidez θ = artanh(v<sub>L</sub>) las tres ecuaciones se
            vuelven una sola: θ crece linealmente con el tiempo propio, θ(τ) = θ
            <sub>0</sub> + ατ, y la nave se limita a deslizarse por una
            hipérbola del espacio-tiempo. La app integra en θ para no perder
            precisión cuando v es indistinguible de 1.
          </p>
          <p>
            Un tramo de crucero es el caso α = 0: el tiempo coordenado y el
            propio se relacionan simplemente por Δt = γ Δτ.
          </p>
          <p>
            El visor no es solo decoración: aplica la{" "}
            <strong>aberración relativista</strong>{" "}
            cos θ′ = (cos θ + v)/(1 + v cos θ) y el factor Doppler D = 1 /
            [γ(1 − v cos θ′)]. Al aproximarnos a <em>c</em> casi todo el cielo
            se aplasta hacia la proa y se ilumina (beaming): el clásico efecto
            túnel. Con el cielo congelado las estrellas no recorren el campo;
            solo se ve cómo la aberración las arrastra al centro al subir v.
          </p>
          <p className="theory-source">
            Basado en la Clase 5 (Cinemática en el espacio-tiempo) del curso de
            Relatividad y Gravitación de la Universidad de Antioquia.
          </p>
        </div>

        <div className="theory-math">
          <p>
            Para un tramo con aceleración propia constante α y condiciones
            iniciales arbitrarias, la solución general del movimiento es:
          </p>
          <div className="formula">
            <span>
              x<sub>L</sub>(τ) = x<sub>L0</sub> + (γ<sub>0</sub>v<sub>L0</sub>
              /α) sinh(ατ) + (γ<sub>0</sub>/α)[cosh(ατ) − 1]
            </span>
            <span>
              t(τ) = t<sub>0</sub> + (γ<sub>0</sub>/α) sinh(ατ) + (γ
              <sub>0</sub>v<sub>L0</sub>/α)[cosh(ατ) − 1]
            </span>
            <span>
              v<sub>L</sub>(τ) = [v<sub>L0</sub> + tanh(ατ)] / [1 + v
              <sub>L0</sub> tanh(ατ)]
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
