export const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value))

export const lerp = (from: number, to: number, t: number): number => from + (to - from) * t

export const invLerp = (from: number, to: number, value: number): number =>
  from === to ? 0 : (value - from) / (to - from)

export const smoothstep = (t: number): number => {
  const x = clamp(t, 0, 1)
  return x * x * (3 - 2 * x)
}

/** Frame-rate independent exponential approach toward a target. */
export const damp = (current: number, target: number, lambda: number, dt: number): number =>
  lerp(current, target, 1 - Math.exp(-lambda * dt))

export const easeInOutCubic = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)

export const easeOutCubic = (t: number): number => 1 - (1 - clamp(t, 0, 1)) ** 3

export const easeOutExpo = (t: number): number => (t >= 1 ? 1 : 1 - 2 ** (-10 * t))

/** Shortest signed angular distance, used when interpolating camera azimuth. */
export const angleDelta = (from: number, to: number): number => {
  const twoPi = Math.PI * 2
  const delta = (((to - from) % twoPi) + twoPi * 1.5) % twoPi - Math.PI
  return delta
}

/** Deterministic pseudo-random sequence so particle layouts are identical on every load. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Damped harmonic spring that gives every animated value mass and settle instead of instant jumps. */
export class Spring {
  value: number
  target: number
  velocity = 0
  stiffness: number
  damping: number

  constructor(value: number, stiffness = 170, damping = 22) {
    this.value = value
    this.target = value
    this.stiffness = stiffness
    this.damping = damping
  }

  step(dt: number): number {
    let remaining = Math.min(dt, 0.1)
    while (remaining > 0) {
      const h = Math.min(remaining, 1 / 120)
      const force = (this.target - this.value) * this.stiffness - this.velocity * this.damping
      this.velocity += force * h
      this.value += this.velocity * h
      remaining -= h
    }
    return this.value
  }

  snap(value: number): void {
    this.value = value
    this.target = value
    this.velocity = 0
  }

  get settled(): boolean {
    return Math.abs(this.target - this.value) < 1e-4 && Math.abs(this.velocity) < 1e-4
  }
}

/** Coalesces bursts of events into at most one call per animation frame (the 16 ms handler budget). */
export function rafThrottle<Args extends unknown[]>(handler: (...args: Args) => void): (...args: Args) => void {
  let frame = 0
  let latest: Args | null = null
  return (...args: Args) => {
    latest = args
    if (frame !== 0) return
    frame = requestAnimationFrame(() => {
      frame = 0
      if (latest) handler(...latest)
    })
  }
}
