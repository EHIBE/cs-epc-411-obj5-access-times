import { Vector3, type Camera } from 'three'
import { clamp } from '../utils/math'
import { svg } from './dom'

export type Placement = 'right' | 'left' | 'center' | 'above' | 'aboveRight' | 'rotated' | 'rotatedRight'

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

/** Projects 3D anchors to DOM labels every frame, keeps same-group labels from overlapping, sets callouts in one aligned column, and draws one-weight leaders that never cross a label. */
export class LabelLayer {
  private readonly items = new Map<string, LabelItem>()
  private readonly columns = new Map<string, ColumnState>()
  private readonly layer: HTMLElement
  private readonly leaders: SVGSVGElement
  private readonly point = new Vector3()
  private top = 0
  private bottom = 10000
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

  setBounds(top: number, bottom: number, right: number): void {
    this.top = top
    this.bottom = bottom
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
      if (item.ax < -200 || item.ax > width + 200 || item.ay < -100 || item.ay > height + 100) continue
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
      this.resolve(list)
    }
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
    if (item.path) {
      const toRight = item.placement !== 'left'
      const endY = item.y + item.shoulderY
      const edge = toRight ? item.x : item.x + item.width
      const knee = toRight ? Math.max(item.ax + 4, edge - KNEE) : Math.min(item.ax - 4, edge + KNEE)
      item.path.setAttribute(
        'd',
        `M${item.ax.toFixed(1)} ${item.ay.toFixed(1)} H${knee.toFixed(1)} L${edge.toFixed(1)} ${endY.toFixed(1)}`,
      )
      item.path.style.opacity = item.element.dataset.state === 'dim' ? '0.35' : '1'
    }
  }
}
