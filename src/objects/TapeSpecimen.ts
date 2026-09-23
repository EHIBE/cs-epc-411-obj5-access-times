import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Vector3,
  type Color,
} from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { clamp, easeInOutCubic } from '../utils/math'
import { createKit, Specimen, tintKit, type SpecimenKit } from './Specimen'

export type TapePhase = 'mount' | 'load' | 'locate' | 'stream' | null

const DURATIONS = { mount: 1.7, load: 1.1, locate: 2.6, stream: 2.4, rest: 0.6 } as const
const SLOT = new Vector3(-6.2, 3.35, 0)
const DOOR = new Vector3(0.4, 1.55, 0)
const INSIDE = new Vector3(2.4, 1.55, 0)

/** A tape library and drive: the cartridge is fetched, loaded and wound before a single byte streams out. */
export class TapeSpecimen extends Specimen {
  onPhase: (phase: TapePhase) => void = () => undefined
  private readonly kit: SpecimenKit = createKit()
  private readonly cartridge = new Group()
  private readonly reel: Mesh<CylinderGeometry, MeshStandardMaterial>
  private readonly stream: InstancedMesh<BoxGeometry, MeshBasicMaterial>
  private readonly matrix = new Matrix4()
  private readonly inkMaterial = new MeshBasicMaterial({ color: 0x26303a })
  private phase: TapePhase | 'rest' = 'rest'
  private phaseTime = 0
  private reelAngle = 0

  constructor(accent: Color) {
    super()
    const floor = new Mesh(new RoundedBoxGeometry(19, 0.4, 9.6, 3, 0.24), this.kit.aluminum)
    floor.position.set(-0.8, -0.2, 0)
    floor.receiveShadow = true
    floor.castShadow = true
    const rack = new Group()
    const upright = new BoxGeometry(0.22, 5.2, 3)
    for (const x of [-9.2, -3.4]) {
      const post = new Mesh(upright, this.kit.anodized)
      post.position.set(x, 2.6, 0)
      rack.add(post)
    }
    const shelfGeometry = new BoxGeometry(6, 0.16, 3)
    for (const y of [0.9, 3.1]) {
      const shelf = new Mesh(shelfGeometry, this.kit.anodized)
      shelf.position.set(-6.3, y - 0.1, 0)
      rack.add(shelf)
    }
    const cartridgeGeometry = new RoundedBoxGeometry(0.46, 2.0, 2.2, 2, 0.06)
    const shelfCartridge = new MeshStandardMaterial({ color: 0x59636e, metalness: 0.25, roughness: 0.5 })
    for (const y of [1.95, 4.15]) {
      for (let i = 0; i < 8; i += 1) {
        const x = -8.7 + i * 0.66
        if (y > 3 && Math.abs(x - SLOT.x) < 0.3) continue
        const stored = new Mesh(cartridgeGeometry, shelfCartridge)
        stored.position.set(x, y, 0)
        stored.castShadow = true
        rack.add(stored)
      }
    }
    const drive = new Mesh(new RoundedBoxGeometry(4.8, 3.1, 4.6, 3, 0.2), this.kit.anodized)
    drive.position.set(3.1, 1.55, 0)
    drive.castShadow = true
    const door = new Mesh(new BoxGeometry(0.06, 2.3, 2.5), this.inkMaterial)
    door.position.set(0.68, 1.55, 0)
    const window = new Mesh(new BoxGeometry(2.8, 0.05, 2.8), new MeshStandardMaterial({ color: 0x9fb2c2, metalness: 0.1, roughness: 0.05, transparent: true, opacity: 0.45 }))
    window.position.set(3.4, 3.12, 0)
    this.reel = new Mesh(new CylinderGeometry(1.1, 1.1, 0.26, 40), new MeshStandardMaterial({ color: 0x3b3f44, metalness: 0.4, roughness: 0.45 }))
    this.reel.position.set(3.4, 2.92, 0)
    const reelMark = new Mesh(new BoxGeometry(1.0, 0.03, 0.14), new MeshBasicMaterial({ color: accent }))
    reelMark.position.set(0.5, 0.14, 0)
    this.reel.add(reelMark)

    const shell = new Mesh(cartridgeGeometry, new MeshStandardMaterial({ color: accent, metalness: 0.3, roughness: 0.4 }))
    shell.castShadow = true
    const tab = new Mesh(new BoxGeometry(0.48, 0.5, 0.8), this.inkMaterial)
    tab.position.set(0, 0.62, 0.55)
    this.cartridge.add(shell, tab)
    this.cartridge.position.copy(SLOT)

    this.stream = new InstancedMesh(new BoxGeometry(0.22, 0.22, 0.22), new MeshBasicMaterial({ color: accent }), 18)
    this.stream.frustumCulled = false
    this.root.add(floor, rack, drive, door, window, this.reel, this.cartridge, this.stream)

    this.label('library', 'Tape library', new Vector3(-6.3, 5.7, 0))
    this.label('drive', 'Tape drive', new Vector3(3.1, 3.9, -1.6))
    this.label('mount', 'Robotic mount: 4 to 10 s', new Vector3(-2.6, 5.1, 0), () => this.phase === 'mount', 'strong')
    this.label('load', 'Drive load: about 11 s', new Vector3(0.6, 4.1, 1.4), () => this.phase === 'load', 'strong')
    this.label('locate', 'Locate the file: 10 to 100 s', new Vector3(3.4, 4.1, 1.2), () => this.phase === 'locate', 'strong')
    this.label('stream', 'Streaming: 400 MB/s native, 1,000 MB/s compressed', new Vector3(6.8, 2.6, 0), () => this.phase === 'stream' && this.mode !== 'stream', 'strong')
    this.label('stream-why', 'Once positioned: 360 to 400 MB/s, vs. 160 to 220 MB/s for most hard disks', new Vector3(6.8, 2.6, 0), () => this.mode === 'stream', 'strong')
  }

  applyPalette(ink: Color, dark: boolean): void {
    tintKit(this.kit, ink, dark)
    this.inkMaterial.color.copy(ink)
  }

  protected override onMode(mode: string): void {
    if (mode === 'stream') {
      this.cartridge.position.copy(INSIDE)
      this.setPhase('stream')
    } else {
      this.cartridge.position.copy(SLOT)
      this.setPhase('mount')
    }
  }

  private setPhase(phase: TapePhase | 'rest'): void {
    this.phase = phase
    this.phaseTime = 0
    this.onPhase(phase === 'rest' ? null : phase)
  }

  protected animate(dt: number, time: number): void {
    this.phaseTime += dt
    const phase = this.phase
    if (phase === 'mount') {
      const t = easeInOutCubic(clamp(this.phaseTime / DURATIONS.mount, 0, 1))
      const lift = Math.sin(t * Math.PI) * 1.4
      this.cartridge.position.set(SLOT.x + (DOOR.x - 1.4 - SLOT.x) * t, SLOT.y + (DOOR.y - SLOT.y) * t + lift, 0)
      if (this.phaseTime >= DURATIONS.mount) this.setPhase('load')
    } else if (phase === 'load') {
      const t = easeInOutCubic(clamp(this.phaseTime / DURATIONS.load, 0, 1))
      this.cartridge.position.set(DOOR.x - 1.4 + (INSIDE.x - DOOR.x + 1.4) * t, DOOR.y, 0)
      if (this.phaseTime >= DURATIONS.load) this.setPhase('locate')
    } else if (phase === 'locate') {
      const t = clamp(this.phaseTime / DURATIONS.locate, 0, 1)
      this.reelAngle += dt * (4 + 26 * Math.sin(t * Math.PI))
      if (this.phaseTime >= DURATIONS.locate && this.mode !== 'stream') this.setPhase('stream')
    } else if (phase === 'stream') {
      this.reelAngle += dt * 5
      if (this.mode !== 'stream' && this.phaseTime >= DURATIONS.stream) this.setPhase('rest')
    } else if (this.phaseTime >= DURATIONS.rest) {
      this.cartridge.position.copy(SLOT)
      this.setPhase('mount')
    }
    this.cartridge.visible = phase !== 'locate' && phase !== 'stream'
    this.reel.rotation.y = -this.reelAngle
    const streaming = phase === 'stream'
    for (let i = 0; i < 18; i += 1) {
      const progress = ((time * 0.9 + i / 18) % 1 + 1) % 1
      const s = streaming ? 1 - progress * 0.6 : 0.0001
      this.matrix.makeScale(s, s, s)
      this.matrix.setPosition(5.6 + progress * 3.4, 1.55 + Math.sin(progress * 9 + i) * 0.12, (i % 3) * 0.5 - 0.5)
      this.stream.setMatrixAt(i, this.matrix)
    }
    this.stream.instanceMatrix.needsUpdate = true
  }
}
