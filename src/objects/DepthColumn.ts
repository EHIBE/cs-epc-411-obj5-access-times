import {
  BoxGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
  type Color,
} from 'three'
import { decadeLabel, HUMAN_LANDMARKS, logForHumanSeconds } from '../utils/format'
import { clamp, easeOutCubic } from '../utils/math'
import { AXIS, axisBottomY, yForLog } from '../utils/scale'

export const COLUMN_X = -17
const HALF = 0.55
const FRONT = HALF + 0.012

export type ColumnLabelKind = 'decade' | 'epoch' | 'human' | 'note'

export interface ColumnLabel {
  id: string
  kind: ColumnLabelKind
  text: string
  local: Vector3
}

interface TickSpec {
  x: number
  y: number
  z: number
  sx: number
  sy: number
  sz: number
}

const EPOCHS: readonly { name: string; from: number; to: number }[] = [
  { name: 'picoseconds', from: -11, to: -9 },
  { name: 'nanoseconds', from: -9, to: -6 },
  { name: 'microseconds', from: -6, to: -3 },
  { name: 'milliseconds', from: -3, to: 0 },
  { name: 'seconds', from: 0, to: 3 },
]

/** The depth column: an ink ruler engraved like a slide rule, with a second human-time scale that draws itself in for the analogy. */
export class DepthColumn {
  readonly group = new Group()
  readonly labels: ColumnLabel[] = []
  private readonly body: Mesh<BoxGeometry, MeshStandardMaterial>
  private readonly ticks: InstancedMesh<BoxGeometry, MeshBasicMaterial>
  private readonly humanTicks: InstancedMesh<BoxGeometry, MeshBasicMaterial>
  private readonly humanSpecs: TickSpec[] = []
  private readonly techSpecs: TickSpec[] = []
  private humanOn = false
  private humanChangedAt = -10
  private revealFrom = 0
  private drawStart = -1
  private readonly matrix = new Matrix4()
  private readonly quaternion = new Quaternion()
  private readonly position = new Vector3()
  private readonly size = new Vector3()

  constructor() {
    const top = AXIS.yTop + 0.7
    const bottom = axisBottomY() - 0.7
    const height = top - bottom
    this.body = new Mesh(
      new BoxGeometry(HALF * 2, height, HALF * 2),
      new MeshStandardMaterial({ color: 0x26303a, roughness: 0.55, metalness: 0.22 }),
    )
    this.body.position.set(COLUMN_X, (top + bottom) / 2, 0)
    this.body.castShadow = true
    this.body.receiveShadow = true

    const epochEdges = new Set([-9, -6, -3, 0])
    for (let exponent: number = AXIS.logTop; exponent <= AXIS.logBottom; exponent += 1) {
      const y = yForLog(exponent)
      const full = epochEdges.has(exponent)
      const length = full ? HALF * 2 : 0.62
      this.techSpecs.push({ x: COLUMN_X - HALF + length / 2, y, z: FRONT, sx: length, sy: 0.075, sz: 0.02 })
      this.techSpecs.push({ x: COLUMN_X + HALF + 0.012, y, z: HALF - 0.28, sx: 0.02, sy: 0.075, sz: 0.56 })
      this.labels.push({
        id: `decade:${exponent}`,
        kind: 'decade',
        text: decadeLabel(exponent),
        local: new Vector3(COLUMN_X - HALF - 0.25, y, FRONT),
      })
      if (exponent === AXIS.logBottom) continue
      for (let m = 2; m <= 9; m += 1) {
        const minorLength = m === 5 ? 0.42 : 0.26
        this.techSpecs.push({
          x: COLUMN_X - HALF + minorLength / 2,
          y: yForLog(exponent + Math.log10(m)),
          z: FRONT,
          sx: minorLength,
          sy: 0.038,
          sz: 0.02,
        })
      }
    }
    for (const epoch of EPOCHS) {
      this.labels.push({
        id: `epoch:${epoch.name}`,
        kind: 'epoch',
        text: epoch.name,
        local: new Vector3(COLUMN_X - HALF - 0.25, yForLog((epoch.from + epoch.to) / 2), FRONT),
      })
    }
    HUMAN_LANDMARKS.forEach((landmark) => {
      const y = yForLog(logForHumanSeconds(landmark.humanSeconds))
      this.humanSpecs.push({ x: COLUMN_X + HALF - 0.31, y, z: FRONT + 0.004, sx: 0.62, sy: 0.085, sz: 0.024 })
      this.labels.push({
        id: `human:${landmark.label}`,
        kind: 'human',
        text: landmark.label,
        local: new Vector3(COLUMN_X + HALF + 0.3, y, FRONT),
      })
    })
    this.labels.push({ id: 'note', kind: 'note', text: '', local: new Vector3(COLUMN_X, top + 1.6, FRONT) })

    const unit = new BoxGeometry(1, 1, 1)
    this.ticks = new InstancedMesh(unit, new MeshBasicMaterial({ color: 0xe9edf0 }), this.techSpecs.length)
    this.humanTicks = new InstancedMesh(unit, new MeshBasicMaterial({ color: 0xe9edf0 }), this.humanSpecs.length)
    this.techSpecs.forEach((spec, index) => this.ticks.setMatrixAt(index, this.compose(spec, 1)))
    this.humanSpecs.forEach((spec, index) => this.humanTicks.setMatrixAt(index, this.compose(spec, 0)))
    this.ticks.instanceMatrix.needsUpdate = true
    this.humanTicks.instanceMatrix.needsUpdate = true
    this.group.add(this.body, this.ticks, this.humanTicks)
  }

  private compose(spec: TickSpec, reveal: number): Matrix4 {
    const r = Math.max(0.0001, reveal)
    const grows = spec.sx > spec.sz
    this.size.set(grows ? spec.sx * r : spec.sx, spec.sy, grows ? spec.sz : spec.sz * r)
    const shift = grows ? (spec.sx * (1 - r)) / 2 : 0
    this.position.set(spec.x + (spec.x > COLUMN_X ? shift : -shift), spec.y, spec.z)
    return this.matrix.compose(this.position, this.quaternion, this.size)
  }

  applyPalette(ink: Color, tick: Color): void {
    this.body.material.color.copy(ink)
    this.ticks.material.color.copy(tick)
    this.humanTicks.material.color.copy(tick)
  }

  /** Engraves the technical ticks from the surface down; used by the opening sequence. */
  playDraw(startTime: number, reduced: boolean): void {
    this.drawStart = reduced ? -1 : startTime
    if (reduced) {
      this.techSpecs.forEach((spec, index) => this.ticks.setMatrixAt(index, this.compose(spec, 1)))
      this.ticks.instanceMatrix.needsUpdate = true
    }
  }

  setHuman(on: boolean, time: number): void {
    if (on === this.humanOn) return
    this.humanOn = on
    this.humanChangedAt = time
    this.revealFrom = on ? 0 : 1
  }

  get human(): boolean {
    return this.humanOn
  }

  /** Human-scale reveal progress for one landmark, staggered top to bottom like a pen redrawing the axis. */
  humanReveal(index: number, time: number): number {
    const elapsed = time - this.humanChangedAt
    if (this.humanOn) return easeOutCubic(clamp((elapsed - index * 0.07) / 0.4, 0, 1))
    return clamp(this.revealFrom - elapsed / 0.3, 0, 1)
  }

  update(time: number): void {
    if (this.drawStart >= 0) {
      const elapsed = time - this.drawStart
      const topY = AXIS.yTop
      const span = AXIS.yTop - axisBottomY()
      this.techSpecs.forEach((spec, index) => {
        const delay = ((topY - spec.y) / span) * 1.1
        this.ticks.setMatrixAt(index, this.compose(spec, easeOutCubic(clamp((elapsed - delay) / 0.3, 0, 1))))
      })
      this.ticks.instanceMatrix.needsUpdate = true
      if (elapsed > 1.6) this.drawStart = -1
    }
    if (time - this.humanChangedAt < 2) {
      this.humanSpecs.forEach((spec, index) => this.humanTicks.setMatrixAt(index, this.compose(spec, this.humanReveal(index, time))))
      this.humanTicks.instanceMatrix.needsUpdate = true
    }
  }
}
