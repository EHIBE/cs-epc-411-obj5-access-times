import { DirectionalLight, HemisphereLight, type Scene } from 'three'
import type { ScenePalette } from './palette'

/** A key light that casts the floor shadow, a cool rim from behind, and a hemisphere fill tinted by the ground. */
export class Lighting {
  readonly key = new DirectionalLight(0xffffff, 1.0)
  readonly rim = new DirectionalLight(0xdfe9f2, 0.55)
  readonly fill = new HemisphereLight(0xffffff, 0xe6eaed, 1.05)

  constructor(scene: Scene) {
    this.key.position.set(10, 96, 22)
    this.key.target.position.set(-2, 8, 0)
    this.key.castShadow = true
    this.key.shadow.mapSize.set(2048, 2048)
    this.key.shadow.radius = 10
    this.key.shadow.bias = -0.0004
    this.key.shadow.normalBias = 0.03
    const shadowCamera = this.key.shadow.camera
    shadowCamera.left = -40
    shadowCamera.right = 44
    shadowCamera.top = 40
    shadowCamera.bottom = -40
    shadowCamera.near = 20
    shadowCamera.far = 180
    shadowCamera.updateProjectionMatrix()
    this.rim.position.set(-34, 46, -48)
    this.rim.target.position.set(0, 8, 0)
    scene.add(this.key, this.key.target, this.rim, this.rim.target, this.fill)
  }

  applyPalette(palette: ScenePalette): void {
    this.fill.color.copy(palette.sky)
    this.fill.groundColor.copy(palette.ground)
    this.fill.intensity = palette.dark ? 0.7 : 1.05
    this.key.intensity = palette.dark ? 1.15 : 1.0
    this.rim.intensity = palette.dark ? 0.9 : 0.55
  }
}
