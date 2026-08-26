# Product-launch reference corpus

This directory keeps the reproducible evidence for REM-299. Raw source videos
are local-only and ignored by Git. Everything committed here is metadata,
measurement output, manual annotation, or an aggregate derived from those
local sources.

## Layout

- `manifest.json` — selected public source pages and optional clip boundaries.
- `schemas/` — JSON Schemas for committed artifacts.
- `metadata/` — normalized downloader metadata, one file per source.
- `measurements/` — analyzer output, one file per source.
- `annotations/` — manual choreography annotations for the reviewed subset.
- `profiles/` — machine-readable aggregate rhythm profiles.
- `reports/` — provenance-rich human reports.
- `videos/` — ignored local media.

## Setup

```sh
python3.13 -m venv .venv-rule-mining
.venv-rule-mining/bin/python -m pip install -r scripts/rule-mining/requirements.txt
```

Check the corpus without downloading:

```sh
.venv-rule-mining/bin/python scripts/rule-mining/fetch.py --dry-run
```

Fetch one source and analyse it:

```sh
.venv-rule-mining/bin/python scripts/rule-mining/fetch.py --id linear-releases
.venv-rule-mining/bin/python scripts/rule-mining/analyze.py --id linear-releases
```

The fetcher only accepts public HTTP(S) pages and never supplies browser
cookies, credentials, or access-control workarounds.
