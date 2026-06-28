import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import yaml from 'js-yaml'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const electronDir = resolve(root, 'electron')
const config = yaml.load(readFileSync(resolve(root, 'electron-builder.yml'), 'utf8'))

test('electron-builder config is unpacked (no asar)', () => {
  assert.equal(config.asar, false, 'asar must be disabled so Rails can read its tree and spawn subprocesses')
})

test('electron-builder config ships extraResources ruby/', () => {
  const extras = (config.extraResources || []).map(e => e.from)
  assert.ok(extras.includes('ruby'), 'extraResources must include the bundled Ruby runtime')
})

test('electron-builder config files list covers the Rails app', () => {
  const files = config.files || []
  for (const required of ['app/**/*', 'bin/**/*', 'config/**/*', 'Gemfile', 'Gemfile.lock', 'public/**/*', 'vendor/**/*', 'electron/**/*']) {
    assert.ok(files.includes(required), `electron-builder files must include ${required}`)
  }
})

test('electron-builder config excludes dev artifacts', () => {
  const files = config.files || []
  for (const banned of ['log/**/*', 'tmp/**/*', 'test/**/*', 'docs/**/*', '.github/**/*', 'scripts/**/*']) {
    assert.ok(files.includes(`!${banned}`), `electron-builder files must exclude ${banned}`)
  }
})

test('electron-builder config only targets Windows', () => {
  assert.ok(config.win, 'win target must be defined')
  assert.equal(config.mac, undefined, 'mac target must not be defined in this PR')
  assert.equal(config.linux, undefined, 'linux target must not be defined in this PR')
})

test('electron/main.js is syntactically valid', () => {
  const result = spawnSync(process.execPath, ['--check', resolve(electronDir, 'main.js')], { encoding: 'utf8' })
  assert.equal(result.status, 0, `node --check failed: ${result.stderr}`)
})

test('electron/preload.js is syntactically valid', () => {
  const result = spawnSync(process.execPath, ['--check', resolve(electronDir, 'preload.js')], { encoding: 'utf8' })
  assert.equal(result.status, 0, `node --check failed: ${result.stderr}`)
})

test('electron/main.js does not compile assets at runtime', () => {
  const main = readFileSync(resolve(electronDir, 'main.js'), 'utf8')
  assert.ok(!main.includes('assets:precompile'), 'electron/main.js must not invoke assets:precompile at runtime')
  assert.ok(!main.includes('tailwindcss:build'), 'electron/main.js must not invoke tailwindcss:build at runtime')
})

test('electron/main.js sets desktop-safe production env', () => {
  const main = readFileSync(resolve(electronDir, 'main.js'), 'utf8')
  assert.ok(main.includes("FORCE_SSL: 'false'"), 'electron/main.js must force SSL off for the local Electron URL')
  assert.ok(main.includes("ASSUME_SSL: 'false'"), 'electron/main.js must assume SSL off for the local Electron URL')
  assert.ok(main.includes('loadOrCreateSecretKeyBase'), 'electron/main.js must provide a SECRET_KEY_BASE at runtime')
})

test('electron/main.js does not hardcode ~/.rbenv', () => {
  const main = readFileSync(resolve(electronDir, 'main.js'), 'utf8')
  assert.ok(!main.includes('.rbenv'), 'electron/main.js must not reference the dev rbenv path')
})

test('electron/main.js reads .ruby-version for runtime version', () => {
  const main = readFileSync(resolve(electronDir, 'main.js'), 'utf8')
  assert.ok(main.includes("'.ruby-version'"), 'electron/main.js must read the Ruby version from .ruby-version')
})

test('download-ruby script does not shell out to mv', () => {
  const script = readFileSync(resolve(root, 'scripts/download-ruby.mjs'), 'utf8')
  assert.ok(!/\bspawnSync\(['"]mv['"]/.test(script), 'scripts/download-ruby.mjs must not shell out to mv')
  assert.ok(script.includes('renameSync'), 'scripts/download-ruby.mjs must use Node fs.renameSync')
})

test('download-ruby script pins and verifies SHA256', () => {
  const script = readFileSync(resolve(root, 'scripts/download-ruby.mjs'), 'utf8')
  assert.ok(script.includes('EXPECTED_SHA256'), 'scripts/download-ruby.mjs must pin a SHA256')
  assert.ok(script.includes("createHash('sha256')"), 'scripts/download-ruby.mjs must verify the archive with sha256')
  assert.ok(script.includes('REPLACE_WITH_PINNED_SHA256'), 'scripts/download-ruby.mjs must refuse to run with a placeholder SHA256')
})

test('download-ruby script fails on unexpected HTTP status', () => {
  const script = readFileSync(resolve(root, 'scripts/download-ruby.mjs'), 'utf8')
  assert.ok(script.includes('Unexpected HTTP'), 'scripts/download-ruby.mjs must fail on non-200 responses')
})

test('precompile-assets script exists and uses system Ruby', () => {
  const script = readFileSync(resolve(root, 'scripts/precompile-assets.mjs'), 'utf8')
  assert.ok(script.includes('assets:precompile'), 'scripts/precompile-assets.mjs must run bin/rails assets:precompile')
  assert.ok(script.includes('SECRET_KEY_BASE_DUMMY'), 'scripts/precompile-assets.mjs must set SECRET_KEY_BASE_DUMMY for the precompile')
})

test('package.json version is aligned with the 0.2.x release line', () => {
  const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
  assert.match(pkg.version, /^0\.2\./, `package.json version must stay on the 0.2.x line (got ${pkg.version})`)
})

test('package.json does not advertise cross-platform builds', () => {
  const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
  for (const script of ['build:mac', 'build:linux', 'dist:all']) {
    const body = pkg.scripts[script] || ''
    assert.ok(/not yet implemented/i.test(body), `${script} must declare it is not yet implemented in this PR`)
  }
})

test('package-lock.json is present for reproducible installs', () => {
  assert.ok(existsSync(resolve(root, 'package-lock.json')), 'package-lock.json must be committed for `npm ci`')
})

test('precompiled assets exist when invoked through npm run assets:precompile', { skip: !existsSync(resolve(root, 'app/assets/builds')) || readdirSync(resolve(root, 'app/assets/builds')).filter(f => f !== '.keep').length === 0 }, () => {
  const builds = resolve(root, 'app/assets/builds')
  const entries = readdirSync(builds).filter(f => f !== '.keep')
  assert.ok(entries.length > 0, 'precompile output must be present before electron-builder runs')
})

test('post-build artifact smoke check (when dist/ exists)', { skip: !existsSync(resolve(root, 'dist')) }, () => {
  const dist = resolve(root, 'dist')
  const entries = readdirSync(dist)
  assert.ok(entries.length > 0, 'dist/ should contain a packaged Electron build artifact')
  const artifacts = entries.filter(e => /\.(exe|dmg|AppImage|zip|blockmap)$/.test(e) || statSync(resolve(dist, e)).isDirectory())
  assert.ok(artifacts.length > 0, `dist/ should contain at least one installable artifact; saw: ${entries.join(', ')}`)
})
