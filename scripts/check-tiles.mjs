// Stopt `npm run dev` en `npm run build` met een duidelijke melding als de kaarttegels ontbreken.
// public/tiles/*.pmtiles staat niet in git; zonder deze bestanden blijft de kaart leeg.
import { closeSync, openSync, readSync } from 'node:fs'

const FILES = ['public/tiles/friesland.pmtiles', 'public/tiles/surroundings.pmtiles']

function startsWithMagic(file) {
  try {
    const fd = openSync(new URL(`../${file}`, import.meta.url), 'r')
    const header = Buffer.alloc(7)
    readSync(fd, header, 0, header.length, 0)
    closeSync(fd)
    return header.toString('latin1') === 'PMTiles'
  } catch {
    return false
  }
}

const missing = FILES.filter((file) => !startsWithMagic(file))
if (missing.length) {
  console.error(`\n${missing.join(' en ')} ontbreekt of is geen PMTiles-bestand.`)
  console.error('Maak de tegels aan met `npm run tiles` (vereist de pmtiles-CLI, zie scripts/tiles.sh).\n')
  process.exit(1)
}
