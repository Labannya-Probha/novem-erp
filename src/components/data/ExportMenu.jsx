import { Download, FileSpreadsheet, Printer } from 'lucide-react'
import { Button } from 'src/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from 'src/components/ui/dropdown-menu'

/**
 * @param {{
 *   onCsv?: () => void
 *   onExcel?: () => void
 *   onPrint?: () => void
 *   disabled?: boolean
 *   className?: string
 * }} props
 */
export default function ExportMenu({ onCsv, onExcel, onPrint, disabled = false, className }) {
  const hasActions = Boolean(onCsv || onExcel || onPrint)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className={className} disabled={disabled || !hasActions} aria-label="Export options">
          <Download className="size-4" aria-hidden="true" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {onCsv ? (
          <DropdownMenuItem onClick={onCsv}>
            <Download className="size-4" /> CSV
          </DropdownMenuItem>
        ) : null}
        {onExcel ? (
          <DropdownMenuItem onClick={onExcel}>
            <FileSpreadsheet className="size-4" /> Excel
          </DropdownMenuItem>
        ) : null}
        {onPrint ? (
          <DropdownMenuItem onClick={onPrint}>
            <Printer className="size-4" /> Print
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
