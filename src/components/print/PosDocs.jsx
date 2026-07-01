import {
  formatMoney,
  formatOrderType,
  formatPosDate,
  formatPosTime,
  getCopyProfile,
  getItemModifiers,
  getReceiptCopies,
  normalizeCopyCode,
  posVerifyUrl,
  qrCodeUrl,
  resolvePosBrand,
  resolvePosPrintSettings,
  splitKotBotItems,
} from '../../lib/posPrintEngine'

const line = { borderTop: '1px dashed #000', margin: '6px 0' }
const mono = { fontFamily: '"Noto Sans Bengali", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' }
const cell = { padding: '2px 0', verticalAlign: 'top', fontSize: 10 }
const amountCell = { ...cell, textAlign: 'right', whiteSpace: 'nowrap' }
const labelCell = { ...cell, color: '#000' }

function safeDate(order) {
  return order?.settled_at || order?.created_at || new Date().toISOString()
}

function CopyBadge({ profile }) {
  return (
    <div style={{ border: '1px solid #000', textAlign: 'center', fontWeight: 800, fontSize: 10, padding: '2px 0', letterSpacing: 1 }}>
      {profile.title}
    </div>
  )
}

function QRBlock({ enabled, value, label = 'VERIFY' }) {
  if (!enabled || !value) return null
  return (
    <div style={{ textAlign: 'center', marginTop: 6 }}>
      <img src={qrCodeUrl(value, 86)} alt={label} style={{ width: 64, height: 64, display: 'inline-block' }} />
      <div style={{ fontSize: 8, marginTop: 1 }}>{label}</div>
    </div>
  )
}

function ReceiptHeader({ order, company, profile, settings, invoiceNo }) {
  const brand = resolvePosBrand(company, order)
  const issuedAt = safeDate(order)
  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', marginBottom: 4 }}>
        {settings.showLogo && brand.logoUrl && (
          <img src={brand.logoUrl} alt="" style={{ width: 40, height: 40, objectFit: 'contain', filter: 'grayscale(1) saturate(0) contrast(2)', marginBottom: 3 }} />
        )}
        <div style={{ fontSize: 15, lineHeight: 1.1, fontWeight: 900 }}>{brand.outletName}</div>
        {brand.branchName && <div style={{ fontSize: 9 }}>{brand.branchName}</div>}
        {brand.address && <div style={{ fontSize: 8.5 }}>{brand.address}</div>}
        {(brand.phone || brand.email) && <div style={{ fontSize: 8.5 }}>{[brand.phone, brand.email].filter(Boolean).join(' | ')}</div>}
        {settings.showTaxInfo && (brand.bin || brand.vatRegNo) && (
          <div style={{ fontSize: 8.5 }}>{[brand.bin && `BIN: ${brand.bin}`, brand.vatRegNo && `VAT: ${brand.vatRegNo}`].filter(Boolean).join(' | ')}</div>
        )}
      </div>
      <div style={line} />
      <CopyBadge profile={profile} />
      <table style={{ width: '100%', marginTop: 6, borderCollapse: 'collapse' }}>
        <tbody>
          <tr><td style={labelCell}>Invoice</td><td style={amountCell}>{invoiceNo}</td></tr>
          <tr><td style={labelCell}>Order</td><td style={amountCell}>{order?.order_no || '-'}</td></tr>
          {order?.bill_no && <tr><td style={labelCell}>Bill</td><td style={amountCell}>{order.bill_no}</td></tr>}
          <tr><td style={labelCell}>Type</td><td style={amountCell}>{formatOrderType(order?.order_type)}</td></tr>
          {(order?.guest_name) && <tr><td style={labelCell}>Guest</td><td style={amountCell}>{order.guest_name}</td></tr>}
          {(order?.table_no || order?.room_no || order?.token_no) && (
            <tr>
              <td style={labelCell}>Reference</td>
              <td style={amountCell}>
                {[order?.table_no && `Table ${order.table_no}`, order?.room_no && `Room ${order.room_no}`, order?.token_no && `Token ${order.token_no}`].filter(Boolean).join(' | ')}
              </td>
            </tr>
          )}
          {settings.showWaiter && order?.waiter && <tr><td style={labelCell}>Waiter</td><td style={amountCell}>{order.waiter}</td></tr>}
          {settings.showCashier && (order?.cashier || order?.created_by) && <tr><td style={labelCell}>Cashier</td><td style={amountCell}>{order.cashier || order.created_by}</td></tr>}
          {order?.guest_count && <tr><td style={labelCell}>Guests</td><td style={amountCell}>{order.guest_count}</td></tr>}
          <tr><td style={labelCell}>Date</td><td style={amountCell}>{formatPosDate(issuedAt, settings.timezone)}</td></tr>
          <tr><td style={labelCell}>Time</td><td style={amountCell}>{formatPosTime(issuedAt, settings.timezone)}</td></tr>
          {settings.showTerminal && order?.terminal && <tr><td style={labelCell}>Terminal</td><td style={amountCell}>{order.terminal}</td></tr>}
          {settings.showShift && order?.shift && <tr><td style={labelCell}>Shift</td><td style={amountCell}>{order.shift}</td></tr>}
        </tbody>
      </table>
    </div>
  )
}

function ReceiptItemTable({ items = [], settings }) {
  return (
    <table className="pos-receipt-items" style={{ width: '100%', borderCollapse: 'collapse', marginTop: 6, tableLayout: 'fixed' }}>
      <thead>
        <tr style={{ borderTop: '1px solid #000', borderBottom: '1px solid #000' }}>
          <th style={{ ...cell, textAlign: 'left', width: '46%' }}>Item</th>
          <th style={{ ...cell, textAlign: 'right', width: '12%' }}>Qty</th>
          <th style={{ ...cell, textAlign: 'right', width: '19%' }}>Rate</th>
          <th style={{ ...cell, textAlign: 'right', width: '23%' }}>Amount</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item, index) => {
          const modifiers = getItemModifiers(item)
          return (
            <tr key={`${item.item_name}-${index}`}>
              <td className="pos-item-name" style={cell}>
                <div style={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{item.item_name}</div>
                {modifiers.map((modifier) => (
                  <div key={modifier} style={{ fontSize: 8.5, paddingLeft: 6, overflowWrap: 'anywhere' }}>{modifier}</div>
                ))}
              </td>
              <td className="pos-num" style={amountCell}>{Number(item.qty || 0)}</td>
              <td className="pos-num" style={amountCell}>{Number(item.rate || item.unit_price || 0).toFixed(2)}</td>
              <td className="pos-num" style={amountCell}>{Number(item.line_total || item.total || 0).toFixed(2)}</td>
            </tr>
          )
        })}
        {!items.length && (
          <tr><td colSpan={4} style={{ ...cell, textAlign: 'center' }}>No items</td></tr>
        )}
      </tbody>
      <tfoot>
        <tr><td colSpan={4} style={{ borderTop: '1px solid #000' }} /></tr>
      </tfoot>
    </table>
  )
}

function ReceiptSummary({ order, settings }) {
  const rows = [
    ['Subtotal', order?.base_amount ?? order?.subtotal],
    settings.showDiscount && Number(order?.discount || 0) > 0 ? [`Discount${Number(order?.discount_pct || 0) > 0 ? ` (${order.discount_pct}%)` : ''}`, -Number(order.discount || 0)] : null,
    settings.showServiceCharge ? ['Service charge', order?.service_charge] : null,
    Number(order?.sd || 0) > 0 ? ['SD', order.sd] : null,
    settings.showVat ? ['VAT', order?.vat] : null,
    settings.showRoundOff && Number(order?.rounding || 0) !== 0 ? ['Round off', order.rounding] : null,
  ].filter(Boolean)
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 4 }}>
      <tbody>
        {rows.map(([label, value]) => (
          <tr key={label}>
            <td style={cell}>{label}</td>
            <td style={amountCell}>{Number(value || 0) < 0 ? '-' : ''}{Math.abs(Number(value || 0)).toFixed(2)}</td>
          </tr>
        ))}
        <tr>
          <td style={{ ...cell, borderTop: '1px solid #000', fontSize: 13, fontWeight: 900 }}>GRAND TOTAL</td>
          <td style={{ ...amountCell, borderTop: '1px solid #000', fontSize: 13, fontWeight: 900 }}>{formatMoney(order?.total ?? order?.grand_total, settings.currency)}</td>
        </tr>
      </tbody>
    </table>
  )
}

function PaymentSummary({ order, settings, profile }) {
  if (!profile.showPayment || !settings.showPaymentDetails) return null
  const paymentRows = [
    ['Status', order?.status || 'OPEN'],
    ['Method', order?.payment_method || order?.payment_status || '-'],
    Number(order?.cash_amount || 0) > 0 ? ['Cash', order.cash_amount] : null,
    Number(order?.card_amount || 0) > 0 ? ['Card', order.card_amount] : null,
    Number(order?.mobile_banking_amount || 0) > 0 ? ['Mobile banking', order.mobile_banking_amount] : null,
    Number(order?.received_amount || 0) > 0 ? ['Received', order.received_amount] : null,
    Number(order?.change_amount || 0) > 0 ? ['Change', order.change_amount] : null,
    Number(order?.balance_due || 0) > 0 ? ['Balance due', order.balance_due] : null,
    order?.transaction_ref ? ['Txn Ref', order.transaction_ref] : null,
    order?.settlement_batch ? ['Batch', order.settlement_batch] : null,
  ].filter(Boolean)
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 4 }}>
      <tbody>
        <tr><td colSpan={2} style={{ ...cell, fontWeight: 900, borderTop: '1px dashed #000' }}>PAYMENT</td></tr>
        {paymentRows.map(([label, value]) => (
          <tr key={label}>
            <td style={cell}>{label}</td>
            <td style={amountCell}>{typeof value === 'number' ? Number(value || 0).toFixed(2) : value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function AuditBlock({ order, profile }) {
  if (!profile.showAudit) return null
  return (
    <div style={{ marginTop: 6, borderTop: '1px dashed #000', paddingTop: 4, fontSize: 8.5 }}>
      {order?.department && <div>Department: {order.department}</div>}
      {order?.cost_center && <div>Cost Center: {order.cost_center}</div>}
      {order?.revenue_center && <div>Revenue Center: {order.revenue_center}</div>}
      {order?.audit_no && <div>Audit No: {order.audit_no}</div>}
      {order?.void_reason && <div>Void Reason: {order.void_reason}</div>}
      {order?.approved_by && <div>Approved By: {order.approved_by}</div>}
      {order?.reprint_count > 0 && <div>Reprint Count: {order.reprint_count}</div>}
    </div>
  )
}

function SignatureBlock({ lines = [] }) {
  if (!lines.length) return null
  return (
    <div style={{ display: 'grid', gridTemplateColumns: lines.length > 2 ? '1fr 1fr 1fr' : '1fr 1fr', gap: 6, marginTop: 12 }}>
      {lines.map((label) => (
        <div key={label} style={{ textAlign: 'center', fontSize: 8.5, paddingTop: 14, borderTop: '1px solid #000' }}>{label}</div>
      ))}
    </div>
  )
}

function ThermalFooter({ order, company, settings, profile, verifyUrl }) {
  const brand = resolvePosBrand(company, order)
  const printedAt = new Date().toISOString()
  return (
    <div style={{ textAlign: 'center', marginTop: 8, fontSize: 8.5 }}>
      {settings.loyaltyEnabled && order?.loyalty_points && (
        <div style={{ borderTop: '1px dashed #000', borderBottom: '1px dashed #000', padding: '3px 0', marginBottom: 5 }}>
          Loyalty points earned: {order.loyalty_points}
        </div>
      )}
      <QRBlock enabled={settings.showQr} value={verifyUrl} />
      <div style={{ marginTop: 5, fontWeight: 700 }}>{brand.footerMessage}</div>
      {brand.website && <div>{brand.website}</div>}
      <div>Printed by {order?.printed_by || order?.created_by || 'System'} | {formatPosDate(printedAt, settings.timezone)} | {formatPosTime(printedAt, settings.timezone)}</div>
      {profile.code === 'REPRINT_COPY' && <div>Original print: {order?.original_print_time ? `${formatPosDate(order.original_print_time, settings.timezone)} ${formatPosTime(order.original_print_time, settings.timezone)}` : '-'}</div>}
    </div>
  )
}

export function ThermalReceiptLayout({ order = {}, items = [], company, copyType = 'CUSTOMER_COPY', mushakNo }) {
  const profile = getCopyProfile(copyType)
  const settings = resolvePosPrintSettings(company)
  const invoiceNo = mushakNo || order.invoice_no || order.order_no || '-'
  const verifyUrl = posVerifyUrl(settings, order, invoiceNo)
  const signatureLines = profile.signatureLines && profile.signatureLines.length ? profile.signatureLines : ['Guest Signature']
  return (
    <div
      className={`print-copy ${profile.code !== 'CUSTOMER_COPY' ? 'print-copy-break' : ''}`}
      style={{ ...mono, position: 'relative', boxSizing: 'border-box', maxWidth: '100%', width: '100%', margin: '0 auto', color: '#000', background: '#fff', overflowWrap: 'anywhere' }}
    >
      <ReceiptHeader order={order} company={company} profile={profile} settings={settings} invoiceNo={invoiceNo} />
      <ReceiptItemTable items={items} settings={settings} />
      <ReceiptSummary order={order} settings={settings} />
      <PaymentSummary order={order} settings={settings} profile={profile} />
      <AuditBlock order={order} profile={profile} />
      <SignatureBlock lines={signatureLines} />
      <ThermalFooter order={order} company={company} settings={settings} profile={profile} verifyUrl={verifyUrl} />
    </div>
  )
}

export function POSReceiptCustomerCopy(props) {
  return <ThermalReceiptLayout {...props} copyType="CUSTOMER_COPY" />
}

export function POSReceiptMerchantCopy(props) {
  return <ThermalReceiptLayout {...props} copyType="MERCHANT_COPY" />
}

export function POSReceiptResortCopy(props) {
  return <ThermalReceiptLayout {...props} copyType="RESORT_COPY" />
}

export function DeliveryCopyLayout(props) {
  return <ThermalReceiptLayout {...props} copyType="DELIVERY_COPY" />
}

export function VoidCopyLayout(props) {
  return <ThermalReceiptLayout {...props} copyType="VOID_COPY" />
}

export function ReprintCopyLayout(props) {
  return <ThermalReceiptLayout {...props} copyType="REPRINT_COPY" />
}

export function PosReceipt({ order = {}, items = [], company, mushakNo, copyLabel, singleCopy = false }) {
  if (singleCopy) {
    return <ThermalReceiptLayout order={order} items={items} company={company} mushakNo={mushakNo} copyType={normalizeCopyCode(copyLabel)} />
  }
  return (
    <div className="pos-receipt-copy-stack" style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
      {getReceiptCopies(order, company).map((copyType) => (
        <ThermalReceiptLayout key={copyType} order={order} items={items} company={company} mushakNo={mushakNo} copyType={copyType} />
      ))}
    </div>
  )
}

function TicketItems({ items = [], mode = 'KOT' }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 6 }}>
      <tbody>
        {items.map((item, index) => {
          const modifiers = getItemModifiers(item)
          return (
            <tr key={`${item.item_name}-${index}`} style={{ borderBottom: '1px dashed #000' }}>
              <td style={{ ...cell, width: 36, fontSize: 15, fontWeight: 900 }}>{Number(item.qty || 0)}x</td>
              <td style={{ ...cell, fontSize: 14, fontWeight: 900, overflowWrap: 'anywhere' }}>
                {item.item_name}
                {mode === 'BOT' && item.glass_type && <div style={{ fontSize: 10, fontWeight: 700 }}>Glass: {item.glass_type}</div>}
                {mode === 'BOT' && item.ice_preference && <div style={{ fontSize: 10, fontWeight: 700 }}>Ice: {item.ice_preference}</div>}
                {modifiers.map((modifier) => (
                  <div key={modifier} style={{ fontSize: 10, fontWeight: 700 }}>+ {modifier}</div>
                ))}
                {item.course && <div style={{ fontSize: 10 }}>Course: {item.course}</div>}
                {item.fire_time && <div style={{ fontSize: 10 }}>Fire: {item.fire_time}</div>}
              </td>
            </tr>
          )
        })}
        {!items.length && (
          <tr><td style={{ ...cell, textAlign: 'center' }}>No routed items</td></tr>
        )}
      </tbody>
    </table>
  )
}

export function KOTPrintLayout({ order = {}, items = [], company, stationName = 'Main Kitchen', status = 'New Order', copyType = 'KITCHEN_COPY' }) {
  const settings = resolvePosPrintSettings(company)
  const brand = resolvePosBrand(company, order)
  const profile = getCopyProfile(copyType)
  const issuedAt = order.created_at || new Date().toISOString()
  return (
    <div className="print-copy" style={{ ...mono, boxSizing: 'border-box', maxWidth: '100%', width: '100%', margin: '0 auto', color: '#000', overflowWrap: 'anywhere' }}>
      <CopyBadge profile={profile} />
      <div style={{ textAlign: 'center', borderBottom: '2px solid #000', padding: '4px 0' }}>
        <div style={{ fontSize: 16, fontWeight: 900 }}>{brand.outletName}</div>
        <div style={{ fontSize: 12, fontWeight: 900 }}>{stationName}</div>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 5 }}>
        <tbody>
          <tr><td style={cell}>Order</td><td style={amountCell}>{order.order_no || '-'}</td></tr>
          <tr><td style={cell}>KOT No</td><td style={amountCell}>{order.kot_no || order.order_no || '-'}</td></tr>
          <tr><td style={cell}>Type</td><td style={amountCell}>{formatOrderType(order.order_type)}</td></tr>
          {(order.table_no || order.room_no || order.token_no) && <tr><td style={cell}>Ref</td><td style={amountCell}>{[order.table_no && `Table ${order.table_no}`, order.room_no && `Room ${order.room_no}`, order.token_no && `Token ${order.token_no}`].filter(Boolean).join(' | ')}</td></tr>}
          {order.guest_name && <tr><td style={cell}>Guest</td><td style={amountCell}>{order.guest_name}</td></tr>}
          {order.waiter && <tr><td style={cell}>Waiter</td><td style={amountCell}>{order.waiter}</td></tr>}
          {order.guest_count && <tr><td style={cell}>Covers</td><td style={amountCell}>{order.guest_count}</td></tr>}
          <tr><td style={cell}>Priority</td><td style={{ ...amountCell, fontWeight: 900 }}>{order.priority || 'Normal'}</td></tr>
          <tr><td style={cell}>Order Time</td><td style={amountCell}>{formatPosTime(issuedAt, settings.timezone)}</td></tr>
          <tr><td style={cell}>Print Time</td><td style={amountCell}>{formatPosTime(new Date().toISOString(), settings.timezone)}</td></tr>
        </tbody>
      </table>
      <TicketItems items={items} mode={copyType === 'BAR_COPY' ? 'BOT' : 'KOT'} />
      {order.notes && <div style={{ marginTop: 6, border: '1px solid #000', padding: 4, fontSize: 12, fontWeight: 900 }}>NOTE: {order.notes}</div>}
      {order.allergy_info && <div style={{ marginTop: 4, border: '1px solid #000', padding: 4, fontSize: 12, fontWeight: 900 }}>ALLERGY: {order.allergy_info}</div>}
      <SignatureBlock lines={['Chef Signature', 'Prepared Time', 'Served Time']} />
      <div style={{ textAlign: 'center', marginTop: 6, fontSize: 8.5 }}>Status: {status}</div>
    </div>
  )
}

export function BOTPrintLayout({ order = {}, items = [], company, stationName = 'Bar Station', status = 'New Order' }) {
  return (
    <KOTPrintLayout order={order} items={items} company={company} stationName={stationName} status={status} copyType="BAR_COPY" />
  )
}

export function KitchenTicket({ order = {}, items = [], company }) {
  const { kot } = splitKotBotItems(items)
  return <KOTPrintLayout order={order} items={kot.length ? kot : items} company={company} stationName={order.kitchen_station || 'Main Kitchen'} />
}

export function BarOrderTicket({ order = {}, items = [], company }) {
  const { bot } = splitKotBotItems(items)
  return <BOTPrintLayout order={order} items={bot.length ? bot : items} company={company} stationName={order.bar_station || 'Bar Station'} status={order.ticket_status || 'New Order'} />
}
