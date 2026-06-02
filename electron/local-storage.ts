import { app, ipcMain } from 'electron'
import path from 'node:path'
import { rm } from 'node:fs/promises'
import type { AppSettings } from '../src/lib/settings-types'
import type { InstanceConfig, GatewayUser } from '../src/lib/types'
import { readJsonFile, updateJsonFile, writeJsonFile } from './json-file-store'

const SCHEMA_VERSION = 1
const INSTANCE_DATA_KEYS = new Set([
  'kanban',
  'office-profile',
  'office-layout-instructions',
  'agent-team-profile',
  'ai-action-runs',
])

interface StoredAppState {
  schemaVersion: number
  currentInstanceId: string | null
  settings: AppSettings | null
}

interface StoredInstanceIndex {
  schemaVersion: number
  instances: StoredInstanceRecord[]
}

type StoredInstanceRecord = Omit<
  InstanceConfig,
  'token' | 'gatewayUser' | 'assistantName' | 'avatarUrl'
>

interface StoredInstanceMetadata {
  assistantName?: string
  avatarUrl?: string
  gatewayUser?: GatewayUser
}

interface StoredInstanceCredential {
  token: string
}

export interface LocalAppStateSnapshot {
  settings: AppSettings | null
  instances: InstanceConfig[]
  currentInstanceId: string | null
}

function storageRoot(): string {
  return path.join(app.getPath('userData'), 'storage')
}

function appStatePath(): string {
  return path.join(storageRoot(), 'app.json')
}

function instancesIndexPath(): string {
  return path.join(storageRoot(), 'instances.json')
}

function instanceDir(instanceId: string): string {
  assertSafeInstanceId(instanceId)
  return path.join(storageRoot(), 'instances', instanceId)
}

function metadataPath(instanceId: string): string {
  return path.join(instanceDir(instanceId), 'metadata.json')
}

function credentialPath(instanceId: string): string {
  return path.join(instanceDir(instanceId), 'credential.json')
}

function instanceDataPath(instanceId: string, key: string): string {
  assertSafeInstanceDataKey(key)
  return path.join(instanceDir(instanceId), `${key}.json`)
}

function assertSafeInstanceId(instanceId: string): void {
  if (!/^[a-zA-Z0-9_-]+$/.test(instanceId)) {
    throw new Error('Invalid instance id')
  }
}

function assertSafeInstanceDataKey(key: string): void {
  if (!INSTANCE_DATA_KEYS.has(key)) {
    throw new Error('Unsupported instance data key')
  }
}

function toIndexRecord(instance: InstanceConfig): StoredInstanceRecord {
  const {
    token: _token,
    gatewayUser: _gatewayUser,
    assistantName: _assistantName,
    avatarUrl: _avatarUrl,
    ...record
  } = instance
  return record
}

function toMetadata(instance: InstanceConfig): StoredInstanceMetadata {
  return {
    assistantName: instance.assistantName,
    avatarUrl: instance.avatarUrl,
    gatewayUser: instance.gatewayUser,
  }
}

async function loadInstances(): Promise<InstanceConfig[]> {
  const index = await readJsonFile<StoredInstanceIndex>(instancesIndexPath(), {
    schemaVersion: SCHEMA_VERSION,
    instances: [],
  })

  const instances = await Promise.all(
    index.instances.map(async (record) => {
      const metadata = await readJsonFile<StoredInstanceMetadata>(metadataPath(record.id), {})
      const credential = await readJsonFile<StoredInstanceCredential>(credentialPath(record.id), {
        token: '',
      })
      return {
        ...record,
        ...metadata,
        token: credential.token,
      }
    }),
  )

  return instances.filter((instance): instance is InstanceConfig =>
    typeof instance.id === 'string' &&
    typeof instance.name === 'string' &&
    typeof instance.gatewayUrl === 'string' &&
    typeof instance.token === 'string',
  )
}

async function saveInstances(instances: InstanceConfig[]): Promise<void> {
  await writeJsonFile(instancesIndexPath(), {
    schemaVersion: SCHEMA_VERSION,
    instances: instances.map(toIndexRecord),
  } satisfies StoredInstanceIndex)

  await Promise.all(
    instances.map(async (instance) => {
      await writeJsonFile(metadataPath(instance.id), toMetadata(instance))
      await writeJsonFile(credentialPath(instance.id), { token: instance.token } satisfies StoredInstanceCredential)
    }),
  )
}

async function loadAppState(): Promise<LocalAppStateSnapshot> {
  const appState = await readJsonFile<StoredAppState>(appStatePath(), {
    schemaVersion: SCHEMA_VERSION,
    currentInstanceId: null,
    settings: null,
  })
  return {
    settings: appState.settings,
    currentInstanceId: appState.currentInstanceId,
    instances: await loadInstances(),
  }
}

async function saveSettings(settings: AppSettings): Promise<void> {
  await updateJsonFile<StoredAppState>(appStatePath(), {
    schemaVersion: SCHEMA_VERSION,
    currentInstanceId: null,
    settings: null,
  }, (appState) => ({
    ...appState,
    schemaVersion: SCHEMA_VERSION,
    settings,
  }))
}

async function saveCurrentInstanceId(currentInstanceId: string | null): Promise<void> {
  await updateJsonFile<StoredAppState>(appStatePath(), {
    schemaVersion: SCHEMA_VERSION,
    currentInstanceId: null,
    settings: null,
  }, (appState) => ({
    ...appState,
    schemaVersion: SCHEMA_VERSION,
    currentInstanceId,
  }))
}

async function removeInstance(instanceId: string): Promise<void> {
  await rm(instanceDir(instanceId), { recursive: true, force: true })
}

export function registerLocalFileStorageHandlers(): void {
  ipcMain.handle('storage:loadAppState', () => loadAppState())
  ipcMain.handle('storage:saveSettings', (_event, settings: AppSettings) => saveSettings(settings))
  ipcMain.handle('storage:saveInstances', (_event, instances: InstanceConfig[]) => saveInstances(instances))
  ipcMain.handle('storage:saveCurrentInstanceId', (_event, currentInstanceId: string | null) =>
    saveCurrentInstanceId(currentInstanceId),
  )
  ipcMain.handle('storage:removeInstance', (_event, instanceId: string) => removeInstance(instanceId))
  ipcMain.handle('storage:loadInstanceData', (_event, instanceId: string, key: string) =>
    readJsonFile<unknown | null>(instanceDataPath(instanceId, key), null),
  )
  ipcMain.handle('storage:saveInstanceData', (_event, instanceId: string, key: string, value: unknown) =>
    writeJsonFile(instanceDataPath(instanceId, key), value),
  )
}
