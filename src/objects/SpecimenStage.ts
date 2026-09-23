import { Color, Group, Vector3 } from 'three'
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

/** Where each specimen is excavated: level with the tier it explains, to the right of the strata. */
export const SPECIMEN_POSITIONS: Record<SpecimenId, Vector3> = {
  die: new Vector3(34, 26.4, 0),
  hdd: new Vector3(34, 3.4, 0),
  trio: new Vector3(34, 3.9, 0),
  queues: new Vector3(34, 9.4, 0),
  optical: new Vector3(34, -0.2, 0),
  tape: new Vector3(34, -8.4, 0),
}

/** Holds every mechanism model and shows at most one at a time. */
export class SpecimenStage {
  readonly group = new Group()
  readonly die: DieSpecimen
  readonly hdd: HardDiskSpecimen
  readonly trio: SpindleTrioSpecimen
  readonly queues: QueueSpecimen
  readonly optical: OpticalSpecimen
  readonly tape: TapeSpecimen
  readonly all: Record<SpecimenId, Specimen>
  private current: SpecimenId | null = null

  constructor(palette: SpecimenPalette) {
    this.die = new DieSpecimen(palette.die)
    this.hdd = new HardDiskSpecimen(new Color(palette.hdd))
    this.trio = new SpindleTrioSpecimen(palette.trio.map((hex) => new Color(hex)))
    this.queues = new QueueSpecimen(new Color(palette.sata), new Color(palette.nvme))
    this.optical = new OpticalSpecimen(new Color(palette.optical), new Color(palette.hdd))
    this.tape = new TapeSpecimen(new Color(palette.tape))
    this.all = { die: this.die, hdd: this.hdd, trio: this.trio, queues: this.queues, optical: this.optical, tape: this.tape }
    for (const [id, specimen] of Object.entries(this.all) as [SpecimenId, Specimen][]) {
      specimen.group.position.copy(SPECIMEN_POSITIONS[id])
      this.group.add(specimen.group)
    }
  }

  get active(): SpecimenId | null {
    return this.current
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
  }

  update(dt: number): void {
    for (const specimen of Object.values(this.all)) specimen.update(dt)
  }
}
