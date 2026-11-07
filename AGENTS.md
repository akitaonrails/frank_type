# AGENTS.md

## Project summary

Frank Type is a Rails 8/Hotwire/Tailwind typing trainer for public-domain prose. It is local-first and account-free: session history, timing data, profile charts, adaptive excerpt choices, and theme preference live in browser storage.

## Architecture rules

- Keep the app server-side rendered with Hotwire/Stimulus and importmap.
- Do not add authentication or server-side user/session persistence.
- Do not reintroduce unused Rails subsystems. The app intentionally omits Active Record, Active Job, Action Mailer, Action Cable, Active Storage, Action Text, Action Mailbox, Solid Cache, Solid Queue, Solid Cable, Kamal, sqlite, and Jbuilder.
- `Rails.cache` is only used to cache loaded excerpt YAML per process; production uses `:memory_store` on purpose.
- Keep JavaScript organized under `app/javascript/lib/**` and Stimulus controllers. Avoid dumping large logic into one controller or `application.js`.
- Keep styling themeable through CSS variables in `app/assets/tailwind/application.css`. Do not hard-code major UI colors in views or JS unless they are not theme-relevant.

## Typing experience invariants

- `Tab` loads a random compatible excerpt.
- `Esc` restarts the current run or closes help when help is open.
- `?` opens shortcut help.
- Heat map feedback appears only after the timer finishes, never live while typing.
- Heat map should stay sparse and actionable: highlight only the highest-gain slow digraph samples, with hard caps so the paragraph is not painted.
- Digraph timing is press-to-press latency. Filter mistakes, backspaces/corrections, very fast noise, and long pauses.
- Race strip is time-based. The fastest racer reaches the flag when the timer reaches zero.
- The simulated fast racer and adaptive `fast` excerpt band are 140+ WPM. `medium` is roughly 75–139 WPM.

## Corpus, localization, and themes

- Corpus files live under `config/excerpts/<locale>/<category>/<speed>.yml`.
- Current locales are English (`en`) and Brazilian Portuguese (`pt-BR`).
- Current categories are `scifi`, `fantasy`, and `biography`.
- Keep excerpts public-domain and cite source metadata.
- pt-BR excerpts may modernize obsolete spellings for contemporary typing practice.
- Text normalization is per-language and always NFC. The default/en path transliterates to ASCII (`[a-z0-9 ]`); pt-BR preserves the accents `àáâãçéêíóôõúü` with no transliteration. Typed input is normalized to NFC and lowercased before strict, per code point comparison. Do not reintroduce transliteration for pt-BR, switch to NFD, or fold accents during matching.
- Normal requests should load/cache only the requested locale. Explicit all-corpus/test paths may load every locale.
- Locale selection order: `params[:locale]`, cookie, browser `Accept-Language`, English fallback.
- Themes are CSS-variable sets selected via `data-theme` on `<html>` and persisted under `frankType.theme`.
- `current`/Slate preserves the original dark teal-purple palette. `logo-rush` is derived from the logo's deep teal, cyan, lime/yellow, and orange colors with WCAG-conscious contrast.
- Local typing history is bounded in `SessionStore`: keep recent sessions detailed, then compact older records into weighted daily summaries so profile charts remain useful without storing raw key/timing payloads forever.

## Docker and production

- Docker is the primary run/deploy path. Published image target: `akitaonrails/frank_type`.
- When asked to deploy this project from the local checkout, treat it as verifying the Docker image builds successfully and is pushed to Docker Hub; there is no app-server deploy script in this repo.
- Production requires `HOST` unless building with `SECRET_KEY_BASE_DUMMY`.
- Production defaults to SSL/secure cookies; `/up` must remain usable for health checks.
- Docker Hub publishing uses GitHub secrets `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN`.

## Cleanup after release and Docker verification

Every release, deploy verification, or Docker smoke test leaves leftovers on this shared host. Clean them up before reporting the work done. Be surgical: other projects' images, containers, builders, and caches live on the same Docker daemon, so never run blanket prunes (`docker system prune`, unfiltered `docker image prune`, or `docker builder prune -a`).

- Run smoke-test containers with `--rm` plus an EXIT trap so they self-remove; still check `docker ps -a --filter ancestor=akitaonrails/frank_type` for strays and `docker rm` them.
- After verification, remove the images that verification pulled or built: digest-pulled smoke images land as dangling (filter `dangling=true` with repository `akitaonrails/frank_type`) plus stale local `akitaonrails/frank_type`/`frank_type` tags. Docker Hub is the source of truth; anything needed later re-pulls.
- Prune only this repo's buildx cache: `docker buildx prune --builder frank-type-builder --force`. Leave other builders and their caches untouched.
- Delete `/tmp` scratch dirs and logs the session created, touching only files attributable to this session.
- Report what was removed and roughly how much space was reclaimed.

## Important files

- `app/javascript/controllers/typing_controller.js`: main UI controller, shortcuts, heat-map rendering, race strip.
- `app/javascript/controllers/theme_controller.js`: theme selection and localStorage persistence.
- `app/javascript/lib/typing/session_state.js`: timing/session state and finish behavior.
- `app/javascript/lib/typing/metrics.js`: WPM/accuracy, word timings, digraph ranking, heat normalization.
- `app/javascript/lib/typing/race_progress.js`: time-based race math.
- `app/javascript/lib/typing/speed_band.js`: adaptive speed-band and excerpt selection.
- `app/javascript/lib/storage/session_store.js`: resilient localStorage persistence.
- `app/controllers/application_controller.rb`: locale detection and locale switch path.
- `app/services/typing/excerpt_catalog.rb`: locale-aware YAML loading/caching and JSON export.
- `config/initializers/content_security_policy.rb`: CSP with script nonces for Rails importmap inline scripts.
- `app/assets/tailwind/application.css`: Tailwind entrypoint and theme tokens.
- `Dockerfile`, `docker-compose.yml`, `docker-compose.prod.yml`, `bin/docker-publish`: Docker build/run/publish path.
- User-captured screenshots for README updates are usually in `~/Pictures/Screenshots`; use the most recent relevant files and copy them into `docs/screenshots/`.

## Verification

Run relevant checks before handing back code:

```bash
npm test
env COVERAGE=true bin/rails test
bin/rails tailwindcss:build
bin/rubocop -f github
bin/brakeman --quiet --no-pager --exit-on-warn --exit-on-error
bin/importmap audit
bin/bundler-audit
git diff --check
```

For Docker or production changes, also verify assets/boot when practical:

```bash
SECRET_KEY_BASE_DUMMY=1 bin/rails assets:precompile
```
