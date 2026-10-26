type Props = {
  message: string | null
  onDismiss?: () => void
}

export function ErrorBanner({ message, onDismiss }: Props) {
  if (!message) return null
  return (
    <div className="error-banner" role="alert">
      <div>
        <strong>Preview issue</strong>
        <p>{message}</p>
        <p className="error-hint">
          Place a satellite photo at <code>public/assets/site-satellite.jpg</code>{' '}
          (see project.json imagery path).
        </p>
      </div>
      {onDismiss ? (
        <button type="button" onClick={onDismiss}>
          Dismiss
        </button>
      ) : null}
    </div>
  )
}
