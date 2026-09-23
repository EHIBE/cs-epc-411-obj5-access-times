import {
  BoxGeometry,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  Vector3,
} from 'three'
import { clamp, Spring } from '../utils/math'
import { createKit, Specimen, tintKit, type SpecimenKit } from './Specimen'

export interface DieColors {
  register: string
  l1: string
  l2: string
  l3: string
  dram: string
}

interface Part {
  material: MeshStandardMaterial
  base: Color
  glow: number
}

const LOST = new Color('#6b737b')

/** A schematic processor: registers at each core's centre, L1 and L2 around them, a shared L3, and DRAM out on its own sticks. */
export class DieSpecimen extends Specimen {
  private readonly kit: SpecimenKit = createKit()
  private readonly parts: Part[] = []
  private readonly energy = new Spring(1, 60, 13)
  private flickerUntil = -1
  private readonly traces: LineSegments<BufferGeometry>

  constructor(colors: DieColors) {
    super()
    const substrate = new Mesh(new BoxGeometry(9.2, 0.32, 9.2), this.kit.anodized)
    substrate.position.y = 0
    substrate.castShadow = true
    substrate.receiveShadow = true
    const die = new Mesh(new BoxGeometry(5.8, 0.2, 5.8), this.kit.steel)
    die.position.y = 0.26
    this.root.add(substrate, die)
    const l3 = this.plate(5.3, 0.08, 5.3, colors.l3, 0.14)
    l3.position.y = 0.4
    this.root.add(l3)
    for (const cx of [-1.3, 1.3]) {
      for (const cz of [-1.3, 1.3]) {
        const l2 = this.plate(2.2, 0.1, 2.2, colors.l2, 0.2)
        l2.position.set(cx, 0.49, cz)
        const l1 = this.plate(1.46, 0.1, 1.46, colors.l1, 0.3)
        l1.position.set(cx, 0.59, cz)
        const register = this.plate(0.62, 0.14, 0.62, colors.register, 0.9)
        register.position.set(cx, 0.7, cz)
        this.root.add(l2, l1, register)
      }
    }
    const traceSegments: number[] = []
    for (const offset of [-2.4, -1.2, 0, 1.2, 2.4]) {
      traceSegments.push(4.6, 0.18, offset, 7.4, 0.18, offset * 0.55)
    }
    const traceGeometry = new BufferGeometry()
    traceGeometry.setAttribute('position', new Float32BufferAttribute(traceSegments, 3))
    this.traces = new LineSegments(traceGeometry, this.kit.faint)
    this.root.add(this.traces)
    for (const x of [8.1, 9.3]) {
      const stick = new Mesh(new BoxGeometry(0.28, 1.5, 7.6), this.kit.anodized)
      stick.position.set(x, 0.75, 0)
      stick.castShadow = true
      this.root.add(stick)
      for (let i = 0; i < 6; i += 1) {
        const chip = this.plate(0.36, 0.9, 0.9, colors.dram, 0.12)
        chip.position.set(x - 0.17, 0.85, -2.9 + i * 1.16)
        this.root.add(chip)
      }
    }
    this.detailSheet(this.kit, { minX: -5.4, maxX: 10.2, minZ: -5.3, maxZ: 7, y: -0.17, titleWidth: 7 })
    this.inkEdges(this.kit)
    this.label('registers', 'Registers: inside each core', new Vector3(1.3, 0.77, -1.3), () => true, 'strong', 'above', 62)
    this.label('l3', 'L3: shared by every core', new Vector3(-2.65, 0.44, -0.6), () => true, 'plain', 'above', 26)
    this.label('l1l2', 'L1 and L2: per core', new Vector3(1.3, 0.54, 2.4), () => true, 'plain', 'below', 48)
    this.label('dram', 'DRAM: off the chip, on memory sticks', new Vector3(8.1, 1.5, -2.6))
  }

  private plate(width: number, height: number, depth: number, hex: string, glow: number): Mesh {
    const base = new Color(hex)
    const material = new MeshStandardMaterial({ color: base.clone(), metalness: 0.3, roughness: 0.4, emissive: base.clone(), emissiveIntensity: glow })
    this.parts.push({ material, base, glow })
    const mesh = new Mesh(new BoxGeometry(width, height, depth), material)
    mesh.castShadow = true
    mesh.receiveShadow = true
    return mesh
  }

  applyPalette(ink: Color, dark: boolean): void {
    tintKit(this.kit, ink, dark)
  }

  /** Volatile to the last transistor: every coloured part loses its charge when the power is cut. */
  setPower(on: boolean): void {
    if (!on) this.flickerUntil = this.time + 0.55
    this.energy.target = on ? 1 : 0
  }

  protected animate(dt: number, time: number): void {
    if (time < this.flickerUntil) {
      this.energy.value = Math.random() > 0.45 ? 1 : 0.15
      this.energy.velocity = 0
    }
    this.energy.step(dt)
    const energy = clamp(this.energy.value, 0, 1)
    for (const part of this.parts) {
      part.material.color.copy(part.base).lerp(LOST, 1 - energy)
      part.material.emissiveIntensity = part.glow * energy * (0.85 + 0.15 * Math.sin(time * 3))
    }
  }
}
