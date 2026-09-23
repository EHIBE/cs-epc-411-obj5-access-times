import { Vector3 } from 'three'
import type { Device, HumanScaleEntry } from '../data/types'
import type { Annotations } from '../objects/Annotations'
import type { DepthColumn } from '../objects/DepthColumn'
import type { ProbeSweep } from '../objects/ProbeSweep'
import type { SpecimenId, SpecimenStage } from '../objects/SpecimenStage'
import type { StrataStack } from '../objects/StrataStack'
import { speedColor } from '../utils/color'
import { padRank } from '../utils/format'
import { placementLog, speedT, type SpeedDomain } from '../utils/scale'
import { el, richText } from './dom'
import { icon } from './icons'
import type { LabelLayer } from './LabelLayer'

export type CalloutMode = 'all' | 'focus' | 'none'

interface Callout {
  device: Device
  element: HTMLElement
  value: HTMLElement
  human: HumanScaleEntry | undefined
}

export interface SceneLabelSources {
  layer: LabelLayer
  devices: Device[]
  humanEntries: HumanScaleEntry[]
  domain: SpeedDomain
  stack: StrataStack
  column: DepthColumn
  specimens: SpecimenStage
  annotations: Annotations
  sweep: ProbeSweep
  lessonNames: { id: string; name: string; summary: string }[]
}

/** Builds and steers every DOM label attached to the 3D scene: device callouts, the column's two scales, specimen parts, measurements and the probe stamp. */
export class SceneLabels {
  private readonly sources: SceneLabelSources
  private readonly callouts = new Map<string, Callout>()
  private readonly note: HTMLElement
  private readonly probe: HTMLElement
  private readonly specimenLabelIds: { id: string; specimen: SpecimenId; visible: () => boolean }[] = []
  private readonly technicalTicks: HTMLElement[] = []
  private mode: CalloutMode = 'all'
  private focus: Set<string> | null = null
  private hovered: string | null = null
  private selected: string | null = null
  private human = false
  private powerOn = true
  private readonly reached = new Set<string>()
  private measure: string | null = null
  private lessons = false
  private volatility = false
  private probeVisible = false
  private compact = false
  private readonly epochIds: string[] = []

  constructor(sources: SceneLabelSources) {
    this.sources = sources
    const { layer, stack, column, specimens, annotations, sweep } = sources
    const humanById = new Map(sources.humanEntries.map((entry) => [entry.id, entry]))

    for (const device of sources.devices) {
      const value = el('span', { className: 'callout__value' })
      const element = el(
        'div',
        { className: 'callout', style: { '--swatch': speedColor(speedT(placementLog(device), sources.domain)) } },
        [
          el('span', { className: 'callout__rank', attrs: { 'aria-hidden': 'true' } }),
          el('span', { className: 'callout__name' }, [
            el('span', { className: 'num', text: padRank(device.rank), style: { color: 'var(--ink-3)', 'margin-right': '0.35em' } }),
            device.shortName,
          ]),
          value,
        ],
      )
      this.callouts.set(device.id, { device, element, value, human: humanById.get(device.id) })
      layer.add({
        id: `callout:${device.id}`,
        element,
        anchor: (target) => stack.anchor(device.id, target),
        placement: 'right',
        offset: 30,
        leader: true,
        group: 'callouts',
      })
    }

    this.note = el('div', { className: 'tick-label tick-label--note' })
    for (const label of column.labels) {
      const local = label.local
      const anchor = (target: Vector3): Vector3 => {
        target.copy(local)
        return column.group.localToWorld(target)
      }
      if (label.kind === 'note') {
        layer.add({ id: 'column:note', element: this.note, anchor, placement: 'above', offset: 6, visible: true })
        continue
      }
      const className =
        label.kind === 'epoch' ? 'tick-label tick-label--epoch' : label.kind === 'human' ? 'tick-label tick-label--human' : 'tick-label'
      const element = el('div', { className, text: label.text })
      if (label.kind !== 'human') this.technicalTicks.push(element)
      if (label.kind === 'epoch') this.epochIds.push(`column:${label.id}`)
      layer.add({
        id: `column:${label.id}`,
        element,
        anchor,
        placement: label.kind === 'epoch' ? 'rotated' : label.kind === 'human' ? 'right' : 'left',
        offset: label.kind === 'epoch' ? 62 : 7,
        group: label.kind === 'human' ? 'human' : label.kind === 'decade' ? 'decades' : undefined,
        visible: label.kind !== 'human',
      })
    }

    for (const [specimenId, specimen] of Object.entries(specimens.all) as [SpecimenId, (typeof specimens.all)[SpecimenId]][]) {
      for (const label of specimen.labels) {
        const id = `specimen:${specimenId}:${label.id}`
        const element = el('div', {
          className: 'tick-label tick-label--specimen',
          text: label.text,
          style: label.tone === 'strong' ? { 'font-weight': '760' } : {},
        })
        layer.add({
          id,
          element,
          anchor: (target) => (specimen.visibleAmount > 0.7 ? specimen.labelAnchor(label, target) : null),
          placement: 'above',
          offset: 6,
          group: `specimen:${specimenId}`,
        })
        this.specimenLabelIds.push({ id, specimen: specimenId, visible: label.visible })
      }
    }

    for (const measure of annotations.measures) {
      layer.add({
        id: `measure:${measure.spec.id}`,
        element: el('div', { className: 'tick-label tick-label--dimension', text: measure.spec.label }),
        anchor: (target) => {
          if (annotations.measureVisibility(measure.spec.id) < 0.5) return null
          target.copy(measure.anchor)
          return annotations.group.localToWorld(target)
        },
        placement: 'right',
        offset: 6,
      })
    }

    sources.lessonNames.forEach((lesson, index) => {
      const bracket = annotations.lessons[index]
      if (!bracket) return
      layer.add({
        id: `lesson:${lesson.id}`,
        element: el('div', { className: 'tick-label tick-label--bracket' }, [lesson.name, el('small', { text: lesson.summary })]),
        anchor: (target) => {
          target.copy(bracket.anchor)
          return annotations.group.localToWorld(target)
        },
        placement: 'right',
        offset: 8,
      })
    })

    layer.add({
      id: 'volatility',
      element: el('div', { className: 'tick-label tick-label--note', text: 'Above this sheet: volatile. Below: keeps its data without power.' }),
      anchor: (target) => {
        target.copy(annotations.volatility.anchor)
        return annotations.group.localToWorld(target)
      },
      placement: 'right',
      offset: 10,
    })

    this.probe = el('div', { className: 'tick-label tick-label--probe num' })
    layer.add({
      id: 'probe',
      element: this.probe,
      anchor: (target) => {
        target.copy(sweep.stamp)
        return sweep.group.localToWorld(target)
      },
      placement: 'left',
      offset: 10,
    })
    this.refreshAll()
  }

  setCallouts(mode: CalloutMode, focus: readonly string[] | null): void {
    this.mode = mode
    this.focus = focus ? new Set(focus) : null
    this.refreshCallouts()
  }

  /** On small screens only the pointed or focused devices keep a callout. */
  setCompact(compact: boolean): void {
    if (compact === this.compact) return
    this.compact = compact
    this.refreshCallouts()
  }

  setPointer(hovered: string | null, selected: string | null): void {
    this.hovered = hovered
    this.selected = selected
    this.refreshCallouts()
  }

  setHuman(on: boolean): void {
    this.human = on
    this.refreshAll()
  }

  setPower(on: boolean): void {
    this.powerOn = on
    this.refreshValues()
  }

  markReached(id: string): void {
    this.reached.add(id)
    this.refreshValue(id)
  }

  clearReached(): void {
    const ids = [...this.reached]
    this.reached.clear()
    ids.forEach((id) => this.refreshValue(id))
  }

  setMeasure(id: string | null): void {
    this.measure = id
    for (const measure of this.sources.annotations.measures) {
      this.sources.layer.setVisible(`measure:${measure.spec.id}`, measure.spec.id === id)
    }
  }

  setLessons(on: boolean): void {
    this.lessons = on
    this.sources.lessonNames.forEach((lesson) => this.sources.layer.setVisible(`lesson:${lesson.id}`, on))
  }

  setVolatility(on: boolean): void {
    this.volatility = on
    this.sources.layer.setVisible('volatility', on)
  }

  setProbe(visible: boolean, text: string): void {
    if (this.probeVisible !== visible) {
      this.probeVisible = visible
      this.sources.layer.setVisible('probe', visible)
    }
    if (visible && this.probe.textContent !== text) {
      this.probe.textContent = text
      this.sources.layer.touch('probe')
    }
  }

  get activeMeasure(): string | null {
    return this.measure
  }

  get showsLessons(): boolean {
    return this.lessons
  }

  get showsVolatility(): boolean {
    return this.volatility
  }

  /** Called every frame: specimen part labels follow their specimen's own phase. */
  update(): void {
    const { layer, specimens } = this.sources
    const active = specimens.active
    for (const entry of this.specimenLabelIds) {
      layer.setVisible(entry.id, entry.specimen === active && entry.visible())
    }
    const nano = layer.projectedY('column:decade:-9')
    const milli = layer.projectedY('column:decade:-3')
    const roomy = nano !== null && milli !== null && Math.abs(milli - nano) / 6 > 36 && !this.compact
    for (const id of this.epochIds) layer.setVisible(id, roomy)
  }

  private refreshAll(): void {
    const { layer, column } = this.sources
    for (const label of column.labels) {
      if (label.kind === 'human') layer.setVisible(`column:${label.id}`, this.human)
    }
    this.note.replaceChildren(this.human ? 'If 1 ns = 1 second…' : 'Access time, log scale')
    layer.touch('column:note')
    for (const node of this.technicalTicks) node.style.color = this.human ? 'var(--ink-3)' : ''
    this.refreshValues()
    this.refreshCallouts()
  }

  private refreshValues(): void {
    for (const id of this.callouts.keys()) this.refreshValue(id)
  }

  private refreshValue(id: string): void {
    const callout = this.callouts.get(id)
    if (!callout) return
    const { device, value, element } = callout
    const lost = device.volatile && !this.powerOn
    const reached = this.reached.has(id)
    const text = el('span')
    if (lost) text.textContent = 'contents lost'
    else if (this.human) text.textContent = callout.human ? callout.human.human : 'no single figure to convert'
    else text.appendChild(richText(device.calloutText))
    value.replaceChildren(...(reached ? [icon('check', 'icon'), text] : [text]))
    element.dataset.reached = String(reached)
    element.dataset.lost = String(lost)
    this.sources.layer.touch(`callout:${id}`)
  }

  private refreshCallouts(): void {
    for (const [id, callout] of this.callouts) {
      const pointed = id === this.hovered || id === this.selected
      const inFocus = !this.focus || this.focus.has(id)
      const visible = pointed || (!this.compact && this.mode === 'all') || (this.mode === 'focus' && inFocus && (!this.compact || this.focus !== null))
      this.sources.layer.setVisible(`callout:${id}`, visible)
      callout.element.dataset.state = pointed || (this.focus && inFocus) ? 'focus' : this.focus && !inFocus ? 'dim' : ''
    }
  }
}
