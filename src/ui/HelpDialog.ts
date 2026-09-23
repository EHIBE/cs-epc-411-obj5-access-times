import { el } from './dom'
import { icon } from './icons'

export const SHORTCUTS: readonly { keys: string[]; action: string }[] = [
  { keys: ['ArrowRight', 'Space', 'Page Down'], action: 'Next step (a clicker works too)' },
  { keys: ['ArrowLeft', 'Page Up'], action: 'Previous step' },
  { keys: ['Shift', 'ArrowRight'], action: 'Jump to the next slide' },
  { keys: ['1', 'to', '0'], action: 'Go to slide 1 to 10' },
  { keys: ['H'], action: 'Human time: 1 ns becomes 1 s' },
  { keys: ['S'], action: 'Run the probe down the column' },
  { keys: ['P'], action: 'Cut or restore the power' },
  { keys: ['M'], action: 'Master comparison table' },
  { keys: ['Q'], action: 'Likely questions' },
  { keys: ['[', ']'], action: 'Faster or slower device, while details are open' },
  { keys: ['E'], action: 'Hide or show the slide panel' },
  { keys: ['N'], action: 'Presenter notes: timings, lesson links and cues' },
  { keys: ['R'], action: 'Reset the camera to this step' },
  { keys: ['T'], action: 'Light or dark theme' },
  { keys: ['F'], action: 'Full screen' },
  { keys: ['B'], action: 'Blank the screen' },
  { keys: ['Esc'], action: 'Close details or dialogs' },
]

/** Renders one key: arrow keys as drawn icons, the word "to" as plain text, anything else as a labelled keycap. */
function keycap(key: string): HTMLElement {
  if (key === 'to') return el('span', { className: 't-cite text-[0.76rem]', text: 'to' })
  if (key === 'ArrowRight' || key === 'ArrowLeft') {
    return el('kbd', { className: 'keycap', attrs: { 'aria-label': key === 'ArrowRight' ? 'Right arrow' : 'Left arrow' } }, [
      icon(key === 'ArrowRight' ? 'arrow-right' : 'arrow-left'),
    ])
  }
  return el('kbd', { className: 'keycap', text: key })
}

/** The keyboard shortcut sheet, opened with the question-mark key. */
export class HelpDialog {
  private readonly dialog: HTMLDialogElement

  constructor(dialog: HTMLDialogElement) {
    this.dialog = dialog
    dialog.className = 'drawer max-w-[40rem]'
    dialog.setAttribute('aria-labelledby', 'help-title')
    const close = el('button', { className: 'ctl ctl--icon', attrs: { type: 'button', 'aria-label': 'Close' }, on: { click: () => this.close() } }, [icon('x')])
    dialog.append(
      el('header', { className: 'flex items-center gap-4 border-b border-[var(--rule)] px-6 py-4' }, [
        el('h2', { id: 'help-title', className: 'text-[1.2rem] font-bold [font-stretch:110%]', text: 'Keyboard shortcuts' }),
        el('div', { className: 'ml-auto' }, [close]),
      ]),
      el(
        'dl',
        { className: 'grid grid-cols-[minmax(9rem,auto)_1fr] gap-x-6 gap-y-2.5 overflow-y-auto px-6 py-5' },
        SHORTCUTS.flatMap((shortcut) => [
          el(
            'dt',
            { className: 'flex flex-wrap items-center gap-1' },
            shortcut.keys.map((key) => keycap(key)),
          ),
          el('dd', { className: 'm-0 text-[0.92rem] text-[var(--ink-2)]', text: shortcut.action }),
        ]),
      ),
    )
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) this.close()
    })
  }

  get isOpen(): boolean {
    return this.dialog.open
  }

  open(): void {
    if (!this.dialog.open) this.dialog.showModal()
  }

  close(): void {
    if (this.dialog.open) this.dialog.close()
  }
}
