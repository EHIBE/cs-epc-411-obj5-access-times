import devicesJson from './devices.json'
import humanScaleJson from './human-scale.json'
import notesJson from './notes.json'
import questionsJson from './questions.json'
import referencesJson from './references.json'
import slidesJson from './slides.json'
import type { FactSheet } from './types'
import {
  parseDevice,
  parseHumanEntry,
  parseNotes,
  parseQuestion,
  parseReference,
  parseSlide,
  uniqueById,
  validateList,
} from '../utils/validate'

const field = (source: unknown, key: string): unknown =>
  typeof source === 'object' && source !== null ? (source as Record<string, unknown>)[key] : undefined

const textField = (source: unknown, key: string): string => {
  const value = field(source, key)
  return typeof value === 'string' ? value : ''
}

/** Validates the embedded fact-sheet JSON once at startup and returns only well-formed, rank-ordered records. */
export function loadFactSheet(): FactSheet {
  const devices = uniqueById('devices', validateList('devices', field(devicesJson as unknown, 'devices'), parseDevice)).sort(
    (a, b) => a.rank - b.rank,
  )
  const knownIds = new Set(devices.map((device) => device.id))
  const humanEntries = uniqueById(
    'human-scale entries',
    validateList('human-scale entries', field(humanScaleJson as unknown, 'entries'), parseHumanEntry),
  ).filter((entry) => {
    if (knownIds.has(entry.id)) return true
    console.warn(`[fact sheet] human-scale entries: skipped "${entry.id}" (no matching device)`)
    return false
  })
  return {
    devices,
    humanScale: {
      rule: textField(humanScaleJson, 'rule'),
      explanation: textField(humanScaleJson, 'explanation'),
      methodNote: textField(humanScaleJson, 'methodNote'),
      entries: humanEntries,
    },
    slides: uniqueById('slides', validateList('slides', field(slidesJson as unknown, 'slides'), parseSlide)).sort(
      (a, b) => a.number - b.number,
    ),
    questions: uniqueById('questions', validateList('questions', field(questionsJson as unknown, 'questions'), parseQuestion)),
    references: uniqueById(
      'references',
      validateList('references', field(referencesJson as unknown, 'references'), parseReference),
    ),
    notes: parseNotes(notesJson as unknown),
    sectionNote: textField(devicesJson, 'note'),
  }
}
