export type RingParameters = {
  planetRadius: number;
  innerRingRadius: number;
  outerRingRadius: number;
  tilt: number;
  inclination: number;
  impact: number;
  alpha: number;
};

export type TransitModel = {
  depth: number;
  contacts: [number, number, number, number];
  planetContacts: [number, number, number, number];
  durations: { total: number; full: number; ingress: number };
  aOverR: number;
  observedDensityRatio: number;
  prAnomaly: number;
  ringDepth: number;
  verticalScaleDepth: number;
  lightCurve: { time: number; flux: number; x: number }[];
  timeAtX: (x: number) => number;
};

const PERIOD_DAYS = 365.25;
const TRUE_DENSITY_KG_M3 = 1408;
const G = 6.6743e-11;
const DAY_SECONDS = 86400;
const DEG = Math.PI / 180;
const JUPITER_TO_SUN_RADIUS = 0.10045;
const SATURN_LIKE_RING_AREA_FACTOR = 1 + 2.5 ** 2 - 1.5 ** 2;
const FIXED_VERTICAL_SCALE_DEPTH =
  JUPITER_TO_SUN_RADIUS ** 2 * SATURN_LIKE_RING_AREA_FACTOR;

const STAR_SAMPLES = (() => {
  const points: { x: number; y: number }[] = [];
  const n = 150;

  for (let row = 0; row < n; row += 1) {
    const y = -1 + (2 * (row + 0.5)) / n;
    for (let col = 0; col < n; col += 1) {
      const x = -1 + (2 * (col + 0.5)) / n;
      const r2 = x * x + y * y;
      if (r2 > 1) continue;
      points.push({ x, y });
    }
  }
  return points;
})();

function ringBlockingFactor(alpha: number, cosInclination: number) {
  if (cosInclination <= 1e-6 || alpha >= 1) return 0;
  if (alpha <= 0) return 1;
  return 1 - alpha ** (1 / cosInclination);
}

function ellipseSupport(
  nx: number,
  ny: number,
  semimajor: number,
  semiminor: number,
  angle: number,
) {
  const alongMajor = nx * Math.cos(angle) + ny * Math.sin(angle);
  const alongMinor = -nx * Math.sin(angle) + ny * Math.cos(angle);
  return Math.sqrt(
    (semimajor * alongMajor) ** 2 + (semiminor * alongMinor) ** 2,
  );
}

function occultorArea(parameters: RingParameters) {
  const p = parameters.planetRadius;
  const outer = p * parameters.outerRingRadius;
  const inner = p * parameters.innerRingRadius;
  const cosI = Math.max(0, Math.cos(parameters.inclination * DEG));
  const blocking = ringBlockingFactor(parameters.alpha, cosI);
  const n = 180;
  const bound = outer;
  const cell = (2 * bound) / n;
  let covered = 0;
  let ringCovered = 0;

  for (let row = 0; row < n; row += 1) {
    const y = -bound + (row + 0.5) * cell;
    for (let col = 0; col < n; col += 1) {
      const x = -bound + (col + 0.5) * cell;
      const planet = x * x + y * y <= p * p;
      let ring = false;
      if (cosI > 1e-5) {
        const outerEllipse = (x / outer) ** 2 + (y / (outer * cosI)) ** 2 <= 1;
        const innerEllipse = (x / inner) ** 2 + (y / (inner * cosI)) ** 2 < 1;
        ring = outerEllipse && !innerEllipse;
      }
      if (planet) {
        covered += 1;
      } else if (ring) {
        covered += blocking;
        ringCovered += blocking;
      }
    }
  }
  return {
    total: covered * cell * cell,
    ring: ringCovered * cell * cell,
  };
}

function blockedFlux(
  centerX: number,
  parameters: RingParameters,
  cosTilt: number,
  sinTilt: number,
  cosInclination: number,
) {
  const p = parameters.planetRadius;
  const outer = p * parameters.outerRingRadius;
  const inner = p * parameters.innerRingRadius;
  const blocking = ringBlockingFactor(parameters.alpha, cosInclination);
  let blocked = 0;

  for (const point of STAR_SAMPLES) {
    const dx = point.x - centerX;
    const dy = point.y - parameters.impact;
    const planet = dx * dx + dy * dy <= p * p;
    let ring = false;

    if (cosInclination > 1e-5) {
      const u = dx * cosTilt + dy * sinTilt;
      const v = -dx * sinTilt + dy * cosTilt;
      const outerEllipse =
        (u / outer) ** 2 + (v / (outer * cosInclination)) ** 2 <= 1;
      const innerEllipse =
        (u / inner) ** 2 + (v / (inner * cosInclination)) ** 2 < 1;
      ring = outerEllipse && !innerEllipse;
    }

    if (planet) {
      blocked += 1;
    } else if (ring) {
      blocked += blocking;
    }
  }
  return blocked / STAR_SAMPLES.length;
}

export function computeTransit(parameters: RingParameters): TransitModel {
  const p = parameters.planetRadius;
  const b = parameters.impact;
  const theta = parameters.tilt * DEG;
  const cosI = Math.max(0, Math.cos(parameters.inclination * DEG));
  const blocking = ringBlockingFactor(parameters.alpha, cosI);
  const outer = parameters.outerRingRadius * p;
  const aOverR =
    ((G * TRUE_DENSITY_KG_M3 * (PERIOD_DAYS * DAY_SECONDS) ** 2) /
      (3 * Math.PI)) **
    (1 / 3);
  const orbitalInclination = Math.acos(Math.min(1, b / aOverR));
  const limbX = Math.sqrt(Math.max(0, 1 - b * b));

  const hLeft = ellipseSupport(
    -limbX,
    b,
    outer,
    outer * cosI,
    theta,
  );
  const hRight = ellipseSupport(
    limbX,
    b,
    outer,
    outer * cosI,
    theta,
  );
  const ringVisible =
    cosI * blocking * (parameters.outerRingRadius ** 2 - parameters.innerRingRadius ** 2) >
    1e-5;

  const ringContacts: [number, number, number, number] = [
    -Math.sqrt(Math.max(0, (1 + hLeft) ** 2 - b * b)),
    -Math.sqrt(Math.max(0, (1 - hLeft) ** 2 - b * b)),
    Math.sqrt(Math.max(0, (1 - hRight) ** 2 - b * b)),
    Math.sqrt(Math.max(0, (1 + hRight) ** 2 - b * b)),
  ];
  const planetContacts: [number, number, number, number] = [
    -Math.sqrt(Math.max(0, (1 + p) ** 2 - b * b)),
    -Math.sqrt(Math.max(0, (1 - p) ** 2 - b * b)),
    Math.sqrt(Math.max(0, (1 - p) ** 2 - b * b)),
    Math.sqrt(Math.max(0, (1 + p) ** 2 - b * b)),
  ];
  const contacts: [number, number, number, number] = ringVisible
    ? [
        Math.min(ringContacts[0], planetContacts[0]),
        Math.max(ringContacts[1], planetContacts[1]),
        Math.min(ringContacts[2], planetContacts[2]),
        Math.max(ringContacts[3], planetContacts[3]),
      ]
    : planetContacts;

  const orbitalSpeedRPerHour =
    (2 * Math.PI * aOverR * Math.sin(orbitalInclination)) /
    (PERIOD_DAYS * 24);
  const timeAtX = (x: number) => x / orbitalSpeedRPerHour;
  const durationFromSpan = (span: number) => {
    const argument = Math.min(
      1,
      Math.max(0, span / (aOverR * Math.sin(orbitalInclination))),
    );
    return (PERIOD_DAYS * 24 * Math.asin(argument)) / (2 * Math.PI);
  };
  const totalDuration = durationFromSpan(contacts[3] - contacts[0]);
  const fullDuration = durationFromSpan(Math.max(0, contacts[2] - contacts[1]));
  const ingressDuration = Math.max(
    0,
    timeAtX(contacts[1]) - timeAtX(contacts[0]),
  );

  const areas = occultorArea(parameters);
  const depth = areas.total / Math.PI;
  const ringDepth = areas.ring / Math.PI;
  const verticalScaleDepth = FIXED_VERTICAL_SCALE_DEPTH;
  const s14 = Math.sin((Math.PI * totalDuration) / (PERIOD_DAYS * 24));
  const s23 = Math.sin((Math.PI * fullDuration) / (PERIOD_DAYS * 24));
  const ratio = s14 > 0 ? (s23 * s23) / (s14 * s14) : 0;
  const fPlus = 1 + Math.sqrt(depth);
  const fMinus = 1 - Math.sqrt(depth);
  const denominator = Math.max(1e-9, 1 - ratio);
  const observedB2 = Math.min(
    0.999,
    Math.max(0, (fMinus * fMinus - ratio * fPlus * fPlus) / denominator),
  );
  const observedA2 = Math.max(
    1,
    (fPlus * fPlus - observedB2 * (1 - s14 * s14)) /
      Math.max(1e-12, s14 * s14),
  );
  const observedDensityRatio = Math.max(
    1e-6,
    (Math.sqrt(observedA2) / aOverR) ** 3,
  );
  const prAnomaly = 10 * Math.log10(observedDensityRatio);

  const cosTilt = Math.cos(theta);
  const sinTilt = Math.sin(theta);
  const extent = Math.max(Math.abs(contacts[0]), Math.abs(contacts[3])) + 0.16;
  const lightCurve = Array.from({ length: 181 }, (_, index) => {
    const x = -extent + (2 * extent * index) / 180;
    const inFullTransit = x >= contacts[1] && x <= contacts[2];
    return {
      x,
      time: timeAtX(x),
      flux:
        1 -
        (inFullTransit
          ? depth
          : blockedFlux(x, parameters, cosTilt, sinTilt, cosI)),
    };
  });

  return {
    depth,
    contacts,
    planetContacts,
    durations: {
      total: totalDuration,
      full: fullDuration,
      ingress: ingressDuration,
    },
    aOverR,
    observedDensityRatio,
    prAnomaly,
    ringDepth,
    verticalScaleDepth,
    lightCurve,
    timeAtX,
  };
}
