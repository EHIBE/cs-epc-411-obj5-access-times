import { MOUSE, PerspectiveCamera, Spherical, TOUCH, Vector3 } from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { angleDelta, clamp, easeInOutCubic, lerp, Spring } from '../utils/math'

export interface Shot {
  position: readonly [number, number, number]
  target: readonly [number, number, number]
}

export const INITIAL_SHOT: Shot = { position: [30, 40, 50], target: [0, 10, 0] }

interface Flight {
  elapsed: number
  duration: number
  fromTarget: Vector3
  toTarget: Vector3
  from: Spherical
  to: Spherical
}

/** The pinned 75-degree camera with orbit controls, arced flights between shots, and a projection offset that recentres the scene beside the panels. */
export class CameraRig {
  readonly camera: PerspectiveCamera
  readonly controls: OrbitControls
  private flight: Flight | null = null
  private readonly shift = new Spring(0, 70, 17)
  private readonly lift = new Spring(0, 70, 17)
  private readonly zoom = new Spring(1, 70, 17)
  private width = 1
  private height = 1
  private autoOrbit = false
  private userHandlers = new Set<() => void>()
  private readonly scratch = new Vector3()

  constructor(domElement: HTMLElement) {
    this.camera = new PerspectiveCamera(75, 1, 0.1, 10000)
    this.camera.position.set(...INITIAL_SHOT.position)
    this.controls = new OrbitControls(this.camera, domElement)
    this.controls.target.set(...INITIAL_SHOT.target)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.075
    this.controls.rotateSpeed = 0.7
    this.controls.zoomSpeed = 0.9
    this.controls.panSpeed = 0.8
    this.controls.screenSpacePanning = true
    this.controls.minDistance = 7
    this.controls.maxDistance = 170
    this.controls.maxPolarAngle = Math.PI * 0.58
    this.controls.mouseButtons = { LEFT: MOUSE.ROTATE, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.PAN }
    this.controls.touches = { ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_PAN }
    this.controls.autoRotateSpeed = 0.35
    this.controls.addEventListener('start', () => {
      this.flight = null
      this.userHandlers.forEach((handler) => handler())
    })
    this.controls.update()
  }

  onUserControl(handler: () => void): () => void {
    this.userHandlers.add(handler)
    return () => this.userHandlers.delete(handler)
  }

  setSize(width: number, height: number): void {
    this.width = Math.max(1, width)
    this.height = Math.max(1, height)
    this.camera.aspect = this.width / this.height
    this.applyProjection()
  }

  /** Centres the scene in the region the overlays leave free; each inset is the pixels a panel covers on that side. */
  setFrame(insets: { left: number; right: number; top: number; bottom: number }, immediate = false): void {
    const freeWidth = Math.max(1, this.width - insets.left - insets.right)
    const freeHeight = Math.max(1, this.height - insets.top - insets.bottom)
    const shift = (insets.left - insets.right) / 2
    const lift = (insets.bottom - insets.top) / 2
    const zoom = clamp(Math.min(freeWidth / (this.width * 0.64), freeHeight / (this.height * 0.86)), 0.6, 1.12)
    if (immediate) {
      this.shift.snap(shift)
      this.lift.snap(lift)
      this.zoom.snap(zoom)
      this.applyProjection()
    } else {
      this.shift.target = shift
      this.lift.target = lift
      this.zoom.target = zoom
    }
  }

  setAutoOrbit(enabled: boolean): void {
    this.autoOrbit = enabled
    this.controls.autoRotate = enabled
  }

  /** Flies along an arc around the moving target instead of cutting straight through the model. */
  fly(shot: Shot, duration = 1.5): void {
    const toTarget = new Vector3(...shot.target)
    const toOffset = new Vector3(...shot.position).sub(toTarget)
    const fromTarget = this.controls.target.clone()
    const fromOffset = this.camera.position.clone().sub(fromTarget)
    this.flight = {
      elapsed: 0,
      duration: Math.max(0.01, duration),
      fromTarget,
      toTarget,
      from: new Spherical().setFromVector3(fromOffset),
      to: new Spherical().setFromVector3(toOffset),
    }
  }

  jump(shot: Shot): void {
    this.flight = null
    this.controls.target.set(...shot.target)
    this.camera.position.set(...shot.position)
    this.controls.update()
  }

  get isFlying(): boolean {
    return this.flight !== null
  }

  update(dt: number): void {
    const flight = this.flight
    if (flight) {
      flight.elapsed += dt
      const t = easeInOutCubic(clamp(flight.elapsed / flight.duration, 0, 1))
      const target = this.scratch.lerpVectors(flight.fromTarget, flight.toTarget, t)
      const spherical = new Spherical(
        lerp(flight.from.radius, flight.to.radius, t),
        lerp(flight.from.phi, flight.to.phi, t),
        flight.from.theta + angleDelta(flight.from.theta, flight.to.theta) * t,
      )
      this.controls.target.copy(target)
      this.camera.position.setFromSpherical(spherical).add(target)
      if (flight.elapsed >= flight.duration) this.flight = null
    }
    this.controls.autoRotate = this.autoOrbit && !this.flight
    this.controls.update(dt)
    if (!this.shift.settled || !this.lift.settled || !this.zoom.settled) {
      this.shift.step(dt)
      this.lift.step(dt)
      this.zoom.step(dt)
      this.applyProjection()
    }
  }

  private applyProjection(): void {
    this.camera.zoom = this.zoom.value
    const shift = this.shift.value
    const lift = this.lift.value
    if (Math.abs(shift) < 0.5 && Math.abs(lift) < 0.5) {
      this.camera.clearViewOffset()
    } else {
      this.camera.setViewOffset(this.width, this.height, -shift, lift, this.width, this.height)
    }
    this.camera.updateProjectionMatrix()
  }
}
