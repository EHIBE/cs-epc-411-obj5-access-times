const grouped = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

/** Rounds to a few significant digits, drops trailing zeros, and groups thousands. */
export function formatSig(value: number, digits = 3): string {
  if (value === 0 || !Number.isFinite(value)) return '0'
  const magnitude = Math.floor(Math.log10(Math.abs(value)))
  const decimals = Math.max(0, digits - 1 - magnitude)
  const rounded = Number(value.toFixed(Math.min(decimals, 6)))
  if (Math.abs(rounded) >= 1000) return grouped.format(Math.round(rounded))
  return String(rounded)
}

interface UnitStep {
  below: number
  unit: string
  scale: number
}

const TECHNICAL_UNITS: readonly UnitStep[] = [
  { below: 1e-9, unit: 'ps', scale: 1e12 },
  { below: 1e-6, unit: 'ns', scale: 1e9 },
  { below: 1e-3, unit: 'µs', scale: 1e6 },
  { below: 1, unit: 'ms', scale: 1e3 },
  { below: Number.POSITIVE_INFINITY, unit: 's', scale: 1 },
]

/** Formats real seconds in the unit an engineer would say aloud: ps, ns, µs, ms or s. */
export function formatSeconds(seconds: number, digits = 3): string {
  const step = TECHNICAL_UNITS.find((entry) => seconds < entry.below * 0.9995) ?? TECHNICAL_UNITS[TECHNICAL_UNITS.length - 1]
  const scale = step?.scale ?? 1
  return `${formatSig(seconds * scale, digits)} ${step?.unit ?? 's'}`
}

const plural = (value: string, unit: string): string => `${value} ${unit}${value === '1' ? '' : 's'}`

const MINUTE = 60
const HOUR = 3600
const DAY = 86_400
const MONTH = 30 * DAY
const YEAR = 31_536_000

/** Formats human-scale seconds (1 real ns read as 1 s) in the largest unit that keeps the number readable. */
export function formatHuman(seconds: number, digits = 2): string {
  if (seconds < MINUTE) return plural(formatSig(seconds, digits), 'second')
  if (seconds < HOUR) return plural(formatSig(seconds / MINUTE, digits), 'minute')
  if (seconds < DAY) return plural(formatSig(seconds / HOUR, digits), 'hour')
  if (seconds < MONTH) return plural(formatSig(seconds / DAY, digits), 'day')
  if (seconds < YEAR) return plural(formatSig(seconds / MONTH, digits), 'month')
  return plural(formatSig(seconds / YEAR, Math.max(digits, 3)), 'year')
}

/** The human-scale landmarks drawn on the depth column when the analogy is switched on. */
export const HUMAN_LANDMARKS: readonly { label: string; humanSeconds: number }[] = [
  { label: '0.01 second', humanSeconds: 0.01 },
  { label: '0.1 second', humanSeconds: 0.1 },
  { label: '1 second', humanSeconds: 1 },
  { label: '1 minute', humanSeconds: MINUTE },
  { label: '1 hour', humanSeconds: HOUR },
  { label: '1 day', humanSeconds: DAY },
  { label: '1 week', humanSeconds: 7 * DAY },
  { label: '1 month', humanSeconds: MONTH },
  { label: '1 year', humanSeconds: YEAR },
  { label: '10 years', humanSeconds: 10 * YEAR },
  { label: '100 years', humanSeconds: 100 * YEAR },
  { label: '1,000 years', humanSeconds: 1000 * YEAR },
  { label: '10,000 years', humanSeconds: 10_000 * YEAR },
]

/** Converts a real-time log10(seconds) into human-scale seconds under the fact sheet's 1 ns = 1 s rule. */
export const humanSecondsForLog = (log10Seconds: number): number => 10 ** (log10Seconds + 9)

/** Inverse of the rule above: where a human-scale duration sits on the real-time axis. */
export const logForHumanSeconds = (humanSeconds: number): number => Math.log10(humanSeconds) - 9

export const decadeLabel = (exponent: number): string => formatSeconds(10 ** exponent)

export function formatClock(milliseconds: number): string {
  const total = Math.max(0, Math.floor(milliseconds / 1000))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export const formatMinutes = (minutes: number): string => (minutes === 1 ? '1 min' : `${minutes} min`)

export const padRank = (rank: number): string => String(rank).padStart(2, '0')
