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
import { mixHex, speedColor } from '../utils/color'
import { clamp, lerp, seededRandom } from '../utils/math'
import { placementLog, speedT, type SpeedDomain } from '../utils/scale'
import type { DeviceStratum } from './DeviceStratum'

const PER_DEVICE = 26
const BURST = 96
const HIDDEN_Y = -999

interface Mote {
  stratum: DeviceStratum
  hex: string
  color: Color
  angle: number
  speed: number
  radius: number
  lift: number
  wobble: number
  phase: number
  dust: number
}

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

/** Draws the round particle sprite once, lazily, on a small canvas: a procedural texture, never an image file. */
function particleSprite(): Texture {
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

/** Motes that circle each stratum at a speed set by its access time: charge racing near the surface, sediment drifting at depth. */
export class ParticleField {
  readonly points: Points<BufferGeometry, PointsMaterial>
  private readonly motes: Mote[] = []
  private readonly sparks: Spark[] = []
  private readonly positions: Float32Array
  private readonly colors: Float32Array
  private readonly ground = new Color('#e6eaed')
  private readonly scratch = new Color()
  private cursor = 0
  private burstSeed = 1

  constructor(strata: DeviceStratum[], domain: SpeedDomain) {
    const random = seededRandom(20260923)
    for (const stratum of strata) {
      const t = speedT(placementLog(stratum.device), domain)
      const speed = lerp(2.6, 0.05, t ** 0.8)
      const hex = speedColor(t)
      for (let i = 0; i < PER_DEVICE; i += 1) {
        this.motes.push({
          stratum,
          hex,
          color: new Color(hex),
          angle: random() * Math.PI * 2,
          speed: speed * lerp(0.75, 1.25, random()),
          radius: lerp(1.05, 1.32, random()),
          lift: lerp(-0.2, 0.9, random()),
          wobble: lerp(0.05, 0.5, random()) * lerp(0.2, 1, t),
          phase: random() * Math.PI * 2,
          dust: t,
        })
      }
    }
    for (let i = 0; i < BURST; i += 1) {
      this.sparks.push({ life: 0, x: 0, y: HIDDEN_Y, z: 0, vx: 0, vy: 0, vz: 0, color: new Color() })
    }
    const count = this.motes.length + BURST
    this.positions = new Float32Array(count * 3)
    this.colors = new Float32Array(count * 3)
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(this.positions, 3))
    geometry.setAttribute('color', new BufferAttribute(this.colors, 3))
    this.points = new Points(
      geometry,
      new PointsMaterial({
        size: 0.3,
        map: particleSprite(),
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        sizeAttenuation: true,
        alphaTest: 0.02,
      }),
    )
    this.points.frustumCulled = false
  }

  /** Additive light on the dark ground, inked motes on the light ground, so particles read in both themes. */
  applyPalette(ground: Color, dark: boolean, inkHex: string): void {
    this.ground.copy(ground)
    this.points.material.blending = dark ? AdditiveBlending : NormalBlending
    this.points.material.size = dark ? 0.36 : 0.3
    this.points.material.needsUpdate = true
    for (const mote of this.motes) {
      mote.color.set(dark ? mote.hex : mixHex(mote.hex, inkHex, 0.16 + mote.dust * 0.22))
    }
  }

  /** Scatters a burst of sparks from a stratum when it is selected. */
  burst(stratum: DeviceStratum, hex: string): void {
    const random = seededRandom((this.burstSeed += 7919))
    const y = stratum.group.position.y
    for (let i = 0; i < 40; i += 1) {
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

  update(dt: number, time: number, motion: number): void {
    let index = 0
    for (const mote of this.motes) {
      const stratum = mote.stratum
      const energy = clamp(stratum.energy.value, 0, 1)
      const emphasis = clamp(stratum.emphasis.value, 0, 1)
      const base = index * 3
      index += 1
      if (!stratum.group.visible || energy < 0.05) {
        this.positions[base + 1] = HIDDEN_Y
        continue
      }
      mote.angle += mote.speed * dt * motion
      const scale = stratum.scale.value
      const halfW = Math.max((stratum.width * scale) / 2, 0.1)
      const halfD = Math.max((stratum.depth * scale) / 2, 0.1)
      const cos = Math.cos(mote.angle)
      const sin = Math.sin(mote.angle)
      const reach = (mote.radius / Math.max(Math.abs(cos) / halfW, Math.abs(sin) / halfD)) * lerp(0.2, 1, energy)
      const drift = Math.sin(time * (0.6 + mote.dust) * motion + mote.phase) * mote.wobble
      const settle = mote.dust > 0.55 ? -(((time * 0.12 * mote.dust * motion + mote.phase) % 1.2 + 1.2) % 1.2) : 0
      this.positions[base] = cos * reach
      this.positions[base + 1] = stratum.group.position.y + mote.lift + drift + settle
      this.positions[base + 2] = sin * reach
      this.scratch.copy(mote.color).lerp(this.ground, (1 - emphasis) * 0.8)
      this.colors[base] = this.scratch.r
      this.colors[base + 1] = this.scratch.g
      this.colors[base + 2] = this.scratch.b
    }
    for (const spark of this.sparks) {
      const base = index * 3
      index += 1
      if (spark.life <= 0) {
        this.positions[base + 1] = HIDDEN_Y
        continue
      }
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
    }
    const geometry = this.points.geometry
    geometry.getAttribute('position').needsUpdate = true
    geometry.getAttribute('color').needsUpdate = true
  }
}
