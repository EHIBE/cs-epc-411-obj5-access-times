import {
  BoxGeometry,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Line,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  RingGeometry,
  SphereGeometry,
  Vector3,
} from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { clamp, easeInOutCubic, lerp } from '../utils/math'
import { createKit, Specimen, tintKit, type SpecimenKit } from './Specimen'

const DISC_X = -4.6
const PLATTER_X = 4.6
const INNER = 0.95
const OUTER = 2.85
const TURNS = 9
const GROWTH = (OUTER - INNER) / (TURNS * Math.PI * 2)
const TRACK_RADII = [1.1, 1.4, 1.7, 2.0, 2.3, 2.6]
const FOLLOW_SPEED = 3.2

const spiralPoint = (theta: number, target: Vector3): Vector3 =>
  target.set(Math.cos(theta) * (INNER + GROWTH * theta), 0, Math.sin(theta) * (INNER + GROWTH * theta))

/** An optical disc's single spiral beside a hard disk's concentric tracks: the laser jumps and then must follow the spiral, the head just moves. */
export class OpticalSpecimen extends Specimen {
  private readonly kit: SpecimenKit = createKit()
  private readonly laser: Mesh<SphereGeometry, MeshBasicMaterial>
  private readonly beam: Mesh<CylinderGeometry, MeshBasicMaterial>
  private readonly head: Mesh<BoxGeometry, MeshBasicMaterial>
  private readonly lineInk = new MeshBasicMaterial({ color: 0x26303a, transparent: true, opacity: 0.3, side: DoubleSide })
  private phase: 'follow' | 'jump' | 'search' = 'follow'
  private phaseTime = 0
  private laserTheta = 4
  private jumpFrom = new Vector3()
  private jumpTo = new Vector3()
  private searchTarget = 30
  private headFrom = 1
  private headTo = 4
  private headTime = 0
  private readonly point = new Vector3()
  private readonly laserLabel = new Vector3()

  constructor(opticalColor: Color, diskColor: Color) {
    super()
    const base = new Mesh(new RoundedBoxGeometry(19, 0.4, 8.6, 3, 0.24), this.kit.aluminum)
    base.position.set(0, -0.3, 0)
    base.receiveShadow = true
    base.castShadow = true
    const disc = new Mesh(
      new CylinderGeometry(3.05, 3.05, 0.08, 96),
      new MeshStandardMaterial({ color: opticalColor.clone().lerp(new Color(0xe8edf1), 0.72), metalness: 0.85, roughness: 0.16 }),
    )
    disc.position.set(DISC_X, 0.04, 0)
    disc.castShadow = true
    const hole = new Mesh(new CylinderGeometry(0.42, 0.42, 0.1, 32), this.kit.well)
    hole.position.set(DISC_X, 0.05, 0)
    const points: number[] = []
    for (let i = 0; i <= TURNS * 160; i += 1) {
      spiralPoint((i / 160) * Math.PI * 2, this.point)
      points.push(DISC_X + this.point.x, 0.1, this.point.z)
    }
    const spiralGeometry = new BufferGeometry()
    spiralGeometry.setAttribute('position', new Float32BufferAttribute(points, 3))
    const spiral = new Line(spiralGeometry, this.kit.faint)
    this.laser = new Mesh(new SphereGeometry(0.17, 16, 12), new MeshBasicMaterial({ color: opticalColor }))
    this.beam = new Mesh(
      new CylinderGeometry(0.04, 0.04, 1.6, 8),
      new MeshBasicMaterial({ color: opticalColor, transparent: true, opacity: 0.6 }),
    )
    const platter = new Mesh(new CylinderGeometry(3.05, 3.05, 0.1, 96), this.kit.mirror)
    platter.position.set(PLATTER_X, 0.05, 0)
    platter.castShadow = true
    for (const radius of TRACK_RADII) {
      const ring = new Mesh(new RingGeometry(radius - 0.014, radius + 0.014, 128), this.lineInk)
      ring.rotation.x = -Math.PI / 2
      ring.position.set(PLATTER_X, 0.105, 0)
      this.root.add(ring)
    }
    this.head = new Mesh(new BoxGeometry(0.3, 0.2, 0.4), new MeshBasicMaterial({ color: diskColor }))
    this.root.add(base, disc, hole, spiral, this.laser, this.beam, platter, this.head)
    this.label('optical', 'Optical disc: one spiral track, center outward', new Vector3(DISC_X, 0.4, 3.9), () => true, 'strong')
    this.label('disk', 'Hard disk: concentric tracks', new Vector3(PLATTER_X, 0.4, 3.9), () => true, 'strong')
    this.label('jump', 'The laser jumps, then follows the spiral to the data', this.laserLabel, () => this.phase !== 'follow')
  }

  applyPalette(ink: Color, dark: boolean): void {
    tintKit(this.kit, ink, dark)
    this.lineInk.color.copy(ink)
  }

  protected animate(dt: number, time: number): void {
    this.phaseTime += dt
    if (this.phase === 'follow') {
      this.laserTheta += dt * FOLLOW_SPEED
      spiralPoint(this.laserTheta, this.point)
      if (this.phaseTime > 1.4) {
        const far = this.laserTheta > TURNS * Math.PI ? 3 + Math.random() * 6 : TURNS * Math.PI * 1.55 + Math.random() * 6
        this.searchTarget = far
        this.jumpFrom.copy(this.point)
        spiralPoint(far - 5, this.jumpTo)
        this.phase = 'jump'
        this.phaseTime = 0
      }
    } else if (this.phase === 'jump') {
      const t = easeInOutCubic(clamp(this.phaseTime / 0.7, 0, 1))
      this.point.lerpVectors(this.jumpFrom, this.jumpTo, t)
      if (this.phaseTime > 0.7) {
        this.laserTheta = this.searchTarget - 5
        this.phase = 'search'
        this.phaseTime = 0
      }
    } else {
      this.laserTheta += dt * FOLLOW_SPEED
      spiralPoint(this.laserTheta, this.point)
      if (this.laserTheta >= this.searchTarget) {
        this.phase = 'follow'
        this.phaseTime = 0
      }
    }
    this.laser.position.set(DISC_X + this.point.x, 0.2, this.point.z)
    this.beam.position.set(DISC_X + this.point.x, -0.6, this.point.z)
    this.beam.material.opacity = 0.35 + 0.25 * Math.sin(time * 20)
    this.laserLabel.set(DISC_X + this.point.x, 1.1, this.point.z)

    this.headTime += dt
    if (this.headTime > 1.3) {
      this.headTime = 0
      this.headFrom = this.headTo
      this.headTo = Math.floor(Math.random() * TRACK_RADII.length)
    }
    const move = easeInOutCubic(clamp(this.headTime / 0.35, 0, 1))
    const radius = lerp(TRACK_RADII[this.headFrom] ?? 1.1, TRACK_RADII[this.headTo] ?? 1.1, move)
    this.head.position.set(PLATTER_X, 0.25, -radius)
  }
}
