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
    ;(async () => {
      try {
        const stream = await openCamera(facing)
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        stop()
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
    <div className="cam-screen">
      <div className="cam-top">
        <h2 className="cam-title">Post your fit</h2>
        {onCancel && (
          <button type="button" className="cam-chip" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>

      <div className="cam-viewfinder">
        {shot ? (
          <img className="cam-media" src={shot.url} alt="Your fit, ready to post" />
        ) : (
          <video ref={videoRef} className="cam-media" playsInline muted autoPlay />
        )}
        {status === 'error' && (
          <div className="cam-error" role="alert">
            <p>{error}</p>
            <button type="button" className="btn cam-retry" onClick={() => setAttempt((n) => n + 1)}>
              Retry
            </button>
          </div>
        )}
        {status === 'starting' && !shot && <p className="cam-status">Starting camera…</p>}
        <span className="cam-chip cam-live">Live only</span>
      </div>

      {shot ? (
        <div className="cam-actions">
          <button type="button" className="btn btn-ghost cam-ghost" onClick={() => setShot(null)}>
            Retake
          </button>
          <button type="button" className="btn cam-primary" onClick={() => onCapture(shot.blob)}>
            Post my fit
          </button>
        </div>
      ) : (
        <div className="cam-shutter-row">
          <button
            type="button"
            className="cam-side"
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
          <span className="cam-side" aria-hidden="true" />
        </div>
      )}
    </div>
  )
}
