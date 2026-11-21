import { useCallback, useEffect, useRef, useState } from 'react'
import { cameraErrorMessage, openCamera, type Facing } from '../lib/camera'
import { captureFrame } from '../lib/image'

type Status = 'starting' | 'live' | 'error'

/** Full-screen live capture. Camera only: there is deliberately no file or gallery picker. */
export function Camera({ onCapture, onCancel }: { onCapture(blob: Blob): void; onCancel?(): void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [facing, setFacing] = useState<Facing>('user')
  const [attempt, setAttempt] = useState(0)
  const [status, setStatus] = useState<Status>('starting')
  const [error, setError] = useState('')
  const [shot, setShot] = useState<{ blob: Blob; url: string } | null>(null)

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  // Starts (or restarts) the stream when the facing mode changes or the user taps Retry.
  useEffect(() => {
    let cancelled = false
    setStatus('starting')
    // Release the current camera first: many phones only allow one open camera at a time.
    stop()
    if (videoRef.current) videoRef.current.srcObject = null
    ;(async () => {
      try {
        const stream = await openCamera(facing)
        if (cancelled) {
          // Unmounted, or flipped again, while the camera was opening: don't keep the late stream.
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        setStatus('live')
      } catch (e) {
        if (cancelled) return
        setError(cameraErrorMessage(e))
        setStatus('error')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [facing, attempt, stop])

  // Attaches the stream to the video element whenever it is shown (also after a retake).
  useEffect(() => {
    const video = videoRef.current
    if (status === 'live' && !shot && video && streamRef.current) {
      video.srcObject = streamRef.current
      void video.play().catch(() => {})
    }
  }, [status, shot])

  // Stop the camera on unmount.
  useEffect(() => stop, [stop])

  // Free the preview object URL when it is replaced or the screen closes.
  useEffect(() => {
    if (!shot) return
    return () => URL.revokeObjectURL(shot.url)
  }, [shot])

  // Escape cancels, when the host gave us a way to.
  useEffect(() => {
    if (!onCancel) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  async function takePhoto() {
    if (!videoRef.current) return
    try {
      const blob = await captureFrame(videoRef.current)
      setShot({ blob, url: URL.createObjectURL(blob) })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not take the photo. Try again.')
      setStatus('error')
    }
  }

  return (
    <div className="cam-screen set-capture" role="dialog" aria-modal="true" aria-label="Post your fit">
      <div className="app-col flex min-h-0 flex-1 flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <h2 className="h-tile">Post your fit</h2>
          {onCancel && (
            <button type="button" className="chip" onClick={onCancel}>
              Cancel
            </button>
          )}
        </div>

        <div className="viewfinder min-h-0 flex-1">
          {shot ? (
            <img className="absolute inset-0 size-full object-cover" src={shot.url} alt="Your fit, ready to post" />
          ) : (
            <video ref={videoRef} className="absolute inset-0 size-full object-cover" playsInline muted autoPlay />
          )}
          {status === 'starting' && !shot && (
            <p className="sub absolute inset-0 grid place-items-center">Starting camera…</p>
          )}
          {status === 'error' && (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-ink p-6 text-center"
              role="alert"
            >
              <p className="text-[length:var(--text-name)] font-semibold">{error}</p>
              <button type="button" className="btn w-auto" onClick={() => setAttempt((n) => n + 1)}>
                Retry
              </button>
            </div>
          )}
          <div className="absolute inset-x-3.5 top-3.5 flex justify-end">
            <span className="chip bg-lime">Live only</span>
          </div>
          {!shot && status === 'live' && (
            <span aria-hidden="true" className="sticker-sparkle absolute bottom-4 left-4 right-auto size-10 bg-pink" />
          )}
        </div>

        {shot ? (
          <div className="grid grid-cols-[1fr_2fr] gap-2.5 pt-2">
            <button type="button" className="btn btn-ghost" onClick={() => setShot(null)}>
              Retake
            </button>
            <button type="button" className="btn" onClick={() => onCapture(shot.blob)}>
              Post my fit
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-[1fr_auto_1fr] items-center px-4 pt-2 pb-1 font-bold">
            <button
              type="button"
              className="justify-self-start py-2.5"
              onClick={() => setFacing((f) => (f === 'user' ? 'environment' : 'user'))}
            >
              Flip
            </button>
            <button
              type="button"
              className="cam-shutter"
              aria-label="Take photo"
              disabled={status !== 'live'}
              onClick={() => void takePhoto()}
            />
            <span aria-hidden="true" />
          </div>
        )}
      </div>
    </div>
  )
}
