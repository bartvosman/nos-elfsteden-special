// Maakt de kaarttegels in public/tiles/ uit een dagelijkse Protomaps-planetbuild:
//   friesland.pmtiles     straatniveau (z0-13) voor de provincie
//   surroundings.pmtiles  grof (z0-10) voor de omgeving
// De kaart zoomt alleen boven de provincie verder in dan z10 (zie src/main.ts).
//
// Gebruik:
//   npm run tiles                  standaard-build hieronder (of de nieuwste als die weg is)
//   npm run tiles -- 20261005      een specifieke build (JJJJMMDD)
//   node scripts/tiles.mjs --if-missing
//                                  niets doen als de tegels er al zijn (predev/prebuild,
//                                  zodat ook Railway ze bij elke build zelf maakt)
//
// Heeft de machine geen `pmtiles`-CLI, dan wordt de officiële release van GitHub gedownload
// (checksum gecontroleerd) naar node_modules/.cache. Er is dus geen brew of curl nodig.
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { chmodSync, existsSync, mkdirSync, openSync, readSync, closeSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Builds hebben het Protomaps-tegelschema v4 nodig, passend bij @protomaps/basemaps v5. */
const DEFAULT_BUILD = '20260928'
const TILESETS = [
  // Heel Fryslân incl. Vlieland (~4,85°O) en Schiermonnikoog (~6,35°O), met marge. z13 ≈ 52 MB.
  { name: 'friesland', bbox: '4.60,52.60,6.60,53.65', maxzoom: 13 },
  // Wat het overzicht rond de provincie kan tonen, van hoge telefoons tot 32:9-schermen. ≈ 19 MB.
  { name: 'surroundings', bbox: '3.20,51.80,8.10,54.50', maxzoom: 10 },
]

const PMTILES_VERSION = '1.31.2'
const PMTILES_RELEASES = {
  'linux-x64': ['go-pmtiles_1.31.2_Linux_x86_64.tar.gz', '3ed7dbf4ec2e6dfe5e25b6f70d1ffc932729f93c86db353bf514dd71010a312f'],
  'linux-arm64': ['go-pmtiles_1.31.2_Linux_arm64.tar.gz', 'f8bd47e7ea866863489cad588fbaf2f31f42e5821f7a03f009b3769f05801cb1'],
  'darwin-arm64': ['go-pmtiles-1.31.2_Darwin_arm64.zip', '40528f7f616fcbf91207cd48c8fc023d213f6d86c0cbf1f748732803d1880f3d'],
  'darwin-x64': ['go-pmtiles-1.31.2_Darwin_x86_64.zip', '1f0dc02eee6c58312dd6c509faee1b5c32f0596568af1bf51f1b034e7a88a65b'],
}

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const OUT_DIR = join(ROOT, 'public/tiles')
const CACHE_DIR = join(ROOT, 'node_modules/.cache/pmtiles', PMTILES_VERSION)

const args = process.argv.slice(2)
const ifMissing = args.includes('--if-missing')
const requestedBuild = args.find((arg) => !arg.startsWith('--'))

function isPmtiles(file) {
  try {
    const fd = openSync(file, 'r')
    const header = Buffer.alloc(7)
    readSync(fd, header, 0, header.length, 0)
    closeSync(fd)
    return header.toString('latin1') === 'PMTiles'
  } catch {
    return false
  }
}

function run(command, commandArgs) {
  const result = spawnSync(command, commandArgs, { stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`${command} ${commandArgs[0]} stopte met code ${result.status}`)
}

/** De pmtiles-CLI van de machine, of anders de officiële release in de cache. */
async function pmtilesCli() {
  if (!spawnSync('pmtiles', ['version'], { stdio: 'ignore' }).error) return 'pmtiles'

  const binary = join(CACHE_DIR, 'pmtiles')
  if (existsSync(binary)) return binary

  const release = PMTILES_RELEASES[`${process.platform}-${process.arch}`]
  if (!release) {
    throw new Error(
      `Geen pmtiles-release voor ${process.platform}-${process.arch}. Installeer de CLI zelf: ` +
        'https://github.com/protomaps/go-pmtiles/releases',
    )
  }
  const [asset, sha256] = release
  const url = `https://github.com/protomaps/go-pmtiles/releases/download/v${PMTILES_VERSION}/${asset}`
  console.log(`pmtiles-CLI downloaden: ${url}`)
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Download mislukt (${response.status}): ${url}`)
  const archive = Buffer.from(await response.arrayBuffer())
  const actual = createHash('sha256').update(archive).digest('hex')
  if (actual !== sha256) throw new Error(`Checksum klopt niet voor ${asset}: ${actual}`)

  mkdirSync(CACHE_DIR, { recursive: true })
  const archivePath = join(CACHE_DIR, asset)
  writeFileSync(archivePath, archive)
  // tar pakt .tar.gz uit; de bsdtar van macOS kan ook .zip aan.
  run('tar', ['-xf', archivePath, '-C', CACHE_DIR, 'pmtiles'])
  rmSync(archivePath)
  chmodSync(binary, 0o755)
  return binary
}

/** De gevraagde build, of de nieuwste met schema v4 als die (nog) niet bestaat. */
async function resolveBuild(build) {
  const url = (key) => `https://build.protomaps.com/${key}.pmtiles`
  if ((await fetch(url(build), { method: 'HEAD' })).ok) return url(build)

  // Dagelijkse builds blijven maar kort staan: val terug op de nieuwste die er wel is.
  const response = await fetch('https://build-metadata.protomaps.dev/builds.json')
  if (!response.ok) throw new Error(`Protomaps-buildlijst niet bereikbaar (${response.status})`)
  const builds = await response.json()
  const latest = builds.filter((b) => b.version?.startsWith('4.')).at(-1)
  if (!latest) throw new Error('Geen Protomaps-build met tegelschema v4 gevonden')
  const key = latest.key.replace(/\.pmtiles$/, '')
  console.log(`Build ${build} bestaat niet meer, ik gebruik de nieuwste: ${key}`)
  return url(key)
}

const outputs = TILESETS.map((tileset) => join(OUT_DIR, `${tileset.name}.pmtiles`))
if (ifMissing && outputs.every(isPmtiles)) process.exit(0)

const build = requestedBuild ?? DEFAULT_BUILD
if (!/^\d{8}$/.test(build)) {
  console.error(`De build-datum moet JJJJMMDD zijn, niet '${build}'`)
  process.exit(1)
}

try {
  const cli = await pmtilesCli()
  const source = await resolveBuild(build)
  mkdirSync(OUT_DIR, { recursive: true })

  for (const [i, { name, bbox, maxzoom }] of TILESETS.entries()) {
    const tmp = join(OUT_DIR, `.${name}.pmtiles.tmp`)
    console.log(`\n${name}: bbox=${bbox} maxzoom=${maxzoom}`)
    try {
      run(cli, ['extract', source, tmp, `--bbox=${bbox}`, `--maxzoom=${maxzoom}`])
      renameSync(tmp, outputs[i])
    } finally {
      rmSync(tmp, { force: true })
    }
    if (!isPmtiles(outputs[i])) throw new Error(`${outputs[i]} is geen geldig PMTiles-bestand`)
  }
} catch (error) {
  console.error(`\nKaarttegels maken mislukt: ${error.message}`)
  process.exit(1)
}
