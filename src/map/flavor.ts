import { type Flavor, namedFlavor } from '@protomaps/basemaps'

/**
 * NOS Sport-palet, zoals op nos.nl/sport en in de Zandvoort-special.
 * De `--nos-*` tokens in src/style.css gebruiken dezelfde waarden.
 */
export const NOS = {
  page: '#202020',
  ink: '#f2f2f5',
  muted: '#a1a1ac',
  faint: '#6b6b76',
  blue: '#284bbe',
  red: '#e61e14',
  land: '#262626',
  /** Donkere tint van NOS-blauw, zodat water en ijs herkenbaar blauw blijven. */
  water: '#1b2a5c',
} as const

const dark = namedFlavor('dark')
const halo = NOS.page

/** De donkere Protomaps-flavor met NOS Sport-kleuren voor land, water en labels. */
export const nosFlavor: Flavor = {
  ...dark,
  background: NOS.water,
  earth: NOS.land,
  water: NOS.water,
  pier: NOS.land,
  runway: '#3a3a3a',

  // Wegen iets lichter dan standaard, zodat ze op het donkere land leesbaar blijven.
  other: '#363636',
  minor_service: '#363636',
  minor_a: '#3d3d3d',
  minor_b: '#363636',
  link: '#454545',
  major: '#4a4a4a',
  highway: '#5a5a5a',
  bridges_other: '#363636',
  bridges_minor: '#3d3d3d',
  bridges_link: '#454545',
  bridges_major: '#4a4a4a',
  bridges_highway: '#5a5a5a',
  railway: '#141414',
  boundaries: '#5a5a66',

  city_label: NOS.ink,
  city_label_halo: halo,
  subplace_label: NOS.muted,
  subplace_label_halo: halo,
  roads_label_minor: NOS.faint,
  roads_label_minor_halo: halo,
  roads_label_major: NOS.muted,
  roads_label_major_halo: halo,
  ocean_label: '#8ea2de',
  state_label: NOS.faint,
  state_label_halo: halo,
  country_label: NOS.muted,
  address_label: NOS.faint,
  address_label_halo: halo,

  // Eén neutrale tint voor alle POI-labels, zodat ze niet concurreren met de video's.
  pois: {
    blue: NOS.faint,
    green: NOS.faint,
    lapis: NOS.faint,
    pink: NOS.faint,
    red: NOS.faint,
    slategray: NOS.faint,
    tangerine: NOS.faint,
    turquoise: NOS.faint,
  },
}
