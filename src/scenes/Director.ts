import type { Device, Slide } from '../data/types'
import type { Annotations } from '../objects/Annotations'
import type { DepthColumn } from '../objects/DepthColumn'
import type { DiskPhase } from '../objects/HardDiskSpecimen'
import type { ParticleField } from '../objects/ParticleField'
import type { ProbeSweep } from '../objects/ProbeSweep'
import type { SpecimenStage } from '../objects/SpecimenStage'
import type { StrataStack } from '../objects/StrataStack'
import type { TapePhase } from '../objects/TapeSpecimen'
import type { SceneLabels } from '../ui/SceneLabels'
import { speedColor } from '../utils/color'
import { formatHuman, formatSeconds, humanSecondsForLog } from '../utils/format'
import { placementLog, speedT, type SpeedDomain } from '../utils/scale'
import { changed, type AppState, type Store } from '../utils/store'
import type { CameraRig } from './CameraRig'
import { cueFor, SHOTS, type CueState } from './choreography'

export interface DirectorHooks {
  onDiskPhase: (phase: DiskPhase) => void
  onTapePhase: (phase: TapePhase) => void
  onSweepCross: (id: string) => void
  onSweepEnd: () => void
  onCaption: (text: string | null) => void
}

export interface DirectorParts {
  store: Store<AppState>
  slides: Slide[]
  devices: Device[]
  domain: SpeedDomain
  rig: CameraRig
  stack: StrataStack
  column: DepthColumn
  particles: ParticleField
  sweep: ProbeSweep
  annotations: Annotations
  specimens: SpecimenStage
  labels: SceneLabels
  hooks: DirectorHooks
  clock: () => number
  reducedMotion: () => boolean
}

const REACHED_HOLD = 4.5

/** Turns app state into stage directions: camera shots, focus, specimens, overlays, the analogy, power and the probe sweep. */
export class Director {
  private readonly parts: DirectorParts
  private cue: CueState | null = null
  private humanForced = false
  private clearReachedAt = -1

  constructor(parts: DirectorParts) {
    this.parts = parts
    const { specimens, sweep, hooks, stack, labels, store } = parts
    specimens.hdd.onPhase = (phase) => {
      if (specimens.active === 'hdd') hooks.onDiskPhase(phase)
    }
    specimens.tape.onPhase = (phase) => {
      if (specimens.active === 'tape') hooks.onTapePhase(phase)
    }
    sweep.onCross = (id) => {
      stack.pulse(id, 1.1)
      labels.markReached(id)
      hooks.onSweepCross(id)
    }
    sweep.onFinish = () => {
      this.clearReachedAt = parts.clock() + REACHED_HOLD
      store.set({ sweeping: false })
      hooks.onSweepEnd()
    }
  }

  /** Applies the full current state once; at start-up the camera keeps the brief's initial position until the opening finishes. */
  sync(camera: 'jump' | 'keep' = 'jump'): void {
    this.applyCue(this.parts.store.get(), camera)
    const state = this.parts.store.get()
    this.applyHuman(state, false)
    this.applyPointer(state, null)
    this.parts.stack.setPower(state.powerOn)
    this.parts.specimens.die.setPower(state.powerOn)
    this.parts.labels.setPower(state.powerOn)
  }

  handle(state: AppState, previous: AppState): void {
    if (changed(state, previous, 'slide', 'step')) this.applyCue(state, 'fly')
    if (changed(state, previous, 'hovered', 'selected')) this.applyPointer(state, previous)
    if (changed(state, previous, 'human')) this.applyHuman(state, true)
    if (changed(state, previous, 'powerOn')) {
      this.parts.stack.setPower(state.powerOn)
      this.parts.specimens.die.setPower(state.powerOn)
      this.parts.labels.setPower(state.powerOn)
    }
    if (changed(state, previous, 'sweeping')) {
      if (state.sweeping) this.startSweep()
      else if (this.parts.sweep.active) this.parts.sweep.stop()
    }
    if (changed(state, previous, 'deckHidden', 'selected') && this.cue) {
      this.parts.rig.setAutoOrbit(Boolean(this.cue.orbit) && !this.parts.reducedMotion() && !state.selected)
    }
  }

  /** Re-flies to the current step's shot, for the reset-view control. */
  resetView(): void {
    if (this.cue) this.parts.rig.fly(SHOTS[this.cue.shot], this.parts.reducedMotion() ? 0.01 : 1.2)
  }

  private applyCue(state: AppState, camera: 'fly' | 'jump' | 'keep'): void {
    const { slides, rig, stack, annotations, specimens, labels, store, hooks } = this.parts
    const slide = slides[state.slide]
    const step = slide?.steps[state.step]
    const key = step?.cue ?? 'title-scope'
    const cue = cueFor(key)
    const previousShot = this.cue?.shot
    this.cue = cue
    const reduced = this.parts.reducedMotion()
    if (camera === 'jump') rig.jump(SHOTS[cue.shot])
    else if (camera === 'fly' && (previousShot !== cue.shot || !rig.isFlying)) rig.fly(SHOTS[cue.shot], reduced ? 0.01 : 1.6)
    rig.setAutoOrbit(Boolean(cue.orbit) && !reduced && !state.selected)
    stack.setFocus(cue.focus)
    labels.setCallouts(cue.callouts, cue.focus)
    annotations.showMeasure(cue.measure ?? null)
    labels.setMeasure(cue.measure ?? null)
    annotations.showLessons(Boolean(cue.lessons))
    labels.setLessons(Boolean(cue.lessons))
    annotations.volatility.setVisible(Boolean(cue.volatility))
    labels.setVolatility(Boolean(cue.volatility))
    specimens.show(cue.specimen, cue.specimenMode ?? 'idle')
    if (cue.specimen !== 'hdd') hooks.onDiskPhase(null)
    if (cue.specimen !== 'tape') hooks.onTapePhase(null)
    hooks.onCaption(cue.caption ?? null)
    if (!cue.volatility && !state.powerOn) store.set({ powerOn: true })
    if (cue.human && !state.human) {
      this.humanForced = true
      store.set({ human: true })
    } else if (!cue.human && this.humanForced) {
      this.humanForced = false
      if (state.human) store.set({ human: false })
    }
    if (cue.sweep && camera === 'fly') store.set({ sweeping: true })
    else if (!cue.sweep && state.sweeping) store.set({ sweeping: false })
  }

  private applyPointer(state: AppState, previous: AppState | null): void {
    const { stack, labels, particles, domain, devices } = this.parts
    stack.setHovered(state.hovered)
    stack.setSelected(state.selected)
    labels.setPointer(state.hovered, state.selected)
    if (state.selected && state.selected !== previous?.selected) {
      const stratum = stack.get(state.selected)
      const device = devices.find((entry) => entry.id === state.selected)
      if (stratum && device) particles.burst(stratum, speedColor(speedT(placementLog(device), domain)))
    }
  }

  private applyHuman(state: AppState, animate: boolean): void {
    const { column, labels, stack, clock } = this.parts
    column.setHuman(state.human, clock())
    labels.setHuman(state.human)
    if (animate && !this.parts.reducedMotion()) stack.ripple(clock())
  }

  private startSweep(): void {
    const { sweep, devices, labels } = this.parts
    labels.clearReached()
    this.clearReachedAt = -1
    sweep.start(
      devices.map((device) => ({ id: device.id, log: placementLog(device) })),
      this.parts.reducedMotion(),
    )
  }

  update(): void {
    const { sweep, labels, store, clock } = this.parts
    const human = store.get().human
    const showProbe = sweep.active
    const log = sweep.currentLog
    labels.setProbe(showProbe, human ? formatHuman(humanSecondsForLog(log)) : formatSeconds(10 ** log))
    if (this.clearReachedAt > 0 && clock() > this.clearReachedAt) {
      this.clearReachedAt = -1
      labels.clearReached()
    }
    labels.update()
  }
}
