import { layers } from '@protomaps/basemaps'
import type { LayerSpecification, StyleSpecification } from 'maplibre-gl'
import { nosFlavor } from './flavor'

/**
 * Vanaf dit zoomniveau komt de kaart uit de gedetailleerde Friesland-tegels; daaronder uit de
 * grovere tegels van de omgeving. Verder inzoomen kan alleen boven de provincie (zie main.ts).
 */
export const DETAIL_ZOOM = 11

const tiles = (name: string) =>
  `pmtiles://${new URL(`${import.meta.env.BASE_URL}tiles/${name}.pmtiles`, location.href)}`

const ATTRIBUTION =
  '<a href="https://protomaps.com" target="_blank" rel="noopener">Protomaps</a> © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap-bijdragers</a>'

/** De basiskaartlagen voor één bron, alleen zichtbaar binnen [minzoom, maxzoom). */
function basemap(source: string, minzoom: number, maxzoom: number): LayerSpecification[] {
  return layers(source, nosFlavor, { lang: 'nl' })
    .filter((layer) => layer.type !== 'background')
    .map((layer) => ({
      ...layer,
      id: `${source}-${layer.id}`,
      minzoom: Math.max(layer.minzoom ?? 0, minzoom),
      maxzoom: Math.min(layer.maxzoom ?? 24, maxzoom),
    }))
}

export function nosStyle(): StyleSpecification {
  return {
    version: 8,
    name: 'NOS Friesland',
    glyphs: 'https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf',
    sprite: 'https://protomaps.github.io/basemaps-assets/sprites/v4/light',
    sources: {
      surroundings: { type: 'vector', url: tiles('surroundings'), attribution: ATTRIBUTION },
      friesland: { type: 'vector', url: tiles('friesland'), attribution: ATTRIBUTION },
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': nosFlavor.background } },
      ...basemap('surroundings', 0, DETAIL_ZOOM),
      ...basemap('friesland', DETAIL_ZOOM, 24),
    ],
  }
}
