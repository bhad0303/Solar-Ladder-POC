/**
 * Sun position via SunCalc ^1.9.0
 *
 * Convention (documented for this POC):
 * - SunCalc altitude: radians, 0 = horizon, positive above
 * - SunCalc azimuth: radians, 0 = south, west positive (SunCalc docs)
 * - We expose bearingFromNorthDeg: 0 = north, clockwise degrees (solar-design friendly)
 * - Direction vector in local meters: +X east, +Y up, −Z north
 */
import SunCalc from 'suncalc'
import { projectWallTime } from './coordinates'

const RAD2DEG = 180 / Math.PI

export type SunDirection = {
  /** Radians, horizon = 0. */
  altitudeRad: number
  /** SunCalc raw azimuth (0 = south). */
  azimuthRadSunCalc: number
  /** 0 = north, clockwise degrees. */
  bearingFromNorthDeg: number
  /** Unit vector toward the sun in local frame. */
  dir: { x: number; y: number; z: number }
  isUp: boolean
}

/** Convert SunCalc azimuth (0=south) → bearing from north clockwise. */
export function sunCalcAzimuthToBearingFromNorthDeg(azimuthRad: number): number {
  // SunCalc: 0 south, π/2 west, ±π north, -π/2 east
  // Bearing from north CW: 0 N, 90 E, 180 S, 270 W
  const degFromSouth = azimuthRad * RAD2DEG
  return ((180 + degFromSouth) % 360 + 360) % 360
}

export function getSunDirection(
  dayOfYear: number,
  minuteOfDay: number,
  lat: number,
  lng: number,
  timezone: string,
): SunDirection {
  const date = projectWallTime(dayOfYear, minuteOfDay, timezone)
  const pos = SunCalc.getPosition(date, lat, lng)
  const bearingFromNorthDeg = sunCalcAzimuthToBearingFromNorthDeg(pos.azimuth)
  const alt = pos.altitude
  const bearingRad = (bearingFromNorthDeg * Math.PI) / 180
  // Direction toward sun: horizontal component along bearing (from north CW)
  // north = −Z, east = +X
  const cosAlt = Math.cos(alt)
  const dir = {
    x: cosAlt * Math.sin(bearingRad),
    y: Math.sin(alt),
    z: -cosAlt * Math.cos(bearingRad),
  }
  const len = Math.hypot(dir.x, dir.y, dir.z) || 1
  return {
    altitudeRad: alt,
    azimuthRadSunCalc: pos.azimuth,
    bearingFromNorthDeg,
    dir: { x: dir.x / len, y: dir.y / len, z: dir.z / len },
    isUp: alt > 0,
  }
}

/** Sample sun positions for a day (hour marks) for path curve. */
export function sampleSunPathForDay(
  dayOfYear: number,
  lat: number,
  lng: number,
  timezone: string,
  stepMinutes = 30,
): SunDirection[] {
  const out: SunDirection[] = []
  for (let m = 0; m < 1440; m += stepMinutes) {
    const s = getSunDirection(dayOfYear, m, lat, lng, timezone)
    if (s.isUp) out.push(s)
  }
  return out
}

export type SunHourMark = {
  hour: number
  minuteOfDay: number
  sun: SunDirection
}

/** Full-hour marks while the sun is up (for path numerals 7…18). */
export function sampleSunHourMarks(
  dayOfYear: number,
  lat: number,
  lng: number,
  timezone: string,
): SunHourMark[] {
  const out: SunHourMark[] = []
  for (let h = 0; h < 24; h++) {
    const minuteOfDay = h * 60
    const sun = getSunDirection(dayOfYear, minuteOfDay, lat, lng, timezone)
    if (sun.isUp) out.push({ hour: h, minuteOfDay, sun })
  }
  return out
}

export type DaylightTimes = {
  sunrise: Date
  sunset: Date
  sunriseLabel: string
  sunsetLabel: string
  sunriseSun: SunDirection
  sunsetSun: SunDirection
}

function formatInZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date)
}

function wallMinuteOfDay(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0)
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0)
  return hour * 60 + minute
}

/** Sunrise / sunset for the selected day in the project timezone. */
export function getDaylightTimes(
  dayOfYear: number,
  lat: number,
  lng: number,
  timezone: string,
): DaylightTimes {
  const noon = projectWallTime(dayOfYear, 12 * 60, timezone)
  const times = SunCalc.getTimes(noon, lat, lng)
  const sunrise = times.sunrise
  const sunset = times.sunset
  const sunriseMin = wallMinuteOfDay(sunrise, timezone)
  const sunsetMin = wallMinuteOfDay(sunset, timezone)
  return {
    sunrise,
    sunset,
    sunriseLabel: formatInZone(sunrise, timezone),
    sunsetLabel: formatInZone(sunset, timezone),
    sunriseSun: getSunDirection(dayOfYear, sunriseMin, lat, lng, timezone),
    sunsetSun: getSunDirection(dayOfYear, sunsetMin, lat, lng, timezone),
  }
}
