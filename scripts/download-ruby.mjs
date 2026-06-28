import { createReadStream, createWriteStream, existsSync, mkdirSync, readdirSync, statSync, renameSync, rmSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import https from 'node:https'
import { spawnSync } from 'node:child_process'
import { pipeline } from 'node:stream/promises'
import { createHash } from 'node:crypto'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const RELEASE = 'RubyInstaller-3.4.8-1'
const ARCHIVE = `rubyinstaller-3.4.8-1-x64.7z`
const URL = `https://github.com/oneclick/rubyinstaller2/releases/download/${RELEASE}/${ARCHIVE}`

const EXPECTED_SHA256 = process.env.FRANK_TYPE_RUBY_SHA256
  || 'd1c3ba83ae748c08e35e0b1d9939d45dbca7925e0a8bf84a42860bf19847e0d6'

function getTarget() {
  return process.env.BUILD_TARGET || process.platform
}

function followRedirects(url, depth = 0) {
  if (depth > 5) return Promise.reject(new Error('Too many redirects'))
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume()
        followRedirects(res.headers.location, depth + 1).then(resolve, reject)
      } else if (res.statusCode !== 200) {
        res.resume()
        reject(new Error(`Unexpected HTTP ${res.statusCode} downloading ${url}`))
      } else {
        resolve(res)
      }
    })
    req.on('error', reject)
  })
}

async function download(url, dest) {
  console.log(`Downloading ${url}...`)
  const resp = await followRedirects(url)
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

function sha256OfFile(path) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(path)
    stream.on('data', chunk => hash.update(chunk))
    stream.on('end', () => resolve(hash.digest('hex')))
    stream.on('error', reject)
  })
}

function moveExtractedContents(srcDir, destDir) {
  for (const entry of readdirSync(srcDir)) {
    renameSync(resolve(srcDir, entry), resolve(destDir, entry))
  }
}

async function main() {
  const target = getTarget()

  if (target !== 'win32') {
    console.log(`Skipping Ruby download for non-Windows target: ${target}`)
    return
  }

  if (EXPECTED_SHA256.startsWith('REPLACE_WITH')) {
    throw new Error('Refusing to proceed without a pinned SHA256. Set FRANK_TYPE_RUBY_SHA256 or update the script.')
  }

  const rubyDir = resolve(root, 'ruby')
  mkdirSync(rubyDir, { recursive: true })
  const archive = resolve(rubyDir, ARCHIVE)

  if (existsSync(archive)) {
    console.log(`Verifying cached ${ARCHIVE}...`)
    const actual = await sha256OfFile(archive)
    if (actual !== EXPECTED_SHA256) {
      throw new Error(`SHA256 mismatch for ${ARCHIVE}: expected ${EXPECTED_SHA256}, got ${actual}`)
    }
    console.log('SHA256 OK')
  } else {
    await download(URL, archive)
    const actual = await sha256OfFile(archive)
    if (actual !== EXPECTED_SHA256) {
      rmSync(archive)
      throw new Error(`SHA256 mismatch after download: expected ${EXPECTED_SHA256}, got ${actual}`)
    }
    console.log('SHA256 OK')
  }

  const present = readdirSync(rubyDir).filter(f => f !== ARCHIVE)
  if (present.length > 0) {
    const bin = resolve(rubyDir, 'bin')
    if (existsSync(bin) && statSync(bin).isDirectory()) {
      console.log('Ruby already extracted, skipping')
      return
    }
  }

  console.log('Extracting Ruby for Windows...')
  const result = spawnSync('7z', ['x', archive, `-o${rubyDir}`, '-y', '-aoa'], { stdio: 'inherit' })
  if (result.status !== 0) {
    throw new Error('Extraction failed. Install p7zip-full (`sudo apt install p7zip-full` on Debian/Ubuntu) or 7-Zip on Windows.')
  }

  const topLevel = readdirSync(rubyDir).filter(f => f !== ARCHIVE)
  if (topLevel.length === 1 && statSync(resolve(rubyDir, topLevel[0])).isDirectory()) {
    moveExtractedContents(resolve(rubyDir, topLevel[0]), rubyDir)
  }
  console.log('Extracted')
}

main().catch(err => {
  console.error(err.message || err)
  process.exit(1)
})
