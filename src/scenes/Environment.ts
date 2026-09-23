import {
  BufferGeometry,
  CircleGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  ShadowMaterial,
  type Scene,
} from 'three'
import { AXIS } from '../utils/scale'
import { smoothstep } from '../utils/math'
import type { ScenePalette } from './palette'

const RADIUS = 96
const STEP = 3.4
const SEGMENTS = 48

/** The survey floor: a radially fading grid and a soft shadow catcher. */
export class Environment {
  readonly group = new Group()
  private readonly grid: LineSegments<BufferGeometry, LineBasicMaterial>
  private readonly shadow: Mesh<CircleGeometry, ShadowMaterial>
  private readonly fade: Float32Array

  constructor(scene: Scene) {
    const positions: number[] = []
    const fade: number[] = []
    const majorEvery = 5
    for (let index = -Math.floor(RADIUS / STEP); index <= Math.floor(RADIUS / STEP); index += 1) {
      const offset = index * STEP
      const weight = index % majorEvery === 0 ? 1 : 0.55
      for (const axis of [0, 1]) {
        for (let s = 0; s < SEGMENTS; s += 1) {
          const a = -RADIUS + (2 * RADIUS * s) / SEGMENTS
          const b = -RADIUS + (2 * RADIUS * (s + 1)) / SEGMENTS
          const ends = axis === 0 ? [a, offset, b, offset] : [offset, a, offset, b]
          positions.push(ends[0] as number, 0, ends[1] as number, ends[2] as number, 0, ends[3] as number)
          const fadeA = weight * (1 - smoothstep(Math.hypot(ends[0] as number, ends[1] as number) / RADIUS))
          const fadeB = weight * (1 - smoothstep(Math.hypot(ends[2] as number, ends[3] as number) / RADIUS))
          fade.push(fadeA, fadeB)
        }
      }
    }
    this.fade = Float32Array.from(fade)
    const gridGeometry = new BufferGeometry()
    gridGeometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
    gridGeometry.setAttribute('color', new Float32BufferAttribute(new Float32Array(this.fade.length * 3), 3))
    this.grid = new LineSegments(gridGeometry, new LineBasicMaterial({ vertexColors: true, fog: true }))
    this.grid.position.y = AXIS.floorY

    this.shadow = new Mesh(new CircleGeometry(RADIUS, 64), new ShadowMaterial({ opacity: 0.2 }))
    this.shadow.rotation.x = -Math.PI / 2
    this.shadow.position.y = AXIS.floorY + 0.01
    this.shadow.receiveShadow = true

    this.group.add(this.grid, this.shadow)
    scene.add(this.group)
  }

  applyPalette(palette: ScenePalette): void {
    const colors = this.grid.geometry.getAttribute('color')
    const mixed = new Color()
    for (let i = 0; i < this.fade.length; i += 1) {
      const strength = this.fade[i] ?? 0
      mixed.copy(palette.ground).lerp(strength > 0.8 ? palette.gridMajor : palette.grid, Math.min(1, strength * 1.15))
      colors.setXYZ(i, mixed.r, mixed.g, mixed.b)
    }
    colors.needsUpdate = true
    this.shadow.material.color.copy(palette.dark ? new Color(0x05080c) : palette.ink)
    this.shadow.material.opacity = palette.shadowOpacity
  }
}
