# Product-launch rule mining implementation plan

## 1. Research workspace and contracts

- Add the ignored raw-video directory and a documented committed directory
  layout for manifest, normalized metadata, measurements, annotations, reports,
  and profiles.
- Define JSON Schemas for the corpus manifest, per-video measurement, manual
  annotation, and aggregate profile.
- Add small valid fixtures and schema-validation tests.

## 2. Fetching

- Implement `fetch.py` with preflight, manifest filtering, optional dry-run,
  public `yt-dlp` acquisition, segment handling, normalized metadata, SHA-256,
  cache hits, and independent failures.
- Test argument construction and state transitions without network access.
- Curate 12–16 official product-launch entries and fetch the selected corpus
  locally.

## 3. Analysis

- Implement media probing, downscaled frame extraction, beat detection, scene
  candidates, transition classification, global camera transform, compensated
  residual flow, static/motion intervals, confidence, and atomic output.
- Add a versioned analysis config and configuration digest.
- Generate synthetic fixtures and test individual metrics plus an end-to-end
  analysis.

## 4. Annotation and aggregation

- Add annotation templates and validation.
- Manually annotate five to seven representative launch videos.
- Aggregate distributions, sensitivity bands, transition shares, beat
  alignment, camera/element shares, and annotation evidence.
- Emit a machine-readable product-launch profile and provenance-rich report.

## 5. Product integration

- Add the evidence-backed product-launch motion rules and link them from the
  motion-design skill.
- Add a launch-teaser archetype that consumes the measured defaults.
- Extend the design-check motion assertion union and browser sampling with
  bounded `keeps_moving`, then cover protocol, tool spec, and finding behaviour.

## 6. Verification and handoff

- Run Python tests, focused and full Vitest, typecheck, sidecar build, skill
  sync checks, and repository checks.
- Prepare a randomized old-versus-new launch comparison and record the human
  decision in the report.
- Add a changeset, summarize reproducibility steps, and attach the final result
  to REM-299.
