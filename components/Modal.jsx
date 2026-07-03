'use client';
import PropTypes from 'prop-types';

/**
 * Shared modal shell for form dialogs (Income, Vehicles, ...).
 * Uses a native <dialog> instead of a div with role="dialog" for a11y,
 * and renders the backdrop with no role/listeners (no click-outside-to-close,
 * matching DeleteConfirmDialog / CompleteReminderDialog).
 */
export default function Modal({ open, labelledBy, children }) {
  if (!open) return null;

  return (
    <div className="modal-backdrop">
      <dialog className="modal" open aria-modal="true" aria-labelledby={labelledBy}>
        {children}
      </dialog>
    </div>
  );
}

Modal.propTypes = {
  open: PropTypes.bool.isRequired,
  labelledBy: PropTypes.string,
  children: PropTypes.node.isRequired,
};
