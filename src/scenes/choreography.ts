import type { SpecimenId } from '../objects/SpecimenStage'
import type { CalloutMode } from '../ui/SceneLabels'
import type { Shot } from './CameraRig'
import { INITIAL_SHOT } from './CameraRig'

export type ShotId =
  | 'overview'
  | 'hero'
  | 'front'
  | 'side'
  | 'cpu'
  | 'flash'
  | 'ssdhdd'
  | 'mechanical'
  | 'archive'
  | 'die'
  | 'hdd'
  | 'trio'
  | 'queues'
  | 'optical'
  | 'tape'
  | 'table'
  | 'human'
  | 'recap'

/** Camera positions for every beat of the talk, composed for the free area beside the slide panel. */
export const SHOTS: Record<ShotId, Shot> = {
  overview: INITIAL_SHOT,
  hero: { position: [22, 21, 51], target: [0.5, 11, 0] },
  front: { position: [-5, 11, 57], target: [-5, 11, 0] },
  side: { position: [58, 13, 27], target: [-1, 11, 0] },
  cpu: { position: [15, 31, 29], target: [-4, 25.8, 0] },
  flash: { position: [16, 15, 29], target: [-3, 10.2, 0] },
  ssdhdd: { position: [19, 12, 40], target: [-3, 7.5, 0] },
  mechanical: { position: [15, 8, 27], target: [-3, 3.6, 0] },
  archive: { position: [18, 3, 36], target: [-3, -3.4, 0] },
  die: { position: [38.5, 35.5, 13], target: [35.6, 26.6, 0.4] },
  hdd: { position: [37.5, 13.4, 12.6], target: [33.8, 3.4, 0.8] },
  trio: { position: [34, 14.5, 13.2], target: [34, 3.6, 0.9] },
  queues: { position: [40, 19.5, 16.5], target: [35.4, 9.8, 0.6] },
  optical: { position: [36, 9.6, 12.4], target: [34, -0.2, 0.6] },
  tape: { position: [37.5, 3.4, 15.5], target: [33.2, -6.8, 0] },
  table: { position: [26, 25, 60], target: [0.5, 11, 0] },
  human: { position: [20, 22, 52], target: [-2, 11, 0] },
  recap: { position: [22, 22, 53], target: [0.5, 11, 0] },
}

export interface CueState {
  shot: ShotId
  focus: readonly string[] | null
  callouts: CalloutMode
  specimen: SpecimenId | null
  specimenMode?: string
  measure?: string | null
  lessons?: boolean
  volatility?: boolean
  human?: boolean
  sweep?: boolean
  orbit?: boolean
  caption?: string | null
}

const CPU = ['register', 'l1', 'l2', 'l3']
const MEMORY = ['dram', 'optane']
const FLASH = ['nand', 'nvme', 'sata', 'usb']
const DISKS = ['hdd-15k', 'hdd-7200', 'hdd-5400']
const FRONT_CAPTION = 'Front view: width is typical capacity, on a log scale'
const SIDE_CAPTION = 'Side view: depth is relative cost per GB, as the fact sheet ranks it'

const disk = (mode: string): CueState => ({ shot: 'hdd', focus: DISKS, callouts: 'none', specimen: 'hdd', specimenMode: mode })

/** What the 3D stage does on each presenter step; keys are the cue names in slides.json. */
export const CUES: Record<string, CueState> = {
  'title-scope': { shot: 'hero', focus: null, callouts: 'all', specimen: null, orbit: true },
  'title-built': { shot: 'hero', focus: null, callouts: 'all', specimen: null, orbit: true },
  'title-branches': { shot: 'hero', focus: ['tape', 'hdd-7200', 'optical'], callouts: 'focus', specimen: null },

  'terms-access': disk('idle'),
  'terms-seek': disk('seek'),
  'terms-rotate': disk('rotate'),
  'terms-transfer': disk('transfer'),
  'terms-formula': disk('cycle'),
  'terms-sequential': { shot: 'hero', focus: ['tape', 'hdd-7200', 'nvme', 'dram'], callouts: 'focus', specimen: null },
  'terms-iops': { shot: 'flash', focus: FLASH, callouts: 'focus', specimen: null },

  'hier-recap': { shot: 'hero', focus: null, callouts: 'none', specimen: null, lessons: true },
  'hier-rule': { shot: 'front', focus: null, callouts: 'none', specimen: null, caption: FRONT_CAPTION },
  'hier-order': { shot: 'hero', focus: null, callouts: 'all', specimen: null },
  'hier-tradeoff': { shot: 'side', focus: null, callouts: 'none', specimen: null, caption: SIDE_CAPTION },
  'hier-branches': { shot: 'hero', focus: ['tape', 'hdd-7200', 'optical'], callouts: 'focus', specimen: null },
  'hier-note': { shot: 'ssdhdd', focus: [...FLASH, ...DISKS], callouts: 'focus', specimen: null, measure: 'ssd-hdd' },

  'nano-register': { shot: 'cpu', focus: ['register'], callouts: 'focus', specimen: null },
  'nano-l1': { shot: 'cpu', focus: ['l1'], callouts: 'focus', specimen: null },
  'nano-l2': { shot: 'cpu', focus: ['l2'], callouts: 'focus', specimen: null },
  'nano-l3': { shot: 'cpu', focus: ['l3'], callouts: 'focus', specimen: null },
  'nano-dram': { shot: 'cpu', focus: ['l1', 'dram'], callouts: 'focus', specimen: null, measure: 'l1-dram' },
  'nano-volatile': { shot: 'cpu', focus: [...CPU, ...MEMORY], callouts: 'focus', specimen: null, volatility: true },
  'nano-why': { shot: 'die', focus: [...CPU, 'dram'], callouts: 'none', specimen: 'die' },

  'hdd-mechanical': disk('idle'),
  'hdd-seek': disk('seek'),
  'hdd-rotation': disk('rotate'),
  'hdd-rpm': { shot: 'trio', focus: DISKS, callouts: 'none', specimen: 'trio' },
  'hdd-total': { shot: 'mechanical', focus: DISKS, callouts: 'focus', specimen: null },
  'hdd-scheduling': disk('scheduling'),

  'ssd-nomoving': { shot: 'flash', focus: FLASH, callouts: 'focus', specimen: null },
  'ssd-nand': { shot: 'ssdhdd', focus: ['nand', 'hdd-7200'], callouts: 'focus', specimen: null, measure: 'ssd-hdd' },
  'ssd-interface': { shot: 'queues', focus: ['nvme', 'sata'], callouts: 'none', specimen: 'queues', specimenMode: 'idle' },
  'ssd-protocol': { shot: 'queues', focus: ['nvme', 'sata'], callouts: 'none', specimen: 'queues', specimenMode: 'protocol' },
  'ssd-cost': { shot: 'side', focus: [...FLASH, ...DISKS], callouts: 'none', specimen: null, caption: SIDE_CAPTION },
  'ssd-note': { shot: 'flash', focus: ['nvme', 'sata'], callouts: 'focus', specimen: null },

  'arch-usb': { shot: 'flash', focus: ['usb', 'nvme', 'sata'], callouts: 'focus', specimen: null },
  'arch-optical': { shot: 'optical', focus: ['optical', 'hdd-7200'], callouts: 'none', specimen: 'optical' },
  'arch-tape': { shot: 'tape', focus: ['tape'], callouts: 'none', specimen: 'tape', specimenMode: 'cycle' },
  'arch-why': { shot: 'tape', focus: ['tape'], callouts: 'none', specimen: 'tape', specimenMode: 'stream' },

  'master-walk': { shot: 'table', focus: null, callouts: 'all', specimen: null, measure: 'thirteen', sweep: true },
  'master-cost': { shot: 'side', focus: null, callouts: 'none', specimen: null, caption: SIDE_CAPTION },

  'human-rule': { shot: 'human', focus: null, callouts: 'all', specimen: null, human: true },
  'human-headline': { shot: 'human', focus: ['l1', 'hdd-7200', 'tape'], callouts: 'all', specimen: null, human: true, sweep: true },
  'human-point': { shot: 'human', focus: null, callouts: 'all', specimen: null, human: true },

  'sum-formula': { shot: 'recap', focus: null, callouts: 'all', specimen: null },
  'sum-tradeoff': { shot: 'recap', focus: null, callouts: 'all', specimen: null },
  'sum-jumps': { shot: 'recap', focus: ['nand', 'nvme', 'sata', ...DISKS], callouts: 'all', specimen: null, measure: 'ssd-hdd' },
  'sum-tape': { shot: 'recap', focus: ['tape'], callouts: 'all', specimen: null },
}

export const FALLBACK_CUE: CueState = { shot: 'hero', focus: null, callouts: 'all', specimen: null }

export const cueFor = (name: string): CueState => CUES[name] ?? FALLBACK_CUE
