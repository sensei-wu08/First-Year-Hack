import { QRCodeSVG } from 'qrcode.react'
import { useState } from 'react'

/** QR code (ink on white) plus "Copy link" and "Share" pill buttons. */
export function InviteQr({ url, label }: { url: string; label: string }) {
  const [copied, setCopied] = useState(false)
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt('Copy this link', url)
    }
  }

  async function share() {
    try {
      await navigator.share({ title: label, url })
    } catch {
      /* the person closed the share sheet */
    }
  }

  return (
    <div className="invite-qr">
      <div className="invite-qr-code">
        <QRCodeSVG value={url} size={176} level="M" fgColor="currentColor" bgColor="transparent" title={label} />
      </div>
      <p className="invite-qr-label">{label}</p>
      <p className="invite-qr-url">{url}</p>
      <div className="invite-qr-actions">
        <button type="button" className="btn btn-pill" onClick={copy}>
          {copied ? 'Copied' : 'Copy link'}
        </button>
        {canShare && (
          <button type="button" className="btn btn-pill btn-ghost" onClick={share}>
            Share
          </button>
        )}
      </div>
    </div>
  )
}
