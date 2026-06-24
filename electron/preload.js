const { contextBridge } = require('electron')

contextBridge.exposeInMainWorld('frankTypeElectron', {
  platform: process.platform,
})
