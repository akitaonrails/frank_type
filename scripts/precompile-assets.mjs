import { spawn, spawnSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

function findRuby() {
  if (process.env.RUBY_HOME) {
    const exe = process.platform === 'win32' ? 'ruby.exe' : 'ruby'
    return resolve(process.env.RUBY_HOME, 'bin', exe)
  }
  const probe = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['ruby'], { encoding: 'utf8' })
  if (probe.status === 0) {
    return probe.stdout.trim().split(/\r?\n/)[0]
  }
  return null
}

function main() {
  const ruby = findRuby()
  if (!ruby) {
    throw new Error('Could not locate a system Ruby. Install Ruby 3.4 (see .ruby-version) and ensure `ruby` is on PATH, or set RUBY_HOME.')
  }

  const env = {
    ...process.env,
    RAILS_ENV: 'production',
    SECRET_KEY_BASE_DUMMY: '1',
  }

  console.log(`Precompiling assets with ${ruby}...`)
  const result = spawnSync(ruby, ['-W0', resolve(root, 'bin/rails'), 'assets:precompile'], {
    cwd: root,
    stdio: 'inherit',
    env,
  })
  if (result.status !== 0) {
    throw new Error(`assets:precompile failed with exit code ${result.status}`)
  }

  const builds = resolve(root, 'app/assets/builds')
  if (!existsSync(builds) || readdirSync(builds).filter(f => f !== '.keep').length === 0) {
    throw new Error(`Expected precompiled assets under ${builds} but found nothing.`)
  }

  console.log('Assets precompiled')
}

try {
  main()
} catch (err) {
  console.error(err.message || err)
  process.exit(1)
}
