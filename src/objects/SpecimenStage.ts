import { BufferGeometry, Color, Float32BufferAttribute, Group, LineBasicMaterial, LineSegments, Vector3 } from 'three'
import { DieSpecimen, type DieColors } from './DieSpecimen'
import { HardDiskSpecimen } from './HardDiskSpecimen'
import { OpticalSpecimen } from './OpticalSpecimen'
import { QueueSpecimen } from './QueueSpecimen'
import type { Specimen } from './Specimen'
import { SpindleTrioSpecimen } from './SpindleTrioSpecimen'
import { TapeSpecimen } from './TapeSpecimen'

export type SpecimenId = 'die' | 'hdd' | 'trio' | 'queues' | 'optical' | 'tape'

export interface SpecimenPalette {
  die: DieColors
  hdd: string
  trio: [string, string, string]
  sata: string
  nvme: string
  optical: string
  tape: string
}

export interface SpecimenDetail {
  source: string
  title: string
  position: Vector3
}

/** Each mechanism is a detail drawn beside the stratum it explains: level with that layer, clear of every wider plate nearby, and joined to its source by one hairline leader. */
export const SPECIMEN_DETAILS: Record<SpecimenId, SpecimenDetail> = {
  die: { source: 'l1', title: 'Inside the processor', position: new Vector3(12.5, 26.6, 0) },
  hdd: { source: 'hdd-7200', title: 'Hard disk, 7,200 RPM', position: new Vector3(22.5, 3.4, 0) },
  trio: { source: 'hdd-7200', title: 'Three spindle speeds', position: new Vector3(26.5, 3.9, 0) },
  queues: { source: 'sata', title: 'SATA and NVMe queues', position: new Vector3(20, 9.4, 0) },
  optical: { source: 'optical', title: 'Optical disc and hard disk tracks', position: new Vector3(25.5, -0.2, 0) },
  tape: { source: 'tape', title: 'Tape library and drive', position: new Vector3(27, -8.4, 0) },
}

/** Holds every mechanism model, shows at most one at a time, and draws the leader from its stratum to the detail. */
export class SpecimenStage {
  readonly group = new Group()
  readonly die: DieSpecimen
  readonly hdd: HardDiskSpecimen
  readonly trio: SpindleTrioSpecimen
  readonly queues: QueueSpecimen
  readonly optical: OpticalSpecimen
  readonly tape: TapeSpecimen
  readonly all: Record<SpecimenId, Specimen>
  readonly leaderStart = new Vector3()
  readonly leaderMid = new Vector3()
  private readonly leader: LineSegments<BufferGeometry, LineBasicMaterial>
  private readonly positions = new Float32Array(12)
  private readonly anchorOf: (id: string, target: Vector3) => Vector3 | null
  private readonly start = new Vector3()
  private readonly end = new Vector3()
  private current: SpecimenId | null = null
  private leaderAmount = 0

  constructor(palette: SpecimenPalette, anchorOf: (id: string, target: Vector3) => Vector3 | null) {
    this.anchorOf = anchorOf
    this.die = new DieSpecimen(palette.die)
    this.hdd = new HardDiskSpecimen(new Color(palette.hdd))
    this.trio = new SpindleTrioSpecimen(palette.trio.map((hex) => new Color(hex)))
    this.queues = new QueueSpecimen(new Color(palette.sata), new Color(palette.nvme))
    this.optical = new OpticalSpecimen(new Color(palette.optical), new Color(palette.hdd))
    this.tape = new TapeSpecimen(new Color(palette.tape))
    this.all = { die: this.die, hdd: this.hdd, trio: this.trio, queues: this.queues, optical: this.optical, tape: this.tape }
    for (const [id, specimen] of Object.entries(this.all) as [SpecimenId, Specimen][]) {
      specimen.group.position.copy(SPECIMEN_DETAILS[id].position)
      this.group.add(specimen.group)
    }
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute(this.positions, 3))
    this.leader = new LineSegments(geometry, new LineBasicMaterial({ color: 0x26303a, transparent: true, opacity: 0 }))
    this.leader.frustumCulled = false
    this.leader.visible = false
    this.group.add(this.leader)
  }

  get active(): SpecimenId | null {
    return this.current
  }

  /** How far the active detail and its leader have appeared, from 0 to 1. */
  get detailAmount(): number {
    return this.leaderAmount
  }

  show(id: SpecimenId | null, mode = 'idle'): void {
    this.current = id
    for (const [key, specimen] of Object.entries(this.all) as [SpecimenId, Specimen][]) {
      const visible = key === id
      specimen.show(visible)
      if (visible) specimen.setMode(mode)
    }
  }

  applyPalette(ink: Color, dark: boolean): void {
    for (const specimen of Object.values(this.all)) specimen.applyPalette(ink, dark)
    this.leader.material.color.copy(ink)
  }

  /** Routes the leader from the source stratum's right edge, out along a short shoulder, then across to the model's dock. */
  private routeLeader(): void {
    const id = this.current
    const specimen = id ? this.all[id] : null
    this.leaderAmount = specimen ? specimen.visibleAmount : 0
    if (!id || !specimen || this.leaderAmount < 0.05 || !this.anchorOf(SPECIMEN_DETAILS[id].source, this.start)) {
      this.leader.visible = false
      return
    }
    this.leaderStart.copy(this.start)
    specimen.dockPoint(this.end)
    this.group.worldToLocal(this.start)
    this.group.worldToLocal(this.end)
    const kneeX = this.start.x + 1.4
    const points = [this.start.x, this.start.y, this.start.z, kneeX, this.start.y, this.start.z, kneeX, this.start.y, this.start.z, this.end.x, this.end.y, this.end.z]
    this.positions.set(points)
    this.leader.geometry.getAttribute('position').needsUpdate = true
    this.leaderMid.set((kneeX + this.end.x) / 2, (this.start.y + this.end.y) / 2, (this.start.z + this.end.z) / 2)
    this.group.localToWorld(this.leaderMid)
    this.leader.material.opacity = 0.85 * this.leaderAmount
    this.leader.visible = true
  }

  update(dt: number): void {
    for (const specimen of Object.values(this.all)) specimen.update(dt)
    this.routeLeader()
  }
}
