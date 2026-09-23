import type { Device, TimeUnit } from '../data/types'
import { clamp, invLerp } from './math'

export const UNIT_SECONDS: Record<TimeUnit, number> = { ps: 1e-12, ns: 1e-9, us: 1e-6, ms: 1e-3, s: 1 }

/** The depth axis: every decade of time is the same physical height, fastest at the surface. */
export const AXIS = {
  logTop: -11,
  logBottom: 3,
  yTop: 34,
  unitsPerDecade: 3.4,
  floorY: -16.5,
} as const

export const toSeconds = (value: number, unit: TimeUnit): number => value * UNIT_SECONDS[unit]

export const yForLog = (log10Seconds: number): number =>
  AXIS.yTop - (log10Seconds - AXIS.logTop) * AXIS.unitsPerDecade

export const logForY = (y: number): number => AXIS.logTop + (AXIS.yTop - y) / AXIS.unitsPerDecade

export const axisBottomY = (): number => yForLog(AXIS.logBottom)

/** Where a device sits: its Section E representative value, or the middle of its stated order-of-magnitude band. */
export function placementLog(device: Device): number {
  if (device.accessTime !== null) return Math.log10(toSeconds(device.accessTime, device.unit))
  if (device.band) return (device.band.from + device.band.to) / 2
  return AXIS.logBottom
}

export const hasSingleFigure = (device: Device): boolean => device.accessTime !== null

export interface SpeedDomain {
  fastest: number
  slowest: number
}

export function speedDomain(devices: Device[]): SpeedDomain {
  const logs = devices.map(placementLog)
  return { fastest: Math.min(...logs), slowest: Math.max(...logs) }
}

/** 0 for the fastest device, 1 for the slowest, measured in decades so the color ramp is perceptually even. */
export const speedT = (log10Seconds: number, domain: SpeedDomain): number =>
  clamp(invLerp(domain.fastest, domain.slowest, log10Seconds), 0, 1)

export const PLATE = {
  thickness: 0.5,
  radius: 0.12,
  widthBase: 2.4,
  widthPerDecade: 1.45,
  componentWidth: 4,
  unlimitedWidth: 20,
  unlimitedFade: 4.2,
  depthBase: 2.6,
  depthPerRank: 0.9,
  unratedDepth: 5,
} as const

export const capacityMidpoint = (device: Device): number | null => {
  const bytes = device.capacity.log10Bytes
  return bytes ? (bytes[0] + bytes[1]) / 2 : null
}

/** Width grows with the log of typical capacity; unlimited and component rows get their own honest treatments. */
export function plateWidth(device: Device): number {
  if (device.capacity.unlimited) return PLATE.unlimitedWidth
  const mid = capacityMidpoint(device)
  if (mid === null) return PLATE.componentWidth
  return PLATE.widthBase + (mid - 2.5) * PLATE.widthPerDecade
}

/** Depth follows the fact sheet's own cost wording ranked 1 (extremely low) to 9 (extremely high). */
export function plateDepth(device: Device): number {
  if (device.cost.rank === null) return PLATE.unratedDepth
  return PLATE.depthBase + device.cost.rank * PLATE.depthPerRank
}

export const isUnrated = (device: Device): boolean =>
  device.cost.rank === null || (device.capacity.log10Bytes === null && !device.capacity.unlimited)

/** The log span a device's whisker draws: an explicit numeric range, or its order-of-magnitude band. */
export function whiskerSpan(device: Device): { from: number; to: number; label: string } | null {
  if (device.range) {
    return {
      from: Math.log10(toSeconds(device.range.min, device.range.unit)),
      to: Math.log10(toSeconds(device.range.max, device.range.unit)),
      label: device.range.label,
    }
  }
  if (device.band) return { from: device.band.from, to: device.band.to, label: device.band.label }
  return null
}
