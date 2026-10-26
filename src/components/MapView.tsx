import { useEffect, useRef, useState } from 'react'
import { getMapsApiKey, loadGoogleMaps } from '../map/loadGoogleMaps'
import { useProjectStore } from '../store/useProjectStore'

/**
 * Google Maps satellite background only — no outline tracing from imagery.
 * Yellow polygon = OSM footprint from Overpass (Step 2).
 */
export function MapView() {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const markerRef = useRef<google.maps.Marker | null>(null)
  const polygonRef = useRef<google.maps.Polygon | null>(null)
  const lat = useProjectStore((s) => s.location.lat)
  const lng = useProjectStore((s) => s.location.lng)
  const footprint = useProjectStore((s) => s.footprint)
  const setLatLng = useProjectStore((s) => s.setLatLng)
  const setMapReady = useProjectStore((s) => s.setMapReady)
  const setError = useProjectStore((s) => s.setError)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    let cancelled = false

    void (async () => {
      try {
        if (!getMapsApiKey()) {
          throw new Error(
            'Missing VITE_GOOGLE_MAPS_KEY in .env.local (see .env.example).',
          )
        }
        await loadGoogleMaps()
        if (cancelled || !containerRef.current) return

        const center = { lat, lng }
        const map = new google.maps.Map(containerRef.current, {
          center,
          zoom: 19,
          mapTypeId: google.maps.MapTypeId.SATELLITE,
          disableDefaultUI: false,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          tilt: 0,
          heading: 0,
        })
        mapRef.current = map

        const marker = new google.maps.Marker({
          map,
          position: center,
          draggable: true,
          title: 'Selected location',
        })
        markerRef.current = marker

        map.addListener('click', (ev: google.maps.MapMouseEvent) => {
          const p = ev.latLng
          if (!p) return
          setLatLng(p.lat(), p.lng())
        })
        marker.addListener('dragend', () => {
          const p = marker.getPosition()
          if (!p) return
          setLatLng(p.lat(), p.lng())
        })

        setMapReady(true)
        setLoadError(null)
        setError(null)
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : 'Failed to load Google Maps'
        if (!cancelled) {
          setLoadError(msg)
          setMapReady(false)
          setError(msg)
        }
      }
    })()

    return () => {
      cancelled = true
      polygonRef.current?.setMap(null)
      polygonRef.current = null
      markerRef.current?.setMap(null)
      markerRef.current = null
      mapRef.current = null
      setMapReady(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const marker = markerRef.current
    if (!map || !marker) return
    const pos = { lat, lng }
    marker.setPosition(pos)
    map.panTo(pos)
  }, [lat, lng])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    polygonRef.current?.setMap(null)
    polygonRef.current = null

    if (!footprint?.polygonLatLng.length) return

    const path = footprint.polygonLatLng.map((p) => ({
      lat: p.lat,
      lng: p.lng,
    }))
    const polygon = new google.maps.Polygon({
      paths: path,
      strokeColor: '#facc15',
      strokeOpacity: 0.95,
      strokeWeight: 2,
      fillColor: '#eab308',
      fillOpacity: 0.28,
      map,
      clickable: false,
    })
    polygonRef.current = polygon

    const bounds = new google.maps.LatLngBounds()
    for (const p of path) bounds.extend(p)
    map.fitBounds(bounds, 48)
  }, [footprint])

  return (
    <div className="relative h-full min-h-[280px] w-full overflow-hidden rounded-lg bg-slate-800">
      <div ref={containerRef} className="h-full w-full" />
      {loadError ? (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/90 p-4 text-center text-sm text-rose-300">
          {loadError}
        </div>
      ) : null}
      <div className="pointer-events-none absolute bottom-2 left-2 max-w-[90%] rounded bg-black/65 px-2 py-1 text-[10px] leading-snug text-slate-200">
        <span className="pointer-events-auto">
          Map data ©{' '}
          <a
            className="underline hover:text-white"
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noreferrer"
          >
            OpenStreetMap
          </a>{' '}
          contributors · Satellite © Google
        </span>
      </div>
    </div>
  )
}
