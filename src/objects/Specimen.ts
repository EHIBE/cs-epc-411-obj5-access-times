import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  Line,
  LineBasicMaterial,
  MeshStandardMaterial,
  Vector3,
  type Color,
} from 'three'
import { clamp, Spring } from '../utils/math'

export interface SpecimenLabel {
  id: string
  text: string
  local: Vector3
  visible: () => boolean
  tone?: 'plain' | 'strong'
}

export interface SpecimenKit {
  aluminum: MeshStandardMaterial
  steel: MeshStandardMaterial
  mirror: MeshStandardMaterial
  anodized: MeshStandardMaterial
  well: MeshStandardMaterial
  ink: LineBasicMaterial
  faint: LineBasicMaterial
}

/** Shared finishes for every specimen, retinted when the theme changes. */
export function createKit(): SpecimenKit {
  return {
    aluminum: new MeshStandardMaterial({ color: 0xc3ccd4, metalness: 0.72, roughness: 0.34 }),
    steel: new MeshStandardMaterial({ color: 0x8f9aa5, metalness: 0.8, roughness: 0.3 }),
    mirror: new MeshStandardMaterial({ color: 0xe4e9ee, metalness: 0.95, roughness: 0.13 }),
    anodized: new MeshStandardMaterial({ color: 0x2c343d, metalness: 0.45, roughness: 0.42 }),
    well: new MeshStandardMaterial({ color: 0x3a434d, metalness: 0.3, roughness: 0.6 }),
    ink: new LineBasicMaterial({ color: 0x26303a, transparent: true, opacity: 0.9 }),
    faint: new LineBasicMaterial({ color: 0x26303a, transparent: true, opacity: 0.35 }),
  }
}

export function tintKit(kit: SpecimenKit, ink: Color, dark: boolean): void {
  kit.ink.color.copy(ink)
  kit.faint.color.copy(ink)
  kit.faint.opacity = dark ? 0.45 : 0.35
  kit.well.color.set(dark ? 0x2a323b : 0x3a434d)
}

/** A polyline whose points are rewritten every frame, for arcs that grow and shrink. */
export class LivePath {
  readonly line: Line<BufferGeometry, LineBasicMaterial>
  private readonly positions: Float32Array
  private readonly capacity: number

  constructor(capacity: number, material: LineBasicMaterial) {
    this.capacity = capacity
    this.positions = new Float32Array(capacity * 3)
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute(this.positions, 3))
    geometry.setDrawRange(0, 0)
    this.line = new Line(geometry, material)
    this.line.frustumCulled = false
  }

  /** Samples an arc around a centre in the XZ plane at a fixed height. */
  arc(cx: number, cz: number, radius: number, from: number, to: number, y: number): void {
    const count = this.capacity
    for (let i = 0; i < count; i += 1) {
      const angle = from + ((to - from) * i) / (count - 1)
      this.positions[i * 3] = cx + Math.cos(angle) * radius
      this.positions[i * 3 + 1] = y
      this.positions[i * 3 + 2] = cz + Math.sin(angle) * radius
    }
    this.line.geometry.getAttribute('position').needsUpdate = true
    this.line.geometry.setDrawRange(0, Math.abs(to - from) > 0.001 ? count : 0)
  }

  hide(): void {
    this.line.geometry.setDrawRange(0, 0)
  }
}

/** Base for the mechanism models that appear beside their tier: a spring pop-in, a mode, and labelled parts. */
export abstract class Specimen {
  readonly group = new Group()
  readonly root = new Group()
  readonly labels: SpecimenLabel[] = []
  readonly appear = new Spring(0, 130, 16)
  mode = 'idle'
  protected time = 0
  protected shown = false

  constructor() {
    this.group.add(this.root)
    this.group.visible = false
    this.root.scale.setScalar(0.001)
  }

  get visibleAmount(): number {
    return clamp(this.appear.value, 0, 1)
  }

  get isShown(): boolean {
    return this.shown
  }

  show(visible: boolean): void {
    this.shown = visible
    this.appear.target = visible ? 1 : 0
    if (visible) this.group.visible = true
  }

  setMode(mode: string): void {
    if (mode === this.mode) return
    this.mode = mode
    this.onMode(mode)
  }

  protected onMode(_mode: string): void {}

  protected label(id: string, text: string, local: Vector3, visible: () => boolean = () => true, tone: 'plain' | 'strong' = 'plain'): void {
    this.labels.push({ id, text, local, visible, tone })
  }

  labelAnchor(label: SpecimenLabel, target: Vector3): Vector3 {
    target.copy(label.local)
    return this.root.localToWorld(target)
  }

  update(dt: number): void {
    this.appear.step(dt)
    const amount = Math.max(0.001, this.appear.value)
    this.root.scale.setScalar(amount)
    if (!this.shown && this.appear.value < 0.02) {
      this.group.visible = false
      return
    }
    this.time += dt
    this.animate(dt, this.time)
  }

  abstract applyPalette(ink: Color, dark: boolean): void

  protected abstract animate(dt: number, time: number): void
}
