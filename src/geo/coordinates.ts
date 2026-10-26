import type { ProjectLocation, Vec2, Vec3 } from '../data/types'

/** Mean Earth radius (meters) for local tangent-plane approx. */
export const EARTH_RADIUS_M = 6_378_137

const DEG2RAD = Math.PI / 180

/**
 * Local frame (before northOffsetDeg):
 * +X = east, +Y = up, −Z = geographic north (Babylon-friendly).
 * northOffsetDeg rotates the local XZ plane clockwise when viewed from above.
 */

export function metersPerDegreeLat(): number {
  return (Math.PI / 180) * EARTH_RADIUS_M
}

export function metersPerDegreeLng(latDeg: number): number {
  return (Math.PI / 180) * EARTH_RADIUS_M * Math.cos(latDeg * DEG2RAD)
}

function rotateXZ(
  x: number,
  z: number,
  northOffsetDeg: number,
): { x: number; z: number } {
  const a = northOffsetDeg * DEG2RAD
  const c = Math.cos(a)
  const s = Math.sin(a)
  // Clockwise from above (Y-up): apply to (x, −north) where north = −z
  return {
    x: x * c + z * s,
    z: -x * s + z * c,
  }
}

/** Geographic delta → local meters (apply northOffset). */
export function latLngToLocal(
  lat: number,
  lon: number,
  location: ProjectLocation,
): Vec3 {
  const dLat = lat - location.lat
  const dLon = lon - location.lon
  const east = dLon * metersPerDegreeLng(location.lat)
  const north = dLat * metersPerDegreeLat()
  // Unrotated: x=east, z=−north
  const rawX = east
  const rawZ = -north
  const rotated = rotateXZ(rawX, rawZ, location.northOffsetDeg)
  return { x: rotated.x, y: 0, z: rotated.z }
}

/** Local meters → geographic (inverse of latLngToLocal). */
export function localToLatLng(
  local: Vec2 | Vec3,
  location: ProjectLocation,
): { lat: number; lon: number } {
  // Inverse rotate
  const a = -location.northOffsetDeg * DEG2RAD
  const c = Math.cos(a)
  const s = Math.sin(a)
  const rawX = local.x * c + local.z * s
  const rawZ = -local.x * s + local.z * c
  const east = rawX
  const north = -rawZ
  return {
    lat: location.lat + north / metersPerDegreeLat(),
    lon: location.lon + east / metersPerDegreeLng(location.lat),
  }
}

export function dayOfYearToApproxMonthDay(dayOfYear: number): {
  monthIndex: number
  day: number
} {
  const day = Math.min(365, Math.max(1, Math.round(dayOfYear)))
  // Non-leap year cumulative days at month end
  const ends = [31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334, 365]
  let monthIndex = 0
  let prev = 0
  for (let i = 0; i < ends.length; i++) {
    if (day <= ends[i]!) {
      monthIndex = i
      break
    }
    prev = ends[i]!
  }
  return { monthIndex, day: day - prev }
}

/** Build a Date in the project timezone for sun math (wall-clock fields). */
export function projectWallTime(
  dayOfYear: number,
  minuteOfDay: number,
  timezone: string,
  year = 2026,
): Date {
  const { monthIndex, day } = dayOfYearToApproxMonthDay(dayOfYear)
  const hh = Math.floor(minuteOfDay / 60)
  const mm = minuteOfDay % 60
  // Interpret as wall time in timezone via Intl offset probe
  const utcGuess = Date.UTC(year, monthIndex, day, hh, mm, 0)
  const offsetMin = getTimeZoneOffsetMinutes(timezone, utcGuess)
  return new Date(utcGuess - offsetMin * 60_000)
}

export function getTimeZoneOffsetMinutes(
  timeZone: string,
  utcInstant: number,
): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })
  const parts = dtf.formatToParts(new Date(utcInstant))
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? '0')
  const asUTC = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  )
  return (asUTC - utcInstant) / 60_000
}

export function formatMinuteOfDay(minuteOfDay: number): string {
  const m = ((minuteOfDay % 1440) + 1440) % 1440
  const h24 = Math.floor(m / 60)
  const mm = m % 60
  const period = h24 >= 12 ? 'PM' : 'AM'
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  return `${h12}:${mm.toString().padStart(2, '0')} ${period}`
}

export function formatDayOfYear(dayOfYear: number): string {
  const { monthIndex, day } = dayOfYearToApproxMonthDay(dayOfYear)
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ]
  return `${months[monthIndex]} ${day}`
}

export const JUNE_21_DOY = 172
export const DEC_21_DOY = 355
export const NOON_MINUTE = 12 * 60
