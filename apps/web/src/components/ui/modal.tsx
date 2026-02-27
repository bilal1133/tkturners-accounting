'use client';

import { ReactNode, useEffect } from 'react';

type ModalProps = {
  open: boolean;
  title: string;
  description?: string;
  size?: 'sm' | 'md' | 'lg';
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
};

const modalSizeClassMap: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'modal-panel-sm',
  md: 'modal-panel-md',
  lg: 'modal-panel-lg',
};

export function Modal({
  open,
  title,
  description,
  size = 'md',
  onClose,
  children,
  footer,
}: ModalProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        className={`modal-panel ${modalSizeClassMap[size]}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <div>
            <h3>{title}</h3>
            {description ? <p className="modal-description">{description}</p> : null}
          </div>
          <button className="ghost-button" type="button" onClick={onClose}>
            Close
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer ? <footer className="modal-footer">{footer}</footer> : null}
      </section>
    </div>
  );
}
