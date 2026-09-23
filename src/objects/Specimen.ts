import {
  BoxGeometry,
  BufferGeometry,
  EdgesGeometry,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Line,
  LineBasicMaterial,
  LineSegments,
  Mesh,
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
  paper: MeshStandardMaterial
  ink: LineBasicMaterial
  faint: LineBasicMaterial
  edge: LineBasicMaterial
}

export interface SheetBounds {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
  y: number
  titleWidth: number
}

/** Shared finishes for every specimen: the strata's satin anodized recipe in neutral tints, a paper sheet, and the one hairline ink. */
export function createKit(): SpecimenKit {
  const satin = (color: number): MeshStandardMaterial => new MeshStandardMaterial({ color, metalness: 0.3, roughness: 0.4 })
  return {
    aluminum: satin(0xd3d9de),
    steel: satin(0x98a3ad),
    mirror: new MeshStandardMaterial({ color: 0xe6eaee, metalness: 0.42, roughness: 0.26 }),
    anodized: satin(0x2c343d),
    well: satin(0x3a434d),
    paper: new MeshStandardMaterial({ color: 0xf5f7f8, metalness: 0, roughness: 0.95 }),
    ink: new LineBasicMaterial({ color: 0x26303a, transparent: true, opacity: 0.9 }),
    faint: new LineBasicMaterial({ color: 0x26303a, transparent: true, opacity: 0.35 }),
    edge: new LineBasicMaterial({ color: 0x26303a, transparent: true, opacity: 0.72 }),
  }
}

export function tintKit(kit: SpecimenKit, ink: Color, dark: boolean): void {
  kit.ink.color.copy(ink)
  kit.faint.color.copy(ink)
  kit.edge.color.copy(ink)
  kit.faint.opacity = dark ? 0.45 : 0.35
  kit.edge.opacity = dark ? 0.62 : 0.72
  kit.well.color.set(dark ? 0x2a323b : 0x3a434d)
  kit.paper.color.set(dark ? 0x172a3c : 0xf5f7f8)
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

/** Base for the mechanism models drawn as details beside their stratum: a paper detail sheet with a neat line and title block, ligne-claire outlines, a spring pop-in, a mode, and leadered part labels. */
export abstract class Specimen {
  readonly group = new Group()
  readonly root = new Group()
  readonly labels: SpecimenLabel[] = []
  readonly appear = new Spring(0, 130, 16)
  readonly dock = new Vector3()
  readonly titleLocal = new Vector3()
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

  /** Lays the paper detail sheet under the mechanism: a thin matte sheet, a double neat line, and a title block in the near right corner whose centre carries the detail's title. */
  protected detailSheet(kit: SpecimenKit, bounds: SheetBounds): void {
    const width = bounds.maxX - bounds.minX
    const depth = bounds.maxZ - bounds.minZ
    const paper = new Mesh(new BoxGeometry(width, 0.04, depth), kit.paper)
    paper.position.set((bounds.minX + bounds.maxX) / 2, bounds.y - 0.02, (bounds.minZ + bounds.maxZ) / 2)
    paper.receiveShadow = true
    paper.userData.noEdges = true
    const y = bounds.y + 0.004
    const rect = (x0: number, z0: number, x1: number, z1: number, into: number[]): void => {
      into.push(x0, y, z0, x1, y, z0, x1, y, z0, x1, y, z1, x1, y, z1, x0, y, z1, x0, y, z1, x0, y, z0)
    }
    const lines: number[] = []
    rect(bounds.minX + 0.3, bounds.minZ + 0.3, bounds.maxX - 0.3, bounds.maxZ - 0.3, lines)
    rect(bounds.minX + 0.5, bounds.minZ + 0.5, bounds.maxX - 0.5, bounds.maxZ - 0.5, lines)
    const blockX1 = bounds.maxX - 0.5
    const blockX0 = blockX1 - bounds.titleWidth
    const blockZ1 = bounds.maxZ - 0.5
    const blockZ0 = blockZ1 - 1.5
    rect(blockX0, blockZ0, blockX1, blockZ1, lines)
    lines.push(blockX0, y, blockZ0 + 1.05, blockX1, y, blockZ0 + 1.05)
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute(lines, 3))
    const frame = new LineSegments(geometry, kit.ink)
    this.titleLocal.set((blockX0 + blockX1) / 2, y, blockZ0 + 0.52)
    this.dock.set(bounds.minX, y, (bounds.minZ + bounds.maxZ) / 2)
    this.root.add(paper, frame)
  }

  /** Traces every solid part at the drawing's one hairline weight, the ligne-claire outline the strata already carry. */
  protected inkEdges(kit: SpecimenKit): void {
    const meshes: Mesh[] = []
    this.root.traverse((node) => {
      if (node instanceof Mesh && !(node instanceof InstancedMesh) && !node.userData.noEdges) meshes.push(node)
    })
    for (const mesh of meshes) {
      const edges = new LineSegments(new EdgesGeometry(mesh.geometry, 28), kit.edge)
      edges.raycast = () => undefined
      mesh.add(edges)
    }
  }

  /** World-space point on the sheet's left edge where the detail leader from its stratum lands. */
  dockPoint(target: Vector3): Vector3 {
    target.copy(this.dock)
    return this.root.localToWorld(target)
  }

  /** World-space centre of the sheet's title block. */
  titleAnchor(target: Vector3): Vector3 {
    target.copy(this.titleLocal)
    return this.root.localToWorld(target)
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
