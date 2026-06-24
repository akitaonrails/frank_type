import pkg from 'electron'
const { app, BrowserWindow } = pkg
import { spawn, execSync } from 'node:child_process'
import { createServer } from 'node:net'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import http from 'node:http'
import os from 'node:os'

const __dirname = dirname(fileURLToPath(import.meta.url))
const devRoot = resolve(__dirname, '..')

function rubyPaths() {
  if (app.isPackaged) {
    const platform = os.platform()
    const resources = resolve(process.resourcesPath)

    if (platform === 'win32') {
      const base = resolve(resources, 'ruby')
      return {
        root: base,
        bin: resolve(base, 'bin'),
        ruby: resolve(base, 'bin', 'ruby.exe'),
        gem: resolve(base, 'bin', 'gem.cmd'),
        bundle: resolve(base, 'bin', 'bundler.cmd'),
      }
    } else {
      const base = resolve(resources, 'ruby')
      return {
        root: base,
        bin: resolve(base, 'bin'),
        ruby: resolve(base, 'bin', 'ruby'),
        gem: resolve(base, 'bin', 'gem'),
        bundle: resolve(base, 'bin', 'bundler'),
      }
    }
  }

  const base = resolve(os.homedir(), '.rbenv/versions/3.4.8')
  return {
    root: base,
    bin: resolve(base, 'bin'),
    ruby: resolve(base, 'bin', 'ruby'),
    gem: resolve(base, 'bin', 'gem'),
    bundle: resolve(base, 'bin', 'bundler'),
  }
}

const projectRoot = app.isPackaged ? process.resourcesPath : devRoot
const rp = rubyPaths()

function bundlePath() {
  if (app.isPackaged) {
    return resolve(app.getPath('userData'), 'gems')
  }
  return resolve(projectRoot, 'vendor/bundle')
}

function rubyEnv() {
  const sep = os.platform() === 'win32' ? ';' : ':'
  const rubyVer = '3.4.0'
  const gemRoot = resolve(bundlePath(), 'ruby', rubyVer)
  const gemBin = resolve(gemRoot, 'bin')
  const appRoot = app.isPackaged ? resolve(projectRoot, 'app') : projectRoot
  return {
    ...process.env,
    PATH: `${gemBin}${sep}${rp.bin}${sep}${process.env.PATH}`,
    BUNDLE_GEMFILE: resolve(appRoot, 'Gemfile'),
    BUNDLE_PATH: bundlePath(),
    BUNDLE_DISABLE_SHARED_GEMS: 'true',
    GEM_PATH: gemRoot,
    GEM_HOME: gemRoot,
  }
}

function railsRoot() {
  if (app.isPackaged) {
    return resolve(projectRoot, 'app')
  }
  return projectRoot
}

function runBundled(cmd, args, extraEnv = {}) {
  return spawn(rp.ruby, ['-W0', '-S', cmd, ...args], {
    cwd: projectRoot,
    stdio: 'inherit',
    env: { ...rubyEnv(), ...extraEnv },
  })
}

function runRails(args, extraEnv = {}) {
  const root = railsRoot()
  return spawn(rp.ruby, ['-W0', resolve(root, 'bin/rails'), ...args], {
    cwd: root,
    stdio: 'inherit',
    env: { ...rubyEnv(), ...extraEnv },
  })
}

function runTask(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = runBundled(cmd, args, { RAILS_ENV: process.env.RAILS_ENV || 'development' })
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${cmd} exited with code ${code}`))
    })
    child.on('error', reject)
  })
}

function runRailsTask(args, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const child = runRails(args, { RAILS_ENV: process.env.RAILS_ENV || 'development', ...extraEnv })
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`rails exited with code ${code}`))
    })
    child.on('error', reject)
  })
}

function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.listen(0, '127.0.0.1', () => {
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
      http.get(url, (res) => {
        if (res.statusCode === 200) resolve()
        else if (Date.now() - start > timeout) reject(new Error('Server did not start'))
        else setTimeout(check, 500)
      }).on('error', () => {
        if (Date.now() - start > timeout) reject(new Error('Server did not start'))
        else setTimeout(check, 500)
      })
    }
    check()
  })
}

let railsProcess = null

async function ensureGems() {
  if (!app.isPackaged) return

  if (os.platform() === 'win32') {
    console.log('Setting up Windows Ruby environment...')
    try {
      execSync(`"${rp.gem}" install bundler -v 4.0.10 --no-document`, { stdio: 'inherit' })
    } catch (e) {
      console.warn('Could not update Bundler, proceeding with existing version')
    }
    try {
      execSync(`"${resolve(rp.root, 'bin', 'ridk.cmd')}" install 3`, { stdio: 'inherit' })
    } catch (e) {
      console.warn('MSYS2 installation skipped or failed (native gems may need manual setup)')
    }
  }

  console.log('Installing gems (first run)...')
  await runTask('bundle', ['install'])
  console.log('Gems ready')
}

async function createWindow() {
  await ensureGems()

  const envMode = process.env.RAILS_ENV || 'development'

  if (envMode === 'production') {
    await runRailsTask(['assets:precompile'])
  } else {
    await runRailsTask(['tailwindcss:build'])
  }

  const port = await findFreePort()
  const url = `http://127.0.0.1:${port}`

  railsProcess = runRails(['server', '-b', '127.0.0.1', '-p', String(port)], {
    RAILS_ENV: envMode,
    PORT: String(port),
  })

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

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (railsProcess) {
    railsProcess.kill('SIGTERM')
    railsProcess = null
  }
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

app.on('before-quit', () => {
  if (railsProcess) {
    railsProcess.kill('SIGTERM')
    railsProcess = null
  }
})
