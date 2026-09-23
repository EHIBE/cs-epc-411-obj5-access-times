import type { Device, TierId } from '../data/types'

export interface TierDefinition {
  id: TierId
  name: string
  members: string
  fastest: string
  slowest: string
}

/** The five families the brief groups devices into, with their fastest and slowest figures quoted from Section D. */
export const TIERS: readonly TierDefinition[] = [
  { id: 'cpu', name: 'CPU', members: 'Registers, L1, L2, L3', fastest: '~0.02 ns', slowest: '~12 ns' },
  { id: 'memory', name: 'Memory', members: 'DRAM, byte-addressable NVM', fastest: '~30 ns', slowest: '~1 µs (approx.)' },
  { id: 'flash', name: 'Flash', members: 'NAND, NVMe, SATA, USB/SD', fastest: '~10 µs', slowest: 'a few hundred µs' },
  { id: 'mechanical', name: 'Mechanical', members: 'HDD 15K, 7,200, 5,400 RPM', fastest: '~5 ms', slowest: '~16 ms' },
  {
    id: 'archive',
    name: 'Network and archive',
    members: 'Network, optical, tape',
    fastest: '~8 ms',
    slowest: '100 s plus mount and load',
  },
]

export const tierOf = (id: TierId): TierDefinition => TIERS.find((tier) => tier.id === id) ?? (TIERS[0] as TierDefinition)

export const devicesInTier = (devices: Device[], tier: TierId): Device[] =>
  devices.filter((device) => device.tier === tier)

/** Lesson 1, Slide 5's own three-tier recap, mapped onto the devices it names. */
export const LESSON_TIERS: readonly { id: string; name: string; summary: string; deviceIds: string[] }[] = [
  { id: 'primary', name: 'Primary / main memory', summary: 'Very fast, small, volatile', deviceIds: ['l1', 'l2', 'l3', 'dram'] },
  {
    id: 'secondary',
    name: 'Secondary / persistent',
    summary: 'Medium, large, non-volatile',
    deviceIds: ['nvme', 'sata', 'usb', 'hdd-15k', 'hdd-7200', 'hdd-5400'],
  },
  { id: 'tertiary', name: 'Tertiary', summary: 'Slow, very large, non-volatile', deviceIds: ['optical', 'tape'] },
]

/** Lesson 2, Slide 1's title diagram: which physical media sit on each access-method branch. */
export const ACCESS_BRANCHES: readonly { name: string; media: { label: string; deviceId: string | null }[] }[] = [
  {
    name: 'Sequential Access',
    media: [
      { label: 'Paper Storage Media', deviceId: null },
      { label: 'Magnetic Tape Storage Media', deviceId: 'tape' },
    ],
  },
  {
    name: 'Direct Access',
    media: [
      { label: 'Magnetic Disk Storage Media', deviceId: 'hdd-7200' },
      { label: 'Optical Disc Storage', deviceId: 'optical' },
    ],
  },
]
