# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Pinned by the brief: Vite, TypeScript (strict), Three.js, Tailwind CSS. No UI framework (React is removed), no data-visualization library. Dependencies come from npm only; fonts and icons are self-hosted so the deck runs offline.

## Users

Primary: a student group presenting Objective #5 ("Differences in access times in several types of devices") to their Operating Systems class (Storage Management, Device Management unit, NDDU). They drive the deck live from a laptop, usually onto a classroom projector, inside a 10-minute cap.

Secondary: classmates and the instructor watching the projection, and anyone reopening the page afterward to explore device specs on their own.

## Product Purpose

An interactive 3D presentation of the storage hierarchy. It walks the class from CPU registers to magnetic tape across the fact sheet's 10 slides, and lets anyone click a device for its full specification. Success means the class leaves understanding that storage access times differ by orders of magnitude, not by percentages, and why the gap exists (mechanical motion, protocol overhead, distance).

## Positioning

The source is a researched fact sheet, not a generic latency chart. Every number, range, and caveat comes from `docs/fact-sheet.md`, including where the sheet deliberately refuses to give a figure (Intel Optane, USB/SD, optical discs).

## Operating Context

- Presented live with keyboard or a presentation clicker (arrow keys, Page Up/Down), often on a projector in a lit room (inferred: the brief names no room, so both light and dark themes ship).
- 10 slides, each with a planned speaking time totalling 10 minutes (fact sheet Section C).
- Q&A follows the talk; the fact sheet's Section G lists the likely questions.

## Capabilities and Constraints

- Content comes only from `docs/fact-sheet.md`: Sections A to I. No fabricated figures. Derived arithmetic (unit conversions, log positions) is allowed and labeled.
- Section D has 16 devices (the brief's "14" was a miscount). Section E converts 14 of them; Optane and USB/SD have no human-scale figure.
- The brief pins: a stepped pyramid; a speed-to-color scale (fast cool blue/cyan, slow warm desaturated red); PBR slabs (metalness 0.3, roughness 0.4); a 75° camera starting at (30, 40, 50) orbiting (0, 10, 0); hover lift, idle float, click details; a human-scale toggle.
- Must degrade gracefully: if WebGL fails, the slides, table, and specs still work.
- Presenter names are not in the fact sheet and are left off (undecided, not invented).

## Brand Commitments

None beyond the course's own naming: Objective #5 quoted exactly, lesson and slide citations kept as written.

## Evidence on Hand

- `docs/fact-sheet.md`: the full source (slides, master table, human-scale analogy, Q&A, discrepancy log, APA references).
- No photos, logos, or presenter details exist. None may be invented.

## Product Principles

1. The number is the lesson: show real magnitudes and let the gaps between them do the talking.
2. Every figure traces to the fact sheet, and every estimate says it is one.
3. The presenter stays in control: keyboard-first, step-by-step, never blocked by the 3D.
4. Readable from the back row: projection legibility beats density.

## Accessibility & Inclusion

Projection legibility (large type, strong contrast in both themes), full keyboard control, visible focus, reduced-motion support, and a non-3D path to all content.
