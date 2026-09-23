import {
  BackSide,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Fog,
  Group,
  Mesh,
  MeshBasicMaterial,
  NeutralToneMapping,
  PCFShadowMap,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  WebGLRenderer,
  type Camera,
  type Texture,
} from 'three'
import type { ScenePalette } from './palette'

interface Softbox {
  width: number
  height: number
  radiance: number
  position: [number, number, number]
}

const SOFTBOXES: readonly Softbox[] = [
  { width: 26, height: 12, radiance: 3.4, position: [-3, 13, -6] },
  { width: 4, height: 16, radiance: 4.2, position: [-15, 5, -10] },
  { width: 3, height: 12, radiance: 2.6, position: [16, 4, -4] },
  { width: 14, height: 5, radiance: 0.9, position: [6, 1, 15] },
]

/** A procedural photo studio for image-based lighting: a graded grey sweep, one broad overhead softbox and three strips, so satin metal takes a wide sheen and a crisp chamfer highlight. */
function studio(): Scene {
  const room = new Scene()
  const sweep = new SphereGeometry(40, 48, 24)
  const position = sweep.getAttribute('position')
  const shades: number[] = []
  for (let i = 0; i < position.count; i += 1) {
    const height = position.getY(i) / 40
    const shade = height > 0 ? 0.34 + 0.3 * height : 0.34 + 0.24 * height
    shades.push(shade, shade, shade * 1.03)
  }
  sweep.setAttribute('color', new Float32BufferAttribute(shades, 3))
  room.add(new Mesh(sweep, new MeshBasicMaterial({ side: BackSide, vertexColors: true })))
  for (const box of SOFTBOXES) {
    const material = new MeshBasicMaterial({ side: DoubleSide })
    material.color.setScalar(box.radiance)
    const panel = new Mesh(new PlaneGeometry(box.width, box.height), material)
    panel.position.set(...box.position)
    panel.lookAt(0, 0, 0)
    room.add(panel)
  }
  return room
}

/** Owns the renderer, the scene graph roots, fog, and the studio environment every satin surface reflects. */
export class SceneManager {
  readonly renderer: WebGLRenderer
  readonly scene = new Scene()
  readonly instrument = new Group()
  readonly specimens = new Group()
  readonly maxAnisotropy: number
  private environment: Texture | null = null
  private maxPixelRatio = Math.min(window.devicePixelRatio || 1, 2)

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', logarithmicDepthBuffer: true })
    this.renderer.setPixelRatio(this.maxPixelRatio)
    this.renderer.outputColorSpace = SRGBColorSpace
    this.renderer.toneMapping = NeutralToneMapping
    this.renderer.toneMappingExposure = 1
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = PCFShadowMap
    this.maxAnisotropy = this.renderer.capabilities.getMaxAnisotropy()
    this.scene.fog = new Fog(0xe6eaed, 120, 280)
    this.instrument.name = 'instrument'
    this.specimens.name = 'specimens'
    this.scene.add(this.instrument, this.specimens)
    const pmrem = new PMREMGenerator(this.renderer)
    this.environment = pmrem.fromScene(studio(), 0.02).texture
    pmrem.dispose()
    this.scene.environment = this.environment
    this.scene.environmentIntensity = 0.7
  }

  applyPalette(palette: ScenePalette): void {
    this.scene.background = new Color(palette.ground)
    const fog = this.scene.fog
    if (fog instanceof Fog) fog.color.copy(palette.ground)
    this.scene.environmentIntensity = palette.dark ? 0.5 : 0.7
    this.renderer.toneMappingExposure = palette.dark ? 1.06 : 1
  }

  setSize(width: number, height: number): void {
    this.renderer.setSize(width, height, false)
  }

  /** Drops the pixel ratio when frames run long so weak projector laptops stay smooth. */
  degradeResolution(): boolean {
    if (this.maxPixelRatio <= 1) return false
    this.maxPixelRatio = Math.max(1, this.maxPixelRatio - 0.5)
    this.renderer.setPixelRatio(this.maxPixelRatio)
    return true
  }

  render(camera: Camera): void {
    this.renderer.render(this.scene, camera)
  }
}
