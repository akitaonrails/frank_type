const { contextBridge } = require('electron')

contextBridge.exposeInMainWorld('frankTypeElectron', {
  platform: process.platform,
  isPackaged: process.env.NODE_ENV !== 'development',
})
