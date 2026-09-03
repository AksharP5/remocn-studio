---
name: motion-design
description: >
  Video-scale defaults for a Remotion frame — type and opacity at video size, a
  produced, composed layout, a palette with presence, choreographed motion and the
  recipe behind every movement-dictionary name. Read BEFORE designing any scene, and
  again when a result reads generic: web-sized text, centered empty layout,
  invisible decoration, static motion.
---

# Motion design

Numbers here are starting values, calibrated for 30fps at 1920×1080 — scale durations
with fps and sizes with resolution.

## 1. Video-scale

| Element | Web habit | Video |
| --- | --- | --- |
| Headlines | 32–48px | 64–120px |
| Body text | 14–16px | 28–42px |
| Labels, metadata | 12px | 18–24px |
| Decorative opacity | 3–8% | 12–25% |
| Borders | 1px | 2–4px |
| Container padding | 16–32px | 60–140px |

- **A font size under 24px carries a written justification** — fine print (a
  registration mark, a monospace readout) is a garnish, never the message.
- **Decorative opacity starts at 12%, confirmed on a Snapshot still** rather than the
  browser: under 10% H.264 eats it — a 6% glow that reads on your monitor is gone.
- **Fills stronger, shadows real, borders bolder** — a web card, a 1px border and a 4px
  shadow at 6% black, vanishes at video distance.

## 2. Layers: a produced frame

A produced frame carries six to ten elements in three roles; three read as a page that
failed to load.

- **Background** — textured, always: a radial glow, oversized ghost type bleeding off
  the frame, a color panel, grain, a grid.
- **Midground** — the message: the headline, the card, the stat, the code block.
- **Foreground accents** — hairline rules, dividers, small labels, data bars, monospace
  metadata.

**Ambient** is the decoration's one shared slow motion — a breath, a drift. Every scene
has 2–5 decoratives riding it, at least two of them nobody asked for. One motion across
several is the point — five each on their own are
noise, a lone one is an under-dressed frame, and a static one reads at 30fps as a
rendering mistake, worse than none.

```tsx
// One drift shared by the ghost type and the glow; `driftEasing` defaults inline
// to [0.37, 0, 0.63, 1] (sine-in-out) in the InteractivitySchema.
<Interactive.Div
  data-design-id={name}
  name={name}
  style={{
    position: 'absolute',
    left: -80,
    bottom: -40,
    fontSize: 420,
    fontWeight: 900,
    opacity: 0.14,
    translate: interpolate(frame, [0, 240], ['0px 0px', '48px 0px'], {
      easing: Easing.bezier(...driftEasing),
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }),
  }}
>
  LAUNCH
</Interactive.Div>
```

## 3. Color: muted is fine, flat is not

Every scene has one color that pulls the eye, visibly: 15–25% opacity for an
atmospheric wash, full saturation for a focal hit.

- **A light canvas stays light, made cinematic its own way.** On dark an accent glow
  pops by itself; on light glows die, so presence is bolder solid borders (2px+),
  strong structural rules and dividers, full-saturation accent hits and a textured
  background (grain, a faint pattern) — a blank slide otherwise.
- **A dark background is a radial gradient, a solid, or a solid plus a localized glow.**
  A full-screen linear gradient bands under H.264.
- **Neutrals are tinted toward the accent hue.** A warm or cool cast on every neutral
  reads as intentional; dead gray reads as undesigned.

## 4. Framing: composed, not centered

- **Two focal points minimum** — one text block in empty space is a slide.
- **Fill the frame** — hero text spans 60–80% of the width.
- **Anchor to edges** — left/top or right/bottom; the empty diagonal holds the
  decoration and the second focal point.
- **Split into zones** — a data panel left and content right; a metadata bar on top
  and full-width content below.
- **Structural elements earn their place twice** — rules, dividers and border panels
  give the eye a path, and they animate well:

```tsx
// `drawEasing` is a prop of the rule's own schema, defaulting inline to
// [0.33, 1, 0.68, 1] (cubic-out). `name` is unique in the frame.
<Interactive.Div
  data-design-id={name}
  name={name}
  style={{
    height: 3,
    width: 640,
    backgroundColor: '#e8602c',
    transformOrigin: 'left center',
    scale: interpolate(frame, [8, 26], ['0 1', '1 1'], {
      easing: Easing.bezier(...drawEasing),
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }),
  }}
/>
```

## 5. Concept before markup

Declare before the first line of JSX:

1. **Real content** — real ingredients on a recipe scene, real readouts on a dashboard;
   placeholder content produces placeholder design.
2. **The palette** — one background, one foreground, one accent — and whether the
   canvas is light or dark: food, wellness and kids lean light; tech, cinema and
   finance lean dark. One accent hue for the whole film, one background across every
   scene, one palette serving every element.
3. **The typefaces** — weight contrast is the typography, headlines at 700–900 over
   body at 300–400, a serif over a sans rather than two sans; a one-weight brand takes
   its emphasis from size and color.

## 6. Motion: subtle reads as static

At 30fps restraint disappears: err toward more movement than feels safe.

### Direction is grammar

- **Entering decelerates** — fast start, soft landing: `Easing.out(...)` or a clamped
  spring. The default.
- **Exiting accelerates** — slow start, thrown off frame: `Easing.in(...)`.
- **Moving between positions** eases both ends: `Easing.inOut(...)`.

### Speed is weight

| Feel | Duration @30fps | Seconds |
| --- | --- | --- |
| Energy, urgency, confidence | 5–9 frames | 0.15–0.3s |
| Professional default | 9–15 frames | 0.3–0.5s |
| Gravity, luxury, contemplation | 15–24 frames | 0.5–0.8s |
| Cinematic, atmospheric | 24–60 frames | 0.8–2.0s |

The slowest motion in a film is about three times slower than the fastest — everything
at 12 frames has no dynamics.

### Every scene: build, breathe, resolve

- **Build (first ~30%)** — elements enter, staggered by importance.
- **Breathe (middle ~40%)** — content holds, the ambient keeping it alive.
- **Resolve (last ~30%)** — a deliberate exit or a decisive hold.

### Choreographed

- **The first mover reads as the most important** — stagger by meaning, not DOM order.
- **Overlap entrances** — element two starts while element one is still landing.
- **Vary or die** — at least 3 different easings and 3 entrance directions per scene
  (from left, from right, from scale, opacity-only).
- **Vary the ambient per scene** — drift here, breathe there, stillness after motion is
  itself a move; the same ambient zoom everywhere is wallpaper.

### The vocabulary

| Intent | Penner name | Array default of the `easing` prop |
| --- | --- | --- |
| Standard entrance | quad-out | `[0.25, 0.46, 0.45, 0.94]` |
| Standard entrance, softer | cubic-out | `[0.33, 1, 0.68, 1]` |
| Punchy title landing | quart-out | `[0.25, 1, 0.5, 1]`, or a stiff spring |
| Dramatic, premium reveal | expo-out | `[0.16, 1, 0.3, 1]` |
| Calm ambient drift, breathe | sine-in-out | `[0.37, 0, 0.63, 1]` over the whole scene |
| Physical element transforms | — | `spring()` with `damping`/`stiffness` props |
| One deliberate playful pop | — | `spring()` with visible overshoot — at most once per film |
| Mechanical motion, typing | linear | `[0, 0, 1, 1]`, or stepped via a frame threshold |

An entrance combines transforms, and **opacity and transform each get their own range**
(video-lessons):

```tsx
// One run of text: one named text primitive, the string its direct child, typography
// as literals, the curve a prop. Whole component: `rules/tunable-text.md`.
<Interactive.H1
  data-design-id={name}
  name={name}
  style={{
    fontSize: 96,
    fontWeight: 800,
    letterSpacing: -1.5,
    lineHeight: 0.95,
    margin: 0,
    opacity: interpolate(frame, [6, 16], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }),
    translate: interpolate(frame, [6, 22], ['-64px 0px', '0px 0px'], {
      easing: Easing.bezier(...entryEasing),
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }),
  }}
>
  {text}
</Interactive.H1>
```

## 7. The movement dictionary

Every movement has a role — the conventions' `entry`, `emphasis`, `exit`, `scene`,
`transition` — and a dictionary name. The settling rule: a behaviour that
**replaces content in place** is emphasis — there before, there after; one that brings
content **out of nothing** is entry, a number counting to its landing value included.
A component from the studio's own set arrives classified in its `[Asset #N]` block. A
`scene` behaviour takes `speed`, `intensity`; a `transition` `direction`,
`durationInFrames`, `easing`.

### Entry — 12–18 frames, decelerating

0.4–0.6s on `Easing.out(...)`; the scene's first starts at frame 3–9, since frame 0
reads as a jump cut.

| Name | What it is | Recipe |
| --- | --- | --- |
| `fade-in` | opacity alone, when the thing must not move | `opacity: interpolate(frame, [6, 16], [0, 1], clamped)` |
| `rise-in` | comes up from below as it fades — panels, cards, media | `translate: interpolate(frame, [6, 22], ['0px 28px', '0px 0px'], easeOutCubic)` |
| `slide-in` | travels in from an edge — **the text entrance** | `translate: interpolate(frame, [6, 22], ['-64px 0px', '0px 0px'], easeOutCubic)` |
| `blur-in` | resolves out of blur as it fades | a `filter: blur(Npx)` template string over `interpolate(frame, [6, 20], [12, 0], clamped)` |
| `scale-in` | lands from just under or over 1 | `scale: spring({frame: frame - 6, fps, config: {damping: 200}, ...})` |
| `mask-reveal` | wiped in behind a window that does not move | a fixed `overflow: hidden` box; the content translates inside it |
| `type-on` | characters appear on a stepped clock | `text.slice(0, Math.floor((frame - 6) / 2))` — glyphs appear in place, untransformed |
| `draw-on` | a stroke draws itself — a rule, an underline, a path | `scale: interpolate(...)` on a `transformOrigin: 'left center'` bar, or `strokeDashoffset` |
| `count-in` | a number rolls to the value it lands on | `Math.round(interpolate(frame, [6, 30], [0, 1240], clamped))`, `tabular-nums` |
| `decode-in` | scrambled characters resolve into the real ones | per-character: settled when `frame > start + index * 2`, random glyph before |

Stagger, at 30fps: **1 frame per character** (0.04s), 2–3 per word, 4–6 per line; the
whole run fits in about 15 frames however many items enter — past that, shrink the
step, keep the count.

**Text travels on X, or holds still** — a Y translate snaps glyph baselines and the line
jitters (`video-lessons` §2): text enters by `slide-in`, `fade-in`, `blur-in`, `type-on`
or `mask-reveal`; `rise-in` is for panels, cards and images.

### Emphasis — earned, once per scene

Two emphasised elements in a frame means neither is. The ambient belongs to the decoration (§2): the emphasised element holds still
between its moves — UI neither breathes nor pulses (`video-lessons` §1).

| Name | What it is | Recipe |
| --- | --- | --- |
| `highlight` | a ground or a color change on the phrase itself | a marker block scaling from `transformOrigin: 'left'`, text color crossing |
| `mark` | a hand-drawn annotation around it — circle, arrow, rule | a stroke drawn on its own curve, landing after the phrase has settled |
| `shimmer` | light sweeps across the surface once | a moving `linear-gradient` under `background-clip: text` |
| `glitch` | a short corruption burst, 4–8 frames, then clean | two offset copies on a frame threshold, held clean between bursts |
| `swap` | the content is replaced in place | old and new share the box; opacity crosses, an X slide carries the change |
| `burst` | particles fired at one moment — confetti, sparks | seeded so every render is identical; fired once, on a frame |

### Exit — the entry, mirrored

About two thirds of the entry's frames — what arrives in 12 leaves in 7; `fade-out`,
`blur-out`, `slide-out` and `scale-out` mirror their entries one for one.

## 8. Every image moves

A raw rectangle is a placeholder; every image gets one treatment:

- **Slow push (Ken Burns)** — scale 1 → 1.04 over the beat.
- **Perspective tilt** — a slight `rotate` with `perspective` on the parent, plus a real
  shadow.
- **Device or panel frame** — a rounded, shadowed shell.
- **Clipped scroll reveal** — a fixed window the image travels through: the mask stays
  still, the content moves.

## 9. Transitions carry meaning

A **crossfade** says "this continues"; a **hard cut** says "wake up" — disruption, a
register shift; a **slow dissolve** says "drift with me". Hard cuts are spent on the
moments that turn; a film that crossfades everything is unchoreographed.

## 10. The brand spec is brand, not layout

**Strict:** hex values (background included), font families, weight relationships, the
do's and don'ts. **Adapted for video:** type sizes, spacing, decorative opacity, border
weights, component treatments — brand colors at web-UI intensity are invisible here;
the color is sacred, the application is yours.

## 11. The AI tells

Default, then tell — a tell is a deliberate, argued choice for this specific content,
or absent:

- Solid-color type — gradient text (`background-clip: text`).
- A callout framed by its ground or a rule — the left-edge accent stripe.
- Content-specific color — cyan-on-dark, purple-to-blue gradients, neon accents.
- Tinted neutrals — pure `#000` or `#fff`.
- Cards of differing size and weight — a grid of identical cards.
- An eye led somewhere — everything centered at equal weight.
- An ease, an entrance and a stagger that change per element and per scene — the same
  ones everywhere.
- Decoration that moves — static decoration, or none.
- An audio-driven scene drawn in the brand's own vocabulary, audio supplying timing and
  intensity — equalizer bars, spectrum analyzers, waveforms, strobing.

## 12. The rules corpus

`rules/` is the source of truth: one file per decision, every number with its source
and an `[unverified]` marker until a Snapshot has confirmed it at video scale. Read the
file whose question you are answering — with the Read tool, before the code:

| File | The question it answers |
| --- | --- |
| `rules/timing.md` | How many frames does this entry, exit, move or hold get? |
| `rules/easing.md` | What curve — exact beziers, spring configs, linear exceptions. |
| `rules/tunable-text.md` | What shape a run of text takes so the pane can name and edit it. |
| `rules/staging.md` | What enters when, from where, in what order, staggered how? |
| `rules/alive.md` | What happens after the entrance settles — holds, drift, counts. |
| `rules/continuity.md` | How one scene becomes the next; the whole video's rhythm. |
| `rules/camera.md` | When may the whole frame move, and how. |
| `rules/anti-patterns.md` | The consolidated cliché blocklist — scan after drafting. |
| `rules/product-launch.md` | Measured scene rhythm, cut mix, beat alignment and holds for product launches. |

On a number, `rules/` outranks this file; `remocn-studio:video-lessons` outranks both.
