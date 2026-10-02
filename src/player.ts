import type Hls from 'hls.js'
import type { Video } from './videos'

const dialog = document.querySelector<HTMLDialogElement>('#player')!
const title = dialog.querySelector<HTMLElement>('.player__title')!
const video = dialog.querySelector<HTMLVideoElement>('.player__video')!
const error = dialog.querySelector<HTMLElement>('.player__error')!

let hls: Hls | null = null

function showError() {
  error.hidden = false
}

/** Opent de modal en speelt de HLS-stream af in de native videospeler. */
export async function openVideo(item: Video) {
  title.textContent = item.title
  video.poster = item.thumbnail
  error.hidden = true
  dialog.showModal()

  // hls.js is groot en pas nodig bij de eerste video: laad het dan pas.
  const { default: Hls } = await import('hls.js')
  if (!dialog.open) return // al gesloten tijdens het laden

  if (Hls.isSupported()) {
    hls = new Hls()
    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (data.fatal) showError()
    })
    hls.loadSource(item.video_url)
    hls.attachMedia(video)
  } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
    // Safari op oudere iPhones heeft geen MediaSource, maar speelt HLS zelf af.
    video.src = item.video_url
  } else {
    showError()
    return
  }

  // Autoplay kan geblokkeerd worden; de bediening van de speler blijft dan gewoon werken.
  video.play().catch(() => {})
}

video.addEventListener('error', () => {
  if (!hls) showError() // bij hls.js meldt de ERROR-handler hierboven al fatale fouten
})

dialog.addEventListener('close', () => {
  video.pause()
  hls?.destroy()
  hls = null
  video.removeAttribute('src')
  video.load()
})

// Klik op de achtergrond sluit de modal; de inhoud vangt klikken daarbinnen af.
dialog.addEventListener('click', (event) => {
  if (event.target === dialog) dialog.close()
})
