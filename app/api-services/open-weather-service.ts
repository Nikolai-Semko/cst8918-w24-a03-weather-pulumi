import { redis } from '../data-access/redis-connection.js'

const API_KEY = process.env.WEATHER_API_KEY
const BASE_URL = 'https://api.openweathermap.org/data/2.5/weather' // FIXED: Use 2.5 API that works
const TEN_MINUTES = 1000 * 60 * 10 // in milliseconds

// Keep in-memory cache as fallback
const resultsCache: Record<string, {lastFetch: number; data: unknown}> = {}
function getCacheEntry(key: string) {
  return resultsCache[key]
}
function setCacheEntry(key: string, data: unknown) {
  resultsCache[key] = {lastFetch: Date.now(), data}
}
function isDataStale(lastFetch: number) {
  return Date.now() - lastFetch > TEN_MINUTES
}

interface FetchWeatherDataParams {
  lat: number
  lon: number
  units: 'standard' | 'metric' | 'imperial'
}

export async function fetchWeatherData({
  lat,
  lon,
  units
}: FetchWeatherDataParams) {
  const queryString = `lat=${lat}&lon=${lon}&units=${units}`

  try {
    // Try Redis cache first
    const cacheEntry = await redis.get(queryString)
    if (cacheEntry) {
      console.log('🟢 Cache HIT (Redis):', queryString)
      return JSON.parse(cacheEntry)
    }

    // If not in Redis, fetch from API
    console.log('🔴 Cache MISS, fetching from API:', queryString)
    const response = await fetch(`${BASE_URL}?${queryString}&appid=${API_KEY}`)
    
    if (!response.ok) {
      throw new Error(`Weather API error: ${response.status} ${response.statusText}`)
    }
    
    const data = await response.json() // FIXED: Use .json() not .text()
    
    // Store in Redis with expiration
    await redis.set(queryString, JSON.stringify(data), {PX: TEN_MINUTES})
    console.log('💾 Cached in Redis:', queryString)
    
    return data
  } catch (redisError) {
    // Fallback to in-memory cache if Redis fails
    console.warn('⚠️ Redis error, falling back to in-memory cache:', redisError)
    
    const cacheEntry = getCacheEntry(queryString)
    if (cacheEntry && !isDataStale(cacheEntry.lastFetch)) {
      console.log('🟡 Cache HIT (in-memory):', queryString)
      return cacheEntry.data
    }
    
    console.log('🔴 Cache MISS, fetching from API (fallback):', queryString)
    const response = await fetch(`${BASE_URL}?${queryString}&appid=${API_KEY}`)
    
    if (!response.ok) {
      throw new Error(`Weather API error: ${response.status}`)
    }
    
    const data = await response.json()
    setCacheEntry(queryString, data)
    return data
  }
}

export async function getGeoCoordsForPostalCode(
  postalCode: string,
  countryCode: string
) {
  const url = `http://api.openweathermap.org/geo/1.0/zip?zip=${postalCode},${countryCode}&appid=${API_KEY}`
  const response = await fetch(url)
  const data = response.json()
  return data
}
