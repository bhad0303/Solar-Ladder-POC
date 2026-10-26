import { FallbackEnergyEstimateProvider } from './FallbackEnergyEstimateProvider'
import { NasaPowerEnergyEstimateProvider } from './NasaPowerEnergyEstimateProvider'
import { PvgisEnergyEstimateProvider } from './PvgisEnergyEstimateProvider'
import type {
  EnergyEstimate,
  EnergyEstimateInput,
  EstimateStatus,
} from './types'

export type EstimateControllerCallbacks = {
  onStatus: (status: EstimateStatus) => void
  onResult: (estimate: EnergyEstimate | null) => void
  onError: (message: string | null) => void
}

/**
 * Debounced estimate runner:
 * 1) PVGIS (best when proxy works — local Vite / some hosts)
 * 2) NASA POWER (CORS-open, location monthly insolation — works on Vercel)
 * 3) Peak-sun-hours formula fallback
 */
export class EstimateController {
  private pvgis = new PvgisEnergyEstimateProvider()
  private nasa = new NasaPowerEnergyEstimateProvider()
  private fallback = new FallbackEnergyEstimateProvider()
  private seq = 0
  private timer: ReturnType<typeof setTimeout> | null = null
  private abort: AbortController | null = null
  private cbs: EstimateControllerCallbacks
  private debounceMs: number

  constructor(cbs: EstimateControllerCallbacks, debounceMs = 400) {
    this.cbs = cbs
    this.debounceMs = debounceMs
  }

  dispose(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    this.abort?.abort()
    this.abort = null
    this.seq += 1
  }

  request(input: EnergyEstimateInput): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => {
      void this.run(input)
    }, this.debounceMs)
  }

  private async run(input: EnergyEstimateInput): Promise<void> {
    const mySeq = ++this.seq
    this.abort?.abort()
    this.abort = new AbortController()
    const signal = this.abort.signal

    this.cbs.onStatus('loading')
    this.cbs.onError(null)

    if (!(input.installedCapacityKw > 0)) {
      if (mySeq !== this.seq) return
      this.cbs.onResult(null)
      this.cbs.onStatus('idle')
      this.cbs.onError('No panels / zero capacity — energy estimate skipped.')
      return
    }

    let pvgisError: string | null = null
    try {
      const estimate = await this.pvgis.estimate(input, signal)
      if (mySeq !== this.seq) return
      this.cbs.onResult(estimate)
      this.cbs.onStatus('ready')
      return
    } catch (err) {
      if (signal.aborted && mySeq !== this.seq) return
      pvgisError = err instanceof Error ? err.message : String(err)
    }

    try {
      const nasa = await this.nasa.estimate(input, signal)
      if (mySeq !== this.seq) return
      this.cbs.onResult({
        ...nasa,
        warnings: [
          ...nasa.warnings,
          ...(pvgisError
            ? [`PVGIS unavailable (${pvgisError}). Using NASA POWER.`]
            : []),
        ],
      })
      this.cbs.onStatus('ready')
      return
    } catch (nasaErr) {
      if (signal.aborted && mySeq !== this.seq) return
      const nasaMsg =
        nasaErr instanceof Error ? nasaErr.message : String(nasaErr)
      try {
        const fb = await this.fallback.estimate(input)
        if (mySeq !== this.seq) return
        this.cbs.onResult({
          ...fb,
          warnings: [
            ...fb.warnings,
            ...(pvgisError ? [`PVGIS unavailable (${pvgisError}).`] : []),
            `NASA POWER unavailable (${nasaMsg}). Showing peak-sun-hours fallback.`,
          ],
        })
        this.cbs.onStatus('ready')
      } catch (fbErr) {
        if (mySeq !== this.seq) return
        this.cbs.onResult(null)
        this.cbs.onStatus('error')
        this.cbs.onError(
          fbErr instanceof Error ? fbErr.message : 'Estimate failed',
        )
      }
    }
  }
}
