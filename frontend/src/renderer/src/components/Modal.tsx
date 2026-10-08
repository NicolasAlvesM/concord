import type { ReactNode } from 'react'

interface ModalProps {
  open: boolean
  title?: string
  onClose?: () => void
  children?: ReactNode
}

function Modal({ open, title, onClose, children }: ModalProps): React.JSX.Element | null {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="glass-card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          {title && <h2 className="text-lg font-semibold text-white">{title}</h2>}
          {onClose && (
            <button
              className="cursor-pointer text-white/60 transition-colors hover:text-white"
              onClick={onClose}
              aria-label="Fechar"
            >
              ✕
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  )
}

export default Modal
