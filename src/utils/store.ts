export type ThemeName = 'light' | 'dark'

export interface AppState {
  slide: number
  step: number
  human: boolean
  theme: ThemeName
  selected: string | null
  hovered: string | null
  powerOn: boolean
  sweeping: boolean
  deckHidden: boolean
  blackout: boolean
  reducedMotion: boolean
  webgl: boolean
}

export type Listener<S> = (state: S, previous: S) => void

export interface Store<S> {
  get(): S
  set(patch: Partial<S>): void
  subscribe(listener: Listener<S>): () => void
}

/** A minimal observable store: immutable snapshots and shallow patches; patches made while listeners run are queued so every listener sees each transition in order. */
export function createStore<S extends object>(initial: S): Store<S> {
  let state = initial
  let notifying = false
  const queue: Partial<S>[] = []
  const listeners = new Set<Listener<S>>()
  const apply = (patch: Partial<S>): void => {
    const keys = Object.keys(patch) as (keyof S)[]
    if (keys.every((key) => Object.is(state[key], patch[key]))) return
    const previous = state
    state = { ...state, ...patch }
    notifying = true
    try {
      listeners.forEach((listener) => listener(state, previous))
    } finally {
      notifying = false
    }
  }
  return {
    get: () => state,
    set(patch) {
      if (notifying) {
        queue.push(patch)
        return
      }
      apply(patch)
      while (queue.length > 0) {
        const next = queue.shift()
        if (next) apply(next)
      }
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

/** True when any of the named keys differ between two snapshots. */
export const changed = <S extends object>(state: S, previous: S, ...keys: (keyof S)[]): boolean =>
  keys.some((key) => !Object.is(state[key], previous[key]))
