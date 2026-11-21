/** Scales (w, h) so the longest edge is at most `max`. Keeps aspect ratio, never upscales. */
export function fitWithin(w: number, h: number, max = 1280): { width: number; height: number } {
  const longest = Math.max(w, h)
  if (longest <= max) return { width: w, height: h }
  const scale = max / longest
  return { width: Math.round(w * scale), height: Math.round(h * scale) }
}

/** Draws the current video frame to a canvas and returns it as a JPEG (quality 0.8). */
export function captureFrame(video: HTMLVideoElement, max = 1280): Promise<Blob> {
  const { width, height } = fitWithin(video.videoWidth, video.videoHeight, max)
  if (!width || !height) return Promise.reject(new Error('The camera is not ready yet.'))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.reject(new Error('Could not process the photo.'))
  ctx.drawImage(video, 0, 0, width, height)
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not process the photo.'))),
      'image/jpeg',
      0.8,
    )
  })
}
