import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../supabase'
import { setCurrency } from '../../lib/helpers'
import { getTenantId } from '../../lib/tenant'
import { Save, Building2, Image, Upload, ChevronDown } from 'lucide-react'

function RichTextEditor({ initialHtml, onSave, saveLabel = 'Save' }) {
  const editorRef = useRef(null)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [preview, setPreview] = useState(false)
  const [previewHtml, setPreviewHtml] = useState('')

  // Set content ONCE on mount via ref — never via dangerouslySetInnerHTML
  // This avoids React re-rendering the div and resetting cursor position
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = initialHtml || ''
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Toolbar button handler — MUST use onMouseDown + preventDefault
  // so the editor div never loses focus before execCommand fires
  const cmd = (command, value = null) => (e) => {
    e.preventDefault()        // stop button from blurring the editor
    e.stopPropagation()
    editorRef.current?.focus() // ensure editor has focus
    document.execCommand(command, false, value)
    editorRef.current?.focus() // restore focus after command (some browsers lose it)
  }

  const handleSave = async () => {
    const html = editorRef.current?.innerHTML || ''
    setSaving(true)
    await onSave(html)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const togglePreview = () => {
    const html = editorRef.current?.innerHTML || ''
    setPreviewHtml(html)
    setPreview((v) => !v)
  }

  const Btn = ({ command, value, title, children }) => (
    <button
      type="button"
      title={title}
      onMouseDown={cmd(command, value)}
      className="w-8 h-8 flex items-center justify-center rounded text-pine/50 hover:bg-leaf hover:text-forest transition-colors select-none"
    >
      {children}
    </button>
  )

  const Sep = () => <div className="w-px h-5 bg-pine/15 mx-0.5 shrink-0" />

  return (
    <div className="border border-leaf rounded-xl overflow-hidden shadow-sm">

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 bg-stone-50 border-b border-leaf">

        {/* Text style */}
        <Btn command="bold"      title="Bold (Ctrl+B)">      <strong>B</strong></Btn>
        <Btn command="italic"    title="Italic (Ctrl+I)">    <em>I</em></Btn>
        <Btn command="underline" title="Underline (Ctrl+U)"> <span className="underline">U</span></Btn>
        <Btn command="strikeThrough" title="Strikethrough">  <span className="line-through">S</span></Btn>
        <Sep />

        {/* Block format */}
        <Btn command="formatBlock" value="h2"  title="Heading 1"> <span className="text-xs font-bold">H1</span></Btn>
        <Btn command="formatBlock" value="h3"  title="Heading 2"> <span className="text-xs font-bold">H2</span></Btn>
        <Btn command="formatBlock" value="p"   title="Paragraph"> <span className="text-xs">¶</span></Btn>
        <Sep />

        {/* Lists */}
        <Btn command="insertUnorderedList" title="Bullet list">  <span className="text-sm">•≡</span></Btn>
        <Btn command="insertOrderedList"   title="Numbered list"><span className="text-sm">1≡</span></Btn>
        <Btn command="outdent"  title="Decrease indent"> <span className="text-sm">←</span></Btn>
        <Btn command="indent"   title="Increase indent"> <span className="text-sm">→</span></Btn>
        <Sep />

        {/* Alignment */}
        <Btn command="justifyLeft"   title="Align left">   <span className="text-xs">◀═</span></Btn>
        <Btn command="justifyCenter" title="Align center"> <span className="text-xs">═◼═</span></Btn>
        <Btn command="justifyRight"  title="Align right">  <span className="text-xs">═▶</span></Btn>
        <Btn command="justifyFull"   title="Justify">      <span className="text-xs">☰</span></Btn>
        <Sep />

        {/* Misc */}
        <Btn command="removeFormat" title="Clear formatting"><span className="text-xs line-through opacity-60">A</span></Btn>

        <div className="flex-1" />

        {/* Preview toggle */}
        <button
          type="button"
          onClick={togglePreview}
          className={`px-2.5 py-1 rounded text-xs font-medium mr-1 transition-colors ${preview ? 'bg-forest/15 text-forest' : 'bg-white border border-leaf text-pine/60 hover:text-pine'}`}
        >
          {preview ? '✏ Edit' : '👁 Preview'}
        </button>

        {/* Save button */}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${saved ? 'bg-forest/15 text-forest' : 'bg-forest text-white hover:bg-forest/90'}`}
        >
          <Save size={12} />
          {saving ? 'Saving…' : saved ? 'Saved ✓' : saveLabel}
        </button>
      </div>

      {/* ── Editor / Preview ── */}
      {preview ? (
        <div
          className="min-h-[220px] max-h-[420px] overflow-y-auto p-4 bg-white text-sm text-pine leading-relaxed"
          dangerouslySetInnerHTML={{ __html: previewHtml }}
        />
      ) : (
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          className="min-h-[220px] max-h-[420px] overflow-y-auto p-4 bg-white text-sm text-pine leading-relaxed focus:outline-none"
          style={{ caretColor: '#1B4D2E' }}
          onKeyDown={(e) => {
            // Ctrl+B / Ctrl+I / Ctrl+U — let browser handle natively, they work in contentEditable
            if ((e.ctrlKey || e.metaKey) && ['b','i','u'].includes(e.key.toLowerCase())) {
              // Allow default — browser handles these natively in contentEditable
            }
          }}
        />
      )}

      {/* Footer hint */}
      <div className="px-4 py-2 bg-stone-50 border-t border-leaf flex items-center justify-between text-xs text-pine/40">
        <span>Select text then use toolbar · Ctrl+B Bold · Ctrl+I Italic · Ctrl+U Underline</span>
        <span>Saves separately from profile</span>
      </div>
    </div>
  )
}

// ─── VAT Circle master list ───────────────────────────────────────────────────
const VAT_CIRCLES = [
  // LTU
  { comm: "LTU (বৃহৎ করদাতা ইউনিট)", code: "0006", circles: ["LTU মূসক সার্কেল-১","LTU মূসক সার্কেল-২","LTU মূসক সার্কেল-৩","LTU মূসক সার্কেল-৪","LTU মূসক সার্কেল-৫","LTU মূসক সার্কেল-৬"] },
  // Dhaka South
  { comm: "ঢাকা (দক্ষিণ)", code: "0010", circles: ["মতিঝিল সার্কেল","রাজারবাগ সার্কেল","আরামবাগ সার্কেল","রামপুরা সার্কেল","সেগুনবাগিচা সার্কেল","সিদ্ধেশ্বরী সার্কেল","ফুলবাড়িয়া সার্কেল","পল্টন সার্কেল","তেজগাঁও সার্কেল","বেগুনবাড়ি সার্কেল","কাওরানবাজার সার্কেল","ফার্মগেট সার্কেল","ধানমন্ডি সার্কেল","রায়েরবাজার সার্কেল","কাঁঠালবাগান সার্কেল","নীলক্ষেত সার্কেল","আজিমপুর সার্কেল","ইমামগঞ্জ সার্কেল","কেরাণীগঞ্জ সার্কেল","হাসনাবাদ সার্কেল","আরমানিটোলা সার্কেল","বংশাল সার্কেল","চকবাজার সার্কেল","বকশীবাজার সার্কেল","নারায়ণগঞ্জ সার্কেল","ফতুল্লা সার্কেল","আলীগঞ্জ সার্কেল","এনায়েতনগর সার্কেল","মুন্সীগঞ্জ সার্কেল","গজারিয়া সার্কেল","শ্রীনগর সার্কেল","সিরাজদীখাঁন সার্কেল"] },
  // Dhaka North
  { comm: "ঢাকা (উত্তর)", code: "0015", circles: ["গুলশান সার্কেল","বনানী সার্কেল","বারিধারা সার্কেল","খিলক্ষেত সার্কেল","উত্তরা সার্কেল","টঙ্গী সার্কেল","আশুলিয়া সার্কেল","সাভার সার্কেল","মিরপুর সার্কেল","পল্লবী সার্কেল","শাহ আলী সার্কেল","কাফরুল সার্কেল","ময়মনসিংহ সার্কেল-১","ময়মনসিংহ সার্কেল-২","ময়মনসিংহ সার্কেল-৩"] },
  // Dhaka East
  { comm: "ঢাকা (পূর্ব)", code: "0030", circles: ["সূত্রাপুর সার্কেল","ওয়ারী সার্কেল","দেমরা সার্কেল","শ্যামপুর সার্কেল","কদমতলী সার্কেল","জুরাইন সার্কেল","সোনারগাঁও সার্কেল","আড়াইহাজার সার্কেল","রূপগঞ্জ সার্কেল","বন্দর সার্কেল","সিদ্ধিরগঞ্জ সার্কেল"] },
  // Dhaka West
  { comm: "ঢাকা (পশ্চিম)", code: "0035", circles: ["মোহাম্মদপুর সার্কেল","লালমাটিয়া সার্কেল","বেড়িবাঁধ সার্কেল","সাভার সার্কেল (ঢাপশ)","ধামরাই সার্কেল","হেমায়েতপুর সার্কেল","টাঙ্গাইল সার্কেল-১","টাঙ্গাইল সার্কেল-২","টাঙ্গাইল সার্কেল-৩"] },
  // Chittagong
  { comm: "চট্টগ্রাম", code: "0025", circles: ["আগ্রাবাদ সার্কেল","হালিশহর সার্কেল","ডবলমুরিং সার্কেল","পাঁচলাইশ সার্কেল","সদরঘাট সার্কেল","কোতোয়ালি সার্কেল","চকবাজার সার্কেল (চট্ট)","বাকলিয়া সার্কেল","কর্ণফুলী সার্কেল","আনোয়ারা সার্কেল","চন্দনাইশ সার্কেল","পটিয়া সার্কেল","সীতাকুণ্ড সার্কেল","ফটিকছড়ি সার্কেল","মিরসরাই সার্কেল","কক্সবাজার সার্কেল-১","কক্সবাজার সার্কেল-২","চকরিয়া সার্কেল","টেকনাফ সার্কেল","রাঙামাটি সার্কেল","খাগড়াছড়ি সার্কেল","বান্দরবান সার্কেল"] },
  // Sylhet
  { comm: "সিলেট", code: "0018", circles: ["সিলেট সার্কেল-১","সিলেট সার্কেল-২","সিলেট সার্কেল-৩","সিলেট সার্কেল-৪","মৌলভীবাজার সার্কেল","শ্রীমঙ্গল সার্কেল","কমলগঞ্জ সার্কেল","কুলাউড়া সার্কেল","হবিগঞ্জ সার্কেল-১","হবিগঞ্জ সার্কেল-২","মাধবপুর সার্কেল","সুনামগঞ্জ সার্কেল-১","সুনামগঞ্জ সার্কেল-২"] },
  // Rajshahi
  { comm: "রাজশাহী", code: "0020", circles: ["রাজশাহী সার্কেল-১","রাজশাহী সার্কেল-২","রাজশাহী সার্কেল-৩","বগুড়া সার্কেল-১","বগুড়া সার্কেল-২","বগুড়া সার্কেল-৩","পাবনা সার্কেল-১","পাবনা সার্কেল-২","নওগাঁ সার্কেল","চাঁপাইনবাবগঞ্জ সার্কেল","সিরাজগঞ্জ সার্কেল"] },
  // Khulna
  { comm: "খুলনা", code: "0001", circles: ["খুলনা সার্কেল-১","খুলনা সার্কেল-২","খুলনা সার্কেল-৩","বরিশাল সার্কেল-১","বরিশাল সার্কেল-২","বরিশাল সার্কেল-৩","বাগেরহাট সার্কেল","পিরোজপুর সার্কেল","ঝালকাঠি সার্কেল"] },
  // Jessore
  { comm: "যশোর", code: "0005", circles: ["যশোর সার্কেল-১","যশোর সার্কেল-২","যশোর সার্কেল-৩","কুষ্টিয়া সার্কেল-১","কুষ্টিয়া সার্কেল-২","মেহেরপুর সার্কেল","সাতক্ষীরা সার্কেল","ঝিনাইদহ সার্কেল","মাগুরা সার্কেল"] },
  // Comilla
  { comm: "কুমিল্লা", code: "0040", circles: ["কুমিল্লা সার্কেল-১","কুমিল্লা সার্কেল-২","কুমিল্লা সার্কেল-৩","কুমিল্লা সার্কেল-৪","ব্রাহ্মণবাড়িয়া সার্কেল-১","ব্রাহ্মণবাড়িয়া সার্কেল-২","আখাউড়া সার্কেল","নোয়াখালী সার্কেল-১","নোয়াখালী সার্কেল-২","ফেনী সার্কেল","লক্ষ্মীপুর সার্কেল","চাঁদপুর সার্কেল-১","চাঁদপুর সার্কেল-২"] },
  // Rangpur
  { comm: "রংপুর", code: "0045", circles: ["রংপুর সার্কেল-১","রংপুর সার্কেল-২","রংপুর সার্কেল-৩","দিনাজপুর সার্কেল-১","দিনাজপুর সার্কেল-২","দিনাজপুর সার্কেল-৩","গাইবান্ধা সার্কেল","নীলফামারী সার্কেল","কুড়িগ্রাম সার্কেল","লালমনিরহাট সার্কেল"] },
]

// flat list for dropdown
const ALL_CIRCLES = VAT_CIRCLES.flatMap((c) =>
  c.circles.map((name) => ({ label: name, value: name, comm: c.comm, code: c.code }))
)
function VatCircleDropdown({ value, onChange }) {
  const [query, setQuery] = useState('')
  const [open, setOpen]   = useState(false)
  const ref               = useRef(null)

  // close on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = query.trim()
    ? ALL_CIRCLES.filter((c) =>
        c.label.toLowerCase().includes(query.toLowerCase()) ||
        c.comm.toLowerCase().includes(query.toLowerCase()) ||
        c.code.includes(query)
      )
    : ALL_CIRCLES

  const select = (item) => {
    onChange(item.value)
    setQuery('')
    setOpen(false)
  }

  // group filtered results by commissionerate
  const groups = VAT_CIRCLES.map((c) => ({
    comm: c.comm,
    code: c.code,
    items: filtered.filter((f) => f.comm === c.comm),
  })).filter((g) => g.items.length > 0)

  return (
    <div className="relative" ref={ref}>
      {/* trigger button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="input text-left flex items-center justify-between w-full"
      >
        <span className={value ? 'text-pine' : 'text-pine/40'}>
          {value || 'সার্কেল নির্বাচন করুন…'}
        </span>
        <ChevronDown size={14} className={`text-pine/40 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* dropdown panel */}
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-leaf rounded-xl shadow-lg overflow-hidden">
          {/* search box inside dropdown */}
          <div className="p-2 border-b border-leaf">
            <input
              autoFocus
              className="input !py-1.5 text-sm"
              placeholder="খুঁজুন… (যেমন: শ্রীমঙ্গল, সিলেট, 0018)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div className="max-h-64 overflow-y-auto">
            {groups.length === 0 && (
              <div className="px-4 py-3 text-sm text-pine/40">কোনো ফলাফল নেই।</div>
            )}
            {groups.map((g) => (
              <div key={g.comm}>
                {/* group header */}
                <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-pine/40 bg-stone-50 border-b border-leaf/50 flex justify-between">
                  <span>{g.comm}</span>
                  <span className="font-mono text-forest/60">{g.code}</span>
                </div>
                {g.items.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => select(item)}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-leaf/60 transition-colors flex items-center justify-between ${
                      value === item.label ? 'bg-forest/10 text-forest font-medium' : 'text-pine'
                    }`}
                  >
                    <span>{item.label}</span>
                    {value === item.label && <span className="text-forest text-xs">✓</span>}
                  </button>
                ))}
              </div>
            ))}
          </div>

          {/* clear button */}
          {value && (
            <div className="p-2 border-t border-leaf">
              <button
                type="button"
                onClick={() => { onChange(''); setOpen(false) }}
                className="w-full text-xs text-pine/50 hover:text-red-500 py-1 transition-colors"
              >
                ✕ Clear selection
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
const FONT_OPTIONS = [
  'Inter',
  'Arial',
  'Roboto',
  'Noto Sans',
  'Source Sans 3',
  'System UI',
]

const ColorInput = ({ label, value, fallback, onChange }) => (
  <div>
    <label className="label">{label}</label>
    <div className="flex items-center gap-2">
      <input type="color" className="input !p-1 !w-14 shrink-0" value={/^#[0-9a-f]{6}$/i.test(value || '') ? value : fallback} onChange={(e) => onChange(e.target.value)} />
      <input className="input money uppercase" value={value || ''} placeholder={fallback} onChange={(e) => onChange(e.target.value)} />
    </div>
  </div>
)

function TenantBrandPreview({ company }) {
  const primary = company.primary_color || '#1F6F78'
  const accent = company.accent_color || '#2E7D32'
  const sidebar = company.sidebar_bg_color || company.brand_primary || '#123F2A'
  const sidebarText = company.sidebar_text_color || '#FFFFFF'
  const button = company.button_color || primary
  const tableHeader = company.table_header_color || '#EAF4F1'
  const reportHeader = company.report_header_color || company.brand_primary || '#0F4C81'
  const fontFamily = company.font_family || 'Inter'

  return (
    <div className="col-span-2 rounded-xl border border-leaf overflow-hidden bg-white">
      <div className="grid md:grid-cols-[170px_1fr] min-h-[210px]" style={{ fontFamily: `"${fontFamily}", Inter, sans-serif` }}>
        <aside className="p-4 text-sm" style={{ background: sidebar, color: sidebarText }}>
          <div className="flex items-center gap-2 mb-5">
            <div className="h-9 w-9 rounded-lg bg-white/12 border border-white/20 flex items-center justify-center overflow-hidden">
              {company.logo_url ? <img src={company.logo_url} alt="" className="h-full w-full object-contain" /> : <Building2 size={18} />}
            </div>
            <div>
              <div className="font-bold leading-tight">{company.software_name || 'Aura Stay ERP'}</div>
              <div className="text-[11px] opacity-65">{company.name || 'Property'}</div>
            </div>
          </div>
          {['Dashboard', 'Reservations', 'Reports'].map((item, idx) => (
            <div key={item} className="mb-2 rounded-lg px-3 py-2" style={{ background: idx === 2 ? 'rgba(255,255,255,.14)' : 'transparent' }}>
              {item}
            </div>
          ))}
        </aside>
        <main className="p-4 bg-slate-50">
          <div className="rounded-lg overflow-hidden border border-slate-200 bg-white">
            <div className="px-4 py-3 text-white font-bold" style={{ background: reportHeader }}>
              {company.name || 'Tenant'} - Reporting Workbench
            </div>
            <div className="grid sm:grid-cols-3 gap-3 p-4">
              <div className="rounded-lg border p-3" style={{ borderColor: `${accent}44` }}>
                <div className="text-[10px] uppercase text-slate-500 font-bold">Revenue</div>
                <div className="text-xl font-bold" style={{ color: primary }}>BDT 0.00</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-[10px] uppercase text-slate-500 font-bold">Occupancy</div>
                <div className="text-xl font-bold" style={{ color: accent }}>0%</div>
              </div>
              <button type="button" className="rounded-lg px-4 py-3 text-white font-bold" style={{ background: button }}>Primary action</button>
            </div>
            <table className="w-full text-xs">
              <thead style={{ background: tableHeader }}>
                <tr><th className="text-left p-3">Report</th><th className="text-left p-3">Status</th><th className="text-right p-3">Amount</th></tr>
              </thead>
              <tbody>
                <tr><td className="p-3">Daily Sales</td><td className="p-3">Ready</td><td className="p-3 text-right">0.00</td></tr>
                <tr className="bg-slate-50"><td className="p-3">Guest Ledger</td><td className="p-3">Ready</td><td className="p-3 text-right">0.00</td></tr>
              </tbody>
            </table>
          </div>
        </main>
      </div>
    </div>
  )
}

function BrandingCard({ reloadCompany }) {
  const [c, setC]   = useState(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg]   = useState('')
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 4000) }
  const load  = async () => {
    const tenantId = getTenantId()
    let query = supabase.from('company_settings').select('*')
    if (tenantId) query = query.eq('tenant_id', tenantId)
    const { data } = await query.limit(1).single()
    setC(data)
  }
  useEffect(() => { load() }, [])
  if (!c) return <div className="card p-5 text-pine/50">Loading…</div>
  const set = (k, v) => setC((p) => ({ ...p, [k]: v }))

  const uploadLogo = async (file) => {
  if (!file) return
  // size guard — 2 MB max
  if (file.size > 2 * 1024 * 1024) { flash('File too large — max 2 MB.'); return }
  setBusy(true)
  try {
    const ext  = file.name.split('.').pop().toLowerCase()
    const path = `logos/logo_${Date.now()}.${ext}`
    // remove old logo first (best-effort, ignore errors)
    if (c.logo_url) {
      const old = c.logo_url.split('/branding/').pop()
      if (old) await supabase.storage.from('branding').remove([old])
    }
    const { error: upErr } = await supabase.storage
      .from('branding')
      .upload(path, file, { upsert: true, contentType: file.type, cacheControl: '3600' })
    if (upErr) { flash(`Upload failed: ${upErr.message}`); setBusy(false); return }
    const { data: pub } = supabase.storage.from('branding').getPublicUrl(path)
    const url = pub.publicUrl
    set('logo_url', url)
    const { error: dbErr } = await supabase.from('company_settings').update({ logo_url: url }).eq('id', c.id)
    if (dbErr) { flash(`Saved to storage but DB update failed: ${dbErr.message}`); } 
    else { flash('Logo uploaded successfully.'); reloadCompany?.() }
  } catch (e) { flash(e.message) }
  setBusy(false)
}

  const save = async () => {
    setBusy(true)
    const { error } = await supabase.from('company_settings').update({
      name: c.name, legal_name: c.legal_name, address: c.address, phone: c.phone, email: c.email,
      bin: c.bin, vat_circle: c.vat_circle, invoice_footer: c.invoice_footer,
      short_code: c.short_code, software_name: c.software_name, currency: c.currency,
      primary_color: c.primary_color || null,
      accent_color: c.accent_color || null,
      brand_primary: c.brand_primary || null,
      brand_accent: c.brand_accent || null,
      secondary_color: c.secondary_color || null,
      sidebar_bg_color: c.sidebar_bg_color || null,
      sidebar_text_color: c.sidebar_text_color || null,
      button_color: c.button_color || null,
      table_header_color: c.table_header_color || null,
      report_header_color: c.report_header_color || null,
      font_family: c.font_family || 'Inter',
      theme_mode: c.theme_mode || 'light',
      mushak610_threshold: +c.mushak610_threshold || 0,
      is_restaurant_available: !!c.is_restaurant_available,
      restaurant_name: c.is_restaurant_available ? (c.restaurant_name || null) : null,
      updated_at: new Date().toISOString(),
    }).eq('id', c.id)
    setBusy(false)
    if (error) flash(error.message)
    else { setCurrency(c.currency || '৳'); flash('Saved.'); reloadCompany?.() }
  }

  return (
    <div className="card p-5">
      <h2 className="font-display font-semibold text-pine flex items-center gap-2 mb-4">
        <Building2 size={18} className="text-forest" /> Branding &amp; company profile
      </h2>
      {msg && <div className="mb-3 px-3 py-2 rounded-lg bg-forest/10 text-forest text-sm">{msg}</div>}
      <div className="flex items-center gap-4 mb-5">
        <div className="w-20 h-20 rounded-xl border border-leaf bg-paper flex items-center justify-center overflow-hidden">
          {c.logo_url ? <img src={c.logo_url} alt="logo" className="w-full h-full object-contain" /> : <Image size={26} className="text-pine/30" />}
        </div>
        <label className="btn-ghost cursor-pointer">
          <Upload size={15} /> {busy ? 'Uploading…' : 'Upload logo'}
          <input type="file" accept="image/*" className="hidden" onChange={(e) => uploadLogo(e.target.files?.[0])} />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div><label className="label">Currency symbol</label><input className="input" value={c.currency || ''} onChange={(e) => set('currency', e.target.value)} /></div>
        <div><label className="label">Short code</label><input className="input money" value={c.short_code || ''} onChange={(e) => set('short_code', e.target.value)} /></div>
        <div><label className="label">Property name</label><input className="input" value={c.name || ''} onChange={(e) => set('name', e.target.value)} /></div>
        <div><label className="label">Legal name</label><input className="input" value={c.legal_name || ''} onChange={(e) => set('legal_name', e.target.value)} /></div>
        <div className="col-span-2 border border-leaf rounded-lg p-3 space-y-2">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={!!c.is_restaurant_available} onChange={(e) => set('is_restaurant_available', e.target.checked)} className="w-4 h-4 accent-forest" />
            <span className="text-sm font-semibold text-pine">Is restaurant available?</span>
          </label>
          {c.is_restaurant_available && (
            <div>
              <label className="label">Restaurant name</label>
              <input className="input" value={c.restaurant_name || ''} onChange={(e) => set('restaurant_name', e.target.value)} placeholder="e.g. The Garden Bistro" />
            </div>
          )}
          {!c.is_restaurant_available && <p className="text-xs text-pine/50">When disabled, documents will use the property name for restaurant bills.</p>}
        </div>
        <div className="col-span-2"><label className="label">Address</label><input className="input" value={c.address || ''} onChange={(e) => set('address', e.target.value)} /></div>
        <div><label className="label">Phone</label><input className="input" value={c.phone || ''} onChange={(e) => set('phone', e.target.value)} /></div>
        <div><label className="label">Email</label><input className="input" value={c.email || ''} onChange={(e) => set('email', e.target.value)} /></div>
        <div><label className="label">BIN</label><input className="input money" value={c.bin || ''} onChange={(e) => set('bin', e.target.value)} /></div>
        <div><label className="label">Software name</label><input className="input" value={c.software_name || ''} onChange={(e) => set('software_name', e.target.value)} /></div>
        <div><label className="label">Primary UI color (optional)</label><input type="color" className="input !p-1" value={c.primary_color || '#1F6F78'} onChange={(e) => set('primary_color', e.target.value)} /></div>
        <div><label className="label">Accent UI color (optional)</label><input type="color" className="input !p-1" value={c.accent_color || '#2E7D32'} onChange={(e) => set('accent_color', e.target.value)} /></div>
        <div><label className="label">Print primary (optional)</label><input type="color" className="input !p-1" value={c.brand_primary || '#1B4D2E'} onChange={(e) => set('brand_primary', e.target.value)} /></div>
        <div><label className="label">Print accent (optional)</label><input type="color" className="input !p-1" value={c.brand_accent || '#2E7D32'} onChange={(e) => set('brand_accent', e.target.value)} /></div>
        <div className="col-span-2 mt-2 border-t border-leaf pt-4">
          <h3 className="font-display font-semibold text-pine">Tenant UI palette</h3>
          <p className="text-sm text-pine/50">Controls the ERP shell, buttons, report headers, and table headers for this tenant.</p>
        </div>
        <ColorInput label="Secondary / soft background" value={c.secondary_color} fallback="#EAF4F1" onChange={(v) => set('secondary_color', v)} />
        <ColorInput label="Sidebar background" value={c.sidebar_bg_color} fallback="#123F2A" onChange={(v) => set('sidebar_bg_color', v)} />
        <ColorInput label="Sidebar text" value={c.sidebar_text_color} fallback="#FFFFFF" onChange={(v) => set('sidebar_text_color', v)} />
        <ColorInput label="Button color" value={c.button_color} fallback={c.primary_color || '#1F6F78'} onChange={(v) => set('button_color', v)} />
        <ColorInput label="Table header color" value={c.table_header_color} fallback="#EAF4F1" onChange={(v) => set('table_header_color', v)} />
        <ColorInput label="Report header color" value={c.report_header_color} fallback="#0F4C81" onChange={(v) => set('report_header_color', v)} />
        <div>
          <label className="label">Font family</label>
          <select className="input" value={c.font_family || 'Inter'} onChange={(e) => set('font_family', e.target.value)}>
            {FONT_OPTIONS.map((font) => <option key={font} value={font}>{font}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Theme mode</label>
          <select className="input" value={c.theme_mode || 'light'} onChange={(e) => set('theme_mode', e.target.value)}>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>
        <TenantBrandPreview company={c} />
        <div className="col-span-2"><label className="label">VAT circle / division</label><VatCircleDropdown value={c.vat_circle || ''} onChange={(v) => set('vat_circle', v)} />{c.vat_circle && (<p className="text-xs text-pine/40 mt-1 font-mono">Challan code: 1/1133/{VAT_CIRCLES.find((g) => g.circles.includes(c.vat_circle))?.code || '????'}/0311</p>)}</div>
        <div><label className="label">Mushak-6.10 threshold</label><input type="number" className="input money" value={c.mushak610_threshold || 0} onChange={(e) => set('mushak610_threshold', e.target.value)} /></div>
        <div><label className="label">Invoice footer</label><input className="input" value={c.invoice_footer || ''} onChange={(e) => set('invoice_footer', e.target.value)} /></div>
      </div>
      <div className="mt-5">
        <label className="label">Default Terms &amp; Conditions</label>
        <RichTextEditor
          initialHtml={c.terms_conditions || ''}
          saveLabel="Save T&C"
          onSave={async (html) => {
            const { error } = await supabase.from('company_settings').update({
              terms_conditions: html, updated_at: new Date().toISOString(),
            }).eq('id', c.id)
            if (error) flash(error.message)
            else { flash('Terms & Conditions saved.'); reloadCompany?.() }
          }}
        />
      </div>
      <button className="btn-primary mt-4" disabled={busy} onClick={save}><Save size={15} /> Save profile</button>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  TAX CONFIG — with inline edit                                       */
/* ------------------------------------------------------------------ */

export default BrandingCard
