import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { Printer, Trash2, Plus } from 'lucide-react'
import { jsPDF } from 'jspdf'

export default function VDSCertificates() {
  const [certs, setCerts] = useState([])
  const [f, setF] = useState({ vendor_name: '', bin_number: '', invoice_amount: '', vat_deducted: '' })

  const load = async () => {
    const { data } = await supabase.from('vds_certificates').select('*').order('cert_date', { ascending: false })
    setCerts(data || [])
  }

  useEffect(() => { load() }, [])

  const add = async () => {
    await supabase.from('vds_certificates').insert(f)
    setF({ vendor_name: '', bin_number: '', invoice_amount: '', vat_deducted: '' })
    load()
  }

  const del = async (id) => {
    await supabase.from('vds_certificates').delete().eq('id', id)
    load()
  }

  const printCert = (c) => {
    const doc = new jsPDF()
    doc.setFontSize(18)
    doc.text('VDS CERTIFICATE', 70, 20)
    doc.setFontSize(12)
    doc.text(`Vendor: ${c.vendor_name}`, 20, 40)
    doc.text(`BIN: ${c.bin_number}`, 20, 50)
    doc.text(`Invoice Amount: ${c.invoice_amount}`, 20, 60)
    doc.text(`VAT Deducted: ${c.vat_deducted}`, 20, 70)
    doc.save(`VDS_${c.vendor_name}.pdf`)
  }

  return (
    <div className="card p-5">
      <h2 className="text-xl font-bold mb-4">VDS Certificates</h2>
      <div className="grid grid-cols-4 gap-2 mb-4">
        <input className="input" placeholder="Vendor Name" value={f.vendor_name} onChange={(e) => setF({...f, vendor_name: e.target.value})} />
        <input className="input" placeholder="BIN" value={f.bin_number} onChange={(e) => setF({...f, bin_number: e.target.value})} />
        <input className="input" placeholder="Amount" value={f.invoice_amount} onChange={(e) => setF({...f, invoice_amount: e.target.value})} />
        <input className="input" placeholder="VAT Deducted" value={f.vat_deducted} onChange={(e) => setF({...f, vat_deducted: e.target.value})} />
        <button className="btn-primary col-span-4" onClick={add}><Plus size={16}/> Add Certificate</button>
      </div>

      <table className="w-full">
        <thead><tr><th className="th">Vendor</th><th className="th">BIN</th><th className="th">VAT</th><th className="th">Action</th></tr></thead>
        <tbody>
          {certs.map(c => (
            <tr key={c.id}>
              <td className="td">{c.vendor_name}</td>
              <td className="td">{c.bin_number}</td>
              <td className="td">{c.vat_deducted}</td>
              <td className="td flex gap-2">
                <button onClick={() => printCert(c)} className="text-forest"><Printer size={16}/></button>
                <button onClick={() => del(c.id)} className="text-red-500"><Trash2 size={16}/></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
