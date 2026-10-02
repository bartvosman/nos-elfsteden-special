export interface Video {
  id: string
  title: string
  location: { lat: number; lng: number }
  thumbnail: string
  /** HLS-stream (.m3u8) */
  video_url: string
}

/** Voorlopig een statisch bestand in public/; later kan hier het endpoint van de backend staan. */
const VIDEOS_URL = `${import.meta.env.BASE_URL}data/videos.json`

export async function loadVideos(): Promise<Video[]> {
  const response = await fetch(VIDEOS_URL)
  if (!response.ok) throw new Error(`Video's laden mislukt (${response.status}): ${VIDEOS_URL}`)
  return response.json()
}
