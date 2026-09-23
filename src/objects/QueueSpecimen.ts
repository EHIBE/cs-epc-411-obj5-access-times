import {
  BoxGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Vector3,
  type Color,
} from 'three'
import { createKit, Specimen, tintKit, type SpecimenKit } from './Specimen'

const SATA_COMMANDS = 32
const NVME_LANES = 64
const NVME_DEPTH = 64
const LANE_LENGTH = 8.2
const IOPS_UNIT = 1.7
const SATA_Z = 4.8
const NVME_Z = -1.2

/** SATA's single 32-command queue beside a 64 by 64 field standing in for NVMe's 64,000 queues of 64,000 commands, with IOPS ceilings to scale. */
export class QueueSpecimen extends Specimen {
  private readonly kit: SpecimenKit = createKit()
  private readonly sata: InstancedMesh<BoxGeometry, MeshStandardMaterial>
  private readonly nvme: InstancedMesh<BoxGeometry, MeshStandardMaterial>
  private readonly matrix = new Matrix4()
  private readonly sataGate: Mesh<BoxGeometry, MeshBasicMaterial>
  private readonly nvmeGate: Mesh<BoxGeometry, MeshBasicMaterial>
  private readonly inkMaterial = new MeshBasicMaterial({ color: 0x26303a })
  private sataPhase = 0
  private nvmePhase = 0

  constructor(sataColor: Color, nvmeColor: Color) {
    super()
    const sataRail = new Mesh(new BoxGeometry(LANE_LENGTH + 0.4, 0.06, 0.5), this.kit.well)
    sataRail.position.set(-3.4, 0.0, SATA_Z)
    const nvmeRail = new Mesh(new BoxGeometry(LANE_LENGTH + 0.4, 0.06, 8.6), this.kit.well)
    nvmeRail.position.set(-3.4, 0.0, NVME_Z)
    this.sata = new InstancedMesh(
      new BoxGeometry(0.2, 0.2, 0.3),
      new MeshStandardMaterial({ color: sataColor, metalness: 0.3, roughness: 0.4 }),
      SATA_COMMANDS,
    )
    this.nvme = new InstancedMesh(
      new BoxGeometry(0.1, 0.1, 0.1),
      new MeshStandardMaterial({ color: nvmeColor, metalness: 0.3, roughness: 0.4 }),
      NVME_LANES * NVME_DEPTH,
    )
    this.sata.castShadow = true
    this.sata.frustumCulled = false
    this.nvme.frustumCulled = false
    this.sataGate = new Mesh(new BoxGeometry(0.12, 0.7, 0.9), this.inkMaterial)
    this.sataGate.position.set(-3.4 + LANE_LENGTH / 2 + 0.35, 0.3, SATA_Z)
    this.nvmeGate = new Mesh(new BoxGeometry(0.12, 0.7, 8.8), this.inkMaterial)
    this.nvmeGate.position.set(-3.4 + LANE_LENGTH / 2 + 0.35, 0.3, NVME_Z)

    const sataBar = new Mesh(
      new BoxGeometry(1.1, IOPS_UNIT, 1.1),
      new MeshStandardMaterial({ color: sataColor, metalness: 0.3, roughness: 0.4 }),
    )
    sataBar.position.set(4.4, IOPS_UNIT / 2, SATA_Z)
    const nvmeBar = new Mesh(
      new BoxGeometry(1.1, IOPS_UNIT * 5, 1.1),
      new MeshStandardMaterial({ color: nvmeColor, metalness: 0.3, roughness: 0.4 }),
    )
    nvmeBar.position.set(6.8, (IOPS_UNIT * 5) / 2, NVME_Z)
    const pastMark = new Mesh(new BoxGeometry(0.08, 1.1, 0.08), this.inkMaterial)
    pastMark.position.set(6.8, IOPS_UNIT * 5 + 0.85, NVME_Z)
    const pastCap = new Mesh(new BoxGeometry(0.7, 0.08, 0.08), this.inkMaterial)
    pastCap.position.set(6.8, IOPS_UNIT * 5 + 0.04, NVME_Z)
    for (const bar of [sataBar, nvmeBar]) bar.castShadow = true

    this.root.add(sataRail, nvmeRail, this.sata, this.nvme, this.sataGate, this.nvmeGate, sataBar, nvmeBar, pastMark, pastCap)
    this.detailSheet(this.kit, { minX: -8.6, maxX: 11.2, minZ: -6.2, maxZ: 8.6, y: -0.035, titleWidth: 7.6 })
    this.inkEdges(this.kit)
    this.label('sata', 'SATA (AHCI): one queue of 32 commands', new Vector3(-3.4, 0.03, SATA_Z), () => true, 'strong')
    this.label('nvme', 'NVMe: up to 64,000 queues of 64,000 commands (64 by 64 drawn)', new Vector3(-3.4, 0.08, NVME_Z - 3.2), () => true, 'strong')
    this.label('sata-iops', 'about 200,000 IOPS', new Vector3(4.4, IOPS_UNIT, SATA_Z))
    this.label('nvme-iops', 'past 1,000,000 IOPS', new Vector3(6.8, IOPS_UNIT * 5 + 1.4, NVME_Z))
    this.label('seq', 'Rated around 7,450 MB/s sequential read (NVMe)', new Vector3(7.35, IOPS_UNIT * 3, NVME_Z), () => this.mode === 'protocol', 'strong')
  }

  applyPalette(ink: Color, dark: boolean): void {
    tintKit(this.kit, ink, dark)
    this.inkMaterial.color.copy(ink)
  }

  protected animate(dt: number, time: number): void {
    this.sataPhase += dt * 2.2
    this.nvmePhase += dt * 2.2
    const sataStep = LANE_LENGTH / SATA_COMMANDS
    const sataShift = (this.sataPhase % 1) * sataStep
    for (let i = 0; i < SATA_COMMANDS; i += 1) {
      const x = -3.4 - LANE_LENGTH / 2 + i * sataStep + sataShift
      const exiting = i === SATA_COMMANDS - 1 ? 1 - (this.sataPhase % 1) : 1
      this.matrix.makeScale(exiting, exiting, exiting)
      this.matrix.setPosition(x, 0.14, SATA_Z)
      this.sata.setMatrixAt(i, this.matrix)
    }
    this.sata.instanceMatrix.needsUpdate = true
    const nvmeStep = LANE_LENGTH / NVME_DEPTH
    const nvmeShift = (this.nvmePhase % 1) * nvmeStep
    const laneGap = 8.4 / NVME_LANES
    let index = 0
    for (let lane = 0; lane < NVME_LANES; lane += 1) {
      const z = NVME_Z - 4.2 + lane * laneGap + laneGap / 2
      for (let slot = 0; slot < NVME_DEPTH; slot += 1) {
        const x = -3.4 - LANE_LENGTH / 2 + slot * nvmeStep + nvmeShift
        const exiting = slot === NVME_DEPTH - 1 ? 1 - (this.nvmePhase % 1) : 1
        this.matrix.makeScale(exiting, exiting, exiting)
        this.matrix.setPosition(x, 0.09, z)
        this.nvme.setMatrixAt(index, this.matrix)
        index += 1
      }
    }
    this.nvme.instanceMatrix.needsUpdate = true
    const pulse = 0.5 + 0.5 * Math.sin(time * 2.2 * Math.PI * 2)
    this.sataGate.scale.y = 0.8 + 0.2 * pulse
    this.nvmeGate.scale.y = 0.8 + 0.2 * pulse
  }
}

