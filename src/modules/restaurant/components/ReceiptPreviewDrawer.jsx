export default function ReceiptPreviewDrawer({ open = false, onClose, children }) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/40">
      <div className="ml-auto h-full w-full max-w-xl bg-background p-4 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Receipt Preview</h3>
          <button type="button" className="text-sm text-muted-foreground hover:text-foreground" onClick={onClose}>Close</button>
        </div>
        {children}
      </div>
    </div>
  )
}

