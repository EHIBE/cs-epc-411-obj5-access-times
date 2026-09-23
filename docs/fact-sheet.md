# Objective #5: Differences in Access Times in Several Types of Devices

**Course:** Operating Systems, Storage Management (Device Management unit)
**Objective #5 (quoted exactly):** "Differences in access times in several types of devices" (Lesson 2, Slide 2, item 5)
**Related objective feeding this one:** #4, "Roles of seek time, search time, and transfer time in calculating access time" (Lesson 2, Slide 2, item 4)
**Total planned time:** 10 minutes or less
**Total slides:** 10

---

## Section A: Assumptions

- The two source files use two different objective lists. Lesson 1 ("Storage Management in Operating Systems," `LESSON - STORAGE MANAGEMENT.pptx`) has its own 5-item list, and its own item 5 is "Describe disk scheduling and performance basics," a different topic. The objective this fact sheet answers, "Differences in access times in several types of devices," is item 5 of Lesson 2's list ("Device Management," `LESSON - STORAGE MANAGEMENT2.pptx`, Slide 2). Lesson 1 is still used below because it is the only one of the two files that contains real hardware access-time content.
- Neither lesson file contains an explicit numeric access-time formula or worked computation. Per the brief, Section F below says so plainly instead of inventing one. The formula itself (access time = seek time + rotational latency + transfer time) is still explained in words on Slide 5, sourced to outside academic material, because Objective #4 requires the terms and Objective #5 cannot be explained without them.
- Lesson 2's Objective #4 uses the term "search time." The academic sources located for this fact sheet (Weiss, n.d.) (Stanford University, n.d.) call the same component "rotational latency" or "rotational delay." Both names describe the same wait for the target sector to rotate under the read/write head. This fact sheet treats them as synonyms and says so on Slide 2, rather than silently picking one.
- No vendor datasheet located during research publishes a single official "access time" figure for CD/DVD/Blu-ray drives (manufacturers publish data-transfer speed ratings like "16x" instead). The figure used for optical discs is a order-of-magnitude range drawn from academic course material, flagged as an estimate rather than a hard spec.
- Intel Optane is described only by its position in the hierarchy and its 2022 discontinuation, not by an invented precise latency number, because no source in the allowed list (textbooks, vendor datasheets, standards bodies, .edu notes) published one during this research pass.
- Device coverage goes beyond what either slide deck lists by name (registers, cache levels, the NVMe/SATA split, USB/SD flash, optical, tape, and network/cloud storage), per the brief's instruction to cover every device type useful to the class while keeping the deck presentable in 10 slides and 10 minutes.
- Per-slide time allocations (Section C) are a suggested pace to fit the 10-minute cap. Adjust to the presenter's actual speaking speed.
- Sequential/Direct/Index Sequential file access methods (Lesson 2, Slides 15 to 27) are software-level techniques for reading records inside a file, not hardware access time. They are referenced only where they explain why some access patterns are faster than others (for example, Slide 22's "decreasing the average access time"), per the hard rule to stay inside Objective #5.

---

## Section B: Lesson Source Map

| Slide # | Deck | What it says | How it supports Objective #5 |
|---|---|---|---|
| Slide 1 | Lesson 2 | Title-slide diagram: Sequential Access branches to Paper Storage Media and Magnetic Tape Storage Media. Direct Access branches to Magnetic Disk Storage Media and Optical Disc Storage | Shows, at a glance, that a device's access method (sequential vs. direct) is historically tied to its physical medium, which is the root cause of the access-time differences this objective covers |
| Slide 2 | Lesson 2 | Learning Objectives list. Item 4: "Roles of seek time, search time, and transfer time in calculating access time." Item 5 (quoted exactly): "Differences in access times in several types of devices" | Item 5 is the objective this fact sheet answers, quoted verbatim. Item 4 supplies the vocabulary needed to explain it |
| Slide 14 | Lesson 2 | "Storage media are divided into two groups: sequential access media... and direct access storage devices (DASD)... There are vast differences in their speed and shareability" | The most direct textual anchor in Lesson 2 itself for "differences in access times across device types" |
| Slides 17 to 27 | Lesson 2 | Sequential, Direct, and Index Sequential file access methods, each with a block diagram | Background on access patterns. Slide 22 explicitly ties direct access to "decreasing the average access time," and Slide 26 ties indexing to "Reduced Access Time" |
| Slide 38 | Lesson 2 | Individual research activity: find two of the fastest removable backup devices available today and cite benchmarks | Confirms this course's pattern of assigning device-speed research as student presentation work, the same genre as this objective's activity |
| Slide 5 | Lesson 1 | Storage Hierarchy (RECAP) table: Primary/Main Memory (RAM, Cache) = Very Fast, Small, Volatile. Secondary/Persistent (HDD, SSD, USB) = Medium, Large, Non-volatile. Tertiary (Tape, Optical Archive) = Slow, Very Large, Non-volatile | The direct primary-source backbone for the whole device speed comparison. Used as the skeleton for Section D below |
| Slide 19 | Lesson 1 | "HDD VS SSD": HDD (mechanical) = seek time + rotational latency = slower, affects scheduling. SSD (flash) = no moving parts, near-zero seek time, faster but costlier per GB | The most direct hardware explanation available in either file for *why* access times differ. Primary anchor for Slides 5 and 6 below |
| Slide 20 | Lesson 1 | Disk scheduling algorithms: FCFS, SSTF, SCAN/Elevator | One-line relevance only: these algorithms exist because seek time dominates HDD access time |
| Slide 21 | Lesson 1 | Fragmentation and defragmentation. SSDs do not need defragmentation because they have no moving parts | Minor supporting fact for the HDD-vs-SSD mechanical difference |
| Slide 22 | Lesson 1 | Summary: "Disk Scheduling optimizes mechanical HDD performance" and "SSDs change the rules" | Reinforces the core takeaway of this objective |

---

## Section C: Slide-by-Slide Fact Sheet (10 slides)

### Slide 1: Title / Objective
**Time:** 0.5 min
**Key facts:**
- Objective #5: "Differences in access times in several types of devices" (Lesson 2, Slide 2)
- Scope: why the exact same task (reading data) takes wildly different amounts of time depending on which device holds it
- This sits directly on top of Objective #4 (seek, search, and transfer time), covered first so the vocabulary is in place
**Visual:** Reuse or redraw the Lesson 2 title-slide diagram (Sequential Access to Paper/Tape, Direct Access to Disk/Optical)
**Lesson link:** Lesson 2, Slides 1 to 2

### Slide 2: Key Terms
**Time:** 1 min
**Key facts:**
- **Access time**: total time from an I/O request to the moment the first byte of data is available (Weiss, n.d.) (Stanford University, n.d.)
- **Seek time**: time to move the read/write head (or arm) to the correct track or cylinder (Stanford University, n.d.)
- **Rotational latency ("search time")**: wait for the target sector to spin under the head once the head is on the right track. Lesson 2's own objective list calls this "search time" (Lesson 2, Slide 2, item 4). This fact sheet treats the two names as the same thing
- **Transfer time**: time to actually move the requested bits once the head is in position (Stanford University, n.d.)
- **Formula (in words, no slide computation exists to copy):** Access time = seek time + rotational latency (search time) + transfer time (Weiss, n.d.) (Stanford University, n.d.)
- **Sequential vs. direct (random) access**: sequential media must pass over every record in order. Direct-access media can jump straight to an address (Lesson 2, Slides 14 to 21)
- **IOPS**: input/output operations completed per second, the standard way flash and solid-state devices are rated instead of seek time (NVM Express, n.d.)
**Visual:** A simple three-box flow: Seek -> Rotate/Search -> Transfer -> Data Ready
**Lesson link:** Lesson 2, Slide 2 (terms named) and Lesson 1, Slide 19 (seek + rotational latency mentioned together)

### Slide 3: The Storage Hierarchy and Why It Exists
**Time:** 1.5 min
**Key facts:**
- Lesson 1's own recap table: Primary/Main Memory (RAM, Cache) = Very Fast, Small, Volatile. Secondary/Persistent (HDD, SSD, USB) = Medium, Large, Non-volatile. Tertiary (Tape, Optical Archive) = Slow, Very Large, Non-volatile (Lesson 1, Slide 5)
- General rule confirmed by outside sources: the higher a device sits in the hierarchy, the higher its cost per bit, the faster its access time, and the smaller its capacity (Simon Fraser University, n.d.)
- The classic fastest-to-slowest ordering used throughout this fact sheet, registers, then L1/L2 cache, then main memory, then disk cache, then disk, then optical, then tape, comes from standard computer-architecture teaching material, not from either lesson file (Nayda, n.d.)
- This is a trade-off, not an accident: no single technology is simultaneously the fastest, the cheapest, and the largest, so real systems stack several tiers and let the OS and hardware move data between them
- Lesson 2's title-slide diagram adds the historical layer: sequential-access devices (paper, tape) and direct-access devices (magnetic disk, optical) evolved as separate branches (Lesson 2, Slide 1)
> **Note:** Lesson 1's table places HDD, SSD, and USB flash in one "Medium" bucket. Section H explains why this fact sheet splits them apart.
**Visual:** A pyramid or stepped bar chart: Registers/Cache -> RAM -> SSD -> HDD -> Optical/Tape, width = capacity, height = speed
**Lesson link:** Lesson 1, Slide 5 and Lesson 2, Slide 1

### Slide 4: Registers, Cache, and RAM (the nanosecond tier)
**Time:** 1 min
**Key facts:**
- CPU registers: on the order of tens of picoseconds, effectively the same clock cycle as the instruction using them (Massachusetts Institute of Technology, n.d.)
- L1 cache: about 1 nanosecond (roughly 4 CPU cycles) (ScienceDirect Topics, n.d.)
- L2 cache: about 3 nanoseconds (roughly 12 cycles) (ScienceDirect Topics, n.d.)
- L3 cache: about 12 nanoseconds (roughly 26 cycles on average) (ScienceDirect Topics, n.d.)
- Main memory (DRAM): roughly 30 to 100 nanoseconds per random access, ten to a hundred times slower than L1 cache (ScienceDirect Topics, n.d.)
- All of these are volatile: contents are lost the instant power is cut (Lesson 1, Slide 5)
- Why so fast: pure electrical switching on or right next to the CPU die, no mechanical motion and no removable media involved
**Visual:** Bar chart on a log scale, registers through DRAM, all under 100 ns
**Lesson link:** Lesson 1, Slide 5 (RAM/Cache = "Very Fast")

### Slide 5: HDD Access Time (the millisecond tier)
**Time:** 1.5 min
**Key facts:**
- A hard disk is mechanical: a spinning platter plus a moving arm, so every access pays a physical penalty (Lesson 1, Slide 19)
- Average seek time on desktop-class drives: about 3 to 12 ms, 9 ms is a commonly cited typical figure (Weiss, n.d.)
- Rotational latency depends on spindle speed. Average latency = half of one full rotation, rotation time = 60 / RPM in seconds (Weiss, n.d.) (Stanford University, n.d.)
- Worked rotational-latency figures at common spindle speeds (calculated from that formula, not from the lesson slides): 5,400 RPM is about 5.6 ms average, 7,200 RPM is about 4.16 ms average as measured on a real drive (Seagate Technology, 2019), 15,000 RPM is about 2.0 ms average as rated by the manufacturer (Seagate Technology, 2015)
- Put together, total average access time runs from about 5 ms on a fast drive to about 15 to 16 ms on a slow 5,400 RPM drive (Weiss, n.d.) (Stanford University, n.d.)
- This mechanical penalty is exactly why disk scheduling algorithms (FCFS, SSTF, SCAN) exist: they reorder requests to cut down the arm's total travel (Lesson 1, Slide 20)
**Visual:** Cutaway diagram of a platter and arm, labeling seek path and rotation arc
**Lesson link:** Lesson 1, Slides 19 and 20

### Slide 6: SSD Access Time, SATA vs. NVMe (the microsecond tier)
**Time:** 1.5 min
**Key facts:**
- Flash-based SSDs have no moving parts, so there is no seek time or rotational latency to wait for (Lesson 1, Slide 19)
- At the raw NAND chip level, a page read takes on the order of 10 microseconds, roughly a thousand times faster than the HDD figures on the previous slide (University of Washington, 2023)
- Interface matters more than the memory chips once mechanical delay is gone. SATA SSDs use the older AHCI protocol, capped at about 200,000 IOPS with one queue of 32 commands. NVMe SSDs use a streamlined protocol built for flash, already demonstrated past 1,000,000 IOPS, with up to 64,000 queues of 64,000 commands each (NVM Express, n.d.)
- That protocol gap is why two SSDs with the same NAND chips can post very different real-world numbers: a current NVMe drive is rated for sequential reads around 7,450 MB/s (Samsung Electronics, 2023), well beyond what the SATA interface itself can carry
- Trade-off: SSDs cost more per GB than HDDs (Lesson 1, Slide 19)
> **Note:** Neither lesson file gives an exact microsecond figure for a finished SSD. The figures above come from the underlying NAND chip speed and the standards body's own protocol comparison, not from a single "SSD access time" spec sheet, because SSD vendors publish IOPS and MB/s instead.
**Visual:** Side-by-side bar: SATA (32-command queue) vs. NVMe (64K-command queue), with the IOPS ceiling for each
**Lesson link:** Lesson 1, Slide 19 ("no moving parts... faster but more expensive per GB")

### Slide 7: Flash Drives, Optical Discs, and Magnetic Tape
**Time:** 1 min
**Key facts:**
- USB flash drives and SD/microSD cards use the same NAND flash principle as SSDs, but usually with simpler, cheaper controllers and a slower bus, so real-world access is slower than an internal SSD even though the underlying memory is similar (Kingston Technology, n.d.)
- Optical discs (CD, DVD, Blu-ray) read with a laser following a spiral track from the center outward, instead of the concentric tracks a hard disk uses. Moving the laser a long distance across that spiral is slow and its access time varies a lot depending on where the data sits, so drive makers publish read speed ("16x") rather than one access-time number. Published academic material puts it roughly two orders of magnitude behind a hard disk
- Magnetic tape (LTO-9) is built for sequential throughput, not quick access: native transfer rate is 400 MB/s, 1,000 MB/s compressed (LTO Program, n.d.), but finding one specific file means a robotic mount (4 to 10 seconds), a drive load (about 11 seconds), and then locating the file on the tape (10 to 100 seconds) (Moore, 2020)
- That is why tape is still bought today for backup and archival storage: once the tape is positioned, it streams data faster than most hard disks (360 to 400 MB/s vs. 160 to 220 MB/s), it costs very little per GB, and it can be removed and stored off-site (Moore, 2020). Lesson 2, Slide 38's own activity asks students to research exactly this kind of removable backup device
**Visual:** Timeline bar for tape: mount -> load -> locate -> stream, showing where the 10-100 second wait sits before data ever moves
**Lesson link:** Lesson 1, Slide 5 (Tertiary = Tape, Optical Archive = Slow) and Lesson 2, Slide 38 (removable backup-device activity)

### Slide 8: Master Comparison Table
**Time:** 0.5 min
**Key facts:**
- Full table is Section D below. Walk the class from fastest (registers) to slowest (tape) and point out the table spans roughly 13 orders of magnitude, tens of picoseconds to over a minute
- Cost per GB moves in the opposite direction: the fastest tiers are the most expensive per byte, the slowest are the cheapest
**Visual:** The Section D table itself, projected in full
**Lesson link:** Synthesizes Lesson 1, Slide 5 and every device slide above

### Slide 9: Human-Scale Analogy
**Time:** 1 min
**Key facts:**
- Rule used: pretend 1 nanosecond of real computer time equals 1 second of human time. Full table and math are in Section E
- Headline comparison: on that scale, an L1 cache hit takes about 1 second, a 7,200 RPM hard disk access takes about 108 days, and locating one file on tape takes roughly 1,744 years
- The point: the difference between "fast" and "slow" storage is not a small percentage, it is many orders of magnitude, which is the entire reason operating systems go to so much trouble (caching, buffering, scheduling) to hide slow devices from the user
**Visual:** A horizontal timeline from "1 second" to "1,744 years," with device icons placed along it
**Lesson link:** Illustrates the same devices as Slides 3 to 7, no new lesson content

### Slide 10: Summary and Key Takeaways
**Time:** 0.5 min
**Key facts:**
- Access time = seek time + rotational latency (search time) + transfer time. Mechanical devices pay for all three, electronic devices barely pay for the first two (Weiss, n.d.) (Lesson 1, Slide 19)
- Speed, cost per GB, and capacity always trade off against each other. That trade-off is why every real system uses several storage tiers instead of one (Simon Fraser University, n.d.) (Lesson 1, Slide 5)
- Removing moving parts (HDD to SSD) buys roughly 1,000 times faster access. Removing protocol overhead on top of that (SATA to NVMe) buys another large jump in throughput (University of Washington, 2023) (NVM Express, n.d.)
- Slow, cheap, removable media like tape has not disappeared. It is still the right tool when the job is bulk backup and off-site archiving rather than quick access (Moore, 2020)
**Visual:** Recap pyramid from Slide 3, now labeled with real numbers from Section D
**Lesson link:** Lesson 1, Slide 22 ("Disk Scheduling optimizes mechanical HDD performance" and "SSDs change the rules")

---

## Section D: Master Comparison Table

Sorted fastest to slowest. "Order of Magnitude" is the typical access time rounded to a power of ten for quick comparison.

| Device | Typical Access Time | Order of Magnitude | Dominant Delay Factor | Volatile? | Relative Cost per GB | Typical Capacity (2026) | Typical Use | Source |
|---|---|---|---|---|---|---|---|---|
| CPU register | ~0.02 to 0.1 ns | 10⁻¹⁰ s | Electrical switching inside the CPU core | Yes | Not sold separately (part of CPU die) | A few hundred bytes per core | Holding operands mid-instruction | Massachusetts Institute of Technology, n.d. |
| L1 cache | ~1 ns | 10⁻⁹ s | On-die SRAM switching | Yes | Extremely high | 32 to 128 KB per core | CPU's most recently used data/instructions | ScienceDirect Topics, n.d. |
| L2 cache | ~3 ns | 10⁻⁹ s | On-die SRAM switching, one step further from the core | Yes | Very high | 256 KB to 2 MB per core | Second-level CPU cache | ScienceDirect Topics, n.d. |
| L3 cache | ~12 ns | 10⁻⁸ s | Shared on-die SRAM, longer wire distance | Yes | High | 8 to 64 MB shared | Last-level cache shared across cores | ScienceDirect Topics, n.d. |
| DRAM (main memory) | ~30 to 100 ns | 10⁻⁸ s | Row activation and charge sensing in the memory cell | Yes | Moderate to high | 8 to 128 GB (typical desktop/server) | Running programs and their working data | ScienceDirect Topics, n.d. |
| Byte-addressable NVM (e.g., Intel Optane) | Between DRAM and NAND flash (no single published figure) | 10⁻⁷ to 10⁻⁶ s (approx.) | Phase-change/resistive cell access, no block erase needed | No | High (niche/legacy pricing) | Up to a few hundred GB per module | Persistent memory tier, cache for slower SSDs | Product discontinued by Intel in 2022. Qualitative positioning only |
| Raw NAND flash cell (component level) | ~10 µs read, ~100 µs program | 10⁻⁵ to 10⁻⁴ s | Reading/charging the flash cell itself | No | (component, not sold standalone) | N/A | Building block inside all flash-based storage | University of Washington, 2023 |
| NVMe SSD | Tens of microseconds, host-visible | 10⁻⁵ s | NAND chip read plus a lightweight PCIe/NVMe protocol | No | Moderate | 500 GB to 4+ TB (consumer), up to tens of TB (enterprise) | OS/boot drives, high-performance storage | University of Washington, 2023 / NVM Express, n.d. / Samsung Electronics, 2023 |
| SATA SSD | Tens to a few hundred microseconds, host-visible | 10⁻⁴ s | Same NAND chip plus the older, heavier AHCI/SATA protocol | No | Low to moderate | 250 GB to 4 TB | Budget and older-system upgrades | NVM Express, n.d. / University of Washington, 2023 |
| USB flash drive / SD card | Similar order to SSD flash, often slower in practice | 10⁻⁴ s (approx.) | NAND cell plus a simpler controller and USB/SD bus overhead | No | Low | 32 GB to 1 TB+ | Portable transfer, cameras, backup | Kingston Technology, n.d. |
| HDD, 15,000 RPM (enterprise) | ~2.0 ms rotational + seek, roughly 5 to 6 ms total | 10⁻³ s | Rotational latency and seek together | No | Low | Hundreds of GB to a few TB | High-performance enterprise storage | Seagate Technology, 2015 |
| HDD, 7,200 RPM (desktop/enterprise) | ~4.16 ms rotational + seek, roughly 9 to 13 ms total | 10⁻² s | Rotational latency and seek together | No | Very low | 1 to 24+ TB | Mainstream desktop and NAS storage | Seagate Technology, 2019 / Weiss, n.d. |
| HDD, 5,400 RPM (laptop/consumer) | ~5.6 ms rotational + seek, roughly 15 to 16 ms total | 10⁻² s | Rotational latency and seek together, slower spindle | No | Very low | 500 GB to 5 TB | Budget laptops, external drives | Stanford University, n.d. / Weiss, n.d. |
| Network / cloud storage (round trip) | ~8 ms (same metro area) to 270+ ms (opposite side of the world) | 10⁻² to 10⁻¹ s | Physical distance and number of network hops, not the storage device itself | No | Pay-per-use, no fixed per-GB hardware cost | Effectively unlimited (provider-managed) | Off-site backup, shared/collaborative storage | Microsoft Corporation, 2026 |
| Optical disc (CD/DVD/Blu-ray) | Roughly 100 to 300 ms (estimated order of magnitude, no single vendor spec found) | 10⁻¹ s | Laser must jump across a spiral track, not concentric rings | No | Low (per disc) | 700 MB (CD) to 100 GB (Blu-ray XL) | Software/media distribution, cold archival | Order-of-magnitude estimate, no exact vendor figure located |
| Magnetic tape (LTO-9), locating one file | 10 to 100 seconds to locate, plus 4-10 s robotic mount and ~11 s drive load | 10¹ to 10² s | Physically winding the tape to the right position | No | Extremely low | 18 TB native, 45 TB compressed per cartridge | Bulk backup, long-term off-site archiving | LTO Program, n.d. / Moore, 2020 |

---

## Section E: Human-Scale Analogy

**Rule:** 1 nanosecond of real time = 1 second of human time. Every figure below is the representative value from Section D, converted with that rule, then converted again into a human-friendly unit. Because the rule is linear, converting is just "take the real time in nanoseconds and read it as seconds."

| Device | Real access time used | In nanoseconds | Human-scale equivalent |
|---|---|---|---|
| CPU register | 0.02 ns | 0.02 ns | 0.02 seconds, faster than an eye blink (~0.1 to 0.4 s) |
| L1 cache | 1 ns | 1 ns | 1 second, about one heartbeat |
| L2 cache | 3 ns | 3 ns | 3 seconds |
| L3 cache | 12 ns | 12 ns | 12 seconds |
| DRAM (main memory) | 50 ns (midpoint of 30 to 100 ns) | 50 ns | 50 seconds, just under a minute |
| Raw NAND flash (component) | 10 µs | 10,000 ns | 2 hours 47 minutes |
| NVMe SSD (host-visible, illustrative midpoint) | 50 µs | 50,000 ns | 13 hours 53 minutes, about half a day |
| SATA SSD (host-visible, illustrative midpoint) | 200 µs | 200,000 ns | about 2.3 days |
| HDD, 15,000 RPM | 2.0 ms | 2,000,000 ns | about 23 days |
| HDD, 7,200 RPM | 9.3 ms | 9,300,000 ns | about 108 days, roughly 3.5 months |
| HDD, 5,400 RPM | 15.6 ms | 15,600,000 ns | about 181 days, roughly 6 months |
| Network / cloud storage (typical cross-region) | 50 ms | 50,000,000 ns | about 1 year 7 months |
| Optical disc (estimated) | 150 ms | 150,000,000 ns | about 4.8 years |
| Magnetic tape, locating one file | 55 s (midpoint of 10 to 100 s) | 55,000,000,000 ns | about 1,744 years |

Method note: where Section D gave a range, the midpoint was used here so each device gets exactly one illustrative number. Conversions: 60 seconds = 1 minute, 3,600 seconds = 1 hour, 86,400 seconds = 1 day, 31,536,000 seconds = 1 (365-day) year.

---

## Section F: Worked Example

Not included. Neither lesson file contains a worked access-time computation using real numbers, only the qualitative statement on Lesson 1, Slide 19 that HDD access time equals "seek time + rotational latency." Per the brief, no numeric example was invented to fill that gap. The formula itself is explained in words on Slide 5 above (Weiss, n.d.) (Stanford University, n.d.), and the RPM-based rotational-latency figures on that slide were calculated directly from the standard formula (rotation time = 60 / RPM, average latency = half of that), not copied from either deck.

---

## Section G: Likely Questions and Answers

**1. Why is an SSD faster than an HDD if both are called "secondary storage"?**
"Secondary storage" only describes where a device sits in the hierarchy (non-volatile, larger than RAM), not how it works internally. An HDD is mechanical and pays seek time and rotational latency on every access. An SSD has no moving parts, so it skips both (Lesson 1, Slide 19) (University of Washington, 2023).

**2. Why not build all storage out of the fastest memory (registers or cache)?**
Cost and physical size. The fastest tiers are also the most expensive per bit and the hardest to make large, which is exactly the trade-off the storage hierarchy is built around (Simon Fraser University, n.d.) (Lesson 1, Slide 5).

**3. What is the difference between access time and transfer rate?**
Access time is how long it takes to *start* getting data (positioning the head and reaching the right spot). Transfer rate is how fast data moves *once* the device is already in position. A device can have a short access time but a modest transfer rate, or the reverse, tape is the clearest example: slow to locate a file, but very fast once it is streaming (Stanford University, n.d.) (Moore, 2020).

**4. Why is RAM volatile?**
DRAM stores each bit as a charge on a tiny capacitor that needs continuous power (and constant refreshing) to hold its value. Cut the power and the charge drains away, which is what "volatile" means (Lesson 1, Slide 5).

**5. Why is tape still used today if it is so much slower?**
Tape is slow to locate a specific file but very fast once streaming, extremely cheap per GB, and it can be physically removed and stored off-site, which protects data from a fire, flood, or ransomware attack that could reach an always-connected disk. That is exactly what Lesson 2's own individual research activity (Slide 38) asks students to investigate (Moore, 2020) (Lesson 2, Slide 38).

**6. How does the OS hide slow device access from the user?**
Mainly through caching and buffering, keeping recently or soon-to-be-needed data in faster memory so the program rarely has to wait on the slowest device directly. That is a different learning objective (I/O subsystem and buffering, Lesson 2, Slide 2, items 3 and 6), so this fact sheet only flags the connection.

**7. Does NVMe vs. SATA matter if both are SSDs?**
Yes. Both can use the same NAND flash chips, but SATA is limited by the older AHCI protocol (about 200,000 IOPS, one queue of 32 commands) while NVMe was designed for flash from the start (over 1,000,000 IOPS demonstrated, up to 64,000 queues of 64,000 commands each). The interface, not just the memory chip, sets the ceiling (NVM Express, n.d.).

**8. What is the difference between "seek time" and "search time"? Aren't they the same thing?**
In this course's own objective list they are listed as two of the three components of access time. The academic sources used for this fact sheet call the same second component "rotational latency" rather than "search time." Different textbooks use different names for it, but it is the same wait: the disk spinning until the right sector arrives under the head (Weiss, n.d.) (Stanford University, n.d.).

**9. Why does a 15,000 RPM drive have lower latency than a 5,400 RPM drive?**
Rotational latency is on average half of one full rotation, and rotation time equals 60 divided by RPM. A faster spindle completes a rotation in less time, so the average wait for the right sector is shorter, about 2.0 ms at 15,000 RPM versus about 5.6 ms at 5,400 RPM (Seagate Technology, 2015) (Weiss, n.d.).

**10. Why is optical disc access time so much slower and so inconsistent compared to a hard disk?**
An optical disc is read as one continuous spiral track from the center outward, rather than the concentric, independently addressable tracks a hard disk uses. Jumping to an arbitrary point on that spiral takes the laser much longer than moving a magnetic head a similar logical distance, and how far it has to jump varies a lot depending on where on the disc the data sits (Lesson 2, Slide 1's sequential/direct diagram places optical discs on the direct-access side, but mechanically closer to sequential media in practice).

**11. What does "random access" versus "sequential access" mean for access time?**
A sequential-access device (tape) must physically pass over every record between where it currently is and the one it needs. A direct/random-access device (disk, SSD, RAM) can jump straight to an address. That difference is the entire reason tape's access time (seconds) is so much worse than its throughput (very fast) would suggest (Lesson 2, Slides 14 and 21 to 22).

**12. Is cloud storage part of this hierarchy, and how does its access time compare?**
Yes, it sits at the slow end alongside or below tape and optical for a single request, but for a different reason: the delay is mostly network distance, not the storage device itself. A round trip to a nearby data center runs about 8 ms, while a round trip to a data center on the other side of the world can run past 270 ms (Microsoft Corporation, 2026).

---

## Section H: Discrepancy Log

| Slide # | Slide Says | Current Source Says | Source |
|---|---|---|---|
| Lesson 1, Slide 5 | Groups HDD, SSD, and USB flash together in one "Medium" speed tier | HDD access time (milliseconds) and SSD access time (tens to low hundreds of microseconds) differ by roughly 1,000 times. They are not the same speed tier | University of Washington, 2023 / Seagate Technology, 2019 |
| Lesson 1, Slide 19 | States SSD has "near-zero seek time" | Directionally correct (no mechanical seek exists), but not literally zero. A finished SSD still takes on the order of tens of microseconds per access | University of Washington, 2023 / NVM Express, n.d. |

Both entries are simplifications appropriate to Lesson 1's own recap-level scope, not errors. They are flagged here, per the brief, rather than corrected silently on the slides themselves.

---

## Section I: References (APA 7th edition)

Kingston Technology. (n.d.). *Flash memory guide*. https://media.kingston.com/pdfs/MKF-283.3-Flash-Memory-Guide_EN.pdf

LTO Program. (n.d.). *LTO-9: LTO generation 9 technology*. Ultrium LTO. https://www.lto.org/lto-9/

Massachusetts Institute of Technology. (n.d.). *L14: The memory hierarchy* [6.004 Computation Structures course notes]. https://computationstructures.org/lectures/caches/caches.html

Microsoft Corporation. (2026, July 30). *Azure network round-trip latency statistics*. Microsoft Learn. https://learn.microsoft.com/en-us/azure/networking/azure-network-latency

Moore, F. (2020). *Tape performance accelerates: Access time and throughput* [White paper]. Horison Information Strategies. https://asset.fujifilm.com/master/americas/files/2020-08/9f5b0bdaa10596d3577f8748f18d6463/Horison_Tape-Performance_2020.pdf

Nayda, L. (n.d.). *Computer organization and architecture, chapter 4: Cache memory* [Course slides presenting W. Stallings's Computer Organization and Architecture, 8th ed.]. University of Puerto Rico, Mayagüez. https://ece.uprm.edu/~nayda/Courses/Icom4215F2011/Cache.pdf

NDDU. (n.d.-a). *Storage management in operating systems* [PowerPoint slides]. Notre Dame of Dadiangas University. (Referenced throughout as Lesson 1)

NDDU. (n.d.-b). *Device management* [PowerPoint slides]. Notre Dame of Dadiangas University. (Referenced throughout as Lesson 2)

NVM Express, Inc. (n.d.). *NVMe overview*. https://nvmexpress.org/wp-content/uploads/NVMe_Overview.pdf

Samsung Electronics Co. (2023). *Samsung V-NAND SSD 990 PRO datasheet* (Rev. 2.0). https://download.semiconductor.samsung.com/resources/data-sheet/samsung_nvme_ssd_990_pro_datasheet_rev.2.0.pdf

ScienceDirect Topics. (n.d.). *Memory access latency*. Elsevier. https://www.sciencedirect.com/topics/computer-science/memory-access-latency

Seagate Technology. (2015). *Enterprise Performance 15K HDD data sheet* (DS1797.5c-1504US). https://www.seagate.com/www-content/product-content/enterprise-performance-savvio-fam/enterprise-performance-15k-hdd/ent-perf-15k-5/en-us/docs/enterprise-performance-15k-hdd-ds1797-5c-1504us.pdf

Seagate Technology. (2019). *Exos X16 data sheet* (DS2011.1-1904US). https://www.seagate.com/files/www-content/datasheets/pdfs/exos-x16-DS2011-1-1904US-en_US.pdf

Simon Fraser University. (n.d.). *Overview of physical storage media* [CMPT 354 course notes]. https://www2.cs.sfu.ca/CourseCentral/354/zaiane/material/notes/Chapter10/node2.html

Stanford University. (n.d.). *Lecture 16: I/O devices* [EE108B course notes]. https://web.stanford.edu/class/archive/ee/ee108b/ee108b.1082/handouts/lect.16.IO_Devices.pdf

University of Washington. (2023). *Persistent storage* [CSE 451 course notes]. https://courses.cs.washington.edu/courses/cse451/23au/lectures/notes/storage.html

Weiss, S. (n.d.). *Chapter 11: Mass-storage systems* [Course slides based on Silberschatz, Galvin, and Gagne's Operating System Concepts, 10th ed.]. CUNY Hunter College. https://www.cs.hunter.cuny.edu/~sweiss/course_materials/csci340/slides/chapter11.pdf
