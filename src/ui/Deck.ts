import type { FactSheet, Slide } from '../data/types'
import type { DiskPhase } from '../objects/HardDiskSpecimen'
import type { TapePhase } from '../objects/TapeSpecimen'
import { formatMinutes } from '../utils/format'
import { el, richText } from './dom'
import { buildFigure, type FigureContext, type LiveFigure } from './Figures'
import { icon } from './icons'

export interface DeckCallbacks {
  next: () => void
  previous: () => void
  jump: (step: number) => void
}

/** The slide panel: title, facts revealed one keypress at a time, the slide's figures, and the lesson citation. */
export class Deck {
  private readonly root: HTMLElement
  private readonly data: FactSheet
  private readonly context: FigureContext
  private readonly callbacks: DeckCallbacks
  private facts: HTMLElement[] = []
  private figures: LiveFigure[] = []
  private slideIndex = -1
  private counter: HTMLElement | null = null
  private previousButton: HTMLButtonElement | null = null
  private nextButton: HTMLButtonElement | null = null

  constructor(root: HTMLElement, data: FactSheet, context: FigureContext, callbacks: DeckCallbacks) {
    this.root = root
    this.data = data
    this.context = context
    this.callbacks = callbacks
  }

  show(slideIndex: number, stepIndex: number): void {
    if (slideIndex !== this.slideIndex) this.render(slideIndex)
    this.reveal(stepIndex)
  }

  private get slide(): Slide | undefined {
    return this.data.slides[this.slideIndex]
  }

  private render(slideIndex: number): void {
    this.slideIndex = slideIndex
    const slide = this.slide
    this.root.replaceChildren()
    this.figures = []
    if (!slide) {
      this.root.appendChild(el('p', { className: 'text-[var(--ink-2)]', text: 'This slide could not be loaded from the fact sheet.' }))
      return
    }
    const header = el('header', { className: 'mb-5' }, [
      el('h1', {
        id: 'slide-title',
        className: slide.number === 1 ? 't-display text-[clamp(2.1rem,2.7vw+0.6rem,3.6rem)]' : 't-display text-[clamp(1.75rem,1.75vw+0.8rem,2.8rem)]',
        text: slide.title,
      }),
      slide.subtitle ? el('p', { className: 'mt-2 text-[1.05rem] font-semibold text-[var(--ink-2)] [font-stretch:108%]', text: slide.subtitle }) : null,
      slide.titleNote ? el('p', { className: 't-cite mt-3 text-[0.82rem]', text: slide.titleNote }) : null,
    ])
    const list = el('ol', { className: 'grid gap-2.5', attrs: { 'aria-label': 'Key facts' } })
    this.facts = slide.steps.map((step, index) => {
      const body = el('div', { className: 'fact__body mt-1.5 pl-[1.7rem]' }, [
        el('p', { className: 'text-[clamp(1rem,0.6vw+0.62rem,1.3rem)] leading-[1.42] max-w-[60ch]' }, [richText(step.body)]),
        step.note ? el('p', { className: 't-cite mt-1.5 text-[0.8rem]', text: step.note }) : null,
        step.cites.length > 0
          ? el('p', { className: 't-cite mt-1.5 text-[0.78rem]', text: step.cites.map((cite) => `(${cite})`).join(' ') })
          : null,
      ])
      if (step.figure) {
        const figure = buildFigure(step.figure, this.context)
        this.figures.push(figure)
        body.appendChild(figure.element)
      }
      const jump = el(
        'button',
        { className: 'fact__jump', attrs: { type: 'button' }, on: { click: () => this.callbacks.jump(index) } },
        [el('span', { className: 'fact__mark', attrs: { 'aria-hidden': 'true' } }), el('span', { className: 'fact__lead text-[1.02rem]', text: step.lead })],
      )
      const item = el('li', { className: 'fact', data: { state: 'future' } }, [jump, body])
      list.appendChild(item)
      return item
    })
    const slideFigure = slide.figure ? buildFigure(slide.figure, this.context) : null
    if (slideFigure) this.figures.push(slideFigure)

    this.counter = el('span', { className: 'num t-label text-[0.8rem] text-[var(--ink-2)]' })
    this.previousButton = el(
      'button',
      { className: 'ctl ctl--icon ctl--line', attrs: { type: 'button', 'aria-label': 'Previous step' }, on: { click: () => this.callbacks.previous() } },
      [icon('arrow-left')],
    )
    this.nextButton = el(
      'button',
      { className: 'ctl ctl--solid', attrs: { type: 'button' }, on: { click: () => this.callbacks.next() } },
      ['Next', icon('arrow-right')],
    )
    const footer = el('footer', { className: 'deck-footer mt-6 flex flex-wrap items-center gap-x-3 gap-y-2' }, [
      this.previousButton,
      this.nextButton,
      this.counter,
      el('span', { className: 't-cite ml-auto text-right text-[0.74rem] leading-snug max-w-[28rem]' }, [
        el('span', { className: 'num', text: `${formatMinutes(slide.minutes)} planned. ` }),
        slide.lessonLink,
      ]),
    ])
    const article = el('article', { className: 'deck-enter', attrs: { 'aria-labelledby': 'slide-title' } }, [
      header,
      list,
      slideFigure ? el('div', { className: 'mt-2' }, [slideFigure.element]) : null,
      footer,
    ])
    this.root.appendChild(article)
    this.root.scrollTop = 0
  }

  private reveal(stepIndex: number): void {
    const slide = this.slide
    if (!slide) return
    this.facts.forEach((fact, index) => {
      fact.dataset.state = index < stepIndex ? 'past' : index === stepIndex ? 'current' : 'future'
      const button = fact.querySelector('button')
      if (button) {
        button.disabled = index >= stepIndex
        button.setAttribute('aria-current', index === stepIndex ? 'step' : 'false')
      }
    })
    const current = this.facts[stepIndex]
    if (current) current.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    if (this.counter) this.counter.textContent = `Step ${stepIndex + 1} of ${slide.steps.length}`
    const lastSlide = this.slideIndex >= this.data.slides.length - 1
    const lastStep = stepIndex >= slide.steps.length - 1
    if (this.previousButton) this.previousButton.disabled = this.slideIndex === 0 && stepIndex === 0
    if (this.nextButton) {
      this.nextButton.disabled = lastSlide && lastStep
      this.nextButton.replaceChildren(lastStep && !lastSlide ? 'Next slide' : 'Next', icon('arrow-right'))
    }
  }

  setDiskPhase(phase: DiskPhase): void {
    for (const figure of this.figures) figure.setDiskPhase?.(phase)
  }

  setTapePhase(phase: TapePhase): void {
    for (const figure of this.figures) figure.setTapePhase?.(phase)
  }

  setPower(on: boolean): void {
    for (const figure of this.figures) figure.setPower?.(on)
  }

  setSweeping(on: boolean): void {
    for (const figure of this.figures) figure.setSweeping?.(on)
  }

  markReached(id: string): void {
    for (const figure of this.figures) figure.markReached?.(id)
  }

  clearReached(): void {
    for (const figure of this.figures) figure.clearReached?.()
  }

  setPointer(hovered: string | null, selected: string | null): void {
    for (const figure of this.figures) figure.setPointer?.(hovered, selected)
  }
}
