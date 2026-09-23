import { Vector3, type Camera } from 'three'
import { clamp } from '../utils/math'
import { svg } from './dom'

export type Placement = 'right' | 'left' | 'center' | 'above' | 'rotated'

export interface LabelOptions {
  id: string
  element: HTMLElement
  anchor: (target: Vector3) => Vector3 | null
  placement: Placement
  offset?: number
  leader?: boolean
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

const GAP = 3

/** Projects 3D anchors to DOM labels every frame, keeps same-group labels from overlapping, and draws one-weight leader lines. */
export class LabelLayer {
  private readonly items = new Map<string, LabelItem>()
  private readonly layer: HTMLElement
  private readonly leaders: SVGSVGElement
  private readonly point = new Vector3()
  private top = 0
  private bottom = 10000

  constructor(layer: HTMLElement, leaders: SVGSVGElement) {
    this.layer = layer
    this.leaders = leaders
  }

  add(options: LabelOptions): void {
    const leader = options.leader ?? false
    const path = leader ? svg('path', { d: '' }) : null
    if (path) this.leaders.appendChild(path)
    options.element.classList.add('is-hidden')
    this.layer.appendChild(options.element)
    this.items.set(options.id, {
      id: options.id,
      element: options.element,
      anchor: options.anchor,
      placement: options.placement,
      offset: options.offset ?? 12,
      leader,
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

  setBounds(top: number, bottom: number): void {
    this.top = top
    this.bottom = bottom
  }

  update(camera: Camera, width: number, height: number): void {
    for (const item of this.items.values()) {
      if (item.visible && item.dirty) {
        item.width = item.element.offsetWidth
        item.height = item.element.offsetHeight
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
      }
    }
    for (const list of groups.values()) this.resolve(list)
    for (const item of this.items.values()) this.write(item)
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
      case 'rotated':
        item.x = ax - offset - h / 2 - w / 2
        item.y = ay - h / 2
        break
      default:
        item.x = ax - w / 2
        item.y = ay - h / 2
    }
  }

  /** Relaxes overlapping labels symmetrically, so a crowded cluster spreads around its anchors instead of sliding one way. */
  private resolve(list: LabelItem[]): void {
    list.sort((a, b) => a.ay - b.ay)
    for (let iteration = 0; iteration < 48; iteration += 1) {
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
      for (const item of list) item.y = clamp(item.y, this.top, Math.max(this.top, this.bottom - item.height))
      if (!moved) break
    }
  }

  /** The last projected screen height of a label's anchor, or null when it is not on screen. */
  projectedY(id: string): number | null {
    const item = this.items.get(id)
    return item && item.shown ? item.ay : null
  }

  private write(item: LabelItem): void {
    if (!item.shown) {
      item.element.classList.add('is-hidden')
      if (item.path) item.path.style.opacity = '0'
      return
    }
    item.element.classList.remove('is-hidden')
    const rotate = item.placement === 'rotated' ? ' rotate(-90deg)' : ''
    item.element.style.transform = `translate3d(${item.x.toFixed(1)}px, ${item.y.toFixed(1)}px, 0)${rotate}`
    if (item.path) {
      const labelY = item.y + item.height / 2
      const toRight = item.placement !== 'left'
      const edge = toRight ? item.x - 2 : item.x + item.width + 2
      const knee = toRight ? edge - 10 : edge + 10
      item.path.setAttribute(
        'd',
        `M${item.ax.toFixed(1)} ${item.ay.toFixed(1)} L${knee.toFixed(1)} ${labelY.toFixed(1)} L${edge.toFixed(1)} ${labelY.toFixed(1)}`,
      )
      item.path.style.opacity = item.element.dataset.state === 'dim' ? '0.3' : '0.75'
    }
  }
}
