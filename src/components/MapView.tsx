import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useProjectStore } from '../store/useProjectStore'

/** Free Esri World Imagery tiles (no API key). */
const ESI_SAT =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'

/**
 * Free map: Leaflet + Esri satellite. Footprints from OSM Overpass (no Google).
 */
export function MapView() {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const polygonRef = useRef<L.Polygon | null>(null)
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

    try {
      const map = L.map(el, {
        center: [lat, lng],
        zoom: 19,
        zoomControl: true,
        attributionControl: false,
      })

      L.tileLayer(ESI_SAT, {
        maxZoom: 19,
        maxNativeZoom: 19,
        attribution: 'Tiles © Esri',
      }).addTo(map)

      // DivIcon avoids Vite broken default marker PNG paths (no Google needed)
      const icon = L.divIcon({
        className: 'solar-pin',
        html: `<div style="width:18px;height:18px;border-radius:50% 50% 50% 0;background:#ef4444;border:2px solid #fff;transform:rotate(-45deg);box-shadow:0 1px 4px rgba(0,0,0,.45)"></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 18],
      })
      const marker = L.marker([lat, lng], { draggable: true, icon }).addTo(map)
      marker.bindTooltip('Selected location', { direction: 'top' })

      map.on('click', (ev: L.LeafletMouseEvent) => {
        setLatLng(ev.latlng.lat, ev.latlng.lng)
      })
      marker.on('dragend', () => {
        const p = marker.getLatLng()
        setLatLng(p.lat, p.lng)
      })

      mapRef.current = map
      markerRef.current = marker
      setMapReady(true)
      setLoadError(null)
      setError(null)

      // Leaflet needs a resize after flex layout
      requestAnimationFrame(() => map.invalidateSize())
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Map failed to load'
      setLoadError(msg)
      setMapReady(false)
      setError(msg)
    }

    return () => {
      polygonRef.current = null
      markerRef.current = null
      mapRef.current?.remove()
      mapRef.current = null
      setMapReady(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const marker = markerRef.current
    if (!map || !marker) return
    marker.setLatLng([lat, lng])
    map.panTo([lat, lng])
  }, [lat, lng])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    if (polygonRef.current) {
      map.removeLayer(polygonRef.current)
      polygonRef.current = null
    }

    if (!footprint?.polygonLatLng.length) return

    const latlngs = footprint.polygonLatLng.map(
      (p) => [p.lat, p.lng] as L.LatLngExpression,
    )
    const polygon = L.polygon(latlngs, {
      color: '#facc15',
      weight: 2,
      opacity: 0.95,
      fillColor: '#eab308',
      fillOpacity: 0.28,
      interactive: false,
    }).addTo(map)
    polygonRef.current = polygon
    map.fitBounds(polygon.getBounds(), { padding: [48, 48] })
  }, [footprint])

  return (
    <div className="relative h-full min-h-[280px] w-full overflow-hidden rounded-lg bg-slate-800">
      <div ref={containerRef} className="h-full w-full" />
      {loadError ? (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/90 p-4 text-center text-sm text-rose-300">
          {loadError}
        </div>
      ) : null}
      <div className="pointer-events-none absolute bottom-2 left-2 z-[1000] max-w-[90%] rounded bg-black/65 px-2 py-1 text-[10px] leading-snug text-slate-200">
        <span className="pointer-events-auto">
          ©{' '}
          <a
            className="underline hover:text-white"
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noreferrer"
          >
            OpenStreetMap
          </a>{' '}
          · Satellite tiles © Esri
        </span>
      </div>
    </div>
  )
}
