# Product-launch rhythm measurements

Corpus: **15 measured videos**, **6 manually annotated videos**.

## Scene rhythm

Measured 449 scenes. Median duration: 1.3333s (p25 0.7508s, p75 2.1688s). Scenes shorter than 1s: 0.3563.

## Motion and transitions

Mean motion shares: `{'static': 0.4127, 'camera': 0.0017, 'elements': 0.0774, 'mixed': 0.5081}`.
Transition shares: `{'cut': 0.6751, 'fade': 0.0461, 'motion-transition': 0.2604, 'unknown': 0.0184}`.
Mean beat-hit rates by 30fps-equivalent window: `{'2': 0.3109, '3': 0.4042, '4': 0.5589}`.

## Candidate rules

- `product-launch-scene-duration` — **candidate** — `{'count': 449, 'median': 1.3333, 'p25': 0.7508, 'p75': 2.1688, 'minimum': 0.1, 'maximum': 35.4354}`; evidence: apple-may-2024-intro, apple-september-2023-intro, apple-wwdc-2025-intro, linear-agent, linear-product-intelligence, linear-releases, raycast-2026, raycast-pro, raycast-windows, stripe-reader-s700, stripe-reader, stripe-sessions-2024, vercel-product-tour, vercel-ship, vercel-v0.
- `product-launch-short-accent-share` — **candidate** — `0.3563`; evidence: apple-may-2024-intro, apple-september-2023-intro, apple-wwdc-2025-intro, linear-agent, linear-product-intelligence, linear-releases, raycast-2026, raycast-pro, raycast-windows, stripe-reader-s700, stripe-reader, stripe-sessions-2024, vercel-product-tour, vercel-ship, vercel-v0.
- `product-launch-continuous-motion-share` — **candidate** — `0.5873`; evidence: apple-may-2024-intro, apple-september-2023-intro, apple-wwdc-2025-intro, linear-agent, linear-product-intelligence, linear-releases, raycast-2026, raycast-pro, raycast-windows, stripe-reader-s700, stripe-reader, stripe-sessions-2024, vercel-product-tour, vercel-ship, vercel-v0.
- `product-launch-static-run` — **candidate** — `{'count': 559, 'median': 0.25, 'p25': 0.0833, 'p75': 0.75, 'minimum': 0.0833, 'maximum': 12.6667}`; evidence: apple-may-2024-intro, apple-september-2023-intro, apple-wwdc-2025-intro, linear-agent, linear-product-intelligence, linear-releases, raycast-2026, raycast-pro, raycast-windows, stripe-reader-s700, stripe-reader, stripe-sessions-2024, vercel-product-tour, vercel-ship, vercel-v0.

## Cut-threshold sensitivity

Boundary counts at 0.8×, 1.0×, and 1.2× the configured cut score:

```json
{
  "apple-may-2024-intro": {
    "0.0640": 27,
    "0.0800": 25,
    "0.0960": 23
  },
  "apple-september-2023-intro": {
    "0.0640": 65,
    "0.0800": 61,
    "0.0960": 55
  },
  "apple-wwdc-2025-intro": {
    "0.0640": 105,
    "0.0800": 93,
    "0.0960": 89
  },
  "linear-agent": {
    "0.0640": 5,
    "0.0800": 5,
    "0.0960": 5
  },
  "linear-product-intelligence": {
    "0.0640": 0,
    "0.0800": 0,
    "0.0960": 0
  },
  "linear-releases": {
    "0.0640": 4,
    "0.0800": 4,
    "0.0960": 4
  },
  "raycast-2026": {
    "0.0640": 14,
    "0.0800": 12,
    "0.0960": 10
  },
  "raycast-pro": {
    "0.0640": 20,
    "0.0800": 19,
    "0.0960": 19
  },
  "raycast-windows": {
    "0.0640": 30,
    "0.0800": 30,
    "0.0960": 28
  },
  "stripe-reader": {
    "0.0640": 35,
    "0.0800": 32,
    "0.0960": 28
  },
  "stripe-reader-s700": {
    "0.0640": 55,
    "0.0800": 51,
    "0.0960": 49
  },
  "stripe-sessions-2024": {
    "0.0640": 97,
    "0.0800": 92,
    "0.0960": 88
  },
  "vercel-product-tour": {
    "0.0640": 7,
    "0.0800": 7,
    "0.0960": 7
  },
  "vercel-ship": {
    "0.0640": 1,
    "0.0800": 1,
    "0.0960": 0
  },
  "vercel-v0": {
    "0.0640": 2,
    "0.0800": 2,
    "0.0960": 2
  }
}
```

Rules remain candidates until the minimum video sample and confidence gates pass.
