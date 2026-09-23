# Access times: registers to tape

An interactive 3D presentation of **Objective #5, "Differences in access times in several types of devices"** (Operating Systems, Storage Management, Device Management unit). Every figure comes from [`docs/fact-sheet.md`](docs/fact-sheet.md).

The idea: **access time is depth.** Each of the fact sheet's 16 devices floats as a stratum at its true position on a logarithmic time axis, from CPU registers at the surface to magnetic tape at bedrock. The gaps between the plates are the lesson: roughly 13 orders of magnitude, drawn to scale.

## Run it

```bash
npm install
npm run dev       # live dev server
npm run build     # type-check, then build to dist/
npm run preview   # serve the production build
npm run lint      # oxlint
```

The source entry point is `public/index.html`. The build writes `dist/index.html`, which loads `dist/main.js`. The build is fully self-contained (fonts and icons are bundled), so it runs offline. Open it through `npm run preview` or any static server; browsers block module scripts on `file://`.

## Presenting

The talk has 10 slides and 48 steps, sized to the fact sheet's 10-minute plan. Each keypress reveals the next fact and moves the 3D camera to match.

| Key | Action |
| --- | --- |
| Right arrow, Space, Page Down | Next step (presentation clickers work) |
| Left arrow, Page Up | Previous step |
| Shift + Right arrow | Next slide |
| 1 to 9, 0 | Jump to slide 1 to 10 |
| H | Human time: 1 ns becomes 1 second |
| S | Run the probe down the depth column |
| P | Cut or restore the power (volatility demo) |
| M | Master comparison table (all 9 columns) |
| Q | Likely questions (Section G), for Q&A |
| [ and ] | Faster or slower device while details are open |
| E | Hide the slide panel to explore the model |
| N | Presenter notes: planned minutes, lesson links and cues (hidden by default, so the projector shows only what the class needs) |
| R | Reset the camera to the current step |
| T | Light or dark theme |
| F | Full screen |
| B | Blank the screen |
| ? | All shortcuts |

With the mouse, drag to rotate, scroll to zoom, right-drag to pan, and click any stratum for its full specification. The bottom rail's segments are sized by each slide's planned minutes. Its clock starts when you leave the title slide, and the marker shows where the talk should be by now.

On shorter screens, such as a 1366 × 768 laptop driving a projector, a step that would not fit switches the slide panel to a compact setting: earlier points run together on one line and the panel widens a little, so every step fits without scrolling from 768px tall up.

Press N, or the notepad button in the top bar, to show the presenter layer while rehearsing: each slide's planned minutes and lesson link, and the builder's notes about a figure. It is hidden by default.

The light theme is tuned for projectors in lit classrooms; the dark theme, a deep navy sheet with light linework, suits dim rooms and screen sharing. The URL keeps your place (`#3.2` is slide 3, step 2), so a refresh mid-talk returns to the same step.

## Reading the model

| Encoding | Meaning |
| --- | --- |
| Height | Access time, log scale: every power of ten is the same distance |
| Width | Typical capacity, log scale |
| Depth | Relative cost per GB, ranked from the fact sheet's wording |
| Color | Speed: blue/cyan (fastest) through green and ochre to desaturated rust (slowest) |
| Whisker | The stated range; dashed when it is only an order-of-magnitude band |
| Ghosted plate | No single published figure (byte-addressable NVM, USB/SD) |
| Dashed inner line | No comparable figure for that dimension |
| Hatching | Each plate's front edge is hatched by family (CPU, memory, flash, mechanical, archive), as a geological section marks rock types |
| Line-only plate | In close-ups and mechanism details, plates outside the step's focus are drawn in outline only |
| Detail mark | A numbered circle on a plate's edge, joined by a leader to the mechanism model drawn beside it (schematic, not to scale) |
| Survey sheet | The floor's ruling is on the same module as the depth axis: a major line every 3.4 units (one power of ten), minor lines every fifth of that |

## Where the content comes from

| Fact sheet section | Used in |
| --- | --- |
| C, slide-by-slide | `src/data/slides.json`, the deck |
| D, master table (16 devices) | `src/data/devices.json`, the strata, callouts, table and detail panel |
| E, human-scale analogy | `src/data/human-scale.json`, human-time mode |
| G, likely questions | `src/data/questions.json`, the Questions drawer |
| I, references (APA) | `src/data/references.json`, Sources and each device's source |
| A, B, F, H and the header | `src/data/notes.json`, "Notes behind the numbers" |

No figure is invented. Where the fact sheet declines to give a number, the model says so:

- Byte-addressable NVM (Intel Optane) and USB/SD have no single published figure, so they are drawn as ghosted plates and read "no single figure to convert" in human time.
- The optical disc figure is flagged as an estimate.
- The human-scale table converts the 15,000 RPM drive's 2.0 ms rotational figure, while Section D gives roughly 5 to 6 ms total with seek. The model shows both and notes the difference in that drive's details.

Derived arithmetic, such as the log positions, the human-scale landmarks on the ruler, and one rotation time as 60 / RPM, is computed with the fact sheet's own rules. It is labeled where it appears.

To edit the talk, change the JSON files in `src/data/`. The app validates them at startup, skips malformed entries with a console warning, and falls back to a message if no device can be read. Presenter names are not in the fact sheet, so the title slide has none; add them to the first slide's `titleNote` in `slides.json` if you want them on screen.

## Project structure

```
public/index.html      page skeleton and entry point
src/main.ts            start-up, state wiring, keyboard, render loop
src/scenes/            renderer and studio environment, camera rig, lighting, survey sheet, picking, the director and per-step choreography
src/objects/           strata, engraved depth column, click sparks, probe cursor, annotations, specimen models
src/data/              the fact sheet as validated JSON, plus the loader and types
src/ui/                deck, figures, detail panel, legend, rail, dialogs, labels, styles
src/utils/             math and springs, log scale, OKLCH color ramp, formatting, validation, store
docs/fact-sheet.md     the source of every figure
PRODUCT.md, DESIGN.md  product context and the recorded design system
```

Built with Three.js, TypeScript (strict), Vite, and Tailwind CSS, using Archivo (via Fontsource) and Phosphor icons. If WebGL is unavailable, the 3D stage shows a notice and everything else keeps working.
