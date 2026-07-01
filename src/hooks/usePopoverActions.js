import { usePopover } from '../contexts/PopoverContext'

/**
 * Hook for common popover use cases
 * Provides pre-configured methods for notifications, confirmations, and actions
 */
export function usePopoverActions() {
  const { notify, confirm } = usePopover()

  return {
    // Simple notifications
    success: (message, duration = 4000) =>
      notify({ title: 'Success', content: message, subType: 'success', duration }),
    
    info: (message, duration = 4000) =>
      notify({ title: 'Info', content: message, subType: 'info', duration }),
    
    warning: (message, duration = 4000) =>
      notify({ title: 'Warning', content: message, subType: 'warning', duration }),
    
    error: (message, duration = 4000) =>
      notify({ title: 'Error', content: message, subType: 'error', duration }),

    // Confirmation dialog
    confirmAction: (title, content, onConfirm, onCancel, confirmLabel = 'Confirm', cancelLabel = 'Cancel') =>
      confirm({
        title,
        content,
        onConfirm,
        onCancel,
        confirmLabel,
        cancelLabel,
      }),

    // Delete confirmation
    confirmDelete: (itemName, onConfirm, onCancel) =>
      confirm({
        title: 'Delete Confirmation',
        content: `Are you sure you want to delete "${itemName}"? This action cannot be undone.`,
        onConfirm,
        onCancel,
        confirmLabel: 'Delete',
        cancelLabel: 'Cancel',
      }),

    // Save confirmation
    confirmSave: (changes, onConfirm, onCancel) =>
      confirm({
        title: 'Confirm Changes',
        content: typeof changes === 'string' ? changes : `You have ${changes} unsaved changes. Save now?`,
        onConfirm,
        onCancel,
        confirmLabel: 'Save',
        cancelLabel: 'Discard',
      }),
  }
}
