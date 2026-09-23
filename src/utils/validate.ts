import type {
  Device,
  DiscrepancyRow,
  FigureId,
  HumanScaleEntry,
  LogBand,
  Notes,
  OrderOfMagnitude,
  Question,
  Reference,
  Slide,
  SlideStep,
  SourceMapRow,
  TierId,
  TimeRange,
  TimeUnit,
} from '../data/types'

type Rec = Record<string, unknown>

class ValidationError extends Error {}

const TIME_UNITS: ReadonlySet<string> = new Set(['ps', 'ns', 'us', 'ms', 's'])
const TIER_IDS: ReadonlySet<string> = new Set(['cpu', 'memory', 'flash', 'mechanical', 'archive'])
const FIGURE_IDS: ReadonlySet<string> = new Set([
  'branches',
  'flow',
  'recap',
  'nanobars',
  'power',
  'rpm',
  'queues',
  'tape',
  'table',
  'human',
])

const isRecord = (value: unknown): value is Rec =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const isText = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0
const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean'
const isTimeUnit = (value: unknown): value is TimeUnit => typeof value === 'string' && TIME_UNITS.has(value)
const isTierId = (value: unknown): value is TierId => typeof value === 'string' && TIER_IDS.has(value)
const isFigureId = (value: unknown): value is FigureId => typeof value === 'string' && FIGURE_IDS.has(value)

/** Reads one required field and throws a readable reason when its type is wrong. */
function need<T>(record: Rec, key: string, guard: (value: unknown) => value is T, expected: string): T {
  const value = record[key]
  if (!guard(value)) throw new ValidationError(`"${key}" must be ${expected}`)
  return value
}

/** Reads an optional field, returning the fallback when it is absent or null. */
function optional<T>(record: Rec, key: string, guard: (value: unknown) => value is T, fallback: T): T {
  const value = record[key]
  if (value === undefined || value === null) return fallback
  if (!guard(value)) throw new ValidationError(`"${key}" has the wrong type`)
  return value
}

const textList = (record: Rec, key: string): string[] => {
  const value = record[key]
  if (value === undefined) return []
  if (!Array.isArray(value) || !value.every(isText)) throw new ValidationError(`"${key}" must be a list of text`)
  return value
}

const numberList = (record: Rec, key: string): number[] => {
  const value = record[key]
  if (value === undefined) return []
  if (!Array.isArray(value) || !value.every(isNumber)) throw new ValidationError(`"${key}" must be a list of numbers`)
  return value
}

/** Validates a list entry by entry, skipping malformed entries with a console warning instead of failing the whole set. */
export function validateList<T>(label: string, raw: unknown, parse: (entry: unknown) => T): T[] {
  if (!Array.isArray(raw)) {
    console.warn(`[fact sheet] ${label}: expected a list, found ${typeof raw}`)
    return []
  }
  const accepted: T[] = []
  raw.forEach((entry, index) => {
    try {
      accepted.push(parse(entry))
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      console.warn(`[fact sheet] ${label}: skipped entry ${index + 1} (${reason})`)
    }
  })
  return accepted
}

function parseRange(raw: unknown): TimeRange | null {
  if (raw === null || raw === undefined) return null
  if (!isRecord(raw)) throw new ValidationError('"range" must be an object or null')
  const min = need(raw, 'min', isNumber, 'a number')
  const max = need(raw, 'max', isNumber, 'a number')
  if (min <= 0 || max < min) throw new ValidationError('"range" needs 0 < min <= max')
  return { min, max, unit: need(raw, 'unit', isTimeUnit, 'a time unit'), label: need(raw, 'label', isText, 'text') }
}

function parseBand(raw: unknown): LogBand | null {
  if (raw === null || raw === undefined) return null
  if (!isRecord(raw)) throw new ValidationError('"band" must be an object or null')
  const from = need(raw, 'from', isNumber, 'a power of ten')
  const to = need(raw, 'to', isNumber, 'a power of ten')
  if (to < from) throw new ValidationError('"band" needs from <= to')
  return { from, to, label: need(raw, 'label', isText, 'text') }
}

function parseOrder(raw: unknown): OrderOfMagnitude {
  if (!isRecord(raw)) throw new ValidationError('"orderOfMagnitude" must be an object')
  return {
    text: need(raw, 'text', isText, 'text'),
    from: need(raw, 'from', isNumber, 'a power of ten'),
    to: need(raw, 'to', isNumber, 'a power of ten'),
    approx: need(raw, 'approx', isBoolean, 'true or false'),
  }
}

/** Parses one Section D row; the brief's required fields are id, name, accessTime and unit. */
export function parseDevice(raw: unknown): Device {
  if (!isRecord(raw)) throw new ValidationError('entry is not an object')
  const id = need(raw, 'id', isText, 'non-empty text')
  const name = need(raw, 'name', isText, 'non-empty text')
  if (!('accessTime' in raw)) throw new ValidationError('"accessTime" is missing')
  const accessTime = raw.accessTime
  if (accessTime !== null && !(isNumber(accessTime) && accessTime > 0)) {
    throw new ValidationError('"accessTime" must be a positive number or null')
  }
  const unit = need(raw, 'unit', isTimeUnit, 'one of ps, ns, us, ms, s')
  const band = parseBand(raw.band)
  if (accessTime === null && band === null) {
    throw new ValidationError('a device without an accessTime needs an order-of-magnitude band to be placed')
  }
  const cost = raw.cost
  const capacity = raw.capacity
  if (!isRecord(cost)) throw new ValidationError('"cost" must be an object')
  if (!isRecord(capacity)) throw new ValidationError('"capacity" must be an object')
  const costRank = cost.rank
  if (costRank !== null && !isNumber(costRank)) throw new ValidationError('"cost.rank" must be a number or null')
  const log10Bytes = capacity.log10Bytes
  let bytes: [number, number] | null = null
  if (log10Bytes !== null) {
    if (!Array.isArray(log10Bytes) || log10Bytes.length !== 2 || !log10Bytes.every(isNumber)) {
      throw new ValidationError('"capacity.log10Bytes" must be two numbers or null')
    }
    bytes = [log10Bytes[0] as number, log10Bytes[1] as number]
  }
  return {
    id,
    rank: need(raw, 'rank', isNumber, 'a number'),
    name,
    shortName: need(raw, 'shortName', isText, 'text'),
    tier: need(raw, 'tier', isTierId, 'a known tier'),
    icon: need(raw, 'icon', isText, 'an icon name'),
    accessTime: accessTime as number | null,
    unit,
    accessText: need(raw, 'accessText', isText, 'text'),
    calloutText: optional(raw, 'calloutText', isText, need(raw, 'accessText', isText, 'text')),
    range: parseRange(raw.range),
    band,
    orderOfMagnitude: parseOrder(raw.orderOfMagnitude),
    dominantDelay: need(raw, 'dominantDelay', isText, 'text'),
    volatile: need(raw, 'volatile', isBoolean, 'true or false'),
    cost: { text: need(cost, 'text', isText, 'text'), rank: costRank as number | null },
    capacity: {
      text: need(capacity, 'text', isText, 'text'),
      log10Bytes: bytes,
      unlimited: need(capacity, 'unlimited', isBoolean, 'true or false'),
    },
    typicalUse: need(raw, 'typicalUse', isText, 'text'),
    source: need(raw, 'source', isText, 'text'),
    referenceIds: textList(raw, 'referenceIds'),
    facts: textList(raw, 'facts'),
    questionIds: numberList(raw, 'questionIds'),
  }
}

/** Parses one Section E row. */
export function parseHumanEntry(raw: unknown): HumanScaleEntry {
  if (!isRecord(raw)) throw new ValidationError('entry is not an object')
  return {
    id: need(raw, 'id', isText, 'text'),
    device: need(raw, 'device', isText, 'text'),
    realText: need(raw, 'realText', isText, 'text'),
    nanosecondsText: need(raw, 'nanosecondsText', isText, 'text'),
    nanoseconds: need(raw, 'nanoseconds', isNumber, 'a number'),
    human: need(raw, 'human', isText, 'text'),
    gloss: optional(raw, 'gloss', isText, null as string | null),
  }
}

function parseStep(raw: unknown): SlideStep {
  if (!isRecord(raw)) throw new ValidationError('step is not an object')
  return {
    lead: need(raw, 'lead', isText, 'text'),
    body: need(raw, 'body', isText, 'text'),
    note: optional(raw, 'note', isText, null as string | null),
    cites: textList(raw, 'cites'),
    cue: need(raw, 'cue', isText, 'a cue name'),
    figure: optional(raw, 'figure', isFigureId, null as FigureId | null),
  }
}

/** Parses one Section C slide, dropping any malformed step rather than the whole slide. */
export function parseSlide(raw: unknown): Slide {
  if (!isRecord(raw)) throw new ValidationError('slide is not an object')
  const id = need(raw, 'id', isText, 'text')
  const steps = validateList(`slide "${id}" steps`, raw.steps, parseStep)
  if (steps.length === 0) throw new ValidationError('a slide needs at least one step')
  return {
    id,
    number: need(raw, 'number', isNumber, 'a number'),
    shortTitle: need(raw, 'shortTitle', isText, 'text'),
    title: need(raw, 'title', isText, 'text'),
    subtitle: optional(raw, 'subtitle', isText, null as string | null),
    titleNote: optional(raw, 'titleNote', isText, null as string | null),
    minutes: need(raw, 'minutes', isNumber, 'a number'),
    lessonLink: need(raw, 'lessonLink', isText, 'text'),
    visual: need(raw, 'visual', isText, 'text'),
    figure: optional(raw, 'figure', isFigureId, null as FigureId | null),
    steps,
  }
}

/** Parses one Section G question. */
export function parseQuestion(raw: unknown): Question {
  if (!isRecord(raw)) throw new ValidationError('question is not an object')
  return {
    id: need(raw, 'id', isNumber, 'a number'),
    question: need(raw, 'question', isText, 'text'),
    answer: need(raw, 'answer', isText, 'text'),
  }
}

/** Parses one Section I reference. */
export function parseReference(raw: unknown): Reference {
  if (!isRecord(raw)) throw new ValidationError('reference is not an object')
  return {
    id: need(raw, 'id', isText, 'text'),
    citation: need(raw, 'citation', isText, 'text'),
    apa: need(raw, 'apa', isText, 'text'),
    url: optional(raw, 'url', isText, null as string | null),
  }
}

function parseSourceRow(raw: unknown): SourceMapRow {
  if (!isRecord(raw)) throw new ValidationError('row is not an object')
  return {
    slide: need(raw, 'slide', isText, 'text'),
    deck: need(raw, 'deck', isText, 'text'),
    says: need(raw, 'says', isText, 'text'),
    supports: need(raw, 'supports', isText, 'text'),
  }
}

function parseDiscrepancy(raw: unknown): DiscrepancyRow {
  if (!isRecord(raw)) throw new ValidationError('row is not an object')
  return {
    slide: need(raw, 'slide', isText, 'text'),
    slideSays: need(raw, 'slideSays', isText, 'text'),
    sourceSays: need(raw, 'sourceSays', isText, 'text'),
    source: need(raw, 'source', isText, 'text'),
  }
}

/** Parses the header metadata plus Sections A, B, F and H, falling back to empty sections when a block is malformed. */
export function parseNotes(raw: unknown): Notes {
  const root = isRecord(raw) ? raw : {}
  const meta = isRecord(root.meta) ? root.meta : {}
  const text = (record: Rec, key: string): string => (isText(record[key]) ? (record[key] as string) : '')
  const block = (key: string): Rec => (isRecord(root[key]) ? (root[key] as Rec) : {})
  const assumptions = block('assumptions')
  const sourceMap = block('sourceMap')
  const worked = block('workedExample')
  const discrepancies = block('discrepancies')
  return {
    meta: {
      heading: text(meta, 'heading'),
      course: text(meta, 'course'),
      objective: text(meta, 'objective'),
      objectiveQuote: text(meta, 'objectiveQuote'),
      objectiveSource: text(meta, 'objectiveSource'),
      related: text(meta, 'related'),
      totalTime: text(meta, 'totalTime'),
      totalSlides: isNumber(meta.totalSlides) ? meta.totalSlides : 0,
    },
    assumptions: validateList('assumptions', assumptions.items, (entry) => {
      if (!isText(entry)) throw new ValidationError('assumption must be text')
      return entry
    }),
    sourceMap: validateList('lesson source map', sourceMap.rows, parseSourceRow),
    workedExample: text(worked, 'text'),
    discrepancies: validateList('discrepancy log', discrepancies.rows, parseDiscrepancy),
    discrepancyNote: text(discrepancies, 'note'),
  }
}

/** Removes duplicate ids, keeping the first occurrence and warning about the rest. */
export function uniqueById<T extends { id: string | number }>(label: string, items: T[]): T[] {
  const seen = new Set<string | number>()
  return items.filter((item) => {
    if (seen.has(item.id)) {
      console.warn(`[fact sheet] ${label}: skipped duplicate id "${item.id}"`)
      return false
    }
    seen.add(item.id)
    return true
  })
}
