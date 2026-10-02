import {
  addProtocol,
  type LngLat,
  type LngLatBoundsLike,
  Map,
  MercatorCoordinate,
  NavigationControl,
  ScaleControl,
  setWorkerUrl,
} from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import { Protocol } from 'pmtiles'
import { east, north, south, west } from './map/friesland'
import { nosStyle } from './map/style'
import { addVideoMarkers } from './map/videoMarkers'
import { createPlayer } from './player'
import './style.css'
import { loadVideos } from './videos'

// Vite bundelt MapLibre, dus de worker staat niet meer naast maplibre-gl.mjs: wijs hem expliciet aan.
setWorkerUrl(workerUrl)
addProtocol('pmtiles', new Protocol().tile)

const PROVINCE: LngLatBoundsLike = [west, south, east, north]
const FIT = { padding: 24 }

const map = new Map({
  container: 'map',
  style: nosStyle(),
  bounds: PROVINCE,
  fitBoundsOptions: FIT,
  maxZoom: 15,
  // Altijd noord boven en plat: geen draaien of kantelen.
  dragRotate: false,
  touchPitch: false,
  maxPitch: 0,
  attributionControl: { compact: true },
  locale: {
    'Map.Title': 'Kaart van Friesland',
    'NavigationControl.ZoomIn': 'Inzoomen',
    'NavigationControl.ZoomOut': 'Uitzoomen',
    'AttributionControl.ToggleAttribution': 'Bronvermelding tonen',
  },
})

map.touchZoomRotate.disableRotation()
map.keyboard.disableRotation()

const NW = MercatorCoordinate.fromLngLat([west, north])
const SE = MercatorCoordinate.fromLngLat([east, south])

/** Houd `value` tussen `min` en `max`; past het beeld er niet tussen, dan precies in het midden. */
const clamp = (value: number, min: number, max: number) =>
  min > max ? (min + max) / 2 : Math.min(Math.max(value, min), max)

/**
 * Schuiven kan alleen zolang de beeldrand binnen de provincie blijft. In het overzicht is het beeld
 * groter dan Friesland en staat het dus vast; pas na inzoomen kun je bewegen. De omgeving is wel
 * te zien, maar nooit ingezoomd: daarvoor zijn alleen grove tegels nodig.
 */
function keepOverProvince(center: LngLat, requestedZoom: number) {
  // Een eigen constrain vervangt ook de standaardbegrenzing van de zoom: doe die dus zelf.
  const zoom = clamp(requestedZoom, map.getMinZoom(), map.getMaxZoom())
  // MapLibre-wereld is 512 px breed op zoom 0.
  const worldSize = 512 * 2 ** zoom
  const { clientWidth, clientHeight } = map.getContainer()
  const dx = clientWidth / 2 / worldSize
  const dy = clientHeight / 2 / worldSize
  const { x, y } = MercatorCoordinate.fromLngLat(center)
  return {
    center: new MercatorCoordinate(
      clamp(x, NW.x + dx, SE.x - dx),
      clamp(y, NW.y + dy, SE.y - dy),
    ).toLngLat(),
    zoom,
  }
}

/** Verder uitzoomen dan de hele provincie kan niet; dat hangt af van de schermvorm. */
function limitToProvince() {
  const overview = map.cameraForBounds(PROVINCE, FIT)
  if (!overview?.center || overview.zoom === undefined) return
  map.setMinZoom(overview.zoom)
  return overview
}

limitToProvince()
map.setTransformConstrain(keepOverProvince)

// Stond de hele provincie in beeld vóór een schermwijziging (zoals het draaien van een telefoon),
// dan blijft dat zo; anders blijft de oude zoom staan en valt een deel van de provincie buiten beeld.
let showingOverview = true
map.on('moveend', () => {
  showingOverview = map.getZoom() - map.getMinZoom() < 0.01
})
map.on('resize', () => {
  const overview = limitToProvince()
  if (overview && showingOverview) map.jumpTo(overview)
})

// De POI-laag van @protomaps/basemaps vraagt iconen (zoals 'townhall') die niet in de sprite staan:
// geef die een leeg plaatje, zodat het label zonder icoon verschijnt en de console schoon blijft.
map.setMissingStyleImageResolver((id) => {
  if (!map.hasImage(id)) map.addImage(id, { width: 1, height: 1, data: new Uint8Array(4) })
})

map.addControl(new NavigationControl({ showCompass: false }), 'top-right')
// In dezelfde hoek als de bronvermelding, zodat die de schaalbalk op smalle schermen niet overlapt.
map.addControl(new ScaleControl({ unit: 'metric' }), 'bottom-right')

loadVideos()
  .then((videos) => {
    const player = createPlayer(videos)
    addVideoMarkers(map, videos, player.open)
    const count = document.querySelector<HTMLElement>('.map-count')!
    count.textContent = videos.length === 1 ? '1 video' : `${videos.length} video's`
    count.hidden = false
  })
  .catch((error) => console.error(error))
