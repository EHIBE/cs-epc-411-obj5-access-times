import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineDashedMaterial,
  LineSegments,
  type Color,
  type Mesh,
  type Vector3,
} from 'three'
import type { Device } from '../data/types'
import { speedColor } from '../utils/color'
import {
  isUnrated,
  PLATE,
  placementLog,
  plateDepth,
  plateWidth,
  speedT,
  whiskerSpan,
  yForLog,
  type SpeedDomain,
} from '../utils/scale'
import { COLUMN_HALF, COLUMN_X } from './DepthColumn'
import { DeviceStratum, TILT } from './DeviceStratum'

const HOVER_LIFT = 1
const HOVER_SCALE = 1.1
const CLEARANCE = 0.32

/** Glow strength for the fastest tiers only: the brief's subtle emissive halo for CPU-side storage. */
const glowFor = (device: Device): number => {
  if (device.tier === 'cpu') return 0.3
  if (device.tier === 'memory') return 0.1
  return 0
}

/** The whole hierarchy as floating strata at their true log depths, plus range whiskers, hover fan-out, focus, and power state. */
export class StrataStack {
  readonly group = new Group()
  readonly strata: DeviceStratum[]
  private readonly byId = new Map<string, DeviceStratum>()
  private readonly whiskers: LineSegments<BufferGeometry, LineBasicMaterial>
  private readonly bandWhiskers: LineSegments<BufferGeometry, LineDashedMaterial>
  private readonly levels: LineSegments<BufferGeometry, LineDashedMaterial>
  private hoveredId: string | null = null
  private selectedId: string | null = null
  private flickerUntil = 0
  private powerOn = true
  private clock = 0
  private rippleAt: number[] = []

  constructor(devices: Device[], domain: SpeedDomain) {
    this.strata = devices.map((device) => {
      const log = placementLog(device)
      const stratum = new DeviceStratum({
        device,
        color: speedColor(speedT(log, domain)),
        baseY: yForLog(log),
        width: plateWidth(device),
        depth: plateDepth(device),
        unrated: isUnrated(device),
        ghost: device.accessTime === null,
        glow: glowFor(device),
      })
      this.byId.set(device.id, stratum)
      this.group.add(stratum.group)
      return stratum
    })
    this.strata.sort((a, b) => b.baseY - a.baseY)

    const solid: number[] = []
    const dashed: number[] = []
    for (const stratum of this.strata) {
      const span = whiskerSpan(stratum.device)
      if (!span) continue
      const target = stratum.device.range ? solid : dashed
      const x = -stratum.width / 2 - 0.85
      const z = stratum.depth / 2 - 0.35
      const top = yForLog(span.from)
      const bottom = yForLog(span.to)
      target.push(x, top, z, x, bottom, z)
      target.push(x - 0.22, top, z, x + 0.22, top, z)
      target.push(x - 0.22, bottom, z, x + 0.22, bottom, z)
      solid.push(x, stratum.baseY, z, -stratum.width / 2, stratum.baseY, z)
      if (stratum.baseY > top || stratum.baseY < bottom) {
        const nearest = stratum.baseY > top ? top : bottom
        dashed.push(x, stratum.baseY, z, x, nearest, z)
      }
    }
    const solidGeometry = new BufferGeometry()
    solidGeometry.setAttribute('position', new Float32BufferAttribute(solid, 3))
    this.whiskers = new LineSegments(solidGeometry, new LineBasicMaterial({ color: 0x26303a, transparent: true, opacity: 0.75 }))
    const dashedGeometry = new BufferGeometry()
    dashedGeometry.setAttribute('position', new Float32BufferAttribute(dashed, 3))
    this.bandWhiskers = new LineSegments(
      dashedGeometry,
      new LineDashedMaterial({ color: 0x26303a, dashSize: 0.3, gapSize: 0.2, transparent: true, opacity: 0.75 }),
    )
    this.bandWhiskers.computeLineDistances()
    const level: number[] = []
    for (const stratum of this.strata) {
      level.push(COLUMN_X + COLUMN_HALF + 0.1, stratum.baseY, 0, -stratum.width / 2 - 0.85, stratum.baseY, 0)
    }
    const levelGeometry = new BufferGeometry()
    levelGeometry.setAttribute('position', new Float32BufferAttribute(level, 3))
    this.levels = new LineSegments(
      levelGeometry,
      new LineDashedMaterial({ color: 0x26303a, dashSize: 0.12, gapSize: 0.22, transparent: true, opacity: 0.28 }),
    )
    this.levels.computeLineDistances()
    this.group.add(this.whiskers, this.bandWhiskers, this.levels)
  }

  get(id: string): DeviceStratum | undefined {
    return this.byId.get(id)
  }

  meshes(): Mesh[] {
    return this.strata.map((stratum) => stratum.body)
  }

  /** On narrow screens a plate's callout starts at its solid edge, so a plate that fades out past the callout column never sends its leader back across the labels. */
  compactAnchors = false

  anchor(id: string, target: Vector3): Vector3 | null {
    const stratum = this.byId.get(id)
    return stratum ? stratum.anchor(target, this.compactAnchors) : null
  }

  applyPalette(ground: Color, line: Color, edgeOpacity: number, hatchOpacity: number): void {
    for (const stratum of this.strata) stratum.setPalette(ground, line, edgeOpacity, hatchOpacity)
    this.whiskers.material.color.copy(line)
    this.bandWhiskers.material.color.copy(line)
    this.levels.material.color.copy(line)
  }

  setHovered(id: string | null): void {
    this.hoveredId = id
    for (const stratum of this.strata) stratum.setHovered(stratum.device.id === id)
    this.relayout()
  }

  setSelected(id: string | null): void {
    this.selectedId = id
    for (const stratum of this.strata) stratum.setSelected(stratum.device.id === id)
    this.relayout()
  }

  /** Emphasises the given devices and lets the rest recede toward the ground colour; null restores everything. */
  setFocus(ids: readonly string[] | null): void {
    const focus = ids ? new Set(ids) : null
    for (const stratum of this.strata) stratum.emphasis.target = !focus || focus.has(stratum.device.id) ? 1 : 0
  }

  /** Draws every plate outside the given set as a hairline outline only, so a detail view reads against a line drawing of the section. */
  setPresence(ids: readonly string[] | null): void {
    const keep = ids ? new Set(ids) : null
    for (const stratum of this.strata) stratum.presence.target = !keep || keep.has(stratum.device.id) ? 1 : 0
  }

  setPower(on: boolean): void {
    if (on === this.powerOn) return
    this.powerOn = on
    if (!on) this.flickerUntil = this.clock + 0.55
    for (const stratum of this.strata) {
      if (stratum.device.volatile) stratum.energy.target = on ? 1 : 0
    }
  }

  isLost(id: string): boolean {
    const stratum = this.byId.get(id)
    return Boolean(stratum && stratum.device.volatile && !this.powerOn)
  }

  /** Passes the current on-screen scale to every plate so cut-face hatching only draws where its pitch can be resolved. */
  setPixelScale(pixelsPerUnit: number): void {
    for (const stratum of this.strata) stratum.pixelScale = pixelsPerUnit
  }

  pulse(id: string, strength = 1): void {
    this.byId.get(id)?.pulse(strength)
  }

  /** Deposits the strata bottom-first, like sediment, over roughly one and a half seconds. */
  playEntrance(startTime: number, reduced: boolean): void {
    const count = this.strata.length
    this.strata.forEach((stratum, index) => {
      if (reduced) {
        stratum.entered = true
        stratum.group.visible = true
        stratum.entry.snap(0)
        return
      }
      stratum.entered = false
      stratum.group.visible = false
      stratum.enterAt = startTime + (count - 1 - index) * 0.075
    })
  }

  /** Sends a settling wave from the surface down to bedrock, used when the axis is relabelled for the analogy. */
  ripple(startTime: number): void {
    this.rippleAt = this.strata.map((_, index) => startTime + index * 0.045)
  }

  /** Pushes neighbours apart just enough that a lifted, scaled or tilted plate never intersects another. */
  private relayout(): void {
    const n = this.strata.length
    const centers: number[] = []
    const halves: number[] = []
    const lifts: number[] = []
    const active: boolean[] = []
    for (const stratum of this.strata) {
      const hovered = stratum.device.id === this.hoveredId
      const selected = stratum.device.id === this.selectedId
      const scale = hovered ? HOVER_SCALE : 1
      const tilt = selected ? TILT : 0
      const lift = hovered ? HOVER_LIFT : 0
      lifts.push(lift)
      centers.push(stratum.baseY + lift)
      halves.push(((PLATE.thickness * scale) / 2) * Math.cos(tilt) + ((stratum.depth * scale) / 2) * Math.sin(tilt))
      active.push(hovered || selected)
    }
    active.forEach((isActive, index) => {
      if (!isActive) return
      for (let upper = index - 1; upper >= 0; upper -= 1) {
        const lower = upper + 1
        const overlap = (centers[lower] ?? 0) + (halves[lower] ?? 0) + CLEARANCE - ((centers[upper] ?? 0) - (halves[upper] ?? 0))
        if (overlap <= 0) break
        centers[upper] = (centers[upper] ?? 0) + overlap
      }
      for (let lower = index + 1; lower < n; lower += 1) {
        const upper = lower - 1
        const overlap = (centers[lower] ?? 0) + (halves[lower] ?? 0) + CLEARANCE - ((centers[upper] ?? 0) - (halves[upper] ?? 0))
        if (overlap <= 0) break
        centers[lower] = (centers[lower] ?? 0) - overlap
      }
    })
    this.strata.forEach((stratum, index) => {
      stratum.fan.target = (centers[index] ?? stratum.baseY) - stratum.baseY - (lifts[index] ?? 0)
    })
  }

  update(dt: number, time: number): void {
    this.clock = time
    const flickering = time < this.flickerUntil
    this.rippleAt.forEach((at, index) => {
      const stratum = this.strata[index]
      if (at <= 0 || time < at || !stratum) return
      stratum.entry.velocity -= 5.5
      this.rippleAt[index] = 0
    })
    for (const stratum of this.strata) {
      if (flickering && stratum.device.volatile) {
        stratum.energy.value = Math.random() > 0.45 ? 1 : 0.15
        stratum.energy.velocity = 0
      }
      stratum.update(dt, time)
    }
  }
}
