import arrowCounterClockwise from '@phosphor-icons/core/assets/regular/arrow-counter-clockwise.svg?raw'
import arrowLeft from '@phosphor-icons/core/assets/regular/arrow-left.svg?raw'
import arrowRight from '@phosphor-icons/core/assets/regular/arrow-right.svg?raw'
import arrowSquareOut from '@phosphor-icons/core/assets/regular/arrow-square-out.svg?raw'
import books from '@phosphor-icons/core/assets/regular/books.svg?raw'
import caretDown from '@phosphor-icons/core/assets/regular/caret-down.svg?raw'
import caretLeft from '@phosphor-icons/core/assets/regular/caret-left.svg?raw'
import caretRight from '@phosphor-icons/core/assets/regular/caret-right.svg?raw'
import cassetteTape from '@phosphor-icons/core/assets/regular/cassette-tape.svg?raw'
import check from '@phosphor-icons/core/assets/regular/check.svg?raw'
import circuitry from '@phosphor-icons/core/assets/regular/circuitry.svg?raw'
import cloud from '@phosphor-icons/core/assets/regular/cloud.svg?raw'
import cornersIn from '@phosphor-icons/core/assets/regular/corners-in.svg?raw'
import cornersOut from '@phosphor-icons/core/assets/regular/corners-out.svg?raw'
import cpu from '@phosphor-icons/core/assets/regular/cpu.svg?raw'
import crosshair from '@phosphor-icons/core/assets/regular/crosshair.svg?raw'
import cursorClick from '@phosphor-icons/core/assets/regular/cursor-click.svg?raw'
import disc from '@phosphor-icons/core/assets/regular/disc.svg?raw'
import hardDrive from '@phosphor-icons/core/assets/regular/hard-drive.svg?raw'
import hardDrives from '@phosphor-icons/core/assets/regular/hard-drives.svg?raw'
import hourglassMedium from '@phosphor-icons/core/assets/regular/hourglass-medium.svg?raw'
import info from '@phosphor-icons/core/assets/regular/info.svg?raw'
import keyboard from '@phosphor-icons/core/assets/regular/keyboard.svg?raw'
import lightning from '@phosphor-icons/core/assets/regular/lightning.svg?raw'
import lightningSlash from '@phosphor-icons/core/assets/regular/lightning-slash.svg?raw'
import memory from '@phosphor-icons/core/assets/regular/memory.svg?raw'
import moon from '@phosphor-icons/core/assets/regular/moon.svg?raw'
import mouseLeftClick from '@phosphor-icons/core/assets/regular/mouse-left-click.svg?raw'
import mouseRightClick from '@phosphor-icons/core/assets/regular/mouse-right-click.svg?raw'
import mouseScroll from '@phosphor-icons/core/assets/regular/mouse-scroll.svg?raw'
import notepad from '@phosphor-icons/core/assets/regular/notepad.svg?raw'
import pause from '@phosphor-icons/core/assets/regular/pause.svg?raw'
import play from '@phosphor-icons/core/assets/regular/play.svg?raw'
import plugsConnected from '@phosphor-icons/core/assets/regular/plugs-connected.svg?raw'
import presentation from '@phosphor-icons/core/assets/regular/presentation.svg?raw'
import question from '@phosphor-icons/core/assets/regular/question.svg?raw'
import sidebarSimple from '@phosphor-icons/core/assets/regular/sidebar-simple.svg?raw'
import stack from '@phosphor-icons/core/assets/regular/stack.svg?raw'
import sun from '@phosphor-icons/core/assets/regular/sun.svg?raw'
import table from '@phosphor-icons/core/assets/regular/table.svg?raw'
import usb from '@phosphor-icons/core/assets/regular/usb.svg?raw'
import warningCircle from '@phosphor-icons/core/assets/regular/warning-circle.svg?raw'
import x from '@phosphor-icons/core/assets/regular/x.svg?raw'

const SOURCES = {
  'arrow-counter-clockwise': arrowCounterClockwise,
  'arrow-left': arrowLeft,
  'arrow-right': arrowRight,
  'arrow-square-out': arrowSquareOut,
  books,
  'caret-down': caretDown,
  'caret-left': caretLeft,
  'caret-right': caretRight,
  'cassette-tape': cassetteTape,
  check,
  circuitry,
  cloud,
  'corners-in': cornersIn,
  'corners-out': cornersOut,
  cpu,
  crosshair,
  'cursor-click': cursorClick,
  disc,
  'hard-drive': hardDrive,
  'hard-drives': hardDrives,
  'hourglass-medium': hourglassMedium,
  info,
  keyboard,
  lightning,
  'lightning-slash': lightningSlash,
  memory,
  moon,
  'mouse-left-click': mouseLeftClick,
  'mouse-right-click': mouseRightClick,
  'mouse-scroll': mouseScroll,
  notepad,
  pause,
  play,
  'plugs-connected': plugsConnected,
  presentation,
  question,
  'sidebar-simple': sidebarSimple,
  stack,
  sun,
  table,
  usb,
  'warning-circle': warningCircle,
  x,
} as const

export type IconName = keyof typeof SOURCES

const parser = new DOMParser()
const templates = new Map<IconName, Element>()

export const isIconName = (name: string): name is IconName => Object.hasOwn(SOURCES, name)

/** Returns a fresh inline SVG of a bundled Phosphor icon, parsed as XML so no HTML string is ever injected. */
export function icon(name: IconName, className = 'icon'): SVGSVGElement {
  let template = templates.get(name)
  if (!template) {
    template = parser.parseFromString(SOURCES[name], 'image/svg+xml').documentElement
    templates.set(name, template)
  }
  const node = document.importNode(template, true) as unknown as SVGSVGElement
  node.setAttribute('class', className)
  node.setAttribute('aria-hidden', 'true')
  node.setAttribute('focusable', 'false')
  return node
}

export const deviceIcon = (name: string, className = 'icon'): SVGSVGElement =>
  icon(isIconName(name) ? name : 'hard-drive', className)
