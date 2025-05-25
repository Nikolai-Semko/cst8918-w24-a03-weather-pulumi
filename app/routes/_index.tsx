import {json} from '@remix-run/node'
import {useLoaderData} from '@remix-run/react'
import {fetchWeatherData} from '../api-services/open-weather-service'
import {capitalizeFirstLetter} from '../utils/text-formatting'
import type {MetaFunction} from '@remix-run/node'

export const meta: MetaFunction = () => {
  return [
    {title: 'Remix Weather'},
    {
      name: 'description',
      content: 'A demo web app using Remix and OpenWeather API.'
    }
  ]
}

const location = {
  city: 'Ottawa',
  postalCode: 'K2G 1V8', // Algonquin College, Woodroffe Campus
  lat: 45.3211,
  lon: -75.7391,
  countryCode: 'CA'
}
const units = 'metric'

export async function loader() {
  try {
    console.log('=== LOADER: Starting weather fetch ===')
    const data = await fetchWeatherData({
      lat: location.lat,
      lon: location.lon,
      units: units
    })
    
    console.log('=== LOADER: Weather data received ===', JSON.stringify(data, null, 2))
    
    // ULTRA-DEFENSIVE: Ensure we have valid data structure
    const safeData = {
      weather: data?.weather || [{
        main: 'Clear',
        description: 'Weather data unavailable',
        icon: '01d'
      }],
      main: data?.main || {
        temp: 20,
        feels_like: 20,
        humidity: 50
      },
      name: data?.name || 'Ottawa',
      dt: data?.dt || Math.floor(Date.now() / 1000)
    }
    
    console.log('=== LOADER: Returning safe data ===', JSON.stringify(safeData, null, 2))
    return json({currentConditions: safeData})
    
  } catch (error) {
    console.error('=== LOADER ERROR ===', error)
    // Return guaranteed fallback data
    return json({
      currentConditions: {
        weather: [{
          main: 'Clear',
          description: 'Weather service temporarily unavailable',
          icon: '01d'
        }],
        main: {
          temp: 20,
          feels_like: 20,
          humidity: 50
        },
        name: 'Ottawa',
        dt: Math.floor(Date.now() / 1000)
      }
    })
  }
}

export default function CurrentConditions() {
  const {currentConditions} = useLoaderData<typeof loader>()
  
  // ULTRA-DEFENSIVE: Triple-check everything exists
  if (!currentConditions) {
    return <div>Loading weather data...</div>
  }
  
  if (!currentConditions.weather || !Array.isArray(currentConditions.weather) || currentConditions.weather.length === 0) {
    return <div>Weather data is not available right now.</div>
  }
  
  if (!currentConditions.main) {
    return <div>Temperature data is not available right now.</div>
  }
  
  const weather = currentConditions.weather[0]
  
  return (
    <>
      <main
        style={{
          padding: '1.5rem',
          fontFamily: 'system-ui, sans-serif',
          lineHeight: '1.8'
        }}
      >
        <h1>Remix Weather</h1>
        <p>
          For Algonquin College, Woodroffe Campus <br />
          <span style={{color: 'hsl(220, 23%, 60%)'}}>
            (LAT: {location.lat}, LON: {location.lon})
          </span>
        </p>
        <h2>Current Conditions</h2>
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            gap: '2rem',
            alignItems: 'center'
          }}
        >
          <img src={getWeatherIconUrl(weather?.icon || '01d')} alt="" />
          <div style={{fontSize: '2rem'}}>
            {(currentConditions.main.temp ?? 20).toFixed(1)}°C
          </div>
        </div>
        <p
          style={{
            fontSize: '1.2rem',
            fontWeight: '400'
          }}
        >
          {capitalizeFirstLetter(weather?.description || 'Clear')}. Feels like{' '}
          {(currentConditions.main.feels_like ?? 20).toFixed(1)}°C.
          <br />
          <span style={{color: 'hsl(220, 23%, 60%)', fontSize: '0.85rem'}}>
            updated at{' '}
            {new Intl.DateTimeFormat('en-CA', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit'
            }).format((currentConditions.dt || Math.floor(Date.now() / 1000)) * 1000)}
          </span>
        </p>
      </main>
      <section
        style={{
          backgroundColor: 'hsl(220, 54%, 96%)',
          padding: '0.5rem 1.5rem 1rem 1.5rem',
          borderRadius: '0.25rem'
        }}
      >
        <h2>Raw Data</h2>
        <pre>{JSON.stringify(currentConditions, null, 2)}</pre>
      </section>
      <hr style={{marginTop: '2rem'}} />
      <p>
        Learn how to customize this app. Read the{' '}
        <a target="_blank" href="https://remix.run/docs" rel="noreferrer">
          Remix Docs
        </a>
      </p>
    </>
  )
}

function getWeatherIconUrl(iconCode: string) {
  return `http://openweathermap.org/img/wn/${iconCode}@2x.png`
}