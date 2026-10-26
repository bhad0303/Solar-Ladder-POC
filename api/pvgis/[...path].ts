/**
 * Vercel Edge proxy for JRC PVGIS (browser CORS + WAF blocks direct calls).
 * Locally Vite proxies `/pvgis-api` → same upstream; production uses this route
 * via vercel.json rewrite `/pvgis-api/:path*` → `/api/pvgis/:path*`.
 */
export const config = {
  runtime: 'edge',
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405 })
  }

  const incoming = new URL(req.url)
  const match = incoming.pathname.match(/\/api\/pvgis\/(.+)$/)
  const apiPath = match?.[1]?.replace(/\/$/, '') || 'PVcalc'

  // Only allow known PVGIS endpoints
  if (!/^[A-Za-z0-9_-]+$/.test(apiPath)) {
    return new Response('Invalid PVGIS path', { status: 400 })
  }

  const target = new URL(
    `https://re.jrc.ec.europa.eu/api/v5_3/${apiPath}`,
  )
  target.search = incoming.search

  try {
    const upstream = await fetch(target.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; SolarPreviewPoC/1.0)',
      },
    })

    const body = await upstream.arrayBuffer()
    const contentType =
      upstream.headers.get('Content-Type') ?? 'application/json'

    return new Response(body, {
      status: upstream.status,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=86400',
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upstream fetch failed'
    return new Response(JSON.stringify({ message: `PVGIS proxy error: ${message}` }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
