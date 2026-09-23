import { speedColor } from '../utils/color'
import { el, svg } from './dom'
import { icon, type IconName } from './icons'

export interface TopBarActions {
  toggleHuman: () => void
  openTable: () => void
  openQuestions: () => void
  openSources: () => void
  toggleDeck: () => void
  toggleTheme: () => void
  toggleFullscreen: () => void
  openHelp: () => void
}

/** The brand mark: four strata of widening width in the speed ramp, drawn rather than typed. */
function strataMark(): SVGSVGElement {
  const mark = svg('svg', { viewBox: '0 0 28 28', width: 28, height: 28, 'aria-hidden': 'true' })
  const rows: [number, number, number][] = [
    [0.02, 5, 4],
    [0.3, 10, 9],
    [0.62, 15, 14],
    [1, 24, 21],
  ]
  for (const [t, width, y] of rows) {
    mark.appendChild(svg('rect', { x: 14 - width / 2, y, width, height: 3.4, rx: 1.2, fill: speedColor(t) }))
  }
  mark.appendChild(svg('rect', { x: 1, y: 2, width: 2.2, height: 24, rx: 1, fill: 'var(--ink)' }))
  return mark
}

/** The title bar: the deck's identity on the left, the human-time switch and presenter controls on the right. */
export class TopBar {
  private readonly humanSwitch: HTMLButtonElement
  private readonly themeButton: HTMLButtonElement
  private readonly fullscreenButton: HTMLButtonElement
  private readonly deckButton: HTMLButtonElement

  constructor(root: HTMLElement, actions: TopBarActions) {
    this.humanSwitch = el(
      'button',
      {
        className: 'ctl ctl--line gap-2.5 pr-2',
        attrs: { type: 'button', role: 'switch', 'aria-checked': 'false', title: 'Human time (H)' },
        on: { click: () => actions.toggleHuman() },
      },
      [
        el('span', { className: 'flex flex-col items-start leading-none' }, [
          el('span', { className: 'text-[0.84rem] font-bold text-[var(--ink)]', text: 'Human time' }),
          el('span', { className: 'switch-note num mt-0.5 text-[0.68rem] font-medium text-[var(--ink-3)]', text: '1 ns = 1 s' }),
        ]),
        el('span', { className: 'switch', attrs: { 'aria-hidden': 'true' } }),
      ],
    )
    const labelled = (name: IconName, label: string, onClick: () => void, shortcut?: string): HTMLButtonElement =>
      el('button', { className: 'ctl', attrs: { type: 'button', title: shortcut ? `${label} (${shortcut})` : label }, on: { click: onClick } }, [
        icon(name),
        el('span', { className: 'hidden xl:inline', text: label }),
      ])
    const plain = (name: IconName, label: string, onClick: () => void): HTMLButtonElement =>
      el('button', { className: 'ctl ctl--icon', attrs: { type: 'button', 'aria-label': label, title: label }, on: { click: onClick } }, [icon(name)])
    this.deckButton = plain('sidebar-simple', 'Hide the slide panel (E)', actions.toggleDeck)
    this.themeButton = plain('moon', 'Switch to the dark theme (T)', actions.toggleTheme)
    this.fullscreenButton = plain('corners-out', 'Full screen (F)', actions.toggleFullscreen)
    root.append(
      el('div', { className: 'flex min-w-0 items-center gap-3' }, [
        strataMark(),
        el('div', { className: 'brand-text min-w-0 leading-tight' }, [
          el('p', { className: 'truncate text-[0.98rem] font-bold [font-stretch:112%]', text: 'Access times' }),
          el('p', { className: 't-cite truncate text-[0.72rem]', text: 'Objective #5 of Lesson 2, Device Management' }),
        ]),
      ]),
      el('div', { className: 'flex items-center gap-1' }, [
        this.humanSwitch,
        el('span', { className: 'mx-1.5 h-6 w-px bg-[var(--rule)]', attrs: { 'aria-hidden': 'true' } }),
        labelled('table', 'Table', actions.openTable, 'M'),
        labelled('question', 'Questions', actions.openQuestions, 'Q'),
        labelled('books', 'Sources', actions.openSources),
        this.deckButton,
        this.themeButton,
        this.fullscreenButton,
        plain('keyboard', 'Keyboard shortcuts (?)', actions.openHelp),
      ]),
    )
  }

  setHuman(on: boolean): void {
    this.humanSwitch.setAttribute('aria-checked', String(on))
  }

  setTheme(dark: boolean): void {
    const label = dark ? 'Switch to the light theme (T)' : 'Switch to the dark theme (T)'
    this.themeButton.replaceChildren(icon(dark ? 'sun' : 'moon'))
    this.themeButton.setAttribute('aria-label', label)
    this.themeButton.title = label
  }

  setFullscreen(on: boolean): void {
    const label = on ? 'Exit full screen (F)' : 'Full screen (F)'
    this.fullscreenButton.replaceChildren(icon(on ? 'corners-in' : 'corners-out'))
    this.fullscreenButton.setAttribute('aria-label', label)
    this.fullscreenButton.title = label
  }

  setDeckHidden(hidden: boolean): void {
    const label = hidden ? 'Show the slide panel (E)' : 'Hide the slide panel (E)'
    this.deckButton.setAttribute('aria-pressed', String(hidden))
    this.deckButton.setAttribute('aria-label', label)
    this.deckButton.title = label
  }
}
