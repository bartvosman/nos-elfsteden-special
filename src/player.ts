import type Hls from 'hls.js'
import type { Video } from './videos'

/** Zo lang (ms) moet het swipen stilstaan voordat de video op de nieuwe slide gaat spelen. */
const SETTLE_DELAY = 150

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')

const dialog = document.querySelector<HTMLDialogElement>('#player')!
const track = dialog.querySelector<HTMLElement>('.carousel__track')!
const counter = dialog.querySelector<HTMLElement>('.player__counter')!
const prev = dialog.querySelector<HTMLButtonElement>('.carousel__nav--prev')!
const next = dialog.querySelector<HTMLButtonElement>('.carousel__nav--next')!

/**
 * Een carousel met alle video's in de modal. Er is één videospeler, die meeschuift naar de actieve
 * slide; de andere slides tonen hun thumbnail, zodat er nooit meer dan één stream laadt.
 */
export function createPlayer(videos: Video[]) {
  const video = document.createElement('video')
  video.className = 'carousel__video'
  video.controls = true
  video.playsInline = true

  const error = document.createElement('p')
  error.className = 'carousel__error'
  error.setAttribute('role', 'alert')
  error.textContent = 'Deze video kan nu niet worden afgespeeld.'
  error.hidden = true

  const slides = videos.map(createSlide)
  track.replaceChildren(...slides)

  let hls: Hls | null = null
  let active = -1
  /** De slide waar de pijlen naartoe schuiven, ook als het schuiven nog bezig is. */
  let goal = 0
  /** Voorkomt dat een trage hls.js-import een video start op een slide die al voorbij is. */
  let loading = 0
  let settleTimer = 0

  function createSlide(item: Video, i: number) {
    const slide = document.createElement('figure')
    slide.className = 'carousel__slide'
    slide.setAttribute('role', 'group')
    slide.setAttribute('aria-roledescription', 'slide')
    slide.setAttribute('aria-label', `${i + 1} van ${videos.length}: ${item.title}`)
    slide.innerHTML =
      '<div class="carousel__screen"><img alt="" loading="lazy" decoding="async"></div>' +
      '<figcaption class="carousel__title"></figcaption>'
    slide.querySelector('img')!.src = item.thumbnail
    slide.querySelector('figcaption')!.textContent = item.title
    // Een klik op een buur-slide schuift die naar het midden.
    slide.addEventListener('click', () => {
      if (i !== active) scrollTo(i)
    })
    return slide
  }

  function scrollTo(i: number, behavior: ScrollBehavior = reducedMotion.matches ? 'instant' : 'smooth') {
    goal = i
    const slide = slides[i]
    track.scrollTo({ left: slide.offsetLeft - (track.clientWidth - slide.offsetWidth) / 2, behavior })
  }

  function go(delta: number) {
    scrollTo(Math.min(Math.max(goal + delta, 0), slides.length - 1))
  }

  /** De slide die het dichtst bij het midden van de carousel staat. */
  function centered() {
    const center = track.scrollLeft + track.clientWidth / 2
    let best = 0
    for (const [i, slide] of slides.entries()) {
      const distance = Math.abs(slide.offsetLeft + slide.offsetWidth / 2 - center)
      if (distance < Math.abs(slides[best].offsetLeft + slides[best].offsetWidth / 2 - center)) best = i
    }
    return best
  }

  function activate(i: number) {
    if (i === active) return
    slides[active]?.classList.remove('is-active')
    active = goal = i
    slides[i].classList.add('is-active')
    counter.textContent = `${i + 1} / ${videos.length}`
    // Een knop die uitgaat terwijl hij de focus heeft, geeft die door aan de andere pijl; anders
    // valt de focus buiten de modal en werken de pijltjestoetsen niet meer.
    const atStart = i === 0
    const atEnd = i === slides.length - 1
    if (atStart && document.activeElement === prev) next.focus()
    if (atEnd && document.activeElement === next) prev.focus()
    prev.disabled = atStart
    next.disabled = atEnd

    stop()
    slides[i].querySelector('.carousel__screen')!.append(video, error)
    video.poster = videos[i].thumbnail
    error.hidden = true
    play(videos[i])
  }

  async function play(item: Video) {
    const attempt = ++loading
    // hls.js is groot en pas nodig bij de eerste video: laad het dan pas.
    const { default: Hls } = await import('hls.js')
    if (attempt !== loading || !dialog.open) return

    if (Hls.isSupported()) {
      hls = new Hls()
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) error.hidden = false
      })
      hls.loadSource(item.video_url)
      hls.attachMedia(video)
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari op oudere iPhones heeft geen MediaSource, maar speelt HLS zelf af.
      video.src = item.video_url
    } else {
      error.hidden = false
      return
    }

    // Autoplay kan geblokkeerd worden; de bediening van de speler blijft dan gewoon werken.
    video.play().catch(() => {})
  }

  function stop() {
    loading++
    video.pause()
    hls?.destroy()
    hls = null
    video.removeAttribute('src')
    video.load()
  }

  video.addEventListener('error', () => {
    if (!hls && video.hasAttribute('src')) error.hidden = false // hls.js meldt fouten zelf
  })

  // Na het swipen of scrollen speelt de video van de slide die in het midden blijft staan.
  track.addEventListener(
    'scroll',
    () => {
      clearTimeout(settleTimer)
      settleTimer = window.setTimeout(() => activate(centered()), SETTLE_DELAY)
    },
    { passive: true },
  )

  prev.addEventListener('click', () => go(-1))
  next.addEventListener('click', () => go(1))

  dialog.addEventListener('keydown', (event) => {
    // Met de focus op de video zijn de pijltjes voor spoelen.
    if (event.target instanceof HTMLVideoElement) return
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault()
      go(event.key === 'ArrowLeft' ? -1 : 1)
    }
  })

  dialog.addEventListener('close', () => {
    clearTimeout(settleTimer)
    stop()
    slides[active]?.classList.remove('is-active')
    active = -1
  })

  // Klik naast de slides sluit de modal.
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog || event.target === track) dialog.close()
  })

  return {
    /** Opent de carousel op deze video. */
    open(item: Video) {
      const i = videos.indexOf(item)
      dialog.showModal()
      scrollTo(i, 'instant')
      activate(i)
    },
  }
}
