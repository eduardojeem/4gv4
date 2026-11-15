import { KNOWN_CITY_NAMES } from '@/lib/public/city-normalizer'

/**
 * Sugerencias para el campo Ciudad (`list="known-cities"`): el negocio elige
 * «Encarnación» bien escrita en vez de tipear «encarnacion». Sigue siendo un
 * campo libre para las ciudades que no están en la lista.
 */
export function KnownCitiesDatalist({ id = 'known-cities' }: { id?: string }) {
  return (
    <datalist id={id}>
      {KNOWN_CITY_NAMES.map((city) => <option key={city} value={city} />)}
    </datalist>
  )
}
