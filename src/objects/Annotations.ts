import {
  BoxGeometry,
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  Vector3,
  type Color,
} from 'three'
import { clamp, Spring } from '../utils/math'
import { yForLog } from '../utils/scale'
import { COLUMN_X } from './DepthColumn'

/** A group of hairline segments that fades in and out as one drawing. */
class LineFigure {
  readonly lines: LineSegments<BufferGeometry, LineBasicMaterial>
  readonly visibility = new Spring(0, 90, 19)
  private readonly maxOpacity: number

  constructor(segments: number[], maxOpacity = 0.85) {
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute(segments, 3))
    this.lines = new LineSegments(geometry, new LineBasicMaterial({ color: 0x26303a, transparent: true, opacity: 0 }))
    this.lines.visible = false
    this.maxOpacity = maxOpacity
  }

  update(dt: number): number {
    this.visibility.step(dt)
    const v = clamp(this.visibility.value, 0, 1)
    this.lines.material.opacity = v * this.maxOpacity
    this.lines.visible = v > 0.01
    return v
  }
}

export interface MeasureSpec {
  id: string
  from: number
  to: number
  label: string
  marks?: number[]
}

/** Measurements taken against the depth column itself: a bracket between two powers of ten, labelled with the ratio the fact sheet states. */
export const MEASURES: readonly MeasureSpec[] = [
  { id: 'l1-dram', from: -9, to: -7, label: 'ten to a hundred times', marks: [-8] },
  { id: 'ssd-hdd', from: -5, to: -2, label: 'roughly 1,000 times' },
  { id: 'thirteen', from: -11, to: 2, label: 'roughly 13 orders of magnitude' },
]

export class Measure {
  readonly spec: MeasureSpec
  readonly figure: LineFigure
  readonly anchor: Vector3

  constructor(spec: MeasureSpec) {
    this.spec = spec
    const x = COLUMN_X + 1.35
    const z = 0.6
    const top = yForLog(spec.from)
    const bottom = yForLog(spec.to)
    const segments = [x, top, z, x, bottom, z, x, top, z, x - 0.75, top, z, x, bottom, z, x - 0.75, bottom, z]
    for (const mark of spec.marks ?? []) {
      const y = yForLog(mark)
      segments.push(x, y, z, x - 0.4, y, z)
    }
    this.figure = new LineFigure(segments, 0.95)
    this.anchor = new Vector3(x + 0.35, (top + bottom) / 2, z)
  }
}

/** Lesson 1, Slide 5's three recap tiers drawn as brackets beside the strata they name. */
export class LessonBracket {
  readonly figure: LineFigure
  readonly anchor: Vector3
  readonly id: string

  constructor(id: string, topY: number, bottomY: number) {
    this.id = id
    const x = 12.6
    const z = 0
    const segments = [x, topY, z, x, bottomY, z, x, topY, z, x - 0.7, topY, z, x, bottomY, z, x - 0.7, bottomY, z]
    this.figure = new LineFigure(segments, 0.9)
    this.anchor = new Vector3(x + 0.45, (topY + bottomY) / 2, z)
  }
}

/** A thin glass sheet at 10⁻⁷ s: everything above it is volatile in Section D, everything below keeps its data without power. */
export class VolatilityPlane {
  readonly group = new Group()
  readonly anchor: Vector3
  readonly visibility = new Spring(0, 80, 18)
  private readonly sheet: Mesh<BoxGeometry, MeshStandardMaterial>
  private readonly edge: LineFigure

  constructor(log = -7) {
    const y = yForLog(log)
    const left = -12.5
    const right = 12.5
    const depth = 7.2
    this.sheet = new Mesh(
      new BoxGeometry(right - left, 0.04, depth * 2),
      new MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0, roughness: 0.1, metalness: 0, depthWrite: false }),
    )
    this.sheet.position.set(0, y, 0)
    const segments = [left, y, -depth, right, y, -depth, right, y, -depth, right, y, depth, right, y, depth, left, y, depth, left, y, depth, left, y, -depth]
    this.edge = new LineFigure(segments, 0.8)
    this.group.add(this.sheet, this.edge.lines)
    this.anchor = new Vector3(right, y, depth)
  }

  applyPalette(ink: Color, dark: boolean): void {
    this.edge.lines.material.color.copy(ink)
    this.sheet.material.color.set(dark ? 0x9fb3c4 : 0xffffff)
  }

  setVisible(visible: boolean): void {
    this.visibility.target = visible ? 1 : 0
    this.edge.visibility.target = visible ? 1 : 0
  }

  update(dt: number): number {
    this.visibility.step(dt)
    this.edge.update(dt)
    const v = clamp(this.visibility.value, 0, 1)
    this.sheet.material.opacity = v * 0.34
    this.sheet.visible = v > 0.01
    return v
  }
}

/** Holds every annotation so the director can switch them per slide step. */
export class Annotations {
  readonly group = new Group()
  readonly measures: Measure[]
  readonly lessons: LessonBracket[] = []
  readonly volatility = new VolatilityPlane()

  constructor(lessonSpans: { id: string; top: number; bottom: number }[]) {
    this.measures = MEASURES.map((spec) => new Measure(spec))
    for (const span of lessonSpans) this.lessons.push(new LessonBracket(span.id, span.top, span.bottom))
    for (const measure of this.measures) this.group.add(measure.figure.lines)
    for (const lesson of this.lessons) this.group.add(lesson.figure.lines)
    this.group.add(this.volatility.group)
  }

  applyPalette(ink: Color, dark: boolean): void {
    for (const measure of this.measures) measure.figure.lines.material.color.copy(ink)
    for (const lesson of this.lessons) lesson.figure.lines.material.color.copy(ink)
    this.volatility.applyPalette(ink, dark)
  }

  showMeasure(id: string | null): void {
    for (const measure of this.measures) measure.figure.visibility.target = measure.spec.id === id ? 1 : 0
  }

  showLessons(visible: boolean): void {
    for (const lesson of this.lessons) lesson.figure.visibility.target = visible ? 1 : 0
  }

  measureVisibility(id: string): number {
    const measure = this.measures.find((entry) => entry.spec.id === id)
    return measure ? clamp(measure.figure.visibility.value, 0, 1) : 0
  }

  update(dt: number): void {
    for (const measure of this.measures) measure.figure.update(dt)
    for (const lesson of this.lessons) lesson.figure.update(dt)
    this.volatility.update(dt)
  }
}
