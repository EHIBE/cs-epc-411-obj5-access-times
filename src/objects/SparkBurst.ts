import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  NormalBlending,
  Points,
  PointsMaterial,
  SRGBColorSpace,
  type Texture,
} from 'three'
import { clamp, lerp, seededRandom } from '../utils/math'
import type { DeviceStratum } from './DeviceStratum'

const CAPACITY = 96
const PER_BURST = 40
const HIDDEN_Y = -999

interface Spark {
  life: number
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  color: Color
}

let sprite: Texture | null = null

/** Draws the round spark sprite once, lazily, on a small canvas: a procedural texture, never an image file. */
function sparkSprite(): Texture {
  if (sprite) return sprite
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const context = canvas.getContext('2d')
  if (context) {
    const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32)
    gradient.addColorStop(0, 'rgba(255,255,255,1)')
    gradient.addColorStop(0.45, 'rgba(255,255,255,0.85)')
    gradient.addColorStop(1, 'rgba(255,255,255,0)')
    context.fillStyle = gradient
    context.fillRect(0, 0, 64, 64)
  }
  sprite = new CanvasTexture(canvas)
  sprite.colorSpace = SRGBColorSpace
  return sprite
}

/** The click response the brief asks for: a short spray of sparks in the device's colour that falls and fades, and nothing in between clicks. */
export class SparkBurst {
  readonly points: Points<BufferGeometry, PointsMaterial>
  private readonly sparks: Spark[] = []
  private readonly positions: Float32Array
  private readonly colors: Float32Array
  private readonly ground = new Color('#e6eaed')
  private readonly scratch = new Color()
  private cursor = 0
  private seed = 1

  constructor() {
    for (let i = 0; i < CAPACITY; i += 1) {
      this.sparks.push({ life: 0, x: 0, y: HIDDEN_Y, z: 0, vx: 0, vy: 0, vz: 0, color: new Color() })
    }
    this.positions = new Float32Array(CAPACITY * 3)
    this.colors = new Float32Array(CAPACITY * 3)
    for (let i = 0; i < CAPACITY; i += 1) this.positions[i * 3 + 1] = HIDDEN_Y
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(this.positions, 3))
    geometry.setAttribute('color', new BufferAttribute(this.colors, 3))
    this.points = new Points(
      geometry,
      new PointsMaterial({
        size: 0.3,
        map: sparkSprite(),
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        sizeAttenuation: true,
        alphaTest: 0.02,
      }),
    )
    this.points.frustumCulled = false
  }

  /** Additive light on the dark ground, inked sparks on the light ground, so a burst reads in both themes. */
  applyPalette(ground: Color, dark: boolean): void {
    this.ground.copy(ground)
    this.points.material.blending = dark ? AdditiveBlending : NormalBlending
    this.points.material.size = dark ? 0.36 : 0.3
    this.points.material.needsUpdate = true
  }

  /** Scatters a burst of sparks from a stratum when it is selected. */
  burst(stratum: DeviceStratum, hex: string): void {
    const random = seededRandom((this.seed += 7919))
    const y = stratum.group.position.y
    for (let i = 0; i < PER_BURST; i += 1) {
      const spark = this.sparks[this.cursor]
      this.cursor = (this.cursor + 1) % this.sparks.length
      if (!spark) continue
      const angle = random() * Math.PI * 2
      const speed = lerp(3, 9, random())
      spark.life = 1
      spark.x = Math.cos(angle) * stratum.width * 0.4
      spark.y = y
      spark.z = Math.sin(angle) * stratum.depth * 0.4
      spark.vx = Math.cos(angle) * speed
      spark.vy = lerp(1.5, 6, random())
      spark.vz = Math.sin(angle) * speed
      spark.color.set(hex)
    }
  }

  update(dt: number): void {
    let alive = false
    this.sparks.forEach((spark, index) => {
      const base = index * 3
      if (spark.life <= 0) {
        this.positions[base + 1] = HIDDEN_Y
        return
      }
      alive = true
      spark.life -= dt * 1.1
      spark.vy -= 9 * dt
      spark.x += spark.vx * dt
      spark.y += spark.vy * dt
      spark.z += spark.vz * dt
      spark.vx *= 1 - 1.8 * dt
      spark.vz *= 1 - 1.8 * dt
      this.scratch.copy(spark.color).lerp(this.ground, 1 - clamp(spark.life, 0, 1))
      this.positions[base] = spark.x
      this.positions[base + 1] = spark.y
      this.positions[base + 2] = spark.z
      this.colors[base] = this.scratch.r
      this.colors[base + 1] = this.scratch.g
      this.colors[base + 2] = this.scratch.b
    })
    this.points.visible = alive
    if (!alive) return
    const geometry = this.points.geometry
    geometry.getAttribute('position').needsUpdate = true
    geometry.getAttribute('color').needsUpdate = true
  }
}
