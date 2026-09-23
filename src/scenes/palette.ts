import { Color } from 'three'
import { readToken } from '../utils/color'

export interface ScenePalette {
  dark: boolean
  ground: Color
  groundHex: string
  grid: Color
  gridMajor: Color
  ink: Color
  inkHex: string
  tick: Color
  line: Color
  sky: Color
  shadowOpacity: number
  edgeOpacity: number
}

const numberToken = (name: string, fallback: number): number => {
  const parsed = Number.parseFloat(readToken(name, String(fallback)))
  return Number.isFinite(parsed) ? parsed : fallback
}

/** Reads the scene tokens from CSS so the WebGL world always matches the active light or dark theme. */
export function readScenePalette(dark: boolean): ScenePalette {
  const groundHex = readToken('--scene-ground', dark ? '#161c23' : '#e6eaed')
  const inkHex = readToken('--scene-ink', dark ? '#cfd7de' : '#26303a')
  return {
    dark,
    ground: new Color(groundHex),
    groundHex,
    grid: new Color(readToken('--scene-grid', '#c9d0d6')),
    gridMajor: new Color(readToken('--scene-grid-major', '#b3bcc4')),
    ink: new Color(inkHex),
    inkHex,
    tick: new Color(readToken('--scene-tick', '#e9edf0')),
    line: new Color(readToken('--scene-line', '#3a4550')),
    sky: new Color(readToken('--scene-sky', '#ffffff')),
    shadowOpacity: numberToken('--scene-shadow', 0.2),
    edgeOpacity: numberToken('--scene-edge-opacity', 0.55),
  }
}
