/**
 * Vercel Edge proxy for OpenStreetMap API (same pattern as local Vite `/osm-api`).
 */
export const config = {
  runtime: 'edge',
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405 })
  }

  const incoming = new URL(req.url)
  const match = incoming.pathname.match(/\/api\/osm\/(.+)$/)
  const rest = match?.[1] ?? ''
  if (rest.includes('..')) {
    return new Response('Invalid path', { status: 400 })
  }

  const target = new URL(`https://api.openstreetmap.org/${rest}`)
  target.search = incoming.search

  try {
    const upstream = await fetch(target.toString(), {
      method: 'GET',
      headers: {
        Accept: req.headers.get('Accept') ?? 'application/json',
        'User-Agent': 'SolarPreviewPoC/1.0 (dev; contact local)',
      },
    })
    const body = await upstream.arrayBuffer()
    return new Response(body, {
      status: upstream.status,
      headers: {
        'Content-Type':
          upstream.headers.get('Content-Type') ?? 'application/octet-stream',
        'Cache-Control': 'public, s-maxage=300',
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upstream fetch failed'
    return new Response(JSON.stringify({ message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
