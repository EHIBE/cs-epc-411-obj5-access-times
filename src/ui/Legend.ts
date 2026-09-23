import type { Device } from '../data/types'
import { devicesInTier, TIERS } from '../utils/categories'
import { speedColor } from '../utils/color'
import { placementLog, speedT, type SpeedDomain } from '../utils/scale'
import { el } from './dom'
import { icon } from './icons'

const KEY: readonly [string, string][] = [
  ['Height', 'Access time on a log scale: every power of ten is the same distance, fastest at the top'],
  ['Width', 'Typical capacity, also on a log scale'],
  ['Depth', 'Relative cost per GB, ranked from the fact sheet wording'],
  ['Dashed outline', 'No comparable figure for that dimension (not sold separately, a component, or pay-per-use)'],
  ['Ghosted plate', 'No single published access time; it sits inside its stated order of magnitude'],
  ['Whisker', 'The stated range beside each plate; dashed when it is an order-of-magnitude band'],
  ['Hatching', 'The front edge of each plate is hatched by family, as a geological section marks its rock types'],
  ['Detail', 'A mechanism model drawn beside its own plate and joined to it by a leader; schematic, not to scale'],
]

/** Bottom-left legend: the brief's five tiers, each drawn as the exact colours of its own plates, with their fastest and slowest figures, plus a key to the model's encodings. */
export function mountLegend(root: HTMLElement, devices: Device[], domain: SpeedDomain): void {
  const tiers = TIERS.map((tier) => {
    const members = devicesInTier(devices, tier.id)
    const swatches = members.map((device) => el('span', { style: { background: speedColor(speedT(placementLog(device), domain)) } }))
    return el('li', { className: 'min-w-0' }, [
      el('span', { className: 'legend-band', attrs: { 'aria-hidden': 'true' } }, swatches),
      el('span', { className: 'mt-1.5 block text-[0.76rem] font-bold leading-tight [font-stretch:92%]', text: tier.name }),
      el('span', { className: 'num block text-[0.78rem] leading-tight text-[var(--ink-2)]', text: `${tier.fastest} to ${tier.slowest}` }),
    ])
  })
  const key = el(
    'dl',
    { className: 'mt-3 grid gap-1.5 border-t border-[var(--rule)] pt-2.5 text-[0.78rem] leading-snug', attrs: { id: 'model-key', hidden: true } },
    KEY.map(([term, description]) =>
      el('div', { className: 'grid grid-cols-[6.4rem_1fr] gap-2' }, [
        el('dt', { className: 'font-bold', text: term }),
        el('dd', { className: 'm-0 text-[var(--ink-2)]', text: description }),
      ]),
    ),
  )
  const toggle: HTMLButtonElement = el(
    'button',
    {
      className: 'ctl h-7 min-h-0 px-2 text-[0.78rem]',
      attrs: { type: 'button', 'aria-expanded': 'false', 'aria-controls': 'model-key' },
      on: {
        click: () => {
          const expanded = toggle.getAttribute('aria-expanded') !== 'true'
          toggle.setAttribute('aria-expanded', String(expanded))
          key.hidden = !expanded
        },
      },
    },
    [icon('info'), 'How to read the model'],
  )
  root.append(
    el('div', { className: 'flex items-center justify-between gap-3' }, [
      el('h2', { className: 'text-[0.78rem] font-bold [font-stretch:94%]', text: 'Color follows access time' }),
      toggle,
    ]),
    el('ol', { className: 'mt-2 grid grid-cols-5 gap-2.5', attrs: { 'aria-label': 'Speed tiers' } }, tiers),
    key,
  )
}
