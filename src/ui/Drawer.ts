import type { FactSheet } from '../data/types'
import { el, richText } from './dom'
import { icon } from './icons'

export type DrawerTab = 'questions' | 'sources' | 'notes'

const TABS: readonly { id: DrawerTab; label: string }[] = [
  { id: 'questions', label: 'Likely questions' },
  { id: 'sources', label: 'Sources' },
  { id: 'notes', label: 'Notes behind the numbers' },
]

const heading = (text: string, section: string): HTMLElement =>
  el('h3', { className: 'mt-7 flex items-baseline gap-2 text-[1.05rem] font-bold first:mt-0 [font-stretch:104%]' }, [
    text,
    el('span', { className: 't-cite text-[0.78rem] font-medium', text: `Section ${section}` }),
  ])

/** The reference drawer: Section G for the Q&A, Section I for sources, and Sections A, B, F and H behind the numbers. */
export class Drawer {
  private readonly dialog: HTMLDialogElement
  private readonly panels = new Map<DrawerTab, HTMLElement>()
  private readonly tabs = new Map<DrawerTab, HTMLButtonElement>()
  private readonly answers = new Map<number, HTMLDetailsElement>()

  constructor(dialog: HTMLDialogElement, data: FactSheet) {
    this.dialog = dialog
    dialog.className = 'drawer'
    dialog.setAttribute('aria-labelledby', 'drawer-title')
    const tabList = el('div', { className: 'flex gap-1 overflow-x-auto', attrs: { role: 'tablist', 'aria-label': 'Reference sections' } })
    for (const tab of TABS) {
      const button = el('button', {
        className: 'tab ctl rounded-none px-3',
        text: tab.label,
        attrs: { type: 'button', role: 'tab', id: `tab-${tab.id}`, 'aria-controls': `panel-${tab.id}`, 'aria-selected': 'false' },
        on: { click: () => this.select(tab.id) },
      })
      this.tabs.set(tab.id, button)
      tabList.appendChild(button)
    }
    const close = el('button', { className: 'ctl ctl--icon', attrs: { type: 'button', 'aria-label': 'Close' }, on: { click: () => this.close() } }, [icon('x')])
    const header = el('header', { className: 'flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-[var(--rule)] px-6 pb-0 pt-4' }, [
      el('h2', { id: 'drawer-title', className: 'text-[1.2rem] font-bold [font-stretch:110%]', text: 'Reference' }),
      tabList,
      el('div', { className: 'ml-auto self-start' }, [close]),
    ])
    const body = el('div', { className: 'min-h-0 flex-1 overflow-y-auto px-6 py-5' })
    const questions = this.questionsPanel(data)
    const sources = this.sourcesPanel(data)
    const notes = this.notesPanel(data)
    for (const [id, panel] of [
      ['questions', questions],
      ['sources', sources],
      ['notes', notes],
    ] as const) {
      panel.id = `panel-${id}`
      panel.setAttribute('role', 'tabpanel')
      panel.setAttribute('aria-labelledby', `tab-${id}`)
      this.panels.set(id, panel)
      body.appendChild(panel)
    }
    dialog.append(header, body)
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) this.close()
    })
  }

  private questionsPanel(data: FactSheet): HTMLElement {
    const list = el('div', { className: 'grid gap-1.5' })
    for (const question of data.questions) {
      const details = el('details', { className: 'qa border border-[var(--rule)]' }, [
        el('summary', { className: 'flex items-start gap-3 px-4 py-3 text-[1rem] font-semibold leading-snug' }, [
          el('span', { className: 'num w-8 flex-none text-[var(--ink-3)]', text: `Q${question.id}` }),
          el('span', { className: 'flex-1', text: question.question }),
          el('span', { className: 'qa__caret mt-0.5 text-[var(--ink-3)]' }, [icon('caret-down')]),
        ]),
        el('p', { className: 'px-4 pb-4 pl-[3.75rem] text-[0.95rem] leading-relaxed text-[var(--ink-2)] max-w-[72ch]' }, [richText(question.answer)]),
      ])
      this.answers.set(question.id, details)
      list.appendChild(details)
    }
    return el('section', {}, [
      el('p', { className: 't-cite mb-4 text-[0.82rem]', text: 'Section G of the fact sheet, word for word.' }),
      list,
    ])
  }

  private sourcesPanel(data: FactSheet): HTMLElement {
    return el('section', {}, [
      el('p', { className: 't-cite mb-4 text-[0.82rem]', text: 'Section I, APA 7th edition.' }),
      el(
        'ol',
        { className: 'grid gap-3' },
        data.references.map((reference) =>
          el('li', { className: 'max-w-[80ch] pl-8 -indent-8 text-[0.92rem] leading-relaxed' }, [
            richText(reference.apa),
            ' ',
            reference.url
              ? el('a', { className: 'break-all text-[var(--ink-2)]', text: reference.url, attrs: { href: reference.url, target: '_blank', rel: 'noopener noreferrer' } })
              : null,
          ]),
        ),
      ),
    ])
  }

  private notesPanel(data: FactSheet): HTMLElement {
    const { notes } = data
    const meta = el('dl', { className: 'grid gap-x-6 gap-y-1.5 text-[0.9rem] sm:grid-cols-[11rem_1fr]' }, [
      ['Course', notes.meta.course],
      ['Objective', `${notes.meta.objective}: "${notes.meta.objectiveQuote}" (${notes.meta.objectiveSource})`],
      ['Related objective', notes.meta.related],
      ['Planned time', notes.meta.totalTime],
      ['Slides', String(notes.meta.totalSlides)],
    ].flatMap(([term, value]) => [el('dt', { className: 'font-bold text-[var(--ink-2)]', text: term ?? '' }), el('dd', { className: 'm-0', text: value ?? '' })]))

    const assumptions = el(
      'ul',
      { className: 'mt-2 grid list-disc gap-2 pl-5 text-[0.92rem] leading-relaxed marker:text-[var(--ink-3)]' },
      notes.assumptions.map((item) => el('li', { className: 'max-w-[80ch]' }, [richText(item)])),
    )
    const sourceMap = el('div', { className: 'mt-2 overflow-x-auto border border-[var(--rule)]' }, [
      el('table', { className: 'data-table' }, [
        el('thead', {}, [el('tr', {}, ['Slide', 'Deck', 'What it says', 'How it supports Objective #5'].map((text) => el('th', { text, attrs: { scope: 'col' } })))]),
        el(
          'tbody',
          {},
          notes.sourceMap.map((row) =>
            el('tr', { style: { cursor: 'default' } }, [
              el('th', { className: 'whitespace-nowrap', text: row.slide, attrs: { scope: 'row' } }),
              el('td', { className: 'whitespace-nowrap', text: row.deck }),
              el('td', { text: row.says }),
              el('td', { text: row.supports }),
            ]),
          ),
        ),
      ]),
    ])
    const discrepancies = el('div', { className: 'mt-2 overflow-x-auto border border-[var(--rule)]' }, [
      el('table', { className: 'data-table' }, [
        el('thead', {}, [el('tr', {}, ['Slide', 'Slide says', 'Current source says', 'Source'].map((text) => el('th', { text, attrs: { scope: 'col' } })))]),
        el(
          'tbody',
          {},
          notes.discrepancies.map((row) =>
            el('tr', { style: { cursor: 'default' } }, [
              el('th', { className: 'whitespace-nowrap', text: row.slide, attrs: { scope: 'row' } }),
              el('td', { text: row.slideSays }),
              el('td', { text: row.sourceSays }),
              el('td', { text: row.source }),
            ]),
          ),
        ),
      ]),
    ])
    return el('section', {}, [
      el('h3', { className: 'text-[1.05rem] font-bold [font-stretch:104%]', text: notes.meta.heading }),
      el('div', { className: 'mt-3' }, [meta]),
      heading('Assumptions', 'A'),
      assumptions,
      heading('Lesson source map', 'B'),
      sourceMap,
      heading('Worked example', 'F'),
      el('p', { className: 'mt-2 max-w-[80ch] text-[0.92rem] leading-relaxed' }, [richText(notes.workedExample)]),
      heading('Discrepancy log', 'H'),
      discrepancies,
      el('p', { className: 'mt-2 max-w-[80ch] text-[0.86rem] leading-relaxed text-[var(--ink-2)]', text: notes.discrepancyNote }),
    ])
  }

  get isOpen(): boolean {
    return this.dialog.open
  }

  select(tab: DrawerTab): void {
    this.tabs.forEach((button, id) => {
      button.setAttribute('aria-selected', String(id === tab))
      button.tabIndex = id === tab ? 0 : -1
    })
    this.panels.forEach((panel, id) => {
      panel.hidden = id !== tab
    })
  }

  open(tab: DrawerTab, questionId?: number): void {
    this.select(tab)
    if (!this.dialog.open) this.dialog.showModal()
    if (questionId !== undefined) {
      const details = this.answers.get(questionId)
      if (details) {
        details.open = true
        details.dataset.flash = 'false'
        requestAnimationFrame(() => {
          details.dataset.flash = 'true'
          details.scrollIntoView({ block: 'center', behavior: 'smooth' })
          details.querySelector('summary')?.focus()
        })
      }
    }
  }

  close(): void {
    if (this.dialog.open) this.dialog.close()
  }
}
