import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Vector3,
  type Color,
} from 'three'
import { clamp, Spring } from '../utils/math'
import { AXIS, yForLog } from '../utils/scale'
import { COLUMN_HALF, COLUMN_X } from './DepthColumn'

export interface SweepTarget {
  id: string
  log: number
}

const WINDOW_LEFT = COLUMN_X - COLUMN_HALF - 0.4
const WINDOW_RIGHT = COLUMN_X + COLUMN_HALF + 0.4
const WINDOW_HALF = 0.8
const REACH = 15
const Z = COLUMN_HALF + 0.3

/** The probe is a slide-rule cursor: a glass window riding the depth column with one hairline that runs on across the section, descending at a constant log speed so its readout accelerates through the units. */
export class ProbeSweep {
  readonly group = new Group()
  readonly stamp = new Vector3(COLUMN_X - COLUMN_HALF - 1.2, AXIS.yTop, Z)
  private readonly frame: LineSegments<BufferGeometry, LineBasicMaterial>
  private readonly hairline: LineSegments<BufferGeometry, LineBasicMaterial>
  private readonly glass: Mesh<PlaneGeometry, MeshBasicMaterial>
  private readonly visibility = new Spring(0, 90, 19)
  private targets: (SweepTarget & { fired: boolean })[] = []
  private log: number = AXIS.logTop
  private endLog: number = AXIS.logBottom
  private running = false
  private secondsPerDecade = 0.72
  onCross: (id: string) => void = () => undefined
  onFinish: () => void = () => undefined

  constructor() {
    const frame = [
      WINDOW_LEFT, -WINDOW_HALF, Z, WINDOW_RIGHT, -WINDOW_HALF, Z,
      WINDOW_RIGHT, -WINDOW_HALF, Z, WINDOW_RIGHT, WINDOW_HALF, Z,
      WINDOW_RIGHT, WINDOW_HALF, Z, WINDOW_LEFT, WINDOW_HALF, Z,
      WINDOW_LEFT, WINDOW_HALF, Z, WINDOW_LEFT, -WINDOW_HALF, Z,
    ]
    const frameGeometry = new BufferGeometry()
    frameGeometry.setAttribute('position', new Float32BufferAttribute(frame, 3))
    this.frame = new LineSegments(frameGeometry, new LineBasicMaterial({ color: 0x26303a, transparent: true, opacity: 0 }))
    const hairGeometry = new BufferGeometry()
    hairGeometry.setAttribute('position', new Float32BufferAttribute([WINDOW_LEFT, 0, Z, REACH, 0, Z], 3))
    this.hairline = new LineSegments(hairGeometry, new LineBasicMaterial({ color: 0x26303a, transparent: true, opacity: 0 }))
    this.glass = new Mesh(
      new PlaneGeometry(WINDOW_RIGHT - WINDOW_LEFT, WINDOW_HALF * 2),
      new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }),
    )
    this.glass.position.set((WINDOW_LEFT + WINDOW_RIGHT) / 2, 0, Z - 0.01)
    this.group.add(this.glass, this.frame, this.hairline)
    this.group.visible = false
  }

  applyPalette(ink: Color, dark: boolean): void {
    this.frame.material.color.copy(ink)
    this.hairline.material.color.copy(ink)
    this.glass.material.color.set(dark ? 0x9fc3e0 : 0xffffff)
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
    this.frame.position.y = y
    this.hairline.position.y = y
    this.glass.position.y = y
    this.stamp.y = y
    this.frame.material.opacity = 0.95 * v
    this.hairline.material.opacity = 0.9 * v
    this.glass.material.opacity = 0.22 * v
    this.group.visible = v > 0.01 || this.running
  }
}
