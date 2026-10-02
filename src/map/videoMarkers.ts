import { type Map as MapLibreMap, Marker } from 'maplibre-gl'
import Supercluster from 'supercluster'
import type { Video } from '../videos'

/** Thumbnails die op het scherm dichter bij elkaar staan dan dit (px), vallen samen tot een stapel. */
const CLUSTER_RADIUS = 64
const FLY_DURATION = 350
const FLY_EASING = 'cubic-bezier(0.2, 0.8, 0.2, 1)'

const PLAY_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg>'

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')

/** Eén marker op de kaart: een losse video of een stapel. `leaves` zijn indexen in `videos`. */
interface Item {
  key: string
  lngLat: [number, number]
  leaves: number[]
  clusterId?: number
}

interface Shown extends Item {
  marker: Marker
  element: HTMLButtonElement
}

/**
 * Zet de video's als thumbnails op de kaart, zoals de kaart in Foto's op de iPhone: wat dicht bij
 * elkaar ligt wordt een stapel met een aantal, en bij inzoomen waaieren de stapels uit.
 */
export function addVideoMarkers(map: MapLibreMap, videos: Video[], onSelect: (video: Video) => void) {
  const index = new Supercluster<{ video: number }>({
    radius: CLUSTER_RADIUS,
    // Op de hoogste zoom staat elke video los (tenzij ze exact op dezelfde plek staan).
    maxZoom: Math.floor(map.getMaxZoom()) - 1,
  })
  index.load(
    videos.map((video, i) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [video.location.lng, video.location.lat] },
      properties: { video: i },
    })),
  )

  let shown = new Map<string, Shown>()
  /** Na het openklikken van een stapel met het toetsenbord: de video waar de focus heen moet. */
  let focusLeaf: number | null = null

  function currentItems(): Item[] {
    return index.getClusters([-180, -85, 180, 85], map.getZoom()).map((feature) => {
      const lngLat = feature.geometry.coordinates as [number, number]
      if (!('cluster' in feature.properties)) {
        const video = feature.properties.video
        return { key: `v${video}`, lngLat, leaves: [video] }
      }
      const clusterId = feature.properties.cluster_id
      const leaves = index
        .getLeaves(clusterId, Infinity)
        .map((leaf) => leaf.properties.video)
        .sort((a, b) => a - b)
      // Dezelfde video's vormen op elk zoomniveau dezelfde sleutel, dus dezelfde marker.
      return { key: `c${leaves[0]}-${leaves.length}`, lngLat, leaves, clusterId }
    })
  }

  function update() {
    const previous = shown
    const next = new Map(currentItems().map((item) => [item.key, item]))
    const oldOwner = ownerOfLeaves(previous)
    const newOwner = ownerOfLeaves(next)
    shown = new Map()

    for (const [key, old] of previous) {
      if (next.has(key)) shown.set(key, old)
      else leave(old, next.get(newOwner.get(old.leaves[0])!))
    }
    for (const [key, item] of next) {
      if (!shown.has(key)) shown.set(key, enter(item, previous.get(oldOwner.get(item.leaves[0])!)))
    }

    if (focusLeaf !== null) {
      shown.get(newOwner.get(focusLeaf)!)?.element.focus({ preventScroll: true })
      focusLeaf = null
    }
  }

  function enter(item: Item, origin?: Item): Shown {
    const element = createElement(item)
    const marker = new Marker({ element, anchor: 'bottom' }).setLngLat(item.lngLat).addTo(map)
    // Bij uitwaaieren vliegen nieuwe markers uit de stapel waar ze in zaten; een nieuwe, grotere
    // stapel verschijnt terwijl de markers erin vliegen.
    if (origin && origin.leaves.length > item.leaves.length) fly(element, origin, item, 'out')
    else if (origin) fadeIn(element)
    return { ...item, marker, element }
  }

  function leave(old: Shown, target?: Item) {
    // Markers die samenvallen vliegen de nieuwe stapel in; een stapel die uitwaaiert verdwijnt direct.
    const merging = target && target.leaves.length > old.leaves.length
    const animation = merging && fly(old.element, old, target, 'in')
    if (animation) animation.onfinish = () => old.marker.remove()
    else old.marker.remove()
  }

  function fly(element: HTMLElement, from: Item, to: Item, direction: 'in' | 'out') {
    if (reducedMotion.matches) return
    const a = map.project(from.lngLat)
    const b = map.project(to.lngLat)
    const card = element.firstElementChild as HTMLElement
    const away = { translate: '0px 0px', scale: 1, opacity: 1 }
    if (direction === 'out') {
      const start = { translate: `${a.x - b.x}px ${a.y - b.y}px`, scale: 0.6, opacity: 1 }
      return card.animate([start, away], { duration: FLY_DURATION, easing: FLY_EASING })
    }
    const end = { translate: `${b.x - a.x}px ${b.y - a.y}px`, scale: 0.6, opacity: 0 }
    element.style.pointerEvents = 'none'
    return card.animate([away, end], { duration: FLY_DURATION, easing: FLY_EASING, fill: 'forwards' })
  }

  function fadeIn(element: HTMLElement) {
    if (reducedMotion.matches) return
    element.firstElementChild!.animate({ opacity: [0, 1] }, { duration: FLY_DURATION, easing: 'ease-in' })
  }

  function createElement(item: Item) {
    const first = videos[item.leaves[0]]
    const count = item.leaves.length
    const button = document.createElement('button')
    button.type = 'button'
    button.className = count > 1 ? 'video-marker video-marker--cluster' : 'video-marker'
    button.setAttribute(
      'aria-label',
      count > 1 ? `${count} video's, zoom in om ze te bekijken` : `Bekijk video: ${first.title}`,
    )
    // Zuidelijke markers liggen over noordelijke, zodat elke punt zichtbaar blijft.
    button.style.setProperty('--stack', String(Math.round((90 - item.lngLat[1]) * 1000)))
    // MapLibre plaatst de marker met een transform op dit element; animaties gaan op de kaart erin.
    button.innerHTML =
      `<span class="video-marker__card"><img alt="" decoding="async">` +
      (count > 1
        ? `<span class="video-marker__count">${count}</span>`
        : `<span class="video-marker__play">${PLAY_ICON}</span>`) +
      `</span>`
    button.querySelector('img')!.src = first.thumbnail
    button.addEventListener('click', () => select(item, button))
    return button
  }

  function select(item: Item, button: HTMLButtonElement) {
    if (item.clusterId === undefined) return onSelect(videos[item.leaves[0]])

    const zoom = Math.min(index.getClusterExpansionZoom(item.clusterId), map.getMaxZoom())
    // Staan ze zelfs op de hoogste zoom nog op één plek, speel dan de eerste af.
    if (zoom <= map.getZoom()) return onSelect(videos[item.leaves[0]])

    if (document.activeElement === button) focusLeaf = item.leaves[0]
    map.easeTo({ center: item.lngLat, zoom })
  }

  update()
  map.on('moveend', update)
}

function ownerOfLeaves(items: Map<string, Item>) {
  const owner = new Map<number, string>()
  for (const [key, item] of items) for (const leaf of item.leaves) owner.set(leaf, key)
  return owner
}
