import { el } from './dom'
import { icon, type IconName } from './icons'

const ITEMS: readonly { glyph: IconName | string; text: string }[] = [
  { glyph: 'mouse-left-click', text: 'Drag to rotate' },
  { glyph: 'mouse-scroll', text: 'Scroll to zoom' },
  { glyph: 'mouse-right-click', text: 'Right-drag to pan' },
  { glyph: 'cursor-click', text: 'Click a device for details' },
  { glyph: 'Esc', text: 'Close details' },
  { glyph: '?', text: 'All shortcuts' },
]

const FADE_AFTER_MS = 5000

/** The bottom-right controls hint: visible for five seconds, back once on the first interaction, and whenever the pointer visits the corner; while it shows, scene labels keep out of its corner. */
export class ControlsHint {
  private readonly root: HTMLElement
  private readonly onChange: (rect: DOMRect | null) => void
  private timer = 0
  private replayed = false

  constructor(root: HTMLElement, onChange: (rect: DOMRect | null) => void = () => undefined) {
    this.root = root
    this.onChange = onChange
    root.classList.add('hint')
    root.setAttribute('aria-label', 'Mouse and keyboard controls')
    root.append(
      el(
        'ul',
        { className: 'grid gap-1.5' },
        ITEMS.map((item) =>
          el('li', { className: 'flex items-center gap-2 text-[0.8rem] font-medium text-[var(--ink-2)]' }, [
            item.glyph.length <= 3
              ? el('kbd', { className: 'keycap', text: item.glyph })
              : el('span', { className: 'inline-flex h-[1.45rem] w-[1.45rem] items-center justify-center text-[var(--ink)]' }, [icon(item.glyph as IconName)]),
            item.text,
          ]),
        ),
      ),
    )
    root.addEventListener('mouseenter', () => this.show(false))
    root.addEventListener('mouseleave', () => this.schedule())
    this.show(true)
  }

  private show(autoHide: boolean): void {
    window.clearTimeout(this.timer)
    this.root.dataset.faded = 'false'
    window.requestAnimationFrame(() => this.onChange(this.root.getClientRects().length > 0 ? this.root.getBoundingClientRect() : null))
    if (autoHide) this.schedule()
  }

  private schedule(): void {
    window.clearTimeout(this.timer)
    this.timer = window.setTimeout(() => {
      this.root.dataset.faded = 'true'
      this.onChange(null)
    }, FADE_AFTER_MS)
  }

  /** The first interaction after the hint fades brings it back once as a reminder. */
  noteInteraction(): void {
    if (this.replayed || this.root.dataset.faded !== 'true') return
    this.replayed = true
    this.show(true)
  }
}
