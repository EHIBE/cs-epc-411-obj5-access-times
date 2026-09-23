import type { Device, FactSheet, HumanScaleEntry } from '../data/types'
import { tierOf } from '../utils/categories'
import { speedGradientCss } from '../utils/color'
import { padRank } from '../utils/format'
import { clamp, invLerp } from '../utils/math'
import { AXIS, placementLog, whiskerSpan } from '../utils/scale'
import { el, richText } from './dom'
import { deviceIcon, icon } from './icons'

export interface SpecCallbacks {
  close: () => void
  step: (direction: 1 | -1) => void
  openQuestion: (id: number) => void
}

/** Notes on how the model draws a device, stated so nobody mistakes a drawing choice for a figure. */
const MODEL_NOTES: Record<string, string> = {
  register: 'Not sold separately, so the depth that encodes cost is drawn unrated (dashed outline).',
  optane:
    'No single published figure: the plate is ghosted and sits in the middle of its stated order-of-magnitude band, which the dashed whisker spans.',
  nand: 'A component rather than a product: capacity and cost per GB do not apply, so the plate is a small dashed square.',
  usb: 'No single published figure: the plate is ghosted and sits inside its stated order of magnitude, after SATA as Section D orders it.',
  'hdd-15k':
    "The human-scale table (Section E) converts this drive's 2.0 ms rotational figure. Section D's total with seek is roughly 5 to 6 ms, which is where its whisker sits.",
  network: 'Capacity is effectively unlimited, so the plate fades out at both ends instead of stopping.',
  optical: 'An estimated order of magnitude: no single vendor access-time figure was found.',
  tape: 'Plate placed at the 55 s midpoint of the 10 to 100 s locate range; the robotic mount and drive load come on top.',
}

/** The device detail sheet that slides in from the right: the fact sheet's full row, its human-scale reading, sources and related questions. */
export class SpecPanel {
  private readonly root: HTMLElement
  private readonly data: FactSheet
  private readonly callbacks: SpecCallbacks
  private readonly humanById: Map<string, HumanScaleEntry>
  private readonly colorOf: (id: string) => string
  private readonly body: HTMLElement
  private readonly heading: HTMLElement
  private device: Device | null = null
  private human = false
  private powerOn = true

  constructor(root: HTMLElement, data: FactSheet, colorOf: (id: string) => string, callbacks: SpecCallbacks) {
    this.root = root
    this.data = data
    this.callbacks = callbacks
    this.colorOf = colorOf
    this.humanById = new Map(data.humanScale.entries.map((entry) => [entry.id, entry]))
    this.heading = el('h2', { id: 'spec-name', className: 't-display text-[clamp(1.35rem,1vw+0.85rem,1.9rem)] pr-10', attrs: { tabindex: -1 } })
    this.body = el('div', { className: 'min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5 pt-5' })
    const close = el(
      'button',
      { className: 'ctl ctl--icon absolute right-3 top-3', attrs: { type: 'button', 'aria-label': 'Close details (Esc)' }, on: { click: () => callbacks.close() } },
      [icon('x')],
    )
    const footer = el('footer', { className: 'flex items-center justify-between gap-2 border-t border-[var(--rule)] px-4 py-2.5' }, [
      el('button', { className: 'ctl', attrs: { type: 'button' }, on: { click: () => callbacks.step(-1) } }, [icon('caret-left'), 'Faster device']),
      el('span', { className: 't-cite text-[0.72rem]' }, [el('kbd', { className: 'keycap', text: '[' }), ' ', el('kbd', { className: 'keycap', text: ']' })]),
      el('button', { className: 'ctl', attrs: { type: 'button' }, on: { click: () => callbacks.step(1) } }, ['Slower device', icon('caret-right')]),
    ])
    root.setAttribute('role', 'dialog')
    root.setAttribute('aria-modal', 'false')
    root.setAttribute('aria-labelledby', 'spec-name')
    root.dataset.open = 'false'
    root.append(close, this.body, footer)
  }

  get isOpen(): boolean {
    return this.device !== null
  }

  show(device: Device, focus: boolean): void {
    this.device = device
    this.render()
    this.root.dataset.open = 'true'
    this.root.removeAttribute('inert')
    this.body.scrollTop = 0
    if (focus) this.heading.focus({ preventScroll: true })
  }

  hide(): void {
    this.device = null
    this.root.dataset.open = 'false'
    this.root.setAttribute('inert', '')
  }

  setHuman(on: boolean): void {
    this.human = on
    if (this.device) this.render()
  }

  setPower(on: boolean): void {
    this.powerOn = on
    if (this.device) this.render()
  }

  private render(): void {
    const device = this.device
    if (!device) return
    const tier = tierOf(device.tier)
    const color = this.colorOf(device.id)
    const human = this.humanById.get(device.id)
    this.heading.textContent = device.name
    const lost = device.volatile && !this.powerOn

    const badge = el('div', { className: 'mb-3 flex items-center gap-2.5' }, [
      el('span', {
        className: 'inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[0.85rem] font-bold text-[#131a21]',
        style: { background: color },
      }, [deviceIcon(device.icon), el('span', { className: 'num', text: padRank(device.rank) })]),
      el('span', { className: 't-label text-[0.8rem] text-[var(--ink-2)]', text: `${tier.name} tier, rank ${device.rank} of ${this.data.devices.length}` }),
    ])

    const reading = el('section', { className: 'mt-4', attrs: { 'aria-label': 'Access time' } })
    if (lost) {
      reading.append(
        el('p', { className: 't-reading text-[clamp(2rem,2vw+1rem,3rem)]', text: 'Contents lost' }),
        el('p', { className: 'mt-2 text-[0.86rem] text-[var(--ink-2)]', text: 'Volatile: the power was cut, so this tier holds nothing until it is restored and reloaded.' }),
      )
    } else if (this.human && human) {
      reading.append(el('p', { className: 't-reading text-[clamp(2.1rem,2.3vw+1rem,3.4rem)]', text: human.human }))
      if (human.gloss) reading.append(el('p', { className: 'mt-1.5 text-[1rem] font-semibold text-[var(--ink-2)]', text: human.gloss }))
      reading.append(el('p', { className: 't-cite mt-2 text-[0.8rem]', text: `If 1 ns were 1 second. Real time used: ${human.realText}.` }))
    } else {
      reading.append(
        el('p', { className: 't-reading text-[clamp(2rem,2.1vw+0.95rem,3.2rem)]' }, [richText(device.calloutText)]),
        el('p', { className: 'mt-2 text-[0.9rem] text-[var(--ink-2)]' }, ['Order of magnitude ', el('strong', { className: 'num text-[var(--ink)]' }, [richText(device.orderOfMagnitude.text)])]),
      )
      if (this.human && !human) {
        reading.appendChild(el('p', { className: 't-cite mt-2 text-[0.8rem]', text: 'Not in the human-scale table: the fact sheet gives no single figure to convert.' }))
      }
    }
    reading.appendChild(this.gauge(device))

    const humanRow = human && !this.human
      ? el('p', { className: 'mt-4 rounded-lg bg-[var(--well)] px-3 py-2.5 text-[0.88rem] leading-snug' }, [
          el('span', { className: 'text-[var(--ink-2)]', text: 'If 1 ns were 1 second: ' }),
          el('strong', { text: human.human }),
          human.gloss ? `, ${human.gloss}` : '',
        ])
      : null

    const rows: [string, Node | string][] = [
      ['Typical access time', richText(device.accessText)],
      ['Order of magnitude', richText(device.orderOfMagnitude.text)],
      ['Dominant delay', device.dominantDelay],
      ['Volatile?', device.volatile ? 'Yes' : 'No'],
      ['Relative cost per GB', device.cost.text],
      ['Typical capacity (2026)', device.capacity.text],
    ]
    const list = el('dl', { className: 'mt-5' }, rows.map(([term, value]) => el('div', { className: 'spec-row' }, [el('dt', { text: term }), el('dd', {}, [value])])))

    const use = el('p', { className: 'mt-4 text-[1.02rem] italic leading-snug text-[var(--ink)]' }, [
      el('span', { className: 'not-italic font-semibold text-[var(--ink-2)] text-[0.8rem] block mb-1', text: 'Typical use' }),
      device.typicalUse,
    ])

    const facts = device.facts.length
      ? el('section', { className: 'mt-5' }, [
          el('h3', { className: 'text-[0.8rem] font-bold text-[var(--ink-2)] [font-stretch:92%]', text: 'From the fact sheet' }),
          el('ul', { className: 'mt-1.5 grid gap-1.5' }, device.facts.map((fact) => el('li', { className: 'text-[0.86rem] leading-snug' }, [richText(fact)]))),
        ])
      : null

    const modelNote = MODEL_NOTES[device.id]
    const note = modelNote
      ? el('p', { className: 'mt-4 flex gap-2 rounded-lg border border-[var(--rule)] px-3 py-2.5 text-[0.8rem] leading-snug text-[var(--ink-2)]' }, [icon('info'), modelNote])
      : null

    const references = device.referenceIds
      .map((id) => this.data.references.find((reference) => reference.id === id))
      .filter((reference) => reference !== undefined)
    const source = el('section', { className: 'mt-5' }, [
      el('h3', { className: 'text-[0.8rem] font-bold text-[var(--ink-2)] [font-stretch:92%]', text: 'Source' }),
      el('p', { className: 'mt-1 text-[0.86rem]', text: device.source }),
      references.length
        ? el(
            'ul',
            { className: 'mt-2 grid gap-2' },
            references.map((reference) =>
              el('li', { className: 't-cite text-[0.76rem] leading-snug' }, [
                richText(reference.apa),
                reference.url
                  ? el('a', { className: 'ml-1 inline-flex items-center gap-0.5 break-all', attrs: { href: reference.url, target: '_blank', rel: 'noopener noreferrer' } }, [
                      'Open source',
                      icon('arrow-square-out'),
                    ])
                  : null,
              ]),
            ),
          )
        : null,
    ])

    const questions = device.questionIds
      .map((id) => this.data.questions.find((question) => question.id === id))
      .filter((question) => question !== undefined)
    const related = questions.length
      ? el('section', { className: 'mt-5' }, [
          el('h3', { className: 'text-[0.8rem] font-bold text-[var(--ink-2)] [font-stretch:92%]', text: 'Likely questions' }),
          el(
            'ul',
            { className: 'mt-1.5 grid gap-1' },
            questions.map((question) =>
              el('li', {}, [
                el('button', {
                  className: 'w-full rounded-md px-2 py-1.5 text-left text-[0.84rem] leading-snug hover:bg-[var(--well)]',
                  attrs: { type: 'button' },
                  on: { click: () => this.callbacks.openQuestion(question.id) },
                }, [el('span', { className: 'num mr-1.5 font-bold', text: `Q${question.id}` }), question.question]),
              ]),
            ),
          ),
        ])
      : null

    this.body.replaceChildren(badge, this.heading, reading, humanRow ?? '', list, use, facts ?? '', note ?? '', source, related ?? '')
  }

  /** The device's place on the full 13-decade axis: its range or band as a bracket, its plate as a dot. */
  private gauge(device: Device): HTMLElement {
    const span = whiskerSpan(device)
    const toPercent = (log: number): number => clamp(invLerp(AXIS.logTop, AXIS.logBottom, log), 0, 1) * 100
    const point = toPercent(placementLog(device))
    const track = el('div', { className: 'gauge mt-4', style: { background: speedGradientCss() }, attrs: { role: 'img', 'aria-label': 'Position on the access-time axis from 10 picoseconds to 1,000 seconds' } }, [
      span
        ? el('div', { className: 'gauge__range', style: { left: `${toPercent(span.from)}%`, width: `${Math.max(1.2, toPercent(span.to) - toPercent(span.from))}%` } })
        : null,
      el('div', { className: 'gauge__point', style: { left: `${point}%` } }),
    ])
    const marks: [number, string][] = [
      [-11, '10 ps'],
      [-9, '1 ns'],
      [-6, '1 µs'],
      [-3, '1 ms'],
      [0, '1 s'],
      [3, '1,000 s'],
    ]
    const scale = el(
      'div',
      { className: 'num relative mt-1.5 h-4 text-[0.72rem] text-[var(--ink-3)]' },
      marks.map(([log, text], index) =>
        el('span', {
          className: 'absolute whitespace-nowrap',
          text,
          style: {
            left: `${toPercent(log)}%`,
            transform: index === 0 ? 'none' : index === marks.length - 1 ? 'translateX(-100%)' : 'translateX(-50%)',
          },
        }),
      ),
    )
    return el('div', {}, [track, scale])
  }
}
