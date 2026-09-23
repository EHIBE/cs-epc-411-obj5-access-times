import {
  BoxGeometry,
  CylinderGeometry,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  RingGeometry,
  Shape,
  Vector3,
  type Color,
} from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { clamp, easeInOutCubic, lerp } from '../utils/math'
import { createKit, LivePath, Specimen, tintKit, type SpecimenKit } from './Specimen'

export type DiskPhase = 'seek' | 'rotate' | 'transfer' | 'ready' | null

const CENTER = new Vector3(-1.6, 0, 0)
const PIVOT = new Vector3(4.3, 0, 3.3)
const ARM = 6.1
const TRACKS = [1.35, 1.73, 2.12, 2.5, 2.88, 3.27, 3.65]
const OMEGA = 2.2
const SEEK_TIME = 1.1
const TRANSFER_TIME = 1.0
const READY_TIME = 0.8
const PAUSE_TIME = 0.55
const PLATTER_Y = 0.3
const TWO_PI = Math.PI * 2

/** Solves the arm angle that puts the head over a given track radius (law of cosines around the pivot). */
function armAngleFor(radius: number): number {
  const dx = PIVOT.x - CENTER.x
  const dz = PIVOT.z - CENTER.z
  const distance = Math.hypot(dx, dz)
  const k = (radius * radius - distance * distance - ARM * ARM) / (2 * ARM)
  return Math.atan2(dz, dx) + Math.acos(clamp(k / distance, -1, 1))
}

const wrap = (angle: number): number => ((angle % TWO_PI) + TWO_PI) % TWO_PI

/** A cut-away hard disk: a mirror platter with concentric tracks, an actuator arm, and the seek, rotate and transfer phases played out. */
export class HardDiskSpecimen extends Specimen {
  onPhase: (phase: DiskPhase) => void = () => undefined
  private readonly kit: SpecimenKit = createKit()
  private readonly arm = new Group()
  private readonly spinner = new Group()
  private readonly sectorHolder = new Group()
  private readonly sector: Mesh<RingGeometry, MeshBasicMaterial>
  private readonly sectorGeometries = TRACKS.map((radius) => new RingGeometry(radius - 0.17, radius + 0.17, 20, 1, -0.24, 0.48))
  private readonly labelLift = new Vector3(0, 1.9, 0)
  private readonly lineInk = new MeshBasicMaterial({ color: 0x26303a, transparent: true, opacity: 0.32, side: DoubleSide })
  private readonly notchInk = new MeshBasicMaterial({ color: 0x26303a })
  private readonly head: Mesh<BoxGeometry, MeshStandardMaterial>
  private readonly bits: InstancedMesh<BoxGeometry, MeshBasicMaterial>
  private readonly seekPath: LivePath
  private readonly rotationArc: LivePath
  private readonly headLocal = new Vector3()
  private readonly accent: Color
  private phase: DiskPhase | 'park' | 'pause' = 'park'
  private phaseTime = 0
  private beta = 0
  private theta = armAngleFor(TRACKS[TRACKS.length - 1] as number)
  private thetaFrom = this.theta
  private thetaTo = this.theta
  private track = TRACKS.length - 1
  private sectorAlpha = 0
  private sectorVisible = 0
  private scanDirection = -1
  private readonly matrix = new Matrix4()
  private readonly seekLabel = new Vector3()
  private readonly arcLabel = new Vector3()
  private readonly bitsLabel = new Vector3()

  constructor(accent: Color) {
    super()
    this.accent = accent.clone()
    const chassis = new Mesh(new RoundedBoxGeometry(13.2, 0.7, 9.8, 3, 0.28), this.kit.aluminum)
    chassis.position.set(0, -0.36, 0)
    chassis.castShadow = true
    chassis.receiveShadow = true
    const well = new Mesh(new RoundedBoxGeometry(12.3, 0.12, 8.9, 2, 0.2), this.kit.well)
    well.position.set(0, 0.02, 0)
    well.receiveShadow = true
    const platter = new Mesh(new CylinderGeometry(3.95, 3.95, 0.14, 96), this.kit.mirror)
    platter.position.set(CENTER.x, PLATTER_Y - 0.07, CENTER.z)
    platter.castShadow = true
    platter.receiveShadow = true
    const hub = new Mesh(new CylinderGeometry(0.78, 0.78, 0.34, 40), this.kit.steel)
    hub.position.set(CENTER.x, PLATTER_Y + 0.1, CENTER.z)
    const tracks = new Group()
    for (const radius of TRACKS) {
      const ring = new Mesh(new RingGeometry(radius - 0.012, radius + 0.012, 128), this.lineInk)
      ring.rotation.x = -Math.PI / 2
      tracks.add(ring)
    }
    tracks.position.set(CENTER.x, PLATTER_Y + 0.004, CENTER.z)

    this.sector = new Mesh(
      this.sectorGeometries[this.track] as RingGeometry,
      new MeshBasicMaterial({ color: this.accent, transparent: true, opacity: 0, side: DoubleSide }),
    )
    this.sector.rotation.x = -Math.PI / 2
    this.sectorHolder.add(this.sector)
    const notch = new Mesh(new BoxGeometry(0.5, 0.02, 0.07), this.notchInk)
    notch.position.set(3.6, 0.01, 0)
    this.spinner.add(this.sectorHolder, notch)
    this.spinner.position.set(CENTER.x, PLATTER_Y + 0.012, CENTER.z)

    const pivot = new Mesh(new CylinderGeometry(0.66, 0.66, 0.62, 36), this.kit.steel)
    pivot.position.set(PIVOT.x, 0.32, PIVOT.z)
    pivot.castShadow = true
    const armShape = new Shape()
    armShape.moveTo(-0.55, -0.5)
    armShape.lineTo(ARM, -0.13)
    armShape.lineTo(ARM, 0.13)
    armShape.lineTo(-0.55, 0.5)
    armShape.lineTo(-0.55, -0.5)
    const armMesh = new Mesh(new ExtrudeGeometry(armShape, { depth: 0.09, bevelEnabled: false }), this.kit.aluminum)
    armMesh.rotation.x = -Math.PI / 2
    armMesh.castShadow = true
    this.head = new Mesh(
      new BoxGeometry(0.46, 0.2, 0.36),
      new MeshStandardMaterial({ color: this.accent, metalness: 0.3, roughness: 0.4, emissive: this.accent, emissiveIntensity: 0.2 }),
    )
    this.head.position.set(ARM, -0.02, 0)
    this.arm.add(armMesh, this.head)
    this.arm.position.set(PIVOT.x, 0.5, PIVOT.z)

    this.bits = new InstancedMesh(new BoxGeometry(0.16, 0.16, 0.16), new MeshBasicMaterial({ color: this.accent }), 12)
    this.bits.frustumCulled = false
    this.seekPath = new LivePath(48, this.kit.ink)
    this.rotationArc = new LivePath(64, this.kit.ink)

    this.root.add(chassis, well, platter, hub, tracks, this.spinner, pivot, this.arm, this.bits, this.seekPath.line, this.rotationArc.line)

    this.label('platter', 'Platter, always spinning', new Vector3(CENTER.x - 2.2, PLATTER_Y + 0.2, CENTER.z - 4.3))
    this.label('arm', 'Actuator arm', new Vector3(PIVOT.x + 0.9, 0.8, PIVOT.z + 0.4), () => this.mode === 'idle')
    this.label('head', 'Read/write head', this.headLocal, () => this.mode === 'idle')
    this.label('seek', 'Seek path', this.seekLabel, () => this.phase === 'seek' || (this.mode === 'seek' && this.phase === 'pause'), 'strong')
    this.label('rotate', 'Rotation arc: the wait for the sector', this.arcLabel, () => this.phase === 'rotate', 'strong')
    this.label('transfer', 'Transfer', this.bitsLabel, () => this.phase === 'transfer', 'strong')
    this.label('ready', 'Data ready', this.bitsLabel, () => this.phase === 'ready', 'strong')
    this.label('scan', 'SCAN: one sweep, requests served in track order', new Vector3(CENTER.x - 2.2, PLATTER_Y + 0.2, CENTER.z + 4.4), () => this.mode === 'scheduling', 'strong')
  }

  applyPalette(ink: Color, dark: boolean): void {
    tintKit(this.kit, ink, dark)
    this.lineInk.color.copy(ink)
    this.lineInk.opacity = dark ? 0.4 : 0.32
    this.notchInk.color.copy(ink)
  }

  protected override onMode(mode: string): void {
    this.phaseTime = 0
    if (mode === 'idle') {
      this.setPhase('park')
      this.thetaFrom = this.theta
      this.thetaTo = armAngleFor(TRACKS[TRACKS.length - 1] as number)
      this.track = TRACKS.length - 1
    } else if (mode === 'rotate') {
      this.beginRotate()
    } else if (mode === 'transfer') {
      this.sectorAlpha = this.headAngle() - this.beta
      this.setPhase('transfer')
    } else if (mode === 'scheduling') {
      this.scanDirection = -1
      this.beginSeek(this.nextScanTrack())
    } else {
      this.beginSeek(this.randomTrack())
    }
  }

  private setPhase(phase: DiskPhase | 'park' | 'pause'): void {
    this.phase = phase
    this.phaseTime = 0
    this.onPhase(phase === 'park' || phase === 'pause' ? null : phase)
  }

  private randomTrack(): number {
    const options = TRACKS.map((_, index) => index).filter((index) => Math.abs(index - this.track) >= 2)
    return options[Math.floor(Math.random() * options.length)] ?? 0
  }

  private nextScanTrack(): number {
    let next = this.track + this.scanDirection
    if (next < 0 || next >= TRACKS.length) {
      this.scanDirection *= -1
      next = this.track + this.scanDirection
    }
    return clamp(next, 0, TRACKS.length - 1)
  }

  private beginSeek(track: number): void {
    this.thetaFrom = this.theta
    this.thetaTo = armAngleFor(TRACKS[track] as number)
    this.track = track
    const seekTime = this.mode === 'scheduling' ? 0.45 : SEEK_TIME
    const headAfter = this.headAngleFor(this.thetaTo)
    this.sectorAlpha = headAfter - (this.beta + OMEGA * seekTime) - 0.62 * TWO_PI
    this.setPhase('seek')
  }

  private beginRotate(): void {
    this.sectorAlpha = this.headAngle() - this.beta - 0.62 * TWO_PI
    this.setPhase('rotate')
  }

  private headPosition(theta: number, target: Vector3): Vector3 {
    return target.set(PIVOT.x + Math.cos(theta) * ARM, PLATTER_Y + 0.35, PIVOT.z + Math.sin(theta) * ARM)
  }

  private headAngleFor(theta: number): number {
    const x = PIVOT.x + Math.cos(theta) * ARM - CENTER.x
    const z = PIVOT.z + Math.sin(theta) * ARM - CENTER.z
    return Math.atan2(z, x)
  }

  private headAngle(): number {
    return this.headAngleFor(this.theta)
  }

  private remainingRotation(): number {
    return wrap(this.headAngle() - (this.sectorAlpha + this.beta))
  }

  protected animate(dt: number, time: number): void {
    this.beta += OMEGA * dt
    this.phaseTime += dt
    const seekTime = this.mode === 'scheduling' ? 0.45 : SEEK_TIME

    if (this.phase === 'seek' || this.phase === 'park') {
      const t = easeInOutCubic(clamp(this.phaseTime / seekTime, 0, 1))
      this.theta = lerp(this.thetaFrom, this.thetaTo, t)
      if (this.phase === 'seek' && this.phaseTime >= seekTime) {
        if (this.mode === 'seek' || this.mode === 'scheduling') this.setPhase('pause')
        else this.setPhase('rotate')
      }
    } else if (this.phase === 'rotate') {
      if (this.remainingRotation() < OMEGA * dt * 1.5 || this.remainingRotation() > TWO_PI - 0.02) {
        this.setPhase(this.mode === 'rotate' ? 'ready' : 'transfer')
      }
    } else if (this.phase === 'transfer') {
      this.sectorAlpha = this.headAngle() - this.beta
      if (this.mode !== 'transfer' && this.phaseTime >= TRANSFER_TIME) this.setPhase('ready')
    } else if (this.phase === 'ready') {
      if (this.phaseTime >= READY_TIME) this.setPhase('pause')
    } else if (this.phase === 'pause' && this.phaseTime >= PAUSE_TIME) {
      if (this.mode === 'rotate') this.beginRotate()
      else if (this.mode === 'scheduling') this.beginSeek(this.nextScanTrack())
      else if (this.mode === 'seek' || this.mode === 'cycle') this.beginSeek(this.randomTrack())
    }

    this.arm.rotation.y = -this.theta
    this.spinner.rotation.y = -this.beta
    const showSector = this.mode !== 'idle' && this.mode !== 'seek' && this.mode !== 'scheduling'
    this.sectorVisible = lerp(this.sectorVisible, showSector ? 1 : 0, 1 - Math.exp(-8 * dt))
    const radius = TRACKS[this.track] as number
    this.sector.geometry = this.sectorGeometries[this.track] as RingGeometry
    this.sectorHolder.rotation.y = -this.sectorAlpha
    const glow = this.phase === 'ready' || this.phase === 'transfer' ? 0.55 + 0.45 * Math.sin(time * 14) : 0
    this.sector.material.opacity = this.sectorVisible * (0.72 + 0.28 * glow)

    this.headPosition(this.theta, this.headLocal)
    this.headLocal.y += 0.45
    this.head.material.emissiveIntensity = 0.2 + glow * 0.8

    if (this.phase === 'seek') {
      const current = this.theta
      this.seekPath.arc(PIVOT.x, PIVOT.z, ARM, this.thetaFrom, current, PLATTER_Y + 0.55)
      const mid = (this.thetaFrom + current) / 2
      this.seekLabel.set(PIVOT.x + Math.cos(mid) * ARM, PLATTER_Y + 0.7, PIVOT.z + Math.sin(mid) * ARM)
    } else if (this.phase !== 'pause') {
      this.seekPath.hide()
    }

    if (this.phase === 'rotate') {
      const start = this.sectorAlpha + this.beta
      const end = start + this.remainingRotation()
      this.rotationArc.arc(CENTER.x, CENTER.z, radius, start, end, PLATTER_Y + 0.08)
      const mid = (start + end) / 2
      this.arcLabel.set(CENTER.x + Math.cos(mid) * (radius + 0.4), PLATTER_Y + 0.3, CENTER.z + Math.sin(mid) * (radius + 0.4))
    } else {
      this.rotationArc.hide()
    }

    this.bitsLabel.copy(this.headLocal).add(this.labelLift)
    const streaming = this.phase === 'transfer'
    for (let i = 0; i < 12; i += 1) {
      const progress = ((time * 1.6 + i / 12) % 1 + 1) % 1
      const scale = streaming ? Math.sin(progress * Math.PI) : 0
      this.matrix.makeScale(scale + 0.0001, scale + 0.0001, scale + 0.0001)
      this.matrix.setPosition(this.headLocal.x, this.headLocal.y - 0.2 + progress * 2.2, this.headLocal.z)
      this.bits.setMatrixAt(i, this.matrix)
    }
    this.bits.instanceMatrix.needsUpdate = true
  }
}
