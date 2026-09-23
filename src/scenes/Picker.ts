import { Raycaster, Vector2, type Camera, type Object3D } from 'three'

export interface PickerCallbacks {
  onHover: (id: string | null) => void
  onPick: (id: string | null) => void
}

const CLICK_SLOP_PX = 6
const CLICK_MAX_MS = 550

/** Raycasts pointer positions against the strata at most once per frame and tells clicks apart from orbit drags. */
export class Picker {
  private readonly raycaster = new Raycaster()
  private readonly pointer = new Vector2()
  private pending = false
  private inside = false
  private dragging = false
  private down: { x: number; y: number; time: number } | null = null
  private hoveredId: string | null = null
  private targets: Object3D[] = []
  private readonly element: HTMLElement
  private readonly camera: Camera
  private readonly callbacks: PickerCallbacks
  enabled = true

  constructor(element: HTMLElement, camera: Camera, callbacks: PickerCallbacks) {
    this.element = element
    this.camera = camera
    this.callbacks = callbacks
    element.addEventListener('pointermove', this.handleMove)
    element.addEventListener('pointerdown', this.handleDown)
    element.addEventListener('pointerup', this.handleUp)
    element.addEventListener('pointerleave', this.handleLeave)
  }

  setTargets(targets: Object3D[]): void {
    this.targets = targets
  }

  private readonly handleMove = (event: PointerEvent): void => {
    this.inside = true
    this.setPointer(event)
    if (this.down && Math.hypot(event.clientX - this.down.x, event.clientY - this.down.y) > CLICK_SLOP_PX) {
      this.dragging = true
    }
    this.pending = true
  }

  private readonly handleDown = (event: PointerEvent): void => {
    this.down = { x: event.clientX, y: event.clientY, time: performance.now() }
    this.dragging = false
  }

  private readonly handleUp = (event: PointerEvent): void => {
    const start = this.down
    this.down = null
    if (!start || this.dragging || !this.enabled) return
    const moved = Math.hypot(event.clientX - start.x, event.clientY - start.y)
    if (moved > CLICK_SLOP_PX || performance.now() - start.time > CLICK_MAX_MS || event.button !== 0) return
    this.setPointer(event)
    this.callbacks.onPick(this.cast())
  }

  private readonly handleLeave = (): void => {
    this.inside = false
    this.pending = true
  }

  private setPointer(event: PointerEvent): void {
    const rect = this.element.getBoundingClientRect()
    this.pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1)
  }

  private cast(): string | null {
    this.raycaster.setFromCamera(this.pointer, this.camera)
    const hit = this.raycaster.intersectObjects(this.targets, false).find((entry) => entry.object.visible)
    const id = hit?.object.userData.deviceId
    return typeof id === 'string' ? id : null
  }

  /** Called from the render loop so hover work never runs more than once per frame. */
  update(): void {
    if (!this.pending) return
    this.pending = false
    const next = this.inside && this.enabled && !this.dragging ? this.cast() : null
    if (next !== this.hoveredId) {
      this.hoveredId = next
      this.callbacks.onHover(next)
    }
  }
}
