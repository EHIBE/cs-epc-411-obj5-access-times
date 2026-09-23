import {
  BoxGeometry,
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  TorusGeometry,
  Vector3,
  type Color,
} from 'three'
import { clamp, Spring } from '../utils/math'
import { AXIS, yForLog } from '../utils/scale'
import { COLUMN_X } from './DepthColumn'

export interface SweepTarget {
  id: string
  log: number
}

const LEFT = COLUMN_X - 2.2
const RIGHT = 14
const DEPTH = 8.5

/** A probe band that descends the depth column at a constant log speed, so its readout accelerates through the units. */
export class ProbeSweep {
  readonly group = new Group()
  readonly stamp = new Vector3(COLUMN_X - 1.6, AXIS.yTop, 0.6)
  private readonly plane: Mesh<BoxGeometry, MeshBasicMaterial>
  private readonly edge: LineSegments<BufferGeometry, LineBasicMaterial>
  private readonly ring: Mesh<TorusGeometry, MeshBasicMaterial>
  private readonly visibility = new Spring(0, 90, 19)
  private targets: (SweepTarget & { fired: boolean })[] = []
  private log: number = AXIS.logTop
  private endLog: number = AXIS.logBottom
  private running = false
  private secondsPerDecade = 0.72
  onCross: (id: string) => void = () => undefined
  onFinish: () => void = () => undefined

  constructor() {
    this.plane = new Mesh(
      new BoxGeometry(RIGHT - LEFT, 0.03, DEPTH * 2),
      new MeshBasicMaterial({ color: 0x26303a, transparent: true, opacity: 0, depthWrite: false }),
    )
    this.plane.position.x = (LEFT + RIGHT) / 2
    const corners = [LEFT, -DEPTH, RIGHT, -DEPTH, RIGHT, -DEPTH, RIGHT, DEPTH, RIGHT, DEPTH, LEFT, DEPTH, LEFT, DEPTH, LEFT, -DEPTH]
    const positions: number[] = []
    for (let i = 0; i < corners.length; i += 2) positions.push(corners[i] as number, 0, corners[i + 1] as number)
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
    this.edge = new LineSegments(geometry, new LineBasicMaterial({ color: 0x26303a, transparent: true, opacity: 0 }))
    this.ring = new Mesh(
      new TorusGeometry(1.05, 0.07, 8, 48),
      new MeshBasicMaterial({ color: 0x26303a, transparent: true, opacity: 0 }),
    )
    this.ring.rotation.x = Math.PI / 2
    this.ring.position.x = COLUMN_X
    this.group.add(this.plane, this.edge, this.ring)
    this.group.visible = false
  }

  applyPalette(ink: Color): void {
    this.plane.material.color.copy(ink)
    this.edge.material.color.copy(ink)
    this.ring.material.color.copy(ink)
  }

  get active(): boolean {
    return this.running
  }

  get currentLog(): number {
    return this.log
  }

  /** Starts a sweep past every target; faster when reduced motion is requested. */
  start(targets: SweepTarget[], reduced: boolean): void {
    this.targets = targets.map((target) => ({ ...target, fired: false })).sort((a, b) => a.log - b.log)
    const last = this.targets[this.targets.length - 1]
    this.endLog = last ? Math.min(AXIS.logBottom, last.log + 0.35) : AXIS.logBottom
    this.log = AXIS.logTop
    this.secondsPerDecade = reduced ? 0.18 : 0.72
    this.running = true
    this.group.visible = true
    this.visibility.target = 1
  }

  stop(): void {
    this.running = false
    this.visibility.target = 0
  }

  update(dt: number): void {
    if (this.running) {
      this.log = Math.min(this.endLog, this.log + dt / this.secondsPerDecade)
      for (const target of this.targets) {
        if (!target.fired && this.log >= target.log) {
          target.fired = true
          this.onCross(target.id)
        }
      }
      if (this.log >= this.endLog) {
        this.running = false
        this.visibility.target = 0
        this.onFinish()
      }
    }
    this.visibility.step(dt)
    const v = clamp(this.visibility.value, 0, 1)
    const y = yForLog(this.log)
    this.plane.position.y = y
    this.edge.position.y = y
    this.ring.position.y = y
    this.stamp.y = y
    this.plane.material.opacity = 0.075 * v
    this.edge.material.opacity = 0.7 * v
    this.ring.material.opacity = v
    this.group.visible = v > 0.01 || this.running
  }
}
