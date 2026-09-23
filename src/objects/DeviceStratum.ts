import {
  BoxGeometry,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineDashedMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  Shape,
  Vector3,
} from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import type { Device } from '../data/types'
import { brighten } from '../utils/color'
import { clamp, Spring } from '../utils/math'
import { PLATE } from '../utils/scale'

export interface StratumSpec {
  device: Device
  color: string
  baseY: number
  width: number
  depth: number
  unrated: boolean
  ghost: boolean
  glow: number
}

const TILT_RADIANS = (14 * Math.PI) / 180
const LOST_HEX = '#6b737b'

/** Builds the top and bottom rounded-rectangle outlines of a plate as line segments: the single hairline weight of the drawing. */
function outlineGeometry(width: number, depth: number, thickness: number): BufferGeometry {
  const radius = Math.min(PLATE.radius * 1.4, width / 4, depth / 4)
  const shape = new Shape()
  const w = width / 2
  const d = depth / 2
  shape.moveTo(-w + radius, -d)
  shape.lineTo(w - radius, -d)
  shape.quadraticCurveTo(w, -d, w, -d + radius)
  shape.lineTo(w, d - radius)
  shape.quadraticCurveTo(w, d, w - radius, d)
  shape.lineTo(-w + radius, d)
  shape.quadraticCurveTo(-w, d, -w, d - radius)
  shape.lineTo(-w, -d + radius)
  shape.quadraticCurveTo(-w, -d, -w + radius, -d)
  const points = shape.getPoints(4)
  const positions: number[] = []
  for (const y of [thickness / 2 + 0.004, -thickness / 2 - 0.004]) {
    for (let i = 0; i < points.length - 1; i += 1) {
      const a = points[i]
      const b = points[i + 1]
      if (!a || !b) continue
      positions.push(a.x, y, a.y, b.x, y, b.y)
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  return geometry
}

/** One device drawn as a satin anodized stratum: PBR body, hairline outline, and every animated state it can be in. */
export class DeviceStratum {
  readonly device: Device
  readonly group = new Group()
  readonly body: Mesh<RoundedBoxGeometry, MeshStandardMaterial>
  readonly outline: LineSegments<BufferGeometry, LineBasicMaterial | LineDashedMaterial>
  readonly baseY: number
  readonly width: number
  readonly depth: number
  readonly reach: number
  readonly ghost: boolean
  readonly lift = new Spring(0, 210, 21)
  readonly scale = new Spring(1, 230, 19)
  readonly tilt = new Spring(0, 120, 15)
  readonly fan = new Spring(0, 170, 22)
  readonly emphasis = new Spring(1, 80, 17)
  readonly hover = new Spring(0, 220, 26)
  readonly flash = new Spring(0, 55, 8)
  readonly energy = new Spring(1, 60, 13)
  readonly entry = new Spring(0, 95, 13)
  float = 0
  enterAt = 0
  entered = true
  private readonly baseColor: Color
  private readonly brightColor: Color
  private readonly lostColor = new Color(LOST_HEX)
  private readonly ground = new Color('#e6eaed')
  private readonly working = new Color()
  private readonly glow: number
  private readonly extensions: Mesh<BoxGeometry, MeshStandardMaterial>[] = []

  constructor(spec: StratumSpec) {
    this.device = spec.device
    this.baseY = spec.baseY
    this.width = spec.width
    this.depth = spec.depth
    this.ghost = spec.ghost
    this.glow = spec.glow
    this.baseColor = new Color(spec.color)
    this.brightColor = new Color(brighten(spec.color, 0.3))
    const material = new MeshStandardMaterial({
      color: this.baseColor.clone(),
      metalness: 0.3,
      roughness: 0.4,
      emissive: this.baseColor.clone(),
      emissiveIntensity: spec.glow,
      transparent: spec.ghost,
      opacity: spec.ghost ? 0.52 : 1,
      depthWrite: !spec.ghost,
    })
    this.body = new Mesh(new RoundedBoxGeometry(spec.width, PLATE.thickness, spec.depth, 3, PLATE.radius), material)
    this.body.castShadow = !spec.ghost
    this.body.receiveShadow = true
    this.body.userData.deviceId = spec.device.id
    this.body.name = `stratum:${spec.device.id}`

    const lineMaterial = spec.unrated || spec.ghost
      ? new LineDashedMaterial({ color: 0x26303a, dashSize: 0.34, gapSize: 0.22, transparent: true, opacity: 0.6 })
      : new LineBasicMaterial({ color: 0x26303a, transparent: true, opacity: 0.55 })
    this.outline = new LineSegments(outlineGeometry(spec.width, spec.depth, PLATE.thickness), lineMaterial)
    if (lineMaterial instanceof LineDashedMaterial) this.outline.computeLineDistances()

    this.group.add(this.body, this.outline)
    let reach = spec.width / 2
    if (spec.device.capacity.unlimited) {
      const pieces = [0.46, 0.26, 0.12]
      pieces.forEach((opacity, index) => {
        for (const side of [-1, 1]) {
          const piece = new Mesh(
            new BoxGeometry(PLATE.unlimitedFade / pieces.length - 0.12, PLATE.thickness * 0.8, spec.depth * 0.92),
            new MeshStandardMaterial({
              color: this.baseColor.clone(),
              metalness: 0.3,
              roughness: 0.4,
              transparent: true,
              opacity,
              depthWrite: false,
            }),
          )
          const step = PLATE.unlimitedFade / pieces.length
          piece.position.x = side * (spec.width / 2 + step * (index + 0.5))
          piece.userData.baseOpacity = opacity
          this.extensions.push(piece)
          this.group.add(piece)
        }
      })
      reach += PLATE.unlimitedFade
    }
    this.reach = reach
    this.group.position.y = spec.baseY
    this.group.userData.deviceId = spec.device.id
  }

  setPalette(ground: Color, line: Color, edgeOpacity: number): void {
    this.ground.copy(ground)
    this.outline.material.color.copy(line)
    this.outline.material.opacity = this.outline.material instanceof LineDashedMaterial ? edgeOpacity + 0.1 : edgeOpacity
  }

  /** World-space point at the plate's right edge, where its callout leader starts. */
  anchor(target: Vector3): Vector3 {
    target.set(this.reach + 0.25, 0, 0)
    return this.group.localToWorld(target)
  }

  /** World-space point on the plate's left edge, used by extension lines and whiskers. */
  leftEdge(target: Vector3): Vector3 {
    target.set(-this.width / 2, 0, 0)
    return this.group.localToWorld(target)
  }

  update(dt: number, time: number): void {
    if (!this.entered) {
      if (time < this.enterAt) {
        this.group.visible = false
        return
      }
      this.entered = true
      this.group.visible = true
      this.entry.snap(26)
      this.entry.target = 0
    }
    for (const spring of [this.lift, this.scale, this.tilt, this.fan, this.emphasis, this.hover, this.flash, this.energy, this.entry]) {
      spring.step(dt)
    }
    const s = this.scale.value
    this.group.position.y = this.baseY + this.float + this.lift.value + this.fan.value + this.entry.value
    this.group.scale.setScalar(s)
    this.group.rotation.x = this.tilt.value

    const material = this.body.material
    const hover = clamp(this.hover.value, 0, 1)
    const emphasis = clamp(this.emphasis.value, 0, 1)
    const energy = clamp(this.energy.value, 0, 1)
    const flash = Math.max(0, this.flash.value)
    this.working.copy(this.baseColor).lerp(this.brightColor, hover)
    this.working.lerp(this.ground, (1 - emphasis) * 0.74)
    this.working.lerp(this.lostColor, 1 - energy)
    material.color.copy(this.working)
    material.emissive.copy(this.baseColor)
    material.emissiveIntensity = this.glow * energy * (0.35 + 0.65 * emphasis) + flash * 0.85
    if (this.ghost) material.opacity = 0.34 + 0.34 * emphasis
    const outlineOpacity = this.outline.material.opacity
    this.outline.visible = outlineOpacity > 0.01
    for (const piece of this.extensions) {
      piece.material.color.copy(this.working)
      piece.material.opacity = (piece.userData.baseOpacity as number) * (0.4 + 0.6 * emphasis)
    }
  }

  setHovered(hovered: boolean): void {
    this.lift.target = hovered ? 1 : 0
    this.scale.target = hovered ? 1.1 : 1
    this.hover.target = hovered ? 1 : 0
  }

  setSelected(selected: boolean): void {
    this.tilt.target = selected ? TILT_RADIANS : 0
  }

  pulse(strength = 1): void {
    this.flash.value = Math.max(this.flash.value, strength)
    this.flash.velocity = 0
    this.flash.target = 0
  }
}

export const TILT = TILT_RADIANS
