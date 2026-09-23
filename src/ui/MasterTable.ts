import type { FactSheet } from '../data/types'
import { padRank } from '../utils/format'
import { el, richText } from './dom'
import { icon } from './icons'

/** Section D projected in full: all nine columns plus the Section E conversion, one row per device, each opening its details. */
export class MasterTable {
  private readonly dialog: HTMLDialogElement

  constructor(dialog: HTMLDialogElement, data: FactSheet, colorOf: (id: string) => string, onSelect: (id: string) => void) {
    this.dialog = dialog
    dialog.className = 'drawer'
    dialog.setAttribute('aria-labelledby', 'table-title')
    const humanById = new Map(data.humanScale.entries.map((entry) => [entry.id, entry]))
    const columns = [
      '#',
      'Device',
      'Typical access time',
      'Order of magnitude',
      'Dominant delay factor',
      'Volatile?',
      'Relative cost per GB',
      'Typical capacity (2026)',
      'Typical use',
      'Source',
      'If 1 ns were 1 s',
    ]
    const rows = data.devices.map((device) => {
      const human = humanById.get(device.id)
      const open = () => {
        this.close()
        onSelect(device.id)
      }
      return el(
        'tr',
        {
          attrs: { tabindex: 0, 'aria-label': `${device.name}, open details` },
          on: {
            click: open,
            keydown: (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                open()
              }
            },
          },
        },
        [
          el('td', { className: 'num whitespace-nowrap text-[var(--ink-3)]' }, [
            el('span', { className: 'mr-1.5 inline-block h-2.5 w-2.5 align-middle', style: { background: colorOf(device.id) } }),
            padRank(device.rank),
          ]),
          el('th', { className: 'min-w-[9rem] text-[0.84rem] font-semibold text-[var(--ink)]', text: device.name, attrs: { scope: 'row' } }),
          el('td', { className: 'min-w-[11rem]' }, [richText(device.accessText)]),
          el('td', { className: 'num whitespace-nowrap' }, [richText(device.orderOfMagnitude.text)]),
          el('td', { className: 'min-w-[11rem]', text: device.dominantDelay }),
          el('td', { text: device.volatile ? 'Yes' : 'No' }),
          el('td', { className: 'min-w-[8rem]', text: device.cost.text }),
          el('td', { className: 'min-w-[9rem]', text: device.capacity.text }),
          el('td', { className: 'min-w-[10rem] italic', text: device.typicalUse }),
          el('td', { className: 'min-w-[10rem] t-cite', text: device.source }),
          el('td', { className: 'min-w-[8rem]', text: human ? `${human.human}${human.gloss ? `, ${human.gloss}` : ''}` : 'Not converted' }),
        ],
      )
    })
    const close = el('button', { className: 'ctl ctl--icon', attrs: { type: 'button', 'aria-label': 'Close' }, on: { click: () => this.close() } }, [icon('x')])
    dialog.append(
      el('header', { className: 'flex items-center gap-4 border-b border-[var(--rule)] px-6 py-4' }, [
        el('div', {}, [
          el('h2', { id: 'table-title', className: 'text-[1.2rem] font-bold [font-stretch:110%]', text: 'Master comparison table' }),
          el('p', { className: 't-cite text-[0.8rem]', text: data.sectionNote }),
        ]),
        el('div', { className: 'ml-auto' }, [close]),
      ]),
      el('div', { className: 'min-h-0 flex-1 overflow-auto' }, [
        el('table', { className: 'data-table' }, [
          el('thead', {}, [el('tr', {}, columns.map((text) => el('th', { text, attrs: { scope: 'col' } })))]),
          el('tbody', {}, rows),
        ]),
      ]),
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
