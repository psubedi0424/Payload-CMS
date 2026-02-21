import { InfluxDB, Point } from '@influxdata/influxdb-client'

// InfluxDB configuration
const INFLUX_URL = process.env.INFLUX_URL || 'http://localhost:8086'
const INFLUX_TOKEN = process.env.INFLUX_TOKEN || 'your-token-here'
const INFLUX_ORG = process.env.INFLUX_ORG || 'your-org'
const INFLUX_BUCKET = process.env.INFLUX_BUCKET || 'stream-metrics'

// Create InfluxDB client instance
const influxDB = new InfluxDB({ url: INFLUX_URL, token: INFLUX_TOKEN })

// Write API for storing metrics
const writeApi = influxDB.getWriteApi(INFLUX_ORG, INFLUX_BUCKET)
writeApi.useDefaultTags({ app: 'livestream-platform' })

// Query API for reading metrics
const queryApi = influxDB.getQueryApi(INFLUX_ORG)

export { influxDB, writeApi, queryApi, INFLUX_BUCKET }

// Helper function to write viewer count
export async function writeViewerMetric(
  streamId: string,
  creatorId: string,
  platform: string,
  viewerCount: number,
  timestamp?: Date
) {
  try {
    const point = new Point('viewer_count')
      .tag('stream_id', streamId)
      .tag('creator_id', creatorId)
      .tag('platform', platform)
      .intField('viewers', viewerCount)
      .timestamp(timestamp || new Date())

    writeApi.writePoint(point)
    await writeApi.flush() // write data in api
    
      console.log(`📊 Wrote viewer metric: ${viewerCount} viewers for stream ${streamId}`)
      return true
  } catch (error: any) {
    console.error(' InfluxDB write error:', error.message)
    return false
  }
}

// Helper function to get viewer snapshots for a stream
export async function getViewerSnapshots1(
  streamId: string,
  startTime?: Date,
  endTime?: Date
): Promise<Array<{ timestamp: Date; viewerCount: number }>> {
  try {
    const start = startTime ? startTime.toISOString() : '-30d' // Last 30 days default
    const end = endTime ? endTime.toISOString() : 'now()'

    const query = `
      from(bucket: "${INFLUX_BUCKET}")
        |> range(start: ${typeof start === 'string' ? start : `time(v: "${start}")`}, stop: ${typeof end === 'string' ? end : `time(v: "${end}")`})
        |> filter(fn: (r) => r._measurement == "viewer_count")
        |> filter(fn: (r) => r.stream_id == "${streamId}")
        |> filter(fn: (r) => r._field == "viewers")
        |> sort(columns: ["_time"])
    `

    const snapshots: Array<{ timestamp: Date; viewerCount: number }> = []

    return new Promise((resolve, reject) => {
      queryApi.queryRows(query, {
        next(row, tableMeta) {
          const o = tableMeta.toObject(row)
          snapshots.push({
            timestamp: new Date(o._time),
            viewerCount: o._value as number,
          })
        },
        error(error) {
          console.error(' InfluxDB query error:', error)
          reject(error)
        },
        complete() {
          resolve(snapshots)
        },
      })
    })
  } catch (error: any) {
    console.error(' Error fetching snapshots:', error.message)
    return []
  }
}

// Get peak viewers for a stream
export async function getPeakViewers1(
  streamId: string,
  startTime?: Date,
  endTime?: Date
): Promise<number> {
  try {
    const start = startTime ? `time(v: "${startTime.toISOString()}")` : '-30d'
    const end = endTime ? `time(v: "${endTime.toISOString()}")` : 'now()'

    const query = `
      from(bucket: "${INFLUX_BUCKET}")
        |> range(start: ${start}, stop: ${end})
        |> filter(fn: (r) => r._measurement == "viewer_count")
        |> filter(fn: (r) => r.stream_id == "${streamId}")
        |> filter(fn: (r) => r._field == "viewers")
        |> max()
    `

    return new Promise((resolve, reject) => {
      let peak = 0
      queryApi.queryRows(query, {
        next(row, tableMeta) {
          const o = tableMeta.toObject(row)
          peak = o._value as number
        },
        error(error) {
          console.error(' InfluxDB query error:', error)
          reject(error)
        },
        complete() {
          resolve(peak)
        },
      })
    })
  } catch (error: any) {
    console.error(' Error fetching peak viewers:', error.message)
    return 0
  }
}

// Get average viewers for a stream
export async function getAverageViewers1(
  streamId: string,
  startTime?: Date,
  endTime?: Date
): Promise<number> {
  try {
    const start = startTime ? `time(v: "${startTime.toISOString()}")` : '-30d'
    const end = endTime ? `time(v: "${endTime.toISOString()}")` : 'now()'

    const query = `
      from(bucket: "${INFLUX_BUCKET}")
        |> range(start: ${start}, stop: ${end})
        |> filter(fn: (r) => r._measurement == "viewer_count")
        |> filter(fn: (r) => r.stream_id == "${streamId}")
        |> filter(fn: (r) => r._field == "viewers")
        |> mean()
    `

    return new Promise((resolve, reject) => {
      let avg = 0
      queryApi.queryRows(query, {
        next(row, tableMeta) {
          const o = tableMeta.toObject(row)
          avg = Math.round(o._value as number)
        },
        error(error) {
          console.error(' InfluxDB query error:', error)
          reject(error)
        },
        complete() {
          resolve(avg)
        },
      })
    })
  } catch (error: any) {
    console.error(' Error fetching average viewers:', error.message)
    return 0
  }
}

// Get viewer data aggregated by time window (for charts)
export async function getAggregatedViewerData1(
  streamId: string,
  windowDuration: string = '1m', // 1m, 5m, 1h, etc.
  startTime?: Date,
  endTime?: Date
): Promise<Array<{ timestamp: Date; avgViewers: number; maxViewers: number }>> {
  try {
    const start = startTime ? `time(v: "${startTime.toISOString()}")` : '-30d'
    const end = endTime ? `time(v: "${endTime.toISOString()}")` : 'now()'

    const query = `
      from(bucket: "${INFLUX_BUCKET}")
        |> range(start: ${start}, stop: ${end})
        |> filter(fn: (r) => r._measurement == "viewer_count")
        |> filter(fn: (r) => r.stream_id == "${streamId}")
        |> filter(fn: (r) => r._field == "viewers")
        |> aggregateWindow(every: ${windowDuration}, fn: mean, createEmpty: false)
        |> yield(name: "mean")
    `

    const data: Array<{ timestamp: Date; avgViewers: number; maxViewers: number }> = []

    return new Promise((resolve, reject) => {
      queryApi.queryRows(query, {
        next(row, tableMeta) {
          const o = tableMeta.toObject(row)
          data.push({
            timestamp: new Date(o._time),
            avgViewers: Math.round(o._value as number),
            maxViewers: Math.round(o._value as number), // Can add separate max query
          })
        },
        error(error) {
          console.error(' InfluxDB query error:', error)
          reject(error)
        },
        complete() {
          resolve(data)
        },
      })
    })
  } catch (error: any) {
    console.error(' Error fetching aggregated data:', error.message)
    return []
  }
}
export async function getSnapshotCount1(
    streamId: string,
    startTime?: Date,
    endTime?: Date
  ): Promise<number> {
    try {
      const start = startTime ? `"${startTime.toISOString()}"` : '-30d'
      const end = endTime ? `"${endTime.toISOString()}"` : 'now()'

      const query = `
      from(bucket: "${INFLUX_BUCKET}")
        |> range(start: ${start}, stop: ${end})
        |> filter(fn: (r) => r._measurement == "viewer_count")
        |> filter(fn: (r) => r.stream_id == "${streamId}")
        |> filter(fn: (r) => r._field == "viewers")
        |> count()
      `

      return new Promise((resolve, reject) => {
        let count = 0
        queryApi.queryRows(query, {
          next(row, tableMeta) {
            const o = tableMeta.toObject(row)
            count = o._value as number
          },
          error(error) {
            console.error('❌ InfluxDB query error:', error)
            reject(error)
          },
          complete() {
            console.log(`📊 InfluxDB: Snapshot count for ${streamId}: ${count}`)
            resolve(count)
          },
        })
      })
    } catch (error: any) {
      console.error('❌ Error fetching snapshot count:', error.message)
      return 0
    }
}