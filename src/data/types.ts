/** Typed shapes for every fact-sheet section after validation. */
export type TierId = 'cpu' | 'memory' | 'flash' | 'mechanical' | 'archive'

export type TimeUnit = 'ps' | 'ns' | 'us' | 'ms' | 's'

export interface TimeRange {
  min: number
  max: number
  unit: TimeUnit
  label: string
}

export interface LogBand {
  from: number
  to: number
  label: string
}

export interface OrderOfMagnitude {
  text: string
  from: number
  to: number
  approx: boolean
}

export interface Device {
  id: string
  rank: number
  name: string
  shortName: string
  tier: TierId
  icon: string
  accessTime: number | null
  unit: TimeUnit
  accessText: string
  calloutText: string
  range: TimeRange | null
  band: LogBand | null
  orderOfMagnitude: OrderOfMagnitude
  dominantDelay: string
  volatile: boolean
  cost: { text: string; rank: number | null }
  capacity: { text: string; log10Bytes: [number, number] | null; unlimited: boolean }
  typicalUse: string
  source: string
  referenceIds: string[]
  facts: string[]
  questionIds: number[]
}

export interface HumanScaleEntry {
  id: string
  device: string
  realText: string
  nanosecondsText: string
  nanoseconds: number
  human: string
  gloss: string | null
}

export interface HumanScale {
  rule: string
  explanation: string
  methodNote: string
  entries: HumanScaleEntry[]
}

export type FigureId =
  | 'branches'
  | 'flow'
  | 'recap'
  | 'nanobars'
  | 'power'
  | 'rpm'
  | 'queues'
  | 'tape'
  | 'table'
  | 'human'

export interface SlideStep {
  lead: string
  body: string
  note: string | null
  cites: string[]
  cue: string
  figure: FigureId | null
}

export interface Slide {
  id: string
  number: number
  shortTitle: string
  title: string
  subtitle: string | null
  titleNote: string | null
  minutes: number
  lessonLink: string
  visual: string
  figure: FigureId | null
  steps: SlideStep[]
}

export interface Question {
  id: number
  question: string
  answer: string
}

export interface Reference {
  id: string
  citation: string
  apa: string
  url: string | null
}

export interface SourceMapRow {
  slide: string
  deck: string
  says: string
  supports: string
}

export interface DiscrepancyRow {
  slide: string
  slideSays: string
  sourceSays: string
  source: string
}

export interface Notes {
  meta: {
    heading: string
    course: string
    objective: string
    objectiveQuote: string
    objectiveSource: string
    related: string
    totalTime: string
    totalSlides: number
  }
  assumptions: string[]
  sourceMap: SourceMapRow[]
  workedExample: string
  discrepancies: DiscrepancyRow[]
  discrepancyNote: string
}

export interface FactSheet {
  devices: Device[]
  humanScale: HumanScale
  slides: Slide[]
  questions: Question[]
  references: Reference[]
  notes: Notes
  sectionNote: string
}
