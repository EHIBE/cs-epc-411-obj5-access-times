import { Color } from 'three'
import { readToken } from '../utils/color'

export interface ScenePalette {
  dark: boolean
  ground: Color
  groundHex: string
  paperHex: string
  ruleMinorHex: string
  ruleMajorHex: string
  ink: Color
  inkHex: string
  tick: Color
  line: Color
  sky: Color
  shadowOpacity: number
  edgeOpacity: number
  hatchOpacity: number
}

const numberToken = (name: string, fallback: number): number => {
  const parsed = Number.parseFloat(readToken(name, String(fallback)))
  return Number.isFinite(parsed) ? parsed : fallback
}

/** Reads the scene tokens from CSS so the WebGL world always matches the active light or dark theme. */
export function readScenePalette(dark: boolean): ScenePalette {
  const groundHex = readToken('--scene-ground', dark ? '#101a24' : '#e6eaed')
  const inkHex = readToken('--scene-ink', dark ? '#d3dfe9' : '#26303a')
  return {
    dark,
    ground: new Color(groundHex),
    groundHex,
    paperHex: readToken('--scene-paper', dark ? '#14222f' : '#f5f7f8'),
    ruleMinorHex: readToken('--scene-rule-minor', dark ? '#1c2f40' : '#e0e7ed'),
    ruleMajorHex: readToken('--scene-rule-major', dark ? '#2a4459' : '#c3cfda'),
    ink: new Color(inkHex),
    inkHex,
    tick: new Color(readToken('--scene-tick', dark ? '#101a24' : '#eef2f5')),
    line: new Color(readToken('--scene-line', dark ? '#c9d7e3' : '#2e3945')),
    sky: new Color(readToken('--scene-sky', dark ? '#2a3b4d' : '#ffffff')),
    shadowOpacity: numberToken('--scene-shadow', 0.14),
    edgeOpacity: numberToken('--scene-edge-opacity', 0.6),
    hatchOpacity: numberToken('--scene-hatch-opacity', 0.34),
  }
}
