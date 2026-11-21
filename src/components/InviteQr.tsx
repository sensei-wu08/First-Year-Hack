import { QRCodeSVG } from 'qrcode.react'
import { useState } from 'react'

/** Ink tile with the QR code (ink on white) plus "Copy link" and "Share" pill buttons. */
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
    <div className="tile bg-ink flex flex-col items-center gap-3 text-center">
      <p className="font-bold">{label}</p>
      <div className="rounded-input bg-white p-3 leading-none text-ink">
        <QRCodeSVG value={url} size={176} level="M" fgColor="currentColor" bgColor="transparent" title={label} />
      </div>
      <p className="sub max-w-full text-caption [overflow-wrap:anywhere]">{url}</p>
      <div className="flex w-full gap-2">
        <button type="button" className="btn w-auto flex-1 py-3" onClick={copy}>
          {copied ? 'Copied' : 'Copy link'}
        </button>
        {canShare && (
          <button type="button" className="btn w-auto flex-1 bg-white py-3" onClick={share}>
            Share
          </button>
        )}
      </div>
    </div>
  )
}
