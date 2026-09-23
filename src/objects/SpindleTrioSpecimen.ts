import {
  BoxGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  RingGeometry,
  Vector3,
  type Color,
} from 'three'
import { createKit, Specimen, tintKit, type SpecimenKit } from './Specimen'

export const SLOWDOWN = 500

/** Spindle speeds and averages exactly as Slide 5 gives them; rotation time is the fact sheet's own 60 / RPM formula. */
export const SPINDLES: readonly { rpm: number; label: string; average: string }[] = [
  { rpm: 5400, label: '5,400 RPM', average: 'about 5.6 ms average' },
  { rpm: 7200, label: '7,200 RPM', average: 'about 4.16 ms average' },
  { rpm: 15000, label: '15,000 RPM', average: 'about 2.0 ms average' },
]

/** Three platters spinning in true ratio, 500 times slower than life, each passing a fixed head once per turn. */
export class SpindleTrioSpecimen extends Specimen {
  private readonly kit: SpecimenKit = createKit()
  private readonly spinners: { group: Group; omega: number; marker: Mesh<RingGeometry, MeshBasicMaterial>; angle: number }[] = []
  private readonly headInk = new MeshBasicMaterial({ color: 0x26303a })
  private readonly trackInk = new MeshBasicMaterial({ color: 0x26303a, transparent: true, opacity: 0.3, side: DoubleSide })

  constructor(accents: Color[]) {
    super()
    SPINDLES.forEach((spindle, index) => {
      const x = (index - 1) * 6.7
      const platter = new Mesh(new CylinderGeometry(2.55, 2.55, 0.12, 80), this.kit.mirror)
      platter.position.set(x, 0.06, 0)
      platter.castShadow = true
      const hub = new Mesh(new CylinderGeometry(0.5, 0.5, 0.28, 32), this.kit.steel)
      hub.position.set(x, 0.18, 0)
      for (const radius of [1.1, 1.6, 2.1]) {
        const ring = new Mesh(new RingGeometry(radius - 0.012, radius + 0.012, 96), this.trackInk)
        ring.rotation.x = -Math.PI / 2
        ring.position.set(x, 0.125, 0)
        ring.userData.noEdges = true
        this.root.add(ring)
      }
      const group = new Group()
      group.position.set(x, 0.13, 0)
      const accent = accents[index] ?? accents[0]
      const marker = new Mesh(
        new RingGeometry(0.75, 2.45, 24, 1, -0.2, 0.4),
        new MeshBasicMaterial({ color: accent?.clone(), transparent: true, opacity: 0.85, side: DoubleSide }),
      )
      marker.rotation.x = -Math.PI / 2
      marker.userData.noEdges = true
      group.add(marker)
      const head = new Mesh(new BoxGeometry(0.16, 0.16, 1.2), this.headInk)
      head.position.set(x, 0.3, -2.1)
      this.root.add(platter, hub, group, head)
      const omega = ((spindle.rpm / 60) * Math.PI * 2) / SLOWDOWN
      this.spinners.push({ group, omega, marker, angle: index * 1.3 })
      this.label(`rpm:${spindle.rpm}`, `${spindle.label}, ${spindle.average}`, new Vector3(x, 0.12, 2.55), () => true, 'strong')
    })
    this.detailSheet(this.kit, { minX: -10.2, maxX: 10.2, minZ: -3.6, maxZ: 5.6, y: -0.01, titleWidth: 7.4 })
    this.inkEdges(this.kit)
  }

  applyPalette(ink: Color, dark: boolean): void {
    tintKit(this.kit, ink, dark)
    this.headInk.color.copy(ink)
    this.trackInk.color.copy(ink)
  }

  protected animate(dt: number, time: number): void {
    for (const spinner of this.spinners) {
      spinner.angle += spinner.omega * dt
      spinner.group.rotation.y = -spinner.angle
      const facing = Math.cos(spinner.angle + Math.PI / 2)
      spinner.marker.material.opacity = 0.62 + 0.38 * Math.max(0, facing) ** 8 + 0.02 * Math.sin(time)
    }
  }
}
