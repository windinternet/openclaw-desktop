/// <reference types="vite/client" />

interface Window {
  electronAPI: {
    platform: string
    versions: {
      node: string
      electron: string
    }
  }
}
