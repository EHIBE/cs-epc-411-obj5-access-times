import type { Device, FactSheet, FigureId, HumanScaleEntry } from '../data/types'
import type { DiskPhase } from '../objects/HardDiskSpecimen'
import { SLOWDOWN, SPINDLES } from '../objects/SpindleTrioSpecimen'
import type { TapePhase } from '../objects/TapeSpecimen'
import { ACCESS_BRANCHES } from '../utils/categories'
import { padRank } from '../utils/format'
import { clamp, invLerp } from '../utils/math'
import { toSeconds } from '../utils/scale'
import { el, richText, svg } from './dom'
import { icon } from './icons'

export interface FigureActions {
  select: (id: string) => void
  hover: (id: string | null) => void
  togglePower: () => void
  runSweep: () => void
  openTable: () => void
}

export interface FigureContext {
  data: FactSheet
  colorOf: (id: string) => string
  actions: FigureActions
  isPowerOn: () => boolean
  isSweeping: () => boolean
}

export interface LiveFigure {
  element: HTMLElement
  setDiskPhase?: (phase: DiskPhase) => void
  setTapePhase?: (phase: TapePhase) => void
  setPower?: (on: boolean) => void
  setSweeping?: (on: boolean) => void
  markReached?: (id: string) => void
  clearReached?: () => void
  setPointer?: (hovered: string | null, selected: string | null) => void
}

const frame = (label: string, children: (Node | string)[]): HTMLElement =>
  el('figure', { className: 'figure-block mt-4', attrs: { 'aria-label': label } }, children)

const caption = (text: string): HTMLElement =>
  el('figcaption', { className: 't-cite mt-2 text-[0.76rem] leading-snug', text })

/** Lesson 2, Slide 1's title diagram redrawn: the two access-method branches and the media on each. */
function branches(): LiveFigure {
  const width = 440
  const drawing = svg('svg', { viewBox: `0 0 ${width} 150`, class: 'w-full h-auto', role: 'img', 'aria-label': 'Sequential access branches to paper and magnetic tape; direct access branches to magnetic disk and optical disc' })
  ACCESS_BRANCHES.forEach((branch, column) => {
    const x = column * 225 + 5
    drawing.append(
      svg('rect', { x, y: 4, width: 210, height: 34, rx: 7, fill: 'var(--ink)' }),
      svg('text', { x: x + 105, y: 26, 'text-anchor': 'middle', fill: 'var(--ground)', 'font-size': 13, 'font-weight': 700 }, [branch.name]),
    )
    branch.media.forEach((medium, row) => {
      const y = 62 + row * 44
      drawing.append(
        svg('path', { d: `M${x + 18} 38 V${y + 17} H${x + 30}`, fill: 'none', stroke: 'var(--ink-2)', 'stroke-width': 1 }),
        svg('rect', { x: x + 30, y, width: 180, height: 34, rx: 7, fill: 'var(--sheet)', stroke: 'var(--rule-strong)', 'stroke-width': 1 }),
        svg('text', { x: x + 42, y: y + 21, fill: 'var(--ink)', 'font-size': 11.5, 'font-weight': 560 }, [medium.label]),
      )
    })
  })
  return { element: frame('Lesson 2 title-slide diagram', [drawing, caption('Redrawn from Lesson 2, Slide 1.')]) }
}

/** The three-box flow from Slide 2's visual, lit in step with the hard disk model. */
function flow(): LiveFigure {
  const steps: { phase: DiskPhase; label: string }[] = [
    { phase: 'seek', label: 'Seek' },
    { phase: 'rotate', label: 'Rotate / search' },
    { phase: 'transfer', label: 'Transfer' },
    { phase: 'ready', label: 'Data ready' },
  ]
  const boxes = new Map<DiskPhase, HTMLElement>()
  const row = el('ol', { className: 'grid grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] items-center gap-1.5' })
  steps.forEach((step, index) => {
    const box = el('li', {
      className: 'flow-step rounded-lg border border-[var(--rule-strong)] px-2 py-2 text-center text-[0.8rem] font-semibold leading-tight',
      text: step.label,
    })
    boxes.set(step.phase, box)
    row.appendChild(box)
    if (index < steps.length - 1) row.appendChild(el('li', { attrs: { 'aria-hidden': 'true' }, className: 'text-[var(--ink-3)]' }, [icon('arrow-right')]))
  })
  return {
    element: frame('Access time flow', [row, caption('Lit by the hard disk model as each phase happens.')]),
    setDiskPhase(phase) {
      boxes.forEach((box, key) => {
        box.dataset.active = String(key === phase)
      })
    },
  }
}

/** Lesson 1, Slide 5's recap table exactly as the fact sheet quotes it. */
function recap(): LiveFigure {
  const rows = [
    ['Primary / main memory', 'RAM, cache', 'Very fast', 'Small', 'Volatile'],
    ['Secondary / persistent', 'HDD, SSD, USB', 'Medium', 'Large', 'Non-volatile'],
    ['Tertiary', 'Tape, optical archive', 'Slow', 'Very large', 'Non-volatile'],
  ]
  const table = el('table', { className: 'data-table text-left' }, [
    el('thead', {}, [el('tr', {}, ['Tier', 'Devices', 'Speed', 'Size', 'Volatility'].map((text) => el('th', { text, attrs: { scope: 'col' } })))]),
    el('tbody', {}, rows.map((cells) => el('tr', { style: { cursor: 'default' } }, cells.map((text, index) => el(index === 0 ? 'th' : 'td', { text, attrs: index === 0 ? { scope: 'row' } : {} }))))),
  ])
  return { element: frame('Lesson 1 recap table', [table, caption('Lesson 1, Slide 5. The 3D brackets mark the same three tiers.')]) }
}

/** Slide 4's visual: registers through DRAM on one log axis, all under 100 ns. */
function nanobars(context: FigureContext): LiveFigure {
  const ids = ['register', 'l1', 'l2', 'l3', 'dram']
  const low = -2
  const high = 2
  const toPercent = (nanoseconds: number): number => clamp(invLerp(low, high, Math.log10(nanoseconds)), 0, 1) * 100
  const list = el('div', { className: 'grid gap-1.5' })
  for (const id of ids) {
    const device = context.data.devices.find((entry) => entry.id === id)
    if (!device) continue
    const min = device.range ? toSeconds(device.range.min, device.range.unit) * 1e9 : toSeconds(device.accessTime ?? 1, device.unit) * 1e9
    const max = device.range ? toSeconds(device.range.max, device.range.unit) * 1e9 : min
    const track = el('div', { className: 'relative h-3.5 rounded-full bg-[var(--well)]' }, [
      el('div', {
        className: 'absolute inset-y-0 left-0 rounded-full',
        style: { width: `${toPercent(max)}%`, background: context.colorOf(id), opacity: device.range ? '0.35' : '1' },
      }),
      el('div', { className: 'absolute inset-y-0 left-0 rounded-full', style: { width: `${toPercent(min)}%`, background: context.colorOf(id) } }),
    ])
    list.appendChild(
      el('div', { className: 'grid grid-cols-[4.2rem_1fr_6.2rem] items-center gap-2 text-[0.78rem]' }, [
        el('span', { className: 'font-semibold', text: device.shortName }),
        track,
        el('span', { className: 'num text-right text-[var(--ink-2)]' }, [richText(device.calloutText)]),
      ]),
    )
  }
  const axis = el('div', { className: 'grid grid-cols-[4.2rem_1fr_6.2rem] gap-2 text-[0.72rem] text-[var(--ink-3)]' }, [
    el('span'),
    el('div', { className: 'num flex justify-between' }, ['0.01 ns', '0.1 ns', '1 ns', '10 ns', '100 ns'].map((text) => el('span', { text }))),
    el('span'),
  ])
  return {
    element: frame('Log-scale bar chart, registers to DRAM', [list, axis, caption('Log scale: each gridline is ten times the one before. Paler ends mark a stated range.')]),
  }
}

/** The volatility demonstration: cut the power and watch everything above 10⁻⁷ s forget. */
function power(context: FigureContext): LiveFigure {
  const label = el('span')
  const glyph = el('span', { className: 'inline-flex' })
  const status = el('p', { className: 'mt-2 text-[0.82rem] leading-snug text-[var(--ink-2)]' })
  const button = el('button', { className: 'ctl ctl--solid', attrs: { type: 'button' }, on: { click: () => context.actions.togglePower() } }, [glyph, label])
  const render = (on: boolean) => {
    glyph.replaceChildren(icon(on ? 'lightning-slash' : 'plugs-connected'))
    label.textContent = on ? 'Cut the power' : 'Restore power'
    button.setAttribute('aria-pressed', String(!on))
    status.textContent = on
      ? 'Section D marks registers, all three caches and DRAM as volatile.'
      : 'Registers, cache and DRAM lost their contents. Byte-addressable NVM and everything below kept theirs.'
  }
  render(context.isPowerOn())
  return { element: frame('Power demonstration', [el('div', { className: 'flex flex-wrap items-center gap-3' }, [button, el('span', { className: 't-cite text-[0.74rem]' }, ['Shortcut ', el('kbd', { className: 'keycap', text: 'P' })])]), status]), setPower: render }
}

/** Slide 5's worked figures as a table: rotation time from 60 / RPM, average latency as half a turn. */
function rpm(): LiveFigure {
  const rows = SPINDLES.map((spindle) => {
    const turn = 60000 / spindle.rpm
    return el('tr', { style: { cursor: 'default' } }, [
      el('th', { text: spindle.label, attrs: { scope: 'row' } }),
      el('td', { className: 'num', text: `${turn.toFixed(spindle.rpm === 15000 ? 0 : spindle.rpm === 7200 ? 2 : 1)} ms` }),
      el('td', { className: 'num', text: spindle.average.replace(' average', '') }),
    ])
  })
  const table = el('table', { className: 'data-table' }, [
    el('thead', {}, [el('tr', {}, ['Spindle', 'One turn (60 / RPM)', 'Average latency'].map((text) => el('th', { text, attrs: { scope: 'col' } })))]),
    el('tbody', {}, rows),
  ])
  return {
    element: frame('Rotational latency by spindle speed', [
      table,
      caption(`7,200 RPM measured on a real drive (Seagate Technology, 2019); 15,000 RPM as rated (Seagate Technology, 2015). The model spins ${SLOWDOWN} times slower than real.`),
    ]),
  }
}

/** Slide 6's side-by-side: queue shape and IOPS ceiling for each protocol, bars to scale. */
function queues(): LiveFigure {
  const row = (name: string, queuesText: string, iops: string, fraction: number, past: boolean) =>
    el('div', { className: 'grid grid-cols-[5.5rem_1fr] items-center gap-3' }, [
      el('div', {}, [el('div', { className: 'text-[0.86rem] font-bold', text: name }), el('div', { className: 't-cite text-[0.7rem]', text: queuesText })]),
      el('div', {}, [
        el('div', { className: 'relative h-4 rounded-full bg-[var(--well)]' }, [
          el('div', { className: 'absolute inset-y-0 left-0 rounded-full bg-[var(--ink)]', style: { width: `${fraction * 100}%` } }),
          past ? el('div', { className: 'absolute -right-0.5 -top-1 bottom-[-0.25rem] w-px bg-[var(--ink)]' }) : null,
        ]),
        el('div', { className: 'num mt-1 text-[0.76rem] text-[var(--ink-2)]', text: iops }),
      ]),
    ])
  return {
    element: frame('SATA versus NVMe', [
      el('div', { className: 'grid gap-3' }, [
        row('SATA (AHCI)', '1 queue, 32 commands', 'about 200,000 IOPS', 0.2, false),
        row('NVMe', 'up to 64,000 queues, 64,000 commands each', 'past 1,000,000 IOPS (demonstrated)', 1, true),
      ]),
      caption('IOPS bars to scale (NVM Express, n.d.).'),
    ]),
  }
}

/** Slide 7's visual: where the tape's wait sits before a single byte streams, drawn in seconds. */
function tape(): LiveFigure {
  const total = 121
  const segments: { phase: Exclude<TapePhase, null>; label: string; min: number; max: number }[] = [
    { phase: 'mount', label: 'Robotic mount', min: 4, max: 10 },
    { phase: 'load', label: 'Drive load', min: 11, max: 11 },
    { phase: 'locate', label: 'Locate', min: 10, max: 100 },
  ]
  const nodes = new Map<string, HTMLElement>()
  const bar = el('div', { className: 'flex h-9 w-full overflow-hidden rounded-lg border border-[var(--rule-strong)]' })
  const legend = el('div', { className: 'mt-2 grid grid-cols-4 gap-2 text-[0.72rem] leading-tight' })
  for (const segment of segments) {
    const fixed = (segment.min / total) * 100
    const variable = ((segment.max - segment.min) / total) * 100
    const part = el('div', { className: 'flow-step flex h-full border-r border-[var(--rule-strong)]', style: { width: `${fixed + variable}%` } }, [
      el('div', { className: 'h-full bg-[var(--ink-3)] opacity-60', style: { width: `${(fixed / (fixed + variable)) * 100}%` } }),
      el('div', { className: 'h-full flex-1 bg-[repeating-linear-gradient(135deg,var(--rule)_0_4px,transparent_4px_8px)]' }),
    ])
    nodes.set(segment.phase, part)
    bar.appendChild(part)
    legend.appendChild(
      el('div', {}, [
        el('div', { className: 'font-semibold', text: segment.label }),
        el('div', { className: 'num text-[var(--ink-3)]', text: segment.min === segment.max ? `about ${segment.max} s` : `${segment.min} to ${segment.max} s` }),
      ]),
    )
  }
  const stream = el('div', { className: 'flow-step flex h-full flex-1 items-center justify-center bg-[var(--sheet)] px-1 text-[0.72rem] font-bold', text: 'Stream' })
  nodes.set('stream', stream)
  bar.appendChild(stream)
  legend.appendChild(
    el('div', {}, [el('div', { className: 'font-semibold', text: 'Stream' }), el('div', { className: 'num text-[var(--ink-3)]', text: '400 MB/s native' })]),
  )
  return {
    element: frame('Tape access timeline', [
      bar,
      legend,
      caption('Solid: the minimum. Hatched: how much longer it can take (Moore, 2020). Streaming then runs at 400 MB/s native (LTO Program, n.d.).'),
    ]),
    setTapePhase(phase) {
      nodes.forEach((node, key) => {
        node.dataset.active = String(key === phase)
      })
    },
  }
}

/** Slide 8: Section D, condensed for projection; rows light as the probe passes and open a device when clicked. */
function table(context: FigureContext): LiveFigure {
  const rows = new Map<string, HTMLTableRowElement>()
  const body = el('tbody')
  for (const device of context.data.devices) {
    const row = el(
      'tr',
      {
        attrs: { tabindex: 0, 'aria-label': `${device.name}, open details` },
        on: {
          click: () => context.actions.select(device.id),
          keydown: (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              context.actions.select(device.id)
            }
          },
          mouseenter: () => context.actions.hover(device.id),
          mouseleave: () => context.actions.hover(null),
        },
      },
      [
        el('td', { className: 'num text-[var(--ink-3)]' }, [
          el('span', { className: 'mr-1.5 inline-block h-2.5 w-2.5 rounded-sm align-middle', style: { background: context.colorOf(device.id) } }),
          padRank(device.rank),
        ]),
        el('td', { className: 'font-semibold', text: device.name }),
        el('td', {}, [richText(device.accessText)]),
        el('td', { className: 'num whitespace-nowrap' }, [richText(device.orderOfMagnitude.text)]),
        el('td', { text: device.volatile ? 'Yes' : 'No' }),
        el('td', { text: device.cost.text }),
        el('td', { text: device.capacity.text }),
      ],
    )
    rows.set(device.id, row)
    body.appendChild(row)
  }
  const head = el('thead', {}, [
    el('tr', {}, ['#', 'Device', 'Typical access time', 'Order of magnitude', 'Volatile?', 'Relative cost per GB', 'Typical capacity (2026)'].map((text) => el('th', { text, attrs: { scope: 'col' } }))),
  ])
  const sweepLabel = el('span', { text: 'Run the probe' })
  const sweepButton = el('button', { className: 'ctl ctl--solid', attrs: { type: 'button' }, on: { click: () => context.actions.runSweep() } }, [icon('play'), sweepLabel])
  const element = frame('Master comparison table', [
    el('div', { className: 'max-h-[min(46dvh,34rem)] overflow-auto rounded-lg border border-[var(--rule)] bg-[var(--sheet)]' }, [el('table', { className: 'data-table' }, [head, body])]),
    el('div', { className: 'mt-3 flex flex-wrap items-center gap-2' }, [
      sweepButton,
      el('button', { className: 'ctl ctl--line', attrs: { type: 'button' }, on: { click: () => context.actions.openTable() } }, [icon('table'), 'All nine columns']),
    ]),
    caption(context.data.sectionNote),
  ])
  return {
    element,
    markReached(id) {
      const row = rows.get(id)
      if (!row) return
      row.dataset.reached = 'true'
      row.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    },
    clearReached() {
      rows.forEach((row) => {
        row.dataset.reached = 'false'
      })
    },
    setPointer(hovered, selected) {
      rows.forEach((row, id) => {
        row.dataset.focus = String(id === hovered || id === selected)
      })
    },
    setSweeping(on) {
      sweepLabel.textContent = on ? 'Probe running' : 'Run the probe'
      sweepButton.toggleAttribute('disabled', on)
    },
  }
}

/** Slide 9's visual: a horizontal timeline from a blink to a millennium with every converted device on it. */
function human(context: FigureContext): LiveFigure {
  const low = -2
  const high = 4.5 + Math.log10(31_536_000)
  const position = (humanSeconds: number): number => clamp(invLerp(low, high, Math.log10(humanSeconds)), 0, 1) * 100
  const track = el('div', { className: 'relative mt-7 h-1.5 rounded-full', style: { background: 'var(--rule-strong)' } })
  const ticks: { label: string; seconds: number }[] = [
    { label: '1 s', seconds: 1 },
    { label: '1 min', seconds: 60 },
    { label: '1 h', seconds: 3600 },
    { label: '1 day', seconds: 86_400 },
    { label: '1 mo', seconds: 2_592_000 },
    { label: '1 yr', seconds: 31_536_000 },
    { label: '100 yr', seconds: 3_153_600_000 },
    { label: '1,000 yr', seconds: 31_536_000_000 },
  ]
  const axis = el('div', { className: 'relative mt-2 h-4 text-[0.72rem] text-[var(--ink-3)]' })
  for (const tick of ticks) {
    const left = position(tick.seconds)
    track.appendChild(el('span', { className: 'absolute top-1/2 h-3 w-px -translate-y-1/2 bg-[var(--ink-2)]', style: { left: `${left}%` } }))
    axis.appendChild(el('span', { className: 'num absolute -translate-x-1/2 whitespace-nowrap', text: tick.label, style: { left: `${left}%` } }))
  }
  const headlines = new Set(['l1', 'hdd-7200', 'tape'])
  const readout = el('p', { className: 'mt-3 min-h-[2.6em] text-[0.84rem] leading-snug', attrs: { 'aria-live': 'polite' } })
  const describe = (entry: HumanScaleEntry, device: Device | undefined) => {
    readout.replaceChildren(
      el('strong', { text: device?.shortName ?? entry.device }),
      `: ${entry.realText} becomes ${entry.human}${entry.gloss ? `, ${entry.gloss}` : ''}`,
    )
  }
  for (const entry of context.data.humanScale.entries) {
    const device = context.data.devices.find((candidate) => candidate.id === entry.id)
    const left = position(entry.nanoseconds)
    const dot = el('button', {
      className: 'timeline-dot absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--sheet)]',
      style: { left: `${left}%`, background: context.colorOf(entry.id) },
      attrs: { type: 'button', 'aria-label': `${entry.device}: ${entry.human}` },
      on: {
        mouseenter: () => {
          describe(entry, device)
          context.actions.hover(entry.id)
        },
        focus: () => describe(entry, device),
        mouseleave: () => context.actions.hover(null),
        click: () => context.actions.select(entry.id),
      },
    })
    track.appendChild(dot)
    if (headlines.has(entry.id)) {
      track.appendChild(
        el('span', {
          className: 'absolute bottom-3 -translate-x-1/2 whitespace-nowrap text-[0.7rem] font-bold',
          text: entry.human.replace('about ', ''),
          style: { left: `${Math.min(92, Math.max(6, left))}%` },
        }),
      )
    }
  }
  const first = context.data.humanScale.entries.find((entry) => entry.id === 'l1')
  if (first) describe(first, context.data.devices.find((device) => device.id === 'l1'))
  const sweepLabel = el('span', { text: 'Run the probe in human time' })
  const sweepButton = el('button', { className: 'ctl ctl--line mt-3', attrs: { type: 'button' }, on: { click: () => context.actions.runSweep() } }, [icon('hourglass-medium'), sweepLabel])
  return {
    element: frame('Human-scale timeline', [
      el('div', { className: 'relative' }, [track, axis]),
      readout,
      sweepButton,
      caption(`${context.data.humanScale.methodNote} Hover or tab to a dot for its conversion.`),
    ]),
    setSweeping(on) {
      sweepLabel.textContent = on ? 'Probe running' : 'Run the probe in human time'
      sweepButton.toggleAttribute('disabled', on)
    },
    setPointer(hovered) {
      const entry = context.data.humanScale.entries.find((candidate) => candidate.id === hovered)
      if (entry) describe(entry, context.data.devices.find((device) => device.id === entry.id))
    },
  }
}

/** Builds the figure for a slide or step; each returns a live handle the deck forwards scene events to. */
export function buildFigure(id: FigureId, context: FigureContext): LiveFigure {
  switch (id) {
    case 'branches':
      return branches()
    case 'flow':
      return flow()
    case 'recap':
      return recap()
    case 'nanobars':
      return nanobars(context)
    case 'power':
      return power(context)
    case 'rpm':
      return rpm()
    case 'queues':
      return queues()
    case 'tape':
      return tape()
    case 'table':
      return table(context)
    case 'human':
      return human(context)
    default:
      return { element: el('div') }
  }
}

