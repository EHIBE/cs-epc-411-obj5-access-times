import {
  Fog,
  Group,
  NeutralToneMapping,
  PCFShadowMap,
  PMREMGenerator,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
  type Camera,
  type Texture,
} from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import type { ScenePalette } from './palette'

/** Owns the renderer, the scene graph roots, fog and the procedural studio environment used for PBR reflections. */
export class SceneManager {
  readonly renderer: WebGLRenderer
  readonly scene = new Scene()
  readonly instrument = new Group()
  readonly specimens = new Group()
  private environment: Texture | null = null
  private maxPixelRatio = Math.min(window.devicePixelRatio || 1, 2)

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(this.maxPixelRatio)
    this.renderer.outputColorSpace = SRGBColorSpace
    this.renderer.toneMapping = NeutralToneMapping
    this.renderer.toneMappingExposure = 1
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = PCFShadowMap
    this.scene.fog = new Fog(0xe6eaed, 110, 260)
    this.instrument.name = 'instrument'
    this.specimens.name = 'specimens'
    this.scene.add(this.instrument, this.specimens)
    const pmrem = new PMREMGenerator(this.renderer)
    this.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    pmrem.dispose()
    this.scene.environment = this.environment
    this.scene.environmentIntensity = 0.62
  }

  applyPalette(palette: ScenePalette): void {
    this.scene.background = palette.ground
    const fog = this.scene.fog
    if (fog instanceof Fog) fog.color.copy(palette.ground)
    this.scene.environmentIntensity = palette.dark ? 0.42 : 0.62
    this.renderer.toneMappingExposure = palette.dark ? 1.08 : 1
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
