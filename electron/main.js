import pkg from 'electron'
const { app, BrowserWindow } = pkg
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import http from 'node:http'
import os from 'node:os'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const devRoot = resolve(__dirname, '..')

function readRubyVersion() {
  try {
    const raw = readFileSync(resolve(devRoot, '.ruby-version'), 'utf8').trim()
    return raw.replace(/^ruby-/, '')
  } catch (e) {
    return null
  }
}

const EXPECTED_RUBY_VERSION = process.env.FRANK_TYPE_RUBY_VERSION || readRubyVersion()
const RAILS_ENV = process.env.RAILS_ENV || (app.isPackaged ? 'production' : 'development')
const HOST = process.env.HOST || '127.0.0.1'

function projectRootPath() {
  return app.isPackaged ? resolve(process.resourcesPath, 'app') : devRoot
}

function rubyHomePath() {
  if (app.isPackaged) {
    return resolve(process.resourcesPath, 'ruby')
  }
  return process.env.RUBY_HOME || null
}

function rubyExecutable(home) {
  if (!home) return 'ruby'
  const exe = os.platform() === 'win32' ? 'ruby.exe' : 'ruby'
  return resolve(home, 'bin', exe)
}

function rubyBinDir(home) {
  if (!home) return null
  return resolve(home, 'bin')
}

function projectEnv() {
  const home = rubyHomePath()
  const bin = rubyBinDir(home)
  const sep = os.platform() === 'win32' ? ';' : ':'
  const pathPrefix = bin ? `${bin}${sep}` : ''

  return {
    ...process.env,
    PATH: `${pathPrefix}${process.env.PATH}`,
    RAILS_ENV,
    HOST,
    FORCE_SSL: 'false',
    ASSUME_SSL: 'false',
    BUNDLE_GEMFILE: resolve(projectRootPath(), 'Gemfile'),
  }
}

function runRubyProcess(args, extraEnv = {}) {
  const home = rubyHomePath()
  const env = { ...projectEnv(), ...extraEnv }
  if (home) {
    return spawn(rubyExecutable(home), args, {
      cwd: projectRootPath(),
      stdio: 'inherit',
      env,
    })
  }
  return spawn(args[0], args.slice(1), {
    cwd: projectRootPath(),
    stdio: 'inherit',
    env,
  })
}

function runBundled(cmd, args, extraEnv = {}) {
  return runRubyProcess(['-W0', '-S', cmd, ...args], extraEnv)
}

function runRails(args, extraEnv = {}) {
  const root = projectRootPath()
  return runRubyProcess(['-W0', resolve(root, 'bin/rails'), ...args], extraEnv)
}

function runTask(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = runBundled(cmd, args)
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${cmd} exited with code ${code}`))
    })
    child.on('error', reject)
  })
}

function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.listen(0, HOST, () => {
      const port = server.address().port
      server.close(() => resolve(port))
    })
    server.on('error', reject)
  })
}

function waitForServer(url, timeout = 30000) {
  const start = Date.now()
  return new Promise((resolve, reject) => {
    function check() {
      const req = http.get(url, (res) => {
        res.resume()
        if (res.statusCode === 200) resolve()
        else if (Date.now() - start > timeout) reject(new Error('Server did not start'))
        else setTimeout(check, 500)
      })
      req.on('error', () => {
        if (Date.now() - start > timeout) reject(new Error('Server did not start'))
        else setTimeout(check, 500)
      })
    }
    check()
  })
}

function secretKeyPath() {
  return resolve(app.getPath('userData'), 'secret_key_base')
}

function loadOrCreateSecretKeyBase() {
  const path = secretKeyPath()
  if (existsSync(path)) {
    return readFileSync(path, 'utf8').trim()
  }
  const bytes = new Uint8Array(64)
  for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
  const key = Buffer.from(bytes).toString('base64')
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, key, { mode: 0o600 })
  return key
}

function ensureGems() {
  if (!app.isPackaged) return Promise.resolve()
  if (os.platform() !== 'win32') {
    return Promise.reject(new Error('Packaged Electron is only configured for Windows in this build.'))
  }
  const home = rubyHomePath()
  if (!home) return Promise.reject(new Error('Bundled Ruby not found in extraResources.'))

  if (EXPECTED_RUBY_VERSION) {
    console.log(`Bundled Ruby expected: ${EXPECTED_RUBY_VERSION}`)
  }
  return runTask('bundle', ['install'])
}

let railsProcess = null

async function createWindow() {
  if (app.isPackaged) {
    await ensureGems()
  }

  const port = await findFreePort()
  const url = `http://${HOST}:${port}`

  const env = {
    ...projectEnv(),
    PORT: String(port),
    SECRET_KEY_BASE: loadOrCreateSecretKeyBase(),
  }

  railsProcess = runRails(['server', '-b', HOST, '-p', String(port)], env)

  railsProcess.on('close', (code) => {
    if (code !== 0) {
      console.error(`Rails server exited with code ${code}`)
    }
  })

  await waitForServer(`${url}/up`)

  const win = new BrowserWindow({
    width: 1024,
    height: 768,
    webPreferences: {
      preload: resolve(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  win.loadURL(url)
}

app.whenReady().then(() => {
  createWindow().catch((err) => {
    console.error('Failed to start Frank Type desktop:', err)
    app.quit()
  })
})

app.on('window-all-closed', () => {
  if (railsProcess) {
    railsProcess.kill('SIGTERM')
    railsProcess = null
  }
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow().catch((err) => {
      console.error('Failed to restart Frank Type desktop:', err)
      app.quit()
    })
  }
})

app.on('before-quit', () => {
  if (railsProcess) {
    railsProcess.kill('SIGTERM')
    railsProcess = null
  }
})
