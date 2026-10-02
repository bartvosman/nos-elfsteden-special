import data from '../data/friesland.json'

/**
 * Omtrek van het provinciegebied van Fryslân (CBS/Kadaster): vasteland, Waddeneilanden, Friese
 * meren en het Friese deel van Waddenzee en IJsselmeer. In [west, zuid, oost, noord] graden.
 */
export const [west, south, east, north] = data.bbox
