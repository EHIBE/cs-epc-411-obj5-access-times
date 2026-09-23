import {
  CanvasTexture,
  LinearMipmapLinearFilter,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  ShadowMaterial,
  SRGBColorSpace,
  type Scene,
} from 'three'
import { AXIS } from '../utils/scale'
import type { ScenePalette } from './palette'

const SHEET = { minX: -40, maxX: 52, minZ: -34, maxZ: 30 } as const
const WIDTH = SHEET.maxX - SHEET.minX
const DEPTH = SHEET.maxZ - SHEET.minZ
const PIXELS = 2048
const SCALE = PIXELS / WIDTH
const MINOR = AXIS.unitsPerDecade / 5
const MAJOR = AXIS.unitsPerDecade
const NEAT = 1.6
const INNER = 2.15
const FONT = '"Archivo Variable", Archivo, system-ui, sans-serif'

/** Paper fibre as a small tile of grey noise, drawn once and repeated across the sheet at a whisper of opacity. */
function grainTile(): HTMLCanvasElement {
  const tile = document.createElement('canvas')
  tile.width = 128
  tile.height = 128
  const context = tile.getContext('2d')
  if (!context) return tile
  const image = context.createImageData(128, 128)
  let seed = 7
  for (let i = 0; i < image.data.length; i += 4) {
    seed = (seed * 16807) % 2147483647
    const value = 96 + (seed % 64)
    image.data[i] = value
    image.data[i + 1] = value
    image.data[i + 2] = value
    image.data[i + 3] = 255
  }
  context.putImageData(image, 0, 0)
  return tile
}

/** The survey sheet under the section: printed minor and major ruling on the decade module, a double neat line with a graduated border, and a title block with a bar scale. */
export class Environment {
  private readonly sheet: Mesh<PlaneGeometry, MeshBasicMaterial>
  private readonly shadow: Mesh<PlaneGeometry, ShadowMaterial>
  private readonly maxAnisotropy: number
  private canvas: HTMLCanvasElement | null = null
  private texture: CanvasTexture | null = null
  private grain: HTMLCanvasElement | null = null

  constructor(scene: Scene, maxAnisotropy: number) {
    this.maxAnisotropy = maxAnisotropy
    const centerX = (SHEET.minX + SHEET.maxX) / 2
    const centerZ = (SHEET.minZ + SHEET.maxZ) / 2
    this.sheet = new Mesh(new PlaneGeometry(WIDTH, DEPTH), new MeshBasicMaterial({ color: 0xffffff, toneMapped: false }))
    this.sheet.rotation.x = -Math.PI / 2
    this.sheet.position.set(centerX, AXIS.floorY, centerZ)
    this.shadow = new Mesh(new PlaneGeometry(WIDTH, DEPTH), new ShadowMaterial({ opacity: 0.14 }))
    this.shadow.rotation.x = -Math.PI / 2
    this.shadow.position.set(centerX, AXIS.floorY + 0.01, centerZ)
    this.shadow.receiveShadow = true
    scene.add(this.sheet, this.shadow)
  }

  /** Prints the sheet for the active theme; the canvas is created on first use and reprinted in place after that. */
  applyPalette(palette: ScenePalette): void {
    if (!this.canvas) {
      this.canvas = document.createElement('canvas')
      this.canvas.width = PIXELS
      this.canvas.height = Math.round(DEPTH * SCALE)
      this.grain = grainTile()
      this.texture = new CanvasTexture(this.canvas)
      this.texture.colorSpace = SRGBColorSpace
      this.texture.anisotropy = this.maxAnisotropy
      this.texture.minFilter = LinearMipmapLinearFilter
      this.sheet.material.map = this.texture
      this.sheet.material.needsUpdate = true
    }
    this.print(palette)
    if (this.texture) this.texture.needsUpdate = true
    this.shadow.material.color.set(palette.dark ? 0x02060a : palette.inkHex)
    this.shadow.material.opacity = palette.shadowOpacity
  }

  private print(palette: ScenePalette): void {
    const canvas = this.canvas
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    const px = (x: number): number => (x - SHEET.minX) * SCALE
    const pz = (z: number): number => (z - SHEET.minZ) * SCALE
    context.setTransform(1, 0, 0, 1, 0, 0)
    context.globalAlpha = 1
    context.fillStyle = palette.paperHex
    context.fillRect(0, 0, canvas.width, canvas.height)
    if (this.grain) {
      const pattern = context.createPattern(this.grain, 'repeat')
      if (pattern) {
        context.globalAlpha = palette.dark ? 0.05 : 0.035
        context.fillStyle = pattern
        context.fillRect(0, 0, canvas.width, canvas.height)
        context.globalAlpha = 1
      }
    }

    const left = SHEET.minX + INNER
    const right = SHEET.maxX - INNER
    const far = SHEET.minZ + INNER
    const near = SHEET.maxZ - INNER
    const line = (x1: number, z1: number, x2: number, z2: number): void => {
      context.beginPath()
      context.moveTo(px(x1), pz(z1))
      context.lineTo(px(x2), pz(z2))
      context.stroke()
    }
    for (const [step, color, width] of [
      [MINOR, palette.ruleMinorHex, 1],
      [MAJOR, palette.ruleMajorHex, 1.6],
    ] as const) {
      context.strokeStyle = color
      context.lineWidth = width
      for (let x = Math.ceil(left / step) * step; x <= right; x += step) line(x, far, x, near)
      for (let z = Math.ceil(far / step) * step; z <= near; z += step) line(left, z, right, z)
    }

    context.strokeStyle = palette.inkHex
    context.fillStyle = palette.inkHex
    context.globalAlpha = 0.7
    context.lineWidth = 2.4
    context.strokeRect(px(SHEET.minX + NEAT), pz(SHEET.minZ + NEAT), (WIDTH - NEAT * 2) * SCALE, (DEPTH - NEAT * 2) * SCALE)
    context.lineWidth = 1.2
    context.strokeRect(px(left), pz(far), (right - left) * SCALE, (near - far) * SCALE)
    const band = (INNER - NEAT) * SCALE
    context.globalAlpha = 0.42
    for (let x = left, index = 0; x < right; x += MAJOR, index += 1) {
      if (index % 2 !== 0) continue
      const span = Math.min(MAJOR, right - x) * SCALE
      context.fillRect(px(x), pz(SHEET.minZ + NEAT), span, band)
      context.fillRect(px(x), pz(near), span, band)
    }
    for (let z = far, index = 0; z < near; z += MAJOR, index += 1) {
      if (index % 2 !== 0) continue
      const span = Math.min(MAJOR, near - z) * SCALE
      context.fillRect(px(SHEET.minX + NEAT), pz(z), band, span)
      context.fillRect(px(right), pz(z), band, span)
    }
    this.printTitleBlock(context, px, pz, right, near, palette)
    context.globalAlpha = 1
  }

  /** The title block in the near right corner: what the drawing is, its vertical scale as a bar, and where the figures come from. */
  private printTitleBlock(
    context: CanvasRenderingContext2D,
    px: (x: number) => number,
    pz: (z: number) => number,
    right: number,
    near: number,
    palette: ScenePalette,
  ): void {
    const width = 30
    const height = 10.2
    const x0 = right - width
    const z0 = near - height
    context.globalAlpha = 1
    context.fillStyle = palette.paperHex
    context.fillRect(px(x0), pz(z0), width * SCALE, height * SCALE)
    context.globalAlpha = 0.85
    context.strokeStyle = palette.inkHex
    context.lineWidth = 1.2
    context.strokeRect(px(x0), pz(z0), width * SCALE, height * SCALE)
    const rows = [z0 + 3.4, z0 + 6.8]
    for (const z of rows) {
      context.beginPath()
      context.moveTo(px(x0), pz(z))
      context.lineTo(px(right), pz(z))
      context.stroke()
    }
    context.fillStyle = palette.inkHex
    context.textBaseline = 'alphabetic'
    const text = (value: string, x: number, z: number, size: number, weight: number, stretch: CanvasFontStretch): void => {
      context.font = `${weight} ${Math.round(size * SCALE)}px ${FONT}`
      context.fontStretch = stretch
      context.fillText(value, px(x), pz(z))
    }
    text('Access times, registers to tape', x0 + 1, z0 + 2.35, 1.35, 760, 'semi-expanded')
    text('Section through the storage hierarchy: the 16 devices of Section D', x0 + 1, z0 + 5.45, 0.78, 520, 'semi-condensed')
    text('Objective #5, Lesson 2, Device Management', x0 + 1, z0 + 6.25, 0.62, 480, 'semi-condensed')
    text('Vertical scale, logarithmic', x0 + 1, z0 + 8.35, 0.7, 620, 'semi-condensed')
    const barX = x0 + 13.4
    const barZ = z0 + 7.7
    for (let index = 0; index < 4; index += 1) {
      const bx = barX + index * MAJOR
      if (index % 2 === 0) context.fillRect(px(bx), pz(barZ), MAJOR * SCALE, 0.55 * SCALE)
      else context.strokeRect(px(bx), pz(barZ), MAJOR * SCALE, 0.55 * SCALE)
    }
    text('each block is one power of ten', barX, barZ + 1.75, 0.6, 480, 'semi-condensed')
  }
}
