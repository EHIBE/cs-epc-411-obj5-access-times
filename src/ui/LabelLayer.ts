import { Vector3, type Camera } from 'three'
import { clamp } from '../utils/math'
import { svg } from './dom'

export type Placement = 'right' | 'left' | 'center' | 'above' | 'below' | 'aboveRight' | 'rotated' | 'rotatedRight'

export interface LabelOptions {
  id: string
  element: HTMLElement
  anchor: (target: Vector3) => Vector3 | null
  placement: Placement
  offset?: number
  leader?: boolean
  tint?: string
  shoulder?: (element: HTMLElement) => number
  group?: string
  occluder?: boolean
  clampX?: boolean
  yieldTo?: string
  visible?: boolean
}

interface LabelItem {
  id: string
  element: HTMLElement
  anchor: (target: Vector3) => Vector3 | null
  placement: Placement
  offset: number
  leader: boolean
  shoulder: ((element: HTMLElement) => number) | null
  shoulderY: number
  group: string | null
  occluder: boolean
  clampX: boolean
  yieldTo: string | null
  visible: boolean
  width: number
  height: number
  dirty: boolean
  ax: number
  ay: number
  x: number
  y: number
  shown: boolean
  path: SVGPathElement | null
}

export interface Exclusion {
  left: number
  top: number
}

interface ColumnState {
  offset: number
  x: number
  seeded: boolean
}

const GAP = 4
const KNEE = 18

const rotatedBox = (item: LabelItem): { x0: number; y0: number; x1: number; y1: number } => {
  if (item.placement !== 'rotated' && item.placement !== 'rotatedRight') {
    return { x0: item.x, y0: item.y, x1: item.x + item.width, y1: item.y + item.height }
  }
  const cx = item.x + item.width / 2
  const cy = item.y + item.height / 2
  return { x0: cx - item.height / 2, y0: cy - item.width / 2, x1: cx + item.height / 2, y1: cy + item.width / 2 }
}

/** Projects 3D anchors to DOM labels every frame. Labels whose anchor leaves the visible frame are hidden rather than squeezed in, dense scales are thinned rather than shifted off their ticks, callouts sit in one aligned column, and every leader is drawn at one hairline weight without crossing a label. */
export class LabelLayer {
  private readonly items = new Map<string, LabelItem>()
  private readonly columns = new Map<string, ColumnState>()
  private readonly thinned = new Set<string>()
  private readonly layer: HTMLElement
  private readonly leaders: SVGSVGElement
  private readonly point = new Vector3()
  private top = 0
  private bottom = 10000
  private left = 0
  private right = 10000
  private exclusion: Exclusion | null = null

  constructor(layer: HTMLElement, leaders: SVGSVGElement) {
    this.layer = layer
    this.leaders = leaders
  }

  add(options: LabelOptions): void {
    const leader = options.leader ?? false
    const path = leader ? svg('path', { d: '' }) : null
    if (path) {
      if (options.tint) path.style.setProperty('--tint', options.tint)
      this.leaders.appendChild(path)
    }
    options.element.classList.add('is-hidden')
    this.layer.appendChild(options.element)
    this.items.set(options.id, {
      id: options.id,
      element: options.element,
      anchor: options.anchor,
      placement: options.placement,
      offset: options.offset ?? 12,
      leader,
      shoulder: options.shoulder ?? null,
      shoulderY: 0,
      group: options.group ?? null,
      occluder: options.occluder ?? false,
      clampX: options.clampX ?? false,
      yieldTo: options.yieldTo ?? null,
      visible: options.visible ?? false,
      width: 0,
      height: 0,
      dirty: true,
      ax: 0,
      ay: 0,
      x: 0,
      y: 0,
      shown: false,
      path,
    })
  }

  /** Sets every label of a group in one column just right of the group's outermost anchor. */
  alignColumn(group: string, offset: number): void {
    this.columns.set(group, { offset, x: 0, seeded: false })
  }

  /** Marks a group as a scale: when its labels would collide, alternate ones are dropped instead of being pushed off their ticks. */
  thinGroup(group: string): void {
    this.thinned.add(group)
  }

  has(id: string): boolean {
    return this.items.has(id)
  }

  setVisible(id: string, visible: boolean): void {
    const item = this.items.get(id)
    if (item) item.visible = visible
  }

  /** Marks a label for re-measurement after its text changes. */
  touch(id: string): void {
    const item = this.items.get(id)
    if (item) item.dirty = true
  }

  touchAll(): void {
    this.items.forEach((item) => {
      item.dirty = true
    })
  }

  setBounds(top: number, bottom: number, left: number, right: number): void {
    this.top = top
    this.bottom = bottom
    this.left = left
    this.right = right
  }

  /** A corner that labels keep out of, such as the controls hint while it is showing. */
  setExclusion(exclusion: Exclusion | null): void {
    this.exclusion = exclusion
  }

  update(camera: Camera, width: number, height: number): void {
    for (const item of this.items.values()) {
      if (item.visible && item.dirty) {
        item.width = item.element.offsetWidth
        item.height = item.element.offsetHeight
        item.shoulderY = item.shoulder ? item.shoulder(item.element) : item.height / 2
        item.dirty = false
      }
    }
    const groups = new Map<string, LabelItem[]>()
    for (const item of this.items.values()) {
      item.shown = false
      if (!item.visible) continue
      const anchor = item.anchor(this.point)
      if (!anchor) continue
      anchor.project(camera)
      if (anchor.z > 1 || anchor.z < -1) continue
      item.ax = ((anchor.x + 1) / 2) * width
      item.ay = ((1 - anchor.y) / 2) * height
      if (item.ay < this.top - 2 || item.ay > this.bottom + 2 || item.ax < this.left - 2 || item.ax > this.right + 2) continue
      item.shown = true
      this.place(item)
      if (item.group) {
        const list = groups.get(item.group) ?? []
        list.push(item)
        groups.set(item.group, list)
      } else {
        item.y = clamp(item.y, this.top, Math.max(this.top, this.floorFor(item) - item.height))
      }
    }
    for (const [group, list] of groups) {
      const column = this.columns.get(group)
      if (column) this.alignToColumn(list, column)
      if (this.thinned.has(group)) this.thin(list)
      else this.resolve(list)
    }
    for (const item of this.items.values()) {
      if (!item.shown || (item.group && this.columns.has(item.group))) continue
      if (item.clampX) item.x = clamp(item.x, this.left, Math.max(this.left, this.right - item.width))
      const box = rotatedBox(item)
      if (box.x0 < this.left || box.x1 > this.right || box.y0 < this.top - 1 || box.y1 > this.bottom + 1) item.shown = false
    }
    this.clearOccluded()
    this.yieldToGroups()
    for (const item of this.items.values()) this.write(item)
  }

  private floorFor(item: LabelItem): number {
    const exclusion = this.exclusion
    if (exclusion && item.x + item.width > exclusion.left) return Math.min(this.bottom, exclusion.top)
    return this.bottom
  }

  private alignToColumn(list: LabelItem[], column: ColumnState): void {
    const widest = Math.max(...list.map((item) => item.width))
    const limit = this.right - widest - 12
    const target = Math.min(Math.max(...list.map((item) => item.ax)) + column.offset, limit)
    if (!column.seeded || Math.abs(target - column.x) > 240) {
      column.x = target
      column.seeded = true
    } else {
      column.x = Math.min(column.x + (target - column.x) * 0.22, limit)
    }
    for (const item of list) item.x = column.x
  }

  private place(item: LabelItem): void {
    const { ax, ay, width: w, height: h, offset } = item
    switch (item.placement) {
      case 'right':
        item.x = ax + offset
        item.y = ay - h / 2
        break
      case 'left':
        item.x = ax - offset - w
        item.y = ay - h / 2
        break
      case 'above':
        item.x = ax - w / 2
        item.y = ay - offset - h
        break
      case 'below':
        item.x = ax - w / 2
        item.y = ay + offset
        break
      case 'aboveRight':
        item.x = ax + offset
        item.y = ay - h - 3
        break
      case 'rotated':
        item.x = ax - offset - h / 2 - w / 2
        item.y = ay - h / 2
        break
      case 'rotatedRight':
        item.x = ax + offset + h / 2 - w / 2
        item.y = ay - h / 2
        break
      default:
        item.x = ax - w / 2
        item.y = ay - h / 2
    }
  }

  /** Keeps a scale honest: each label stays on its own tick, and only a label whose lettering would touch the last kept label is dropped; line boxes may overlap because scale labels carry no fill. */
  private thin(list: LabelItem[]): void {
    list.sort((a, b) => a.ay - b.ay)
    let lastBottom = Number.NEGATIVE_INFINITY
    for (const item of list) {
      const glyph = item.height * 0.74
      const top = item.y + (item.height - glyph) / 2
      if (top < lastBottom + 1) {
        item.shown = false
        continue
      }
      lastBottom = top + glyph
    }
  }

  /** Relaxes overlapping labels symmetrically, so a crowded cluster spreads around its anchors instead of sliding one way; the order never changes, so leaders never cross. */
  private resolve(list: LabelItem[]): void {
    list.sort((a, b) => a.ay - b.ay)
    for (let iteration = 0; iteration < 60; iteration += 1) {
      let moved = false
      for (let i = 1; i < list.length; i += 1) {
        const upper = list[i - 1]
        const lower = list[i]
        if (!upper || !lower) continue
        const overlap = upper.y + upper.height + GAP - lower.y
        if (overlap > 0.5) {
          upper.y -= overlap / 2
          lower.y += overlap / 2
          moved = true
        }
      }
      for (const item of list) item.y = clamp(item.y, this.top, Math.max(this.top, this.floorFor(item) - item.height))
      if (!moved) break
    }
    for (let i = list.length - 1; i > 0; i -= 1) {
      const upper = list[i - 1]
      const lower = list[i]
      if (upper && lower && upper.y + upper.height + GAP > lower.y) upper.y = lower.y - upper.height - GAP
    }
    for (let i = 0; i < list.length; i += 1) {
      const upper = list[i - 1]
      const item = list[i]
      if (!item) continue
      if (item.y < this.top) item.y = this.top
      if (upper && upper.y + upper.height + GAP > item.y) item.y = upper.y + upper.height + GAP
    }
  }

  /** A low-priority label, such as the column note, steps aside for the group it yields to: it hides rather than print over a callout. */
  private yieldToGroups(): void {
    for (const item of this.items.values()) {
      if (!item.shown || !item.yieldTo) continue
      const a = rotatedBox(item)
      for (const other of this.items.values()) {
        if (!other.shown || other.group !== item.yieldTo) continue
        const b = rotatedBox(other)
        if (b.x0 < a.x1 + 4 && b.x1 > a.x0 - 4 && b.y0 < a.y1 + 4 && b.y1 > a.y0 - 4) {
          item.shown = false
          break
        }
      }
    }
  }

  /** A label marked as an occluder, such as the probe readout, clears any other label it passes over so no fragments peek out around it. */
  private clearOccluded(): void {
    for (const occluder of this.items.values()) {
      if (!occluder.shown || !occluder.occluder) continue
      const a = rotatedBox(occluder)
      for (const item of this.items.values()) {
        if (item === occluder || !item.shown || item.occluder) continue
        const b = rotatedBox(item)
        if (b.x0 < a.x1 + 2 && b.x1 > a.x0 - 2 && b.y0 < a.y1 + 2 && b.y1 > a.y0 - 2) item.shown = false
      }
    }
  }

  /** The last projected screen height of a label's anchor, or null when it is not on screen. */
  projectedY(id: string): number | null {
    const item = this.items.get(id)
    return item && item.shown ? item.ay : null
  }

  /** The measured size of a label, for callers that decide whether it fits. */
  sizeOf(id: string): { width: number; height: number } | null {
    const item = this.items.get(id)
    return item ? { width: item.width, height: item.height } : null
  }

  private write(item: LabelItem): void {
    if (!item.shown) {
      item.element.classList.add('is-hidden')
      if (item.path) item.path.style.opacity = '0'
      return
    }
    item.element.classList.remove('is-hidden')
    const rotate = item.placement === 'rotated' || item.placement === 'rotatedRight' ? ' rotate(-90deg)' : ''
    item.element.style.transform = `translate3d(${item.x.toFixed(1)}px, ${item.y.toFixed(1)}px, 0)${rotate}`
    if (!item.path) return
    if (item.placement === 'above' || item.placement === 'below') {
      const end = item.placement === 'above' ? item.y + item.height : item.y
      item.path.setAttribute('d', `M${item.ax.toFixed(1)} ${item.ay.toFixed(1)} V${end.toFixed(1)}`)
    } else {
      const toRight = item.placement !== 'left'
      const endY = item.y + item.shoulderY
      const edge = toRight ? item.x : item.x + item.width
      if (toRight ? item.ax > edge - 6 : item.ax < edge + 6) {
        item.path.style.opacity = '0'
        return
      }
      const knee = toRight ? Math.max(item.ax + 4, edge - KNEE) : Math.min(item.ax - 4, edge + KNEE)
      item.path.setAttribute(
        'd',
        `M${item.ax.toFixed(1)} ${item.ay.toFixed(1)} H${knee.toFixed(1)} L${edge.toFixed(1)} ${endY.toFixed(1)}`,
      )
    }
    item.path.style.opacity = item.element.dataset.state === 'dim' ? '0.35' : '1'
  }
}
