type Child = Node | string | number | null | undefined | false

type Handlers = { [K in keyof HTMLElementEventMap]?: (event: HTMLElementEventMap[K]) => void }

export interface ElementOptions {
  id?: string
  className?: string
  text?: string
  attrs?: Record<string, string | number | boolean | null | undefined>
  data?: Record<string, string>
  style?: Record<string, string>
  on?: Handlers
}

const appendChildren = (parent: Node, children: Child[]): void => {
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue
    parent.appendChild(typeof child === 'string' || typeof child === 'number' ? document.createTextNode(String(child)) : child)
  }
}

/** Creates an element whose text always goes through textContent, never HTML parsing. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options: ElementOptions = {},
  children: Child[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (options.id) node.id = options.id
  if (options.className) node.className = options.className
  if (options.text !== undefined) node.textContent = options.text
  for (const [name, value] of Object.entries(options.attrs ?? {})) {
    if (value === false || value === null || value === undefined) continue
    node.setAttribute(name, value === true ? '' : String(value))
  }
  for (const [key, value] of Object.entries(options.data ?? {})) node.dataset[key] = value
  for (const [property, value] of Object.entries(options.style ?? {})) node.style.setProperty(property, value)
  for (const [type, handler] of Object.entries(options.on ?? {})) {
    if (handler) node.addEventListener(type, handler as EventListener)
  }
  appendChildren(node, children)
  return node
}

const SVG_NS = 'http://www.w3.org/2000/svg'

/** Creates an SVG element with plain attributes, for diagrams drawn from data. */
export function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number> = {},
  children: Child[] = [],
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag)
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, String(value))
  appendChildren(node, children)
  return node
}

const SUPERSCRIPTS: Record<string, string> = {
  '⁰': '0',
  '¹': '1',
  '²': '2',
  '³': '3',
  '⁴': '4',
  '⁵': '5',
  '⁶': '6',
  '⁷': '7',
  '⁸': '8',
  '⁹': '9',
  '⁻': '−',
  '⁺': '+',
}

/** Renders fact-sheet text safely: Unicode superscripts become <sup> (the typeface has no superscript glyphs) and *asterisk* spans become <em>. */
export function richText(text: string): DocumentFragment {
  const fragment = document.createDocumentFragment()
  const parts = text.split('*')
  parts.forEach((part, index) => {
    const host: Node = index % 2 === 1 ? fragment.appendChild(document.createElement('em')) : fragment
    let plain = ''
    let raised = ''
    const flushPlain = () => {
      if (plain) host.appendChild(document.createTextNode(plain))
      plain = ''
    }
    const flushRaised = () => {
      if (raised) host.appendChild(el('sup', { text: raised }))
      raised = ''
    }
    for (const character of part) {
      const mapped = SUPERSCRIPTS[character]
      if (mapped !== undefined) {
        flushPlain()
        raised += mapped
      } else {
        flushRaised()
        plain += character
      }
    }
    flushRaised()
    flushPlain()
  })
  return fragment
}

/** A power of ten as "10" with a raised exponent and an optional unit. */
export function powerOfTen(exponent: number, unit = 's'): HTMLSpanElement {
  const sign = exponent < 0 ? '−' : ''
  return el('span', { className: 'power' }, ['10', el('sup', { text: `${sign}${Math.abs(exponent)}` }), unit ? ` ${unit}` : null])
}

export const clear = (node: Element): void => node.replaceChildren()

export function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const node = document.getElementById(id)
  if (!node) throw new Error(`Missing #${id} in index.html`)
  return node as T
}

export function bySvgId(id: string): SVGSVGElement {
  const node = document.getElementById(id)
  if (!(node instanceof SVGSVGElement)) throw new Error(`Missing <svg id="${id}"> in index.html`)
  return node
}

export const prefersReducedMotion = (): boolean => window.matchMedia('(prefers-reduced-motion: reduce)').matches
