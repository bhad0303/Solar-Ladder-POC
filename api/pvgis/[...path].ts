/**
 * Vercel Node proxy for JRC PVGIS.
 * Edge/cloud IPs are often blocked by JRC WAF — we warm cookies first and
 * use an EU region. If WAF still rejects, the client falls back to NASA POWER.
 */
export const config = {
  runtime: 'nodejs',
  regions: ['fra1'],
  maxDuration: 25,
}

function collectCookies(res: Response): string {
  const anyHeaders = res.headers as Headers & {
    getSetCookie?: () => string[]
  }
  const list =
    typeof anyHeaders.getSetCookie === 'function'
      ? anyHeaders.getSetCookie()
      : []
  if (list.length > 0) {
    return list.map((c) => c.split(';')[0]!).join('; ')
  }
  const single = res.headers.get('set-cookie')
  if (!single) return ''
  return single.split(/, (?=[^;]+?=)/).map((c) => c.split(';')[0]!).join('; ')
}

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405 })
  }

  const incoming = new URL(req.url)
  const match = incoming.pathname.match(/\/api\/pvgis\/(.+)$/)
  const apiPath = match?.[1]?.replace(/\/$/, '') || 'PVcalc'

  if (!/^[A-Za-z0-9_-]+$/.test(apiPath)) {
    return new Response('Invalid PVGIS path', { status: 400 })
  }

  const target = new URL(`https://re.jrc.ec.europa.eu/api/v5_3/${apiPath}`)
  target.search = incoming.search

  try {
    // Warm F5 / JRC session cookies (same pattern as a browser visiting the tools site)
    let cookieHeader = ''
    try {
      const warm = await fetch('https://re.jrc.ec.europa.eu/pvg_tools/en/', {
        method: 'GET',
        headers: {
          'User-Agent': BROWSER_UA,
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        redirect: 'follow',
      })
      cookieHeader = collectCookies(warm)
    } catch {
      /* continue without cookies */
    }

    const upstream = await fetch(target.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/json,text/plain,*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'User-Agent': BROWSER_UA,
        Referer: 'https://re.jrc.ec.europa.eu/pvg_tools/en/',
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
      redirect: 'follow',
    })

    const text = await upstream.text()
    if (
      /requested URL was rejected/i.test(text) ||
      /jrc-waf/i.test(text)
    ) {
      return new Response(
        JSON.stringify({
          message:
            'PVGIS WAF blocked this cloud host. Client should use NASA POWER fallback.',
          waf: true,
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    return new Response(text, {
      status: upstream.status,
      headers: {
        'Content-Type':
          upstream.headers.get('Content-Type') ?? 'application/json',
        'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=86400',
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upstream fetch failed'
    return new Response(
      JSON.stringify({ message: `PVGIS proxy error: ${message}` }),
      {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
}
