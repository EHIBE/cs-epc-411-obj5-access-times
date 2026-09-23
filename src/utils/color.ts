import { clamp, lerp, smoothstep } from './math'

type Vec3 = [number, number, number]

interface OklchStop {
  t: number
  l: number
  c: number
  h: number
}

/** The pinned speed ramp in OKLCH: fresh saturated blue-cyan at the surface, compacted desaturated rust at bedrock. */
const SPEED_STOPS: readonly OklchStop[] = [
  { t: 0.0, l: 0.6, c: 0.15, h: 245 },
  { t: 0.14, l: 0.66, c: 0.14, h: 222 },
  { t: 0.23, l: 0.7, c: 0.13, h: 200 },
  { t: 0.32, l: 0.73, c: 0.12, h: 175 },
  { t: 0.46, l: 0.76, c: 0.15, h: 145 },
  { t: 0.57, l: 0.82, c: 0.16, h: 118 },
  { t: 0.64, l: 0.8, c: 0.15, h: 88 },
  { t: 0.71, l: 0.74, c: 0.145, h: 66 },
  { t: 0.82, l: 0.68, c: 0.13, h: 55 },
  { t: 0.93, l: 0.62, c: 0.11, h: 48 },
  { t: 1.0, l: 0.52, c: 0.085, h: 28 },
]

const oklabToLinear = ([l, a, b]: Vec3): Vec3 => {
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b
  const s_ = l - 0.0894841775 * a - 1.291485548 * b
  const L = l_ ** 3
  const M = m_ ** 3
  const S = s_ ** 3
  return [
    4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S,
    -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S,
    -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S,
  ]
}

const linearToOklab = ([r, g, b]: Vec3): Vec3 => {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}

const toGamma = (x: number): number => (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055)
const toLinear = (x: number): number => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4)

const inGamut = (rgb: Vec3): boolean => rgb.every((channel) => channel >= -1e-4 && channel <= 1 + 1e-4)

/** Converts OKLCH to linear sRGB, pulling chroma in until the color fits the sRGB gamut. */
function oklchToLinear(l: number, c: number, h: number): Vec3 {
  const hr = (h * Math.PI) / 180
  const lab = (chroma: number): Vec3 => [l, chroma * Math.cos(hr), chroma * Math.sin(hr)]
  const requested = oklabToLinear(lab(c))
  if (inGamut(requested)) return requested
  let best = oklabToLinear(lab(0))
  let low = 0
  let high = c
  for (let i = 0; i < 18; i += 1) {
    const mid = (low + high) / 2
    const candidate = oklabToLinear(lab(mid))
    if (inGamut(candidate)) {
      low = mid
      best = candidate
    } else {
      high = mid
    }
  }
  return best
}

const channelHex = (value: number): string =>
  Math.round(clamp(value, 0, 1) * 255)
    .toString(16)
    .padStart(2, '0')

const linearToHex = (rgb: Vec3): string => `#${rgb.map((channel) => channelHex(toGamma(channel))).join('')}`

export function hexToLinear(hex: string): Vec3 {
  const clean = hex.replace('#', '').trim()
  const full = clean.length === 3 ? clean.replace(/(.)/g, '$1$1') : clean
  const value = Number.parseInt(full.slice(0, 6), 16)
  if (Number.isNaN(value)) return [0, 0, 0]
  return [toLinear(((value >> 16) & 255) / 255), toLinear(((value >> 8) & 255) / 255), toLinear((value & 255) / 255)]
}

export const oklch = (l: number, c: number, h: number): string => linearToHex(oklchToLinear(l, c, h))

const hueLerp = (from: number, to: number, t: number): number => {
  let delta = to - from
  if (delta > 180) delta -= 360
  if (delta < -180) delta += 360
  return (from + delta * t + 360) % 360
}

/** Samples the speed ramp: t = 0 is the fastest device, t = 1 the slowest. */
export function speedColor(t: number): string {
  const x = clamp(t, 0, 1)
  const upper = SPEED_STOPS.findIndex((stop) => stop.t >= x)
  if (upper <= 0) {
    const first = SPEED_STOPS[0] as OklchStop
    return oklch(first.l, first.c, first.h)
  }
  const a = SPEED_STOPS[upper - 1] as OklchStop
  const b = SPEED_STOPS[upper] as OklchStop
  const local = smoothstep((x - a.t) / (b.t - a.t))
  return oklch(lerp(a.l, b.l, local), lerp(a.c, b.c, local), hueLerp(a.h, b.h, local))
}

/** Mixes two hex colors in OKLab, which keeps dimmed plates from turning muddy. */
export function mixHex(from: string, to: string, t: number): string {
  const a = linearToOklab(hexToLinear(from))
  const b = linearToOklab(hexToLinear(to))
  const mixed: Vec3 = [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]
  return linearToHex(oklabToLinear(mixed))
}

/** Raises perceptual lightness a fraction of the way to white (the brief's +30% hover brighten). */
export function brighten(hex: string, amount: number): string {
  const [l, a, b] = linearToOklab(hexToLinear(hex))
  return linearToHex(oklabToLinear([l + (1 - l) * amount, a, b]))
}

/** Reads a theme token that CSS defines, so WebGL and the DOM share one palette. */
export function readToken(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value.length > 0 ? value : fallback
}
