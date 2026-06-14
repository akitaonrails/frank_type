# Frank Type

A small Rails 8 + Hotwire + Stimulus typing trainer inspired by monkeytype, but using normalized public-domain prose instead of random word bags.

## What is in the first version

- Rails-rendered pages with Tailwind CSS, Turbo, and Stimulus.
- A responsive typing room with 15s, 30s, and 60s sessions.
- Random excerpt selection on page load and when pressing `Tab`.
- Speed-banded excerpts: `slow` for sub-60 WPM, `medium` for roughly 90 WPM, and `fast` for 120+ WPM.
- Adaptive selection from the user's recent local WPM history.
- Multi-language-ready corpus layout under `config/excerpts/<language>/<category>/<speed>.yml`.
- Accurate browser-side key timing using `performance.now()`.
- Per-session metrics: WPM, raw WPM, accuracy, mistakes, character timings, word timings, and full key event history.
- No authentication. Completed session data is stored in local storage.
- A local profile page with WPM and accuracy trend charts.
- Public-domain excerpt attribution and a future-friendly normalization service.

## Development

```bash
bin/setup
bin/dev
```

Open <http://localhost:3000>.

## Tests

```bash
bin/rails test
npm test
bin/rails tailwindcss:build
```

`bin/ci` runs Rails tests, JavaScript unit tests, RuboCop, Brakeman, bundler-audit, and importmap audit.

## Public-domain corpus strategy

Use Project Gutenberg as the canonical source, but do not scrape its human-facing pages. Ingestion should use official feeds, robot harvest URLs, rsync mirrors, or Gutendex metadata. Store title, author, ebook id, source URL, copyright flag, and attribution with every excerpt.

Current seed excerpts are longer Asimov-first public-domain Project Gutenberg passages, plus AI/automation-adjacent classics such as _R.U.R._, _Metropolis_, and _The Machine Stops_. They are normalized into lowercase alphanumeric word streams.

The English seed corpus is organized as `scifi`, `fantasy`, and `biography`, each with `slow`, `medium`, and `fast` bands. The target is at least 10 vetted excerpts per category/speed band; the initial checked-in seed keeps each band populated while preserving source attribution.

Note: famous Asimov works such as _Foundation_ and _I, Robot_ are not public-domain Project Gutenberg texts, so the seed corpus uses the Asimov stories that are available there.

## Docker

Local production-style container:

```bash
docker compose up --build
```

Then open <http://localhost:3200>.

Build and push the Docker Hub image when ready:

```bash
docker build -t akitaonrails/frank_type:latest .
docker push akitaonrails/frank_type:latest
```

If Docker Hub credentials are needed, source your local secret file in the shell that performs `docker login`; do not commit secrets.

## Homeserver deploy

This follows the `frank_mega` compose pattern:

1. Build/push `akitaonrails/frank_type:latest`.
2. Copy `docker-compose.prod.yml` and a real `.env.production` to the homeserver.
3. Create `/var/opt/docker/frank_type/storage` on the host.
4. Run:

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

The container exposes Rails through Thruster on host port `3200`.
