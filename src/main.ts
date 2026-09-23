import './ui/styles.css'
import { Color } from 'three'
import { loadFactSheet } from './data'
import type { Device, FactSheet } from './data/types'
import type { DiskPhase } from './objects/HardDiskSpecimen'
import type { TapePhase } from './objects/TapeSpecimen'
import { Annotations } from './objects/Annotations'
import { DepthColumn } from './objects/DepthColumn'
import { ProbeSweep } from './objects/ProbeSweep'
import { SparkBurst } from './objects/SparkBurst'
import { SpecimenStage } from './objects/SpecimenStage'
import { StrataStack } from './objects/StrataStack'
import { CameraRig } from './scenes/CameraRig'
import { Director, type DirectorHooks } from './scenes/Director'
import { Environment } from './scenes/Environment'
import { Lighting } from './scenes/Lighting'
import { readScenePalette } from './scenes/palette'
import { Picker } from './scenes/Picker'
import { SceneManager } from './scenes/SceneManager'
import { ControlsHint } from './ui/ControlsHint'
import { Deck } from './ui/Deck'
import { byId, bySvgId, prefersReducedMotion } from './ui/dom'
import { Drawer } from './ui/Drawer'
import { Announcer, Boot, Toast } from './ui/Feedback'
import type { FigureContext } from './ui/Figures'
import { HelpDialog } from './ui/HelpDialog'
import { LabelLayer } from './ui/LabelLayer'
import { mountLegend } from './ui/Legend'
import { MasterTable } from './ui/MasterTable'
import { Rail } from './ui/Rail'
import { SceneLabels } from './ui/SceneLabels'
import { SpecPanel } from './ui/SpecPanel'
import { TopBar } from './ui/TopBar'
import { LESSON_TIERS } from './utils/categories'
import { speedColor } from './utils/color'
import { clamp, rafThrottle } from './utils/math'
import { placementLog, speedDomain, speedT, yForLog, type SpeedDomain } from './utils/scale'
import { changed, createStore, type AppState, type Store, type ThemeName } from './utils/store'

const THEME_KEY = 'access-times:theme'
const FLOAT_AMPLITUDE = 0.5
const FLOAT_PERIOD = 3

interface Stage {
  manager: SceneManager
  rig: CameraRig
  lighting: Lighting
  environment: Environment
  stack: StrataStack
  column: DepthColumn
  sparks: SparkBurst
  sweep: ProbeSweep
  annotations: Annotations
  specimens: SpecimenStage
  layer: LabelLayer
  labels: SceneLabels
  picker: Picker
  director: Director
}

/** Reads a stored theme choice; storage can be blocked, in which case the system preference decides. */
function storedTheme(): ThemeName | null {
  try {
    const value = window.localStorage.getItem(THEME_KEY)
    return value === 'light' || value === 'dark' ? value : null
  } catch {
    return null
  }
}

function persistTheme(theme: ThemeName): void {
  try {
    window.localStorage.setItem(THEME_KEY, theme)
  } catch {
    return
  }
}

/** Parses "#3" or "#3.2" (slide, then step, both counted from one) so a refresh mid-talk returns to the same place. */
function positionFromHash(data: FactSheet): { slide: number; step: number } {
  const match = /^#(\d+)(?:\.(\d+))?$/.exec(window.location.hash)
  if (!match) return { slide: 0, step: 0 }
  const slide = clamp(Number(match[1]) - 1, 0, Math.max(0, data.slides.length - 1))
  const steps = data.slides[slide]?.steps.length ?? 1
  const step = clamp(Number(match[2] ?? 1) - 1, 0, steps - 1)
  return { slide, step }
}

/** Builds the WebGL world; any failure here is caught by the caller and the talk continues without 3D. */
function buildStage(
  data: FactSheet,
  domain: SpeedDomain,
  store: Store<AppState>,
  colorOf: (id: string) => string,
  hooks: DirectorHooks,
  clock: () => number,
): Stage {
  const canvas = byId<HTMLCanvasElement>('scene')
  const manager = new SceneManager(canvas)
  const rig = new CameraRig(canvas)
  const lighting = new Lighting(manager.scene)
  const environment = new Environment(manager.scene, manager.maxAnisotropy)
  const stack = new StrataStack(data.devices, domain)
  const column = new DepthColumn(manager.maxAnisotropy)
  const sparks = new SparkBurst()
  const sweep = new ProbeSweep()
  const yFor = (id: string): number => {
    const device = data.devices.find((entry) => entry.id === id)
    return device ? yForLog(placementLog(device)) : 0
  }
  const annotations = new Annotations(
    LESSON_TIERS.map((tier) => {
      const ys = tier.deviceIds.map(yFor)
      return { id: tier.id, top: Math.max(...ys) + 0.6, bottom: Math.min(...ys) - 0.6 }
    }),
  )
  const specimens = new SpecimenStage(
    {
      die: { register: colorOf('register'), l1: colorOf('l1'), l2: colorOf('l2'), l3: colorOf('l3'), dram: colorOf('dram') },
      hdd: colorOf('hdd-7200'),
      trio: [colorOf('hdd-5400'), colorOf('hdd-7200'), colorOf('hdd-15k')],
      sata: colorOf('sata'),
      nvme: colorOf('nvme'),
      optical: colorOf('optical'),
      tape: colorOf('tape'),
    },
    (id, target) => stack.anchor(id, target),
  )
  manager.instrument.add(stack.group, column.group, sparks.points, sweep.group, annotations.group, specimens.group)
  const layer = new LabelLayer(byId('labels'), bySvgId('leaders'))
  const labels = new SceneLabels({
    layer,
    devices: data.devices,
    humanEntries: data.humanScale.entries,
    domain,
    stack,
    column,
    specimens,
    annotations,
    sweep,
    lessonNames: LESSON_TIERS.map((tier) => ({ id: tier.id, name: tier.name, summary: tier.summary })),
  })
  const picker = new Picker(canvas, rig.camera, {
    onHover: (id) => store.set({ hovered: id }),
    onPick: (id) => {
      if (id) store.set({ selected: id })
    },
  })
  picker.setTargets(stack.meshes())
  const director = new Director({
    store,
    slides: data.slides,
    devices: data.devices,
    domain,
    rig,
    stack,
    column,
    sparks,
    sweep,
    annotations,
    specimens,
    labels,
    hooks,
    clock,
    reducedMotion: () => store.get().reducedMotion,
  })
  return { manager, rig, lighting, environment, stack, column, sparks, sweep, annotations, specimens, layer, labels, picker, director }
}

/** Boots the presentation: data, interface, 3D stage, input and the render loop, each guarded so one failure never takes down the rest. */
function start(): void {
  const boot = new Boot(byId('boot'))
  const toast = new Toast(byId('toast'))
  const announcer = new Announcer(byId('announcer'))
  const data = loadFactSheet()
  const domain: SpeedDomain = data.devices.length > 0 ? speedDomain(data.devices) : { fastest: -11, slowest: 2 }
  const colors = new Map(data.devices.map((device) => [device.id, speedColor(speedT(placementLog(device), domain))]))
  const colorOf = (id: string): string => colors.get(id) ?? '#8d97a2'
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  const initialTheme = storedTheme() ?? (media.matches ? 'dark' : 'light')
  document.documentElement.dataset.theme = initialTheme

  const store = createStore<AppState>({
    ...positionFromHash(data),
    human: false,
    theme: initialTheme,
    selected: null,
    hovered: null,
    powerOn: true,
    sweeping: false,
    deckHidden: false,
    notes: false,
    blackout: false,
    reducedMotion: prefersReducedMotion(),
    webgl: true,
  })

  const deviceById = (id: string | null): Device | undefined => (id ? data.devices.find((device) => device.id === id) : undefined)
  const leftPanel = byId('left')
  const specRoot = byId('spec')
  const caption = byId('caption')
  const blackout = byId('blackout')

  const drawer = new Drawer(byId<HTMLDialogElement>('drawer'), data)
  const table = new MasterTable(byId<HTMLDialogElement>('table-dialog'), data, colorOf, (id) => store.set({ selected: id }))
  const help = new HelpDialog(byId<HTMLDialogElement>('help'))
  const hint = new ControlsHint(byId('hint'), (rect) => {
    stage?.layer.setExclusion(rect ? { left: rect.left - 12, top: rect.top - 12 } : null)
  })
  const context: FigureContext = {
    data,
    colorOf,
    isPowerOn: () => store.get().powerOn,
    isSweeping: () => store.get().sweeping,
    actions: {
      select: (id) => store.set({ selected: id }),
      hover: (id) => store.set({ hovered: id }),
      togglePower: () => store.set({ powerOn: !store.get().powerOn }),
      runSweep: () => {
        if (store.get().webgl) store.set({ sweeping: true })
        else toast.show('The probe runs in the 3D view, which is unavailable here.', 'error')
      },
      openTable: () => table.open(),
    },
  }

  const go = (slide: number, step: number): void => {
    const lastSlide = Math.max(0, data.slides.length - 1)
    const targetSlide = clamp(slide, 0, lastSlide)
    const steps = data.slides[targetSlide]?.steps.length ?? 1
    store.set({ slide: targetSlide, step: clamp(step, 0, steps - 1), selected: null })
  }
  const next = (): void => {
    const { slide, step } = store.get()
    const steps = data.slides[slide]?.steps.length ?? 1
    if (step < steps - 1) go(slide, step + 1)
    else if (slide < data.slides.length - 1) go(slide + 1, 0)
  }
  const previous = (): void => {
    const { slide, step } = store.get()
    if (step > 0) go(slide, step - 1)
    else if (slide > 0) go(slide - 1, (data.slides[slide - 1]?.steps.length ?? 1) - 1)
  }
  const stepDevice = (direction: 1 | -1): void => {
    const current = deviceById(store.get().selected)
    if (!current) return
    const index = data.devices.indexOf(current)
    const target = data.devices[clamp(index + direction, 0, data.devices.length - 1)]
    if (target) store.set({ selected: target.id })
  }
  const toggleTheme = (): void => {
    const theme: ThemeName = store.get().theme === 'dark' ? 'light' : 'dark'
    persistTheme(theme)
    store.set({ theme })
    toast.show(theme === 'dark' ? 'Dark theme, for dim rooms and screens' : 'Light theme, for projectors in lit rooms')
  }
  const toggleFullscreen = (): void => {
    const request = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()
    request.catch(() => toast.show('Full screen was blocked by the browser. Try the F11 key.', 'error'))
  }

  const topBar = new TopBar(byId('topbar'), {
    toggleHuman: () => store.set({ human: !store.get().human }),
    openTable: () => table.open(),
    openQuestions: () => drawer.open('questions'),
    openSources: () => drawer.open('sources'),
    toggleDeck: () => store.set({ deckHidden: !store.get().deckHidden }),
    toggleNotes: () => store.set({ notes: !store.get().notes }),
    toggleTheme,
    toggleFullscreen,
    openHelp: () => help.open(),
  })
  const deck = new Deck(byId('deck'), data, context, { next, previous, jump: (step) => go(store.get().slide, step) })
  const rail = new Rail(byId('rail'), data.slides, (slide) => go(slide, 0))
  const spec = new SpecPanel(specRoot, data, colorOf, {
    close: () => store.set({ selected: null }),
    step: stepDevice,
    openQuestion: (id) => drawer.open('questions', id),
  })
  mountLegend(byId('legend'), data.devices, domain)
  topBar.setTheme(initialTheme === 'dark')

  let time = 0
  let stage: Stage | null = null
  let reachedTimer = 0
  const hooks: DirectorHooks = {
    onDiskPhase: (phase: DiskPhase) => deck.setDiskPhase(phase),
    onTapePhase: (phase: TapePhase) => deck.setTapePhase(phase),
    onSweepCross: (id: string) => deck.markReached(id),
    onSweepEnd: () => {
      window.clearTimeout(reachedTimer)
      reachedTimer = window.setTimeout(() => deck.clearReached(), 4500)
    },
    onCaption: (text: string | null) => {
      caption.textContent = text ?? ''
      caption.dataset.visible = String(Boolean(text))
    },
  }

  const showFallback = (reason: string): void => {
    const fallback = byId('fallback')
    fallback.hidden = false
    byId('fallback-reason').textContent = reason
    store.set({ webgl: false })
  }

  if (data.devices.length === 0) {
    showFallback('The device table in the fact sheet could not be read, so there is nothing to build. Check src/data/devices.json.')
  } else {
    try {
      stage = buildStage(data, domain, store, colorOf, hooks, () => time)
    } catch (error) {
      stage = null
      const detail = error instanceof Error ? error.message : String(error)
      console.error('[3D stage]', detail)
      showFallback('This browser or graphics driver did not provide WebGL, so the 3D model is switched off.')
    }
  }

  const applyScenePalette = (): void => {
    if (!stage) return
    const palette = readScenePalette(store.get().theme === 'dark')
    stage.manager.applyPalette(palette)
    stage.lighting.applyPalette(palette)
    stage.environment.applyPalette(palette)
    stage.stack.applyPalette(palette.ground, palette.line, palette.edgeOpacity, palette.hatchOpacity)
    stage.column.applyPalette(palette.ink, palette.tick, palette.line)
    stage.sparks.applyPalette(palette.ground, palette.dark)
    stage.sweep.applyPalette(palette.ink, palette.dark)
    stage.annotations.applyPalette(palette.ink, palette.dark)
    stage.specimens.applyPalette(new Color(palette.inkHex), palette.dark)
  }

  const updateFrame = (immediate = false): void => {
    if (!stage) return
    const state = store.get()
    const width = window.innerWidth
    const height = window.innerHeight
    const mobile = width < 768
    const topbar = byId('topbar').offsetHeight
    const railHeight = byId('rail').offsetHeight
    const insets = { left: 0, right: 0, top: topbar, bottom: railHeight }
    if (mobile) {
      if (state.selected) insets.bottom += Math.min(specRoot.offsetHeight, height * 0.72)
      else if (!state.deckHidden) insets.bottom += leftPanel.offsetHeight
    } else {
      if (!state.deckHidden) insets.left = leftPanel.offsetWidth
      if (state.selected) insets.right = specRoot.offsetWidth + 24
    }
    const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
    const bias = !mobile && stage.labels.reservesColumn ? Math.min(19 * rem, width * 0.22) : 0
    stage.rig.setFrame(insets, immediate, bias)
    stage.layer.setBounds(topbar + 8, height - insets.bottom - 8, width - insets.right - 8)
  }

  const resize = (): void => {
    if (stage) {
      stage.manager.setSize(window.innerWidth, window.innerHeight)
      stage.rig.setSize(window.innerWidth, window.innerHeight)
      stage.labels.setCompact(window.innerWidth < 768)
      stage.layer.touchAll()
    }
    updateFrame(true)
  }

  const renderUi = (state: AppState, previous: AppState | null): void => {
    const first = previous === null
    if (first || changed(state, previous, 'slide', 'step')) {
      deck.show(state.slide, state.step)
      rail.show(state.slide, state.step)
      const slide = data.slides[state.slide]
      leftPanel.dataset.wide = String(slide?.figure === 'table')
      const step = slide?.steps[state.step]
      if (slide && step) {
        window.history.replaceState(null, '', `#${slide.number}.${state.step + 1}`)
        if (!first) announcer.say(`Slide ${slide.number} of ${data.slides.length}, ${slide.title}. ${step.lead}.`)
      }
      if (!first && previous && previous.slide === 0 && state.slide > 0) rail.autoStart()
    }
    if (first || changed(state, previous, 'selected')) {
      const device = deviceById(state.selected)
      if (device) spec.show(device, !first)
      else spec.hide()
      document.body.dataset.spec = String(Boolean(device))
    }
    if (first || changed(state, previous, 'human')) {
      topBar.setHuman(state.human)
      spec.setHuman(state.human)
      if (!first) announcer.say(state.human ? 'Human time on: 1 nanosecond is read as 1 second.' : 'Human time off: real access times.')
    }
    if (first || changed(state, previous, 'powerOn')) {
      deck.setPower(state.powerOn)
      spec.setPower(state.powerOn)
    }
    if (first || changed(state, previous, 'sweeping')) {
      deck.setSweeping(state.sweeping)
      if (state.sweeping) {
        window.clearTimeout(reachedTimer)
        deck.clearReached()
      }
    }
    if (first || changed(state, previous, 'hovered', 'selected')) {
      deck.setPointer(state.hovered, state.selected)
      byId('stage').dataset.hover = String(Boolean(state.hovered))
    }
    if (first || changed(state, previous, 'deckHidden')) {
      leftPanel.dataset.hidden = String(state.deckHidden)
      leftPanel.toggleAttribute('inert', state.deckHidden)
      topBar.setDeckHidden(state.deckHidden)
      document.body.dataset.deck = state.deckHidden ? 'hidden' : 'shown'
    }
    if (first || changed(state, previous, 'theme')) {
      document.documentElement.dataset.theme = state.theme
      topBar.setTheme(state.theme === 'dark')
      applyScenePalette()
    }
    if (first || changed(state, previous, 'notes')) {
      document.body.dataset.notes = state.notes ? 'on' : 'off'
      topBar.setNotes(state.notes)
      if (!first) toast.show(state.notes ? 'Presenter notes shown: timings, lesson links and cues' : 'Presenter notes hidden')
    }
    if (first || changed(state, previous, 'blackout')) {
      blackout.dataset.on = String(state.blackout)
    }
    if (first || changed(state, previous, 'deckHidden', 'selected', 'slide', 'step')) {
      window.requestAnimationFrame(() => updateFrame(first))
    }
  }

  store.subscribe((state, previous) => {
    renderUi(state, previous)
    stage?.director.handle(state, previous)
  })

  media.addEventListener('change', (event) => {
    if (storedTheme() === null) store.set({ theme: event.matches ? 'dark' : 'light' })
  })
  motionQuery.addEventListener('change', (event) => store.set({ reducedMotion: event.matches }))
  document.addEventListener('fullscreenchange', () => {
    topBar.setFullscreen(Boolean(document.fullscreenElement))
    window.requestAnimationFrame(resize)
  })
  window.addEventListener('resize', rafThrottle(resize))
  window.addEventListener('hashchange', () => {
    const position = positionFromHash(data)
    go(position.slide, position.step)
  })

  const isTyping = (target: EventTarget | null): boolean =>
    target instanceof HTMLElement && Boolean(target.closest('input, textarea, select, [contenteditable="true"]'))
  const isControl = (target: EventTarget | null): boolean =>
    target instanceof HTMLElement && Boolean(target.closest('button, a, summary, [role="switch"], tr[tabindex]'))

  window.addEventListener('keydown', (event) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || isTyping(event.target)) return
    if (drawer.isOpen || table.isOpen || help.isOpen) return
    hint.noteInteraction()
    const state = store.get()
    if (state.blackout) {
      event.preventDefault()
      store.set({ blackout: false })
      return
    }
    const key = event.key
    const handled = (action: () => void): void => {
      event.preventDefault()
      action()
    }
    if ((key === ' ' || key === 'Enter') && isControl(event.target)) return
    switch (key) {
      case 'ArrowRight':
      case 'PageDown':
      case ' ':
      case 'Enter':
        handled(() => (event.shiftKey && key === 'ArrowRight' ? go(state.slide + 1, 0) : next()))
        return
      case 'ArrowLeft':
      case 'PageUp':
        handled(() => (event.shiftKey && key === 'ArrowLeft' ? go(state.slide - 1, 0) : previous()))
        return
      case 'Home':
        handled(() => go(0, 0))
        return
      case 'End':
        handled(() => go(data.slides.length - 1, 0))
        return
      case 'Escape':
        if (state.selected) handled(() => store.set({ selected: null }))
        return
      case '[':
        handled(() => stepDevice(-1))
        return
      case ']':
        handled(() => stepDevice(1))
        return
      case '?':
        handled(() => help.open())
        return
      default:
        break
    }
    if (/^[0-9]$/.test(key)) {
      handled(() => go(key === '0' ? 9 : Number(key) - 1, 0))
      return
    }
    switch (key.toLowerCase()) {
      case 'h':
        handled(() => store.set({ human: !state.human }))
        break
      case 's':
        handled(() => context.actions.runSweep())
        break
      case 'p':
        handled(() => store.set({ powerOn: !state.powerOn }))
        break
      case 'm':
        handled(() => table.open())
        break
      case 'q':
        handled(() => drawer.open('questions'))
        break
      case 'e':
        handled(() => store.set({ deckHidden: !state.deckHidden }))
        break
      case 'n':
        handled(() => store.set({ notes: !state.notes }))
        break
      case 'r':
        handled(() => stage?.director.resetView())
        break
      case 't':
        handled(toggleTheme)
        break
      case 'f':
        handled(toggleFullscreen)
        break
      case 'b':
        handled(() => store.set({ blackout: true }))
        break
      default:
        break
    }
  })
  window.addEventListener('pointerdown', () => hint.noteInteraction(), { passive: true })
  blackout.addEventListener('click', () => store.set({ blackout: false }))

  let reported = false
  const report = (): void => {
    if (reported) return
    reported = true
    toast.show('Something in the 3D view hit an error. The slides and details still work; reloading usually clears it.', 'error', 6000)
  }
  window.addEventListener('error', (event) => {
    event.preventDefault()
    console.error('[uncaught]', event.message)
    report()
  })
  window.addEventListener('unhandledrejection', (event) => {
    event.preventDefault()
    console.error('[unhandled rejection]', event.reason instanceof Error ? event.reason.message : event.reason)
    report()
  })

  renderUi(store.get(), null)
  resize()

  if (stage) {
    const canvas = byId<HTMLCanvasElement>('scene')
    canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault()
      toast.show('The graphics context was lost. The 3D view resumes when the browser restores it.', 'error', 6000)
    })
    stage.director.sync('keep')
    const reduced = store.get().reducedMotion
    stage.stack.playEntrance(0.15, reduced)
    stage.column.playDraw(0.1, reduced)
    window.setTimeout(() => stage?.director.resetView(), reduced ? 50 : 1900)
  }

  let last = performance.now()
  let slowFrames = 0
  let sampled = 0
  let booted = false
  const frame = (now: number): void => {
    window.requestAnimationFrame(frame)
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000))
    last = now
    time += dt
    rail.tick(now)
    if (!stage) return
    try {
      const reduced = store.get().reducedMotion
      stage.manager.instrument.position.y = reduced ? 0 : FLOAT_AMPLITUDE * Math.sin((time * Math.PI * 2) / FLOAT_PERIOD)
      stage.picker.update()
      stage.rig.update(dt)
      stage.stack.update(dt, time)
      stage.column.update(time)
      stage.sparks.update(dt)
      stage.sweep.update(dt)
      stage.annotations.update(dt)
      stage.specimens.update(dt)
      stage.director.update()
      stage.manager.scene.updateMatrixWorld()
      stage.layer.update(stage.rig.camera, window.innerWidth, window.innerHeight)
      stage.manager.render(stage.rig.camera)
    } catch (error) {
      console.error('[render]', error instanceof Error ? error.message : error)
      report()
    }
    sampled += 1
    if (dt > 0.034) slowFrames += 1
    if (sampled >= 120) {
      if (slowFrames > 70 && stage.manager.degradeResolution()) stage.layer.touchAll()
      sampled = 0
      slowFrames = 0
    }
    if (!booted) {
      booted = true
      boot.done()
    }
  }
  window.requestAnimationFrame(frame)
  if (!stage) boot.done()

  void document.fonts.ready.then(() => {
    stage?.column.refreshEngraving()
    applyScenePalette()
    stage?.layer.touchAll()
    updateFrame(true)
  })
}

try {
  start()
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  console.error('[startup]', message)
  const bootRoot = document.getElementById('boot')
  if (bootRoot) new Boot(bootRoot).fail('An unexpected problem stopped the page from loading. Reloading usually fixes it.')
}
