import { FallbackEnergyEstimateProvider } from './FallbackEnergyEstimateProvider'
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
 * Debounced estimate runner: try PVGIS, fall back on CORS/network/API errors.
 * Stale responses never overwrite newer requests.
 */
export class EstimateController {
  private pvgis = new PvgisEnergyEstimateProvider()
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

    try {
      const estimate = await this.pvgis.estimate(input, signal)
      if (mySeq !== this.seq) return
      this.cbs.onResult(estimate)
      this.cbs.onStatus('ready')
    } catch (err) {
      if (signal.aborted && mySeq !== this.seq) return
      const msg = err instanceof Error ? err.message : String(err)
      try {
        const fb = await this.fallback.estimate(input)
        if (mySeq !== this.seq) return
        const warnings = [
          ...fb.warnings,
          `PVGIS unavailable (${msg}). Showing approximate fallback.`,
        ]
        this.cbs.onResult({ ...fb, warnings })
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
