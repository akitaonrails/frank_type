import { createWriteStream, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import https from 'node:https'
import { spawnSync, execSync } from 'node:child_process'
import os from 'node:os'
import { pipeline } from 'node:stream/promises'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const RUBY = resolve(os.homedir(), '.rbenv/versions/3.4.8/bin/ruby')

const RELEASE = 'RubyInstaller-3.4.8-1'
const ARCHIVE = `rubyinstaller-3.4.8-1-x64.7z`
const URL = `https://github.com/oneclick/rubyinstaller2/releases/download/${RELEASE}/${ARCHIVE}`

function getTarget() {
  return process.env.BUILD_TARGET || os.platform()
}

async function download(url, dest) {
  console.log(`Downloading ${url}...`)
  const resp = await new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        https.get(res.headers.location, resolve).on('error', reject)
      } else {
        resolve(res)
      }
    }).on('error', reject)
  })
  const total = parseInt(resp.headers['content-length'], 10)
  let received = 0
  resp.on('data', chunk => {
    received += chunk.length
    if (total) {
      const pct = (received / total * 100).toFixed(1)
      process.stdout.write(`\r  ${pct}% (${(received / 1024 / 1024).toFixed(1)}MB)`)
    }
  })
  await pipeline(resp, createWriteStream(dest))
  console.log('\nDone')
}

async function main() {
  const target = getTarget()

  if (target !== 'win32') {
    console.log(`Skipping Ruby download for target: ${target}`)
    return
  }

  const rubyDir = resolve(root, 'ruby')
  mkdirSync(rubyDir, { recursive: true })
  const archive = resolve(root, 'ruby', ARCHIVE)

  if (!existsSync(archive)) {
    await download(URL, archive)
  } else {
    console.log(`Using cached ${ARCHIVE}`)
  }

  if (readdirSync(rubyDir).some(f => f !== ARCHIVE)) {
    console.log('Ruby already extracted, skipping')
    return
  }

  console.log('Extracting Ruby for Windows...')
  const result = spawnSync('7z', ['x', archive, `-o${rubyDir}`, '-y', '-aoa'], {
    stdio: 'inherit',
  })
  if (result.status !== 0) {
    throw new Error('Extraction failed. Install p7zip-full: sudo apt install p7zip-full')
  }

  const extracted = readdirSync(rubyDir).filter(f => f !== ARCHIVE)
  if (extracted.length === 1) {
    const nested = resolve(rubyDir, extracted[0])
    for (const f of readdirSync(nested)) {
      spawnSync('mv', [resolve(nested, f), resolve(rubyDir, f)], { stdio: 'inherit' })
    }
  }
  console.log('Extracted')

  if (os.platform() === 'win32') {
    console.log('Upgrading Bundler to 4.0.10...')
    const rubyExe = resolve(rubyDir, 'bin', 'ruby.exe')
    try {
      execSync(`"${rubyExe}" -W0 -S gem install bundler -v 4.0.10 --no-document`, {
        stdio: 'inherit',
      })
      console.log('Bundler upgraded')
    } catch (e) {
      console.warn('Bundler upgrade failed, will retry on first launch')
    }
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
