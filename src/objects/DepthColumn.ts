import {
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  LinearMipmapLinearFilter,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  SRGBColorSpace,
  Vector3,
  type Color,
} from 'three'
import { decadeLabel, HUMAN_LANDMARKS, logForHumanSeconds } from '../utils/format'
import { clamp, easeOutCubic } from '../utils/math'
import { AXIS, axisBottomY, yForLog } from '../utils/scale'

export const COLUMN_X = -17
export const COLUMN_HALF = 0.95
const FRONT = COLUMN_HALF + 0.012
const TOP = AXIS.yTop + 0.7
const BOTTOM = axisBottomY() - 0.7
const HEIGHT = TOP - BOTTOM
const FACE_WIDTH_PX = 160
const FACE_HEIGHT_PX = 4096
const PX_PER_UNIT = FACE_HEIGHT_PX / HEIGHT
const SURFACE_Y = TOP + 0.9
const SURFACE_RIGHT = 12

export type ColumnLabelKind = 'decade' | 'epoch' | 'human' | 'note'

export interface ColumnLabel {
  id: string
  kind: ColumnLabelKind
  text: string
  local: Vector3
  from?: number
  to?: number
}

interface TickSpec {
  x: number
  y: number
  z: number
  sx: number
  sy: number
  sz: number
}

export const EPOCHS: readonly { name: string; from: number; to: number }[] = [
  { name: 'picoseconds', from: -11, to: -9 },
  { name: 'nanoseconds', from: -9, to: -6 },
  { name: 'microseconds', from: -6, to: -3 },
  { name: 'milliseconds', from: -3, to: 0 },
  { name: 'seconds', from: 0, to: 3 },
]

/** Engraves the technical scale on a tall canvas the way a slide rule is cut: a long index and a numeral at every power of ten, graduated tenths up to 2, halves up to 5, and every mantissa numbered. */
function engraveFace(canvas: HTMLCanvasElement): HTMLCanvasElement {
  canvas.width = FACE_WIDTH_PX
  canvas.height = FACE_HEIGHT_PX
  const context = canvas.getContext('2d')
  if (!context) return canvas
  context.clearRect(0, 0, canvas.width, canvas.height)
  const u = (units: number): number => units * PX_PER_UNIT
  const rowFor = (log: number): number => (TOP - yForLog(log)) * PX_PER_UNIT
  context.fillStyle = '#ffffff'
  context.textBaseline = 'middle'
  const tick = (log: number, length: number, weight: number): void => {
    const y = rowFor(log)
    context.fillRect(0, y - weight / 2, u(length), weight)
  }
  const numeral = (log: number, text: string, size: number, weight: number, x: number): void => {
    context.font = `${weight} ${Math.round(u(size))}px "Archivo Variable", Archivo, system-ui, sans-serif`
    context.fontStretch = 'condensed'
    context.fillText(text, u(x), rowFor(log))
  }
  for (let exponent: number = AXIS.logTop; exponent <= AXIS.logBottom; exponent += 1) {
    tick(exponent, 0.8, 8)
    numeral(exponent, '1', 0.42, 780, 0.92)
    if (exponent === AXIS.logBottom) continue
    for (let tenth = 11; tenth < 20; tenth += 1) tick(exponent + Math.log10(tenth / 10), tenth === 15 ? 0.36 : 0.24, 2.4)
    for (const half of [2.5, 3.5, 4.5]) tick(exponent + Math.log10(half), 0.28, 2.4)
    for (let mantissa = 2; mantissa <= 9; mantissa += 1) {
      const log = exponent + Math.log10(mantissa)
      tick(log, mantissa === 5 ? 0.6 : 0.44, 4)
      numeral(log, String(mantissa), mantissa >= 7 ? 0.15 : 0.19, 600, mantissa === 5 ? 0.68 : 0.54)
    }
  }
  return canvas
}

/** The depth column: an ink ruler engraved like a slide rule, a ground line at the surface, and a second human-time scale that draws itself in for the analogy. */
export class DepthColumn {
  readonly group = new Group()
  readonly labels: ColumnLabel[] = []
  private readonly body: Mesh<BoxGeometry, MeshStandardMaterial>
  private readonly face: Mesh<PlaneGeometry, MeshBasicMaterial>
  private readonly faceTexture: CanvasTexture
  private readonly sideTicks: InstancedMesh<BoxGeometry, MeshBasicMaterial>
  private readonly humanTicks: InstancedMesh<BoxGeometry, MeshBasicMaterial>
  private readonly surface: LineSegments<BufferGeometry, LineBasicMaterial>
  private readonly humanSpecs: TickSpec[] = []
  private readonly sideSpecs: TickSpec[] = []
  private humanOn = false
  private humanChangedAt = -10
  private revealFrom = 0
  private drawStart = -1
  private readonly matrix = new Matrix4()
  private readonly quaternion = new Quaternion()
  private readonly position = new Vector3()
  private readonly size = new Vector3()

  constructor(maxAnisotropy: number) {
    this.body = new Mesh(
      new BoxGeometry(COLUMN_HALF * 2, HEIGHT, COLUMN_HALF * 2),
      new MeshStandardMaterial({ color: 0x26303a, roughness: 0.5, metalness: 0.25 }),
    )
    this.body.position.set(COLUMN_X, (TOP + BOTTOM) / 2, 0)
    this.body.castShadow = true
    this.body.receiveShadow = true

    this.faceTexture = new CanvasTexture(engraveFace(document.createElement('canvas')))
    this.faceTexture.colorSpace = SRGBColorSpace
    this.faceTexture.anisotropy = maxAnisotropy
    this.faceTexture.minFilter = LinearMipmapLinearFilter
    this.face = new Mesh(
      new PlaneGeometry(COLUMN_HALF * 2, HEIGHT),
      new MeshBasicMaterial({ map: this.faceTexture, transparent: true, toneMapped: false, depthWrite: false }),
    )
    this.face.position.set(COLUMN_X, (TOP + BOTTOM) / 2, COLUMN_HALF + 0.006)

    for (let exponent: number = AXIS.logTop; exponent <= AXIS.logBottom; exponent += 1) {
      const y = yForLog(exponent)
      this.sideSpecs.push({ x: COLUMN_X + COLUMN_HALF + 0.012, y, z: COLUMN_HALF - 0.36, sx: 0.02, sy: 0.07, sz: 0.72 })
      this.labels.push({
        id: `decade:${exponent}`,
        kind: 'decade',
        text: decadeLabel(exponent),
        local: new Vector3(COLUMN_X - COLUMN_HALF - 0.3, y, FRONT),
      })
    }
    for (const epoch of EPOCHS) {
      this.labels.push({
        id: `epoch:${epoch.name}`,
        kind: 'epoch',
        text: epoch.name,
        local: new Vector3(COLUMN_X - COLUMN_HALF - 0.25, yForLog((epoch.from + epoch.to) / 2), FRONT),
        from: epoch.from,
        to: epoch.to,
      })
    }
    HUMAN_LANDMARKS.forEach((landmark) => {
      const y = yForLog(logForHumanSeconds(landmark.humanSeconds))
      this.humanSpecs.push({ x: COLUMN_X + COLUMN_HALF - 0.21, y, z: FRONT + 0.004, sx: 0.42, sy: 0.09, sz: 0.024 })
      this.labels.push({
        id: `human:${landmark.label}`,
        kind: 'human',
        text: landmark.label,
        local: new Vector3(COLUMN_X + COLUMN_HALF + 0.3, y, FRONT),
      })
    })
    this.labels.push({ id: 'note', kind: 'note', text: '', local: new Vector3(COLUMN_X, SURFACE_Y + 0.9, FRONT) })

    const unit = new BoxGeometry(1, 1, 1)
    this.sideTicks = new InstancedMesh(unit, new MeshBasicMaterial({ color: 0xeef2f5, toneMapped: false }), this.sideSpecs.length)
    this.humanTicks = new InstancedMesh(unit, new MeshBasicMaterial({ color: 0xeef2f5, toneMapped: false }), this.humanSpecs.length)
    this.sideSpecs.forEach((spec, index) => this.sideTicks.setMatrixAt(index, this.compose(spec, 1)))
    this.humanSpecs.forEach((spec, index) => this.humanTicks.setMatrixAt(index, this.compose(spec, 0)))
    this.sideTicks.instanceMatrix.needsUpdate = true
    this.humanTicks.instanceMatrix.needsUpdate = true

    const surface: number[] = [COLUMN_X - COLUMN_HALF - 0.6, SURFACE_Y, 0, SURFACE_RIGHT, SURFACE_Y, 0]
    for (let x = COLUMN_X - COLUMN_HALF - 0.2; x <= SURFACE_RIGHT; x += 0.55) surface.push(x, SURFACE_Y, 0, x - 0.36, SURFACE_Y - 0.36, 0)
    const surfaceGeometry = new BufferGeometry()
    surfaceGeometry.setAttribute('position', new Float32BufferAttribute(surface, 3))
    this.surface = new LineSegments(surfaceGeometry, new LineBasicMaterial({ color: 0x26303a, transparent: true, opacity: 0.7 }))
    this.group.add(this.body, this.face, this.sideTicks, this.humanTicks, this.surface)
  }

  private compose(spec: TickSpec, reveal: number): Matrix4 {
    const r = Math.max(0.0001, reveal)
    const grows = spec.sx > spec.sz
    this.size.set(grows ? spec.sx * r : spec.sx, spec.sy, grows ? spec.sz : spec.sz * r)
    const shift = grows ? (spec.sx * (1 - r)) / 2 : 0
    this.position.set(spec.x + (spec.x > COLUMN_X ? shift : -shift), spec.y, spec.z)
    return this.matrix.compose(this.position, this.quaternion, this.size)
  }

  applyPalette(ink: Color, tick: Color, line: Color): void {
    this.body.material.color.copy(ink)
    this.face.material.color.copy(tick)
    this.sideTicks.material.color.copy(tick)
    this.humanTicks.material.color.copy(tick)
    this.surface.material.color.copy(line)
  }

  /** Re-cuts the engraving once the web font has loaded, so the numerals are set in Archivo rather than a fallback. */
  refreshEngraving(): void {
    const image: unknown = this.faceTexture.image
    if (!(image instanceof HTMLCanvasElement)) return
    engraveFace(image)
    this.faceTexture.needsUpdate = true
  }

  /** Reveals the engraving from the surface down like a pen cutting the scale; the texture window slides with the plane so nothing stretches. */
  private setFaceReveal(amount: number): void {
    const r = clamp(amount, 0.0001, 1)
    this.face.scale.y = r
    this.face.position.y = TOP - (HEIGHT * r) / 2
    this.faceTexture.repeat.set(1, r)
    this.faceTexture.offset.set(0, 1 - r)
  }

  /** Engraves the technical scale from the surface down; used by the opening sequence. */
  playDraw(startTime: number, reduced: boolean): void {
    this.drawStart = reduced ? -1 : startTime
    if (reduced) this.setFaceReveal(1)
    else this.setFaceReveal(0)
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
      this.setFaceReveal(easeOutCubic(clamp(elapsed / 1.3, 0, 1)))
      const span = AXIS.yTop - axisBottomY()
      this.sideSpecs.forEach((spec, index) => {
        const delay = ((AXIS.yTop - spec.y) / span) * 1.1
        this.sideTicks.setMatrixAt(index, this.compose(spec, easeOutCubic(clamp((elapsed - delay) / 0.3, 0, 1))))
      })
      this.sideTicks.instanceMatrix.needsUpdate = true
      if (elapsed > 1.6) this.drawStart = -1
    }
    if (time - this.humanChangedAt < 2) {
      this.humanSpecs.forEach((spec, index) => this.humanTicks.setMatrixAt(index, this.compose(spec, this.humanReveal(index, time))))
      this.humanTicks.instanceMatrix.needsUpdate = true
    }
  }
}
