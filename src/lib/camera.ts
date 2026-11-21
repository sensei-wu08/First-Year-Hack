/** Turns a getUserMedia failure into a fix-it message. */
export function cameraErrorMessage(err: unknown): string {
  const name = typeof err === 'object' && err !== null && 'name' in err ? String((err as { name: unknown }).name) : ''
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
    case 'PermissionDeniedError':
      return 'Camera blocked. Allow camera access in your browser settings to post your fit.'
    case 'NotFoundError':
    case 'DevicesNotFoundError':
    case 'OverconstrainedError':
      return 'No camera found on this device.'
    case 'NotReadableError':
    case 'TrackStartError':
      return 'Your camera is in use by another app. Close it, then retry.'
    case 'TypeError':
      return 'Camera needs a secure connection. Open this page over https to post your fit.'
    default:
      return 'Could not start the camera. Try again.'
  }
}

export type Facing = 'user' | 'environment'

/** Opens the live camera. Never falls back to a file or gallery picker. */
export async function openCamera(facing: Facing): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) throw new TypeError('mediaDevices undefined')
  return navigator.mediaDevices.getUserMedia({ video: { facingMode: facing }, audio: false })
}
