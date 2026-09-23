import type { Slide } from '../data/types'
import { formatClock } from '../utils/format'
import { el } from './dom'
import { icon } from './icons'

const LIMIT_MS = 10 * 60 * 1000

/** The bottom rail: one segment per slide sized by its planned minutes, a presenter clock, and a marker showing where the talk should be by now. */
export class Rail {
  private readonly segments: HTMLButtonElement[] = []
  private readonly fills: HTMLElement[] = []
  private readonly marker: HTMLElement
  private readonly clock: HTMLElement
  private readonly playButton: HTMLButtonElement
  private readonly track: HTMLElement
  private readonly slides: Slide[]
  private elapsed = 0
  private running = false
  private lastTick = 0
  private started = false
  private shownSeconds = -1

  constructor(root: HTMLElement, slides: Slide[], onJump: (slide: number) => void) {
    this.slides = slides
    this.track = el('ol', { className: 'relative flex h-full min-w-0 flex-1' })
    slides.forEach((slide, index) => {
      const fill = el('span', { className: 'rail-seg__fill' })
      const segment = el(
        'button',
        {
          className: 'rail-seg w-full',
          attrs: { type: 'button', 'aria-label': `Slide ${slide.number}: ${slide.shortTitle}, ${slide.minutes} minutes planned` },
          on: { click: () => onJump(index) },
        },
        [
          el('span', { className: 'rail-seg__bar' }, [fill]),
          el('span', { className: 'num mr-1.5 text-[0.74rem] font-bold', text: String(slide.number) }),
          el('span', { className: 'truncate text-[0.72rem] font-medium [font-stretch:88%]', text: slide.shortTitle }),
        ],
      )
      this.segments.push(segment)
      this.fills.push(fill)
      this.track.appendChild(el('li', { className: 'min-w-0', style: { flex: `${slide.minutes} 1 0` } }, [segment]))
    })
    this.marker = el('div', { className: 'rail-marker', attrs: { 'aria-hidden': 'true' }, style: { left: '0%' } })
    this.track.appendChild(this.marker)
    this.clock = el('span', { className: 'num text-[0.86rem] font-bold [font-stretch:96%]', attrs: { role: 'timer', 'aria-live': 'off' } })
    this.playButton = el('button', { className: 'ctl ctl--icon', attrs: { type: 'button' }, on: { click: () => this.toggle() } })
    const reset = el(
      'button',
      { className: 'ctl ctl--icon', attrs: { type: 'button', 'aria-label': 'Reset the presenter clock' }, on: { click: () => this.reset() } },
      [icon('arrow-counter-clockwise')],
    )
    root.append(
      this.track,
      el('div', { className: 'flex items-center gap-1 border-l border-[var(--rule)] pl-3 pr-[var(--gutter)]' }, [
        this.playButton,
        this.clock,
        el('span', { className: 'num t-cite text-[0.78rem]', text: '/ 10:00' }),
        reset,
      ]),
    )
    this.renderControls()
    this.renderTime()
  }

  show(slideIndex: number, stepIndex: number): void {
    this.segments.forEach((segment, index) => {
      const slide = this.slides[index]
      const steps = slide ? slide.steps.length : 1
      segment.dataset.done = String(index < slideIndex)
      if (index === slideIndex) segment.setAttribute('aria-current', 'step')
      else segment.removeAttribute('aria-current')
      const fill = this.fills[index]
      if (fill) fill.style.transform = `scaleX(${index < slideIndex ? 1 : index === slideIndex ? (stepIndex + 1) / steps : 0})`
    })
  }

  /** Starts the clock the first time the presenter leaves the title slide. */
  autoStart(): void {
    if (this.started) return
    this.started = true
    this.running = true
    this.lastTick = performance.now()
    this.renderControls()
    this.renderTime()
  }

  toggle(): void {
    this.started = true
    this.running = !this.running
    this.lastTick = performance.now()
    this.renderControls()
    this.renderTime()
  }

  reset(): void {
    this.elapsed = 0
    this.running = false
    this.started = false
    this.renderControls()
    this.renderTime()
  }

  tick(now: number): void {
    if (!this.running) return
    this.elapsed += now - this.lastTick
    this.lastTick = now
    this.renderTime()
  }

  /** Updates the readout and the pace marker at most once per displayed second. */
  private renderTime(): void {
    const seconds = Math.floor(this.elapsed / 1000)
    if (seconds === this.shownSeconds) return
    this.shownSeconds = seconds
    const over = this.elapsed > LIMIT_MS
    this.clock.textContent = formatClock(this.elapsed)
    this.clock.style.textDecoration = over ? 'underline' : ''
    this.clock.title = over ? 'Past the 10-minute cap' : ''
    this.marker.style.left = `${Math.min(100, (this.elapsed / LIMIT_MS) * 100)}%`
    this.marker.style.opacity = this.started ? '1' : '0'
  }

  private renderControls(): void {
    this.shownSeconds = -1
    this.playButton.replaceChildren(icon(this.running ? 'pause' : 'play'))
    this.playButton.setAttribute('aria-label', this.running ? 'Pause the presenter clock' : 'Start the presenter clock')
  }
}
