import { Loader } from '@googlemaps/js-api-loader'

let loading: Promise<typeof google> | null = null

export function getMapsApiKey(): string {
  return (import.meta.env.VITE_GOOGLE_MAPS_KEY ?? '').trim()
}

/** Load Maps JS once (Demo Key — satellite MapTypeId only). */
export function loadGoogleMaps(): Promise<typeof google> {
  const key = getMapsApiKey()
  if (!key) {
    return Promise.reject(
      new Error(
        'Missing VITE_GOOGLE_MAPS_KEY. Copy .env.example to .env.local and add your Maps Demo Key.',
      ),
    )
  }
  if (!loading) {
    const loader = new Loader({
      apiKey: key,
      version: 'weekly',
    })
    loading = loader.load()
  }
  return loading
}
