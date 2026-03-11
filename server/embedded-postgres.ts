import { existsSync, readFileSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  createPool,
  ensurePostgresDatabase,
  getEmbeddedPostgresConfig,
  initDb,
} from './db'

type EmbeddedPostgresInstance = {
  initialise(): Promise<void>
  start(): Promise<void>
  stop(): Promise<void>
}

type EmbeddedPostgresCtor = new (opts: {
  databaseDir: string
  user: string
  password: string
  port: number
  persistent: boolean
  onLog?: (message: unknown) => void
  onError?: (message: unknown) => void
}) => EmbeddedPostgresInstance

async function detectPort(port: number): Promise<number> {
  const mod = await import('detect-port')
  const detected = await (mod.default ?? mod)(port)
  return typeof detected === 'number' ? detected : port
}

export async function startEmbeddedPostgres(): Promise<string> {
  const { dataDir, port: configuredPort, verbose } = getEmbeddedPostgresConfig()
  let EmbeddedPostgres: EmbeddedPostgresCtor
  try {
    const mod = await import('embedded-postgres')
    EmbeddedPostgres = mod.default as EmbeddedPostgresCtor
  } catch {
    throw new Error(
      'Embedded PostgreSQL requires the `embedded-postgres` package. ' +
        'Install it or set DATABASE_URL to use an external Postgres.'
    )
  }

  const port = await detectPort(configuredPort)
  const clusterVersionFile = resolve(dataDir, 'PG_VERSION')
  const clusterAlreadyInitialized = existsSync(clusterVersionFile)
  const postmasterPidFile = resolve(dataDir, 'postmaster.pid')

  const isPidRunning = (pid: number): boolean => {
    try {
      process.kill(pid, 0)
      return true
    } catch {
      return false
    }
  }

  const getRunningPid = (): number | null => {
    if (!existsSync(postmasterPidFile)) return null
    try {
      const pidLine = readFileSync(postmasterPidFile, 'utf8').split('\n')[0]?.trim()
      const pid = Number(pidLine)
      if (!Number.isInteger(pid) || pid <= 0) return null
      if (!isPidRunning(pid)) return null
      return pid
    } catch {
      return null
    }
  }

  const runningPid = getRunningPid()
  let portToUse = port
  if (runningPid) {
    try {
      const pidContent = readFileSync(postmasterPidFile, 'utf8').split('\n')
      const portLine = pidContent[3]?.trim()
      if (portLine) portToUse = Number(portLine) || port
    } catch {
      // use configured port
    }
    console.log(`Embedded PostgreSQL already running (pid=${runningPid}, port=${portToUse})`)
  } else {
    if (port !== configuredPort) {
      console.warn(
        `Embedded PostgreSQL port in use; using ${port} (requested ${configuredPort})`
      )
    }
    console.log(`Starting embedded PostgreSQL (dataDir=${dataDir}, port=${port})`)

    const embeddedPostgres = new EmbeddedPostgres({
      databaseDir: dataDir,
      user: 'agentpm',
      password: 'agentpm',
      port: portToUse,
      persistent: true,
      onLog: (msg) => {
        if (verbose) {
          console.log('[embedded-postgres]', msg)
        }
      },
      onError: (msg) => {
        console.error('[embedded-postgres]', msg)
      },
    })

    if (!clusterAlreadyInitialized) {
      await embeddedPostgres.initialise()
    } else {
      console.log('Embedded PostgreSQL cluster already exists; skipping init')
    }

    if (existsSync(postmasterPidFile)) {
      rmSync(postmasterPidFile, { force: true })
    }
    await embeddedPostgres.start()
  }

  const adminConnectionString = `postgres://agentpm:agentpm@127.0.0.1:${portToUse}/postgres`
  const dbStatus = await ensurePostgresDatabase(adminConnectionString, 'agentpm')
  if (dbStatus === 'created') {
    console.log('Created embedded PostgreSQL database: agentpm')
  }

  const connectionString = `postgres://agentpm:agentpm@127.0.0.1:${portToUse}/agentpm`
  const p = createPool(connectionString)
  await initDb(p)
  console.log('Embedded PostgreSQL ready')
  return connectionString
}
