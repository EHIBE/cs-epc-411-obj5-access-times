import { el } from './dom'
import { icon } from './icons'

/** A short status line at the bottom centre for theme changes, recoverable errors and similar notices. */
export class Toast {
  private readonly root: HTMLElement
  private timer = 0

  constructor(root: HTMLElement) {
    this.root = root
    root.classList.add('toast')
    root.setAttribute('role', 'status')
    root.dataset.visible = 'false'
  }

  show(message: string, tone: 'info' | 'error' = 'info', duration = 2600): void {
    window.clearTimeout(this.timer)
    this.root.replaceChildren(icon(tone === 'error' ? 'warning-circle' : 'info'), el('span', { text: message }))
    this.root.dataset.visible = 'true'
    this.timer = window.setTimeout(() => {
      this.root.dataset.visible = 'false'
    }, duration)
  }
}

/** A visually hidden live region so screen readers hear each slide and step as the presenter advances. */
export class Announcer {
  private readonly root: HTMLElement

  constructor(root: HTMLElement) {
    this.root = root
    root.setAttribute('aria-live', 'polite')
    root.setAttribute('aria-atomic', 'true')
  }

  say(message: string): void {
    this.root.textContent = ''
    window.requestAnimationFrame(() => {
      this.root.textContent = message
    })
  }
}

/** The opening screen shown while fonts load and the first frame renders. */
export class Boot {
  private readonly root: HTMLElement

  constructor(root: HTMLElement) {
    this.root = root
    root.classList.add('boot')
  }

  done(): void {
    this.root.dataset.done = 'true'
    window.setTimeout(() => this.root.remove(), 900)
  }

  fail(message: string): void {
    this.root.replaceChildren(
      el('div', { className: 'max-w-[32rem] px-6 text-center' }, [
        el('p', { className: 'text-[1.4rem] font-bold [font-stretch:110%]', text: 'The presentation could not start' }),
        el('p', { className: 'mt-3 text-[1rem] text-[var(--ink-2)]', text: message }),
        el('button', { className: 'ctl ctl--solid mt-5', attrs: { type: 'button' }, on: { click: () => window.location.reload() } }, [
          icon('arrow-counter-clockwise'),
          'Reload the page',
        ]),
      ]),
    )
  }
}
