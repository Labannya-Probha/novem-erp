// src/pages/VATReturn.jsx
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import {
  FileText, TrendingUp, TrendingDown, DollarSign,
  Download, Calendar, CheckCircle, XCircle, AlertCircle
} from "lucide-react";

export default function VATReturn() {
  const [month, setMonth]       = useState(() => new Date().toISOString().slice(0, 7));
  const [loading, setLoading]   = useState(false);
  const [data, setData]         = useState(null);
  const [salesRows, setSalesRows]       = useState([]);
  const [purchaseRows, setPurchaseRows] = useState([]);
  const [companyName, setCompanyName]   = useState("Eco Resort");

  // Load company name once
  useEffect(() => {
    supabase.from("company_settings").select("name").limit(1).single()
      .then(({ data: cs }) => { if (cs?.name) setCompanyName(cs.name); });
  }, []);

  async function fetchData() {
    setLoading(true);
    const [y, m] = month.split("-");
    const daysInMonth = new Date(+y, +m, 0).getDate();
    const from = `${y}-${m}-01`;
    const to   = `${y}-${m}-${daysInMonth}`;

    // RLS handles tenant filtering automatically — no .eq("tenant_id") needed
    const [{ data: sales }, { data: purchases }] = await Promise.all([
      supabase
        .from("vat_sales_register")
        .select("*")
        .gte("issue_date", from)
        .lte("issue_date", to)
        .eq("is_void", false)
        .order("issue_date"),
      supabase
        .from("vat_purchase_register")
        .select("*")
        .gte("entry_date", from)
        .lte("entry_date", to)
        .order("entry_date"),
    ]);

    const s = sales     || [];
    const p = purchases || [];

    const outputVAT    = s.reduce((acc, r) => acc + +r.vat, 0);
    const claimableITC = p.filter(r => r.rebateable).reduce((acc, r) => acc + +r.vat_amount, 0);
    const nonClaimable = p.filter(r => !r.rebateable).reduce((acc, r) => acc + +r.vat_amount, 0);
    const netPayable   = Math.max(0, outputVAT - claimableITC);
    const savingPct    = outputVAT > 0 ? ((claimableITC / outputVAT) * 100).toFixed(1) : "0.0";

    setSalesRows(s);
    setPurchaseRows(p);
    setData({
      outputVAT, claimableITC, nonClaimable, netPayable, savingPct,
      totalTaxable:  s.reduce((acc, r) => acc + +r.taxable_value, 0),
      totalPurchase: p.reduce((acc, r) => acc + +r.taxable_value, 0),
      totalInputVAT: p.reduce((acc, r) => acc + +r.vat_amount, 0),
    });
    setLoading(false);
  }

  useEffect(() => { fetchData(); }, [month]);

  const fmt = n => "৳" + Number(n).toLocaleString("en-BD");

  const monthLabel = () => new Date(+month.split("-")[0], +month.split("-")[1] - 1, 1)
    .toLocaleString("en-BD", { month: "long", year: "numeric" });

  function printMushak91() {
    const win = window.open("", "_blank");
    win.document.write(`<!DOCTYPE html><html><head>
      <title>মূসক ৯.১ — ${monthLabel()}</title>
      <meta charset="UTF-8"/>
      <style>
        body{font-family:Arial,sans-serif;font-size:12px;margin:30px;color:#111}
        h2{text-align:center;font-size:16px;margin-bottom:2px}
        p.sub{text-align:center;font-size:11px;margin:2px 0 16px;color:#555}
        table{width:100%;border-collapse:collapse;margin-bottom:20px}
        th{background:#1B4D2E;color:#fff;padding:7px 10px;text-align:left;font-size:11px}
        td{padding:6px 10px;border-bottom:1px solid #ddd;font-size:11px}
        tr:nth-child(even) td{background:#f9f9f9}
        .total-row td{font-weight:bold;background:#e8f5e9}
        .summary{border:2px solid #1B4D2E;padding:14px;margin-top:16px;border-radius:6px}
        .summary td{border:none;padding:5px 8px}
        .net{font-size:15px;font-weight:bold;color:#1B4D2E}
        .sig{margin-top:50px;display:flex;justify-content:space-between}
        .sig div{text-align:center;border-top:1px solid #333;padding-top:8px;width:180px}
        @media print{button{display:none}}
      </style></head><body>
      <h2>মূসক ৯.১ — ভ্যাট রিটার্ন সামারি</h2>
      <p class="sub">Period: ${monthLabel()} &nbsp;|&nbsp; ${companyName} &nbsp;|&nbsp; Generated: ${new Date().toLocaleDateString("en-BD")}</p>

      <h3>ক) বিক্রয় রেজিস্টার — Output VAT</h3>
      <table>
        <thead><tr><th>#</th><th>তারিখ</th><th>Invoice No</th><th>Buyer Name</th><th>BIN</th><th style="text-align:right">Taxable (৳)</th><th style="text-align:right">VAT (৳)</th></tr></thead>
        <tbody>
          ${salesRows.map((r, i) => `<tr>
            <td>${i + 1}</td><td>${r.issue_date}</td>
            <td>${r.invoice_no}</td><td>${r.buyer_name || "—"}</td><td>${r.buyer_bin || "—"}</td>
            <td style="text-align:right">${Number(r.taxable_value).toLocaleString()}</td>
            <td style="text-align:right">${Number(r.vat).toLocaleString()}</td>
          </tr>`).join("")}
          <tr class="total-row">
            <td colspan="5">মোট Output VAT</td>
            <td style="text-align:right">${Number(data?.totalTaxable).toLocaleString()}</td>
            <td style="text-align:right">${Number(data?.outputVAT).toLocaleString()}</td>
          </tr>
        </tbody>
      </table>

      <h3>খ) ক্রয় রেজিস্টার — Input VAT (Rebate)</h3>
      <table>
        <thead><tr><th>#</th><th>তারিখ</th><th>Invoice No</th><th>Vendor</th><th>BIN</th><th style="text-align:right">Taxable (৳)</th><th style="text-align:right">Input VAT (৳)</th><th>Rebate</th></tr></thead>
        <tbody>
          ${purchaseRows.map((r, i) => `<tr>
            <td>${i + 1}</td><td>${r.entry_date}</td>
            <td>${r.invoice_no}</td><td>${r.vendor_name || "—"}</td><td>${r.vendor_bin || "—"}</td>
            <td style="text-align:right">${Number(r.taxable_value).toLocaleString()}</td>
            <td style="text-align:right">${Number(r.vat_amount).toLocaleString()}</td>
            <td style="text-align:center">${r.rebateable ? "✅ হ্যাঁ" : "❌ না"}</td>
          </tr>`).join("")}
          <tr class="total-row">
            <td colspan="5">মোট Claimable ITC (Rebate)</td>
            <td style="text-align:right">${Number(data?.totalPurchase).toLocaleString()}</td>
            <td style="text-align:right">${Number(data?.claimableITC).toLocaleString()}</td>
            <td></td>
          </tr>
        </tbody>
      </table>

      <div class="summary">
        <table>
          <tr><td>Output VAT (বিক্রয়ের উপর)</td><td style="text-align:right">${Number(data?.outputVAT).toLocaleString()}</td></tr>
          <tr><td>Less: Input Tax Credit / Rebate</td><td style="text-align:right">(${Number(data?.claimableITC).toLocaleString()})</td></tr>
          <tr><td>Non-claimable Input VAT (Capital Asset)</td><td style="text-align:right">${Number(data?.nonClaimable).toLocaleString()}</td></tr>
          <tr><td colspan="2"><hr/></td></tr>
          <tr><td class="net">নেট প্রদেয় ভ্যাট (NBR তে জমাযোগ্য)</td>
              <td class="net" style="text-align:right">৳${Number(data?.netPayable).toLocaleString()}</td></tr>
        </table>
      </div>
      <div class="sig">
        <div>হিসাব কর্মকর্তা<br/><small>Accounts Officer</small></div>
        <div>ব্যবস্থাপক<br/><small>Manager</small></div>
        <div>অধিকৃত স্বাক্ষর<br/><small>Authorized Signatory</small></div>
      </div>
      <script>window.onload=()=>window.print()</script>
      </body></html>`);
    win.document.close();
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-green-900 flex items-center gap-2">
            <FileText className="w-6 h-6"/> VAT Return Summary
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            মূসক ৯.১ — Output VAT, Input Tax Credit (Rebate) ও নেট প্রদেয় — {companyName}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm">
            <Calendar className="w-4 h-4 text-green-700"/>
            <input type="month" value={month} onChange={e => setMonth(e.target.value)}
              className="text-sm font-medium text-gray-700 outline-none bg-transparent"/>
          </div>
          <button onClick={printMushak91} disabled={!data || loading}
            className="flex items-center gap-2 bg-green-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-900 transition disabled:opacity-40">
            <Download className="w-4 h-4"/> মূসক ৯.১ Print
          </button>
        </div>
      </div>

      {loading && (
        <div className="text-center py-16 text-gray-400 text-sm animate-pulse">
          VAT data লোড হচ্ছে...
        </div>
      )}

      {!loading && data && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: <TrendingUp className="w-4 h-4 text-blue-500"/>, label: "Output VAT (বিক্রয়)",
                value: fmt(data.outputVAT), sub: `Taxable: ${fmt(data.totalTaxable)}`, cardCls: "bg-white border-gray-200", valCls: "text-gray-800" },
              { icon: <CheckCircle className="w-4 h-4 text-green-600"/>, label: "Claimable ITC (Rebate)",
                value: fmt(data.claimableITC), sub: `সাশ্রয়: ${data.savingPct}% of Output VAT`, cardCls: "bg-white border-gray-200", valCls: "text-green-700" },
              { icon: <XCircle className="w-4 h-4 text-orange-500"/>, label: "Non-claimable (Capital)",
                value: fmt(data.nonClaimable), sub: "Fixed assets — rebate নেই", cardCls: "bg-white border-gray-200", valCls: "text-orange-600" },
              { icon: <DollarSign className="w-4 h-4 text-green-200"/>, label: "নেট প্রদেয় ভ্যাট",
                value: fmt(data.netPayable), sub: "NBR তে জমা দিতে হবে", cardCls: "bg-green-900 border-green-900", valCls: "text-white", subCls: "text-green-300", labelCls: "text-green-200" },
            ].map(card => (
              <div key={card.label} className={`rounded-xl border shadow-sm p-4 ${card.cardCls}`}>
                <div className={`flex items-center gap-2 text-xs mb-1 ${card.labelCls || "text-gray-500"}`}>
                  {card.icon} {card.label}
                </div>
                <div className={`text-2xl font-bold ${card.valCls}`}>{card.value}</div>
                <div className={`text-xs mt-1 ${card.subCls || "text-gray-400"}`}>{card.sub}</div>
              </div>
            ))}
          </div>

          {/* Visual Bar */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-green-700"/> VAT Reduction Breakdown
            </h2>
            <div className="space-y-3">
              {[
                { label: "Output VAT (Sales)", value: data.outputVAT, color: "bg-blue-500" },
                { label: "Less: ITC Rebate", value: data.claimableITC, color: "bg-green-500" },
                { label: "Non-claimable (Capital)", value: data.nonClaimable, color: "bg-orange-400" },
                { label: "Net Payable to NBR", value: data.netPayable, color: "bg-green-900" },
              ].map(row => (
                <div key={row.label}>
                  <div className="flex justify-between text-xs text-gray-600 mb-1">
                    <span>{row.label}</span>
                    <span className="font-semibold">{fmt(row.value)}</span>
                  </div>
                  <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full ${row.color} rounded-full transition-all duration-700`}
                      style={{ width: data.outputVAT > 0 ? `${Math.min(100,(row.value/data.outputVAT)*100)}%` : "0%" }}/>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Sales Register */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 bg-blue-50 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-600"/>
              <h2 className="text-sm font-semibold text-blue-800">ক) বিক্রয় রেজিস্টার — Output VAT</h2>
              <span className="ml-auto text-xs text-blue-600 font-medium">{salesRows.length} invoices</span>
            </div>
            {salesRows.length === 0
              ? <p className="text-center py-8 text-gray-400 text-sm">এই মাসে কোনো sales invoice নেই</p>
              : <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-gray-500 border-b border-gray-100 bg-gray-50">
                        {["#","তারিখ","Invoice No","Buyer","BIN","Taxable (৳)","VAT (৳)"].map(h => (
                          <th key={h} className={`px-4 py-2 font-medium ${h.includes("৳") ? "text-right" : "text-left"}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {salesRows.map((r, i) => (
                        <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="px-4 py-2 text-gray-400 text-xs">{i + 1}</td>
                          <td className="px-4 py-2 text-gray-600 text-xs">{r.issue_date}</td>
                          <td className="px-4 py-2 font-mono text-xs text-blue-700">{r.invoice_no}</td>
                          <td className="px-4 py-2 text-gray-700 text-xs">{r.buyer_name || "—"}</td>
                          <td className="px-4 py-2 text-gray-400 text-xs">{r.buyer_bin || "—"}</td>
                          <td className="px-4 py-2 text-right text-gray-700 text-xs font-medium">{Number(r.taxable_value).toLocaleString()}</td>
                          <td className="px-4 py-2 text-right text-blue-700 text-xs font-bold">{Number(r.vat).toLocaleString()}</td>
                        </tr>
                      ))}
                      <tr className="bg-blue-50 text-xs font-semibold">
                        <td colSpan={5} className="px-4 py-2 text-blue-800">মোট</td>
                        <td className="px-4 py-2 text-right text-blue-800">{Number(data.totalTaxable).toLocaleString()}</td>
                        <td className="px-4 py-2 text-right text-blue-900">{Number(data.outputVAT).toLocaleString()}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
            }
          </div>

          {/* Purchase Register */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 bg-green-50 flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-green-700"/>
              <h2 className="text-sm font-semibold text-green-800">খ) ক্রয় রেজিস্টার — Input VAT (Rebate)</h2>
              <span className="ml-auto text-xs text-green-600 font-medium">{purchaseRows.length} entries</span>
            </div>
            {purchaseRows.length === 0
              ? <p className="text-center py-8 text-gray-400 text-sm">এই মাসে কোনো purchase entry নেই</p>
              : <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-gray-500 border-b border-gray-100 bg-gray-50">
                        {["#","তারিখ","Invoice No","Vendor","Description","Taxable (৳)","Input VAT (৳)","Rebate"].map(h => (
                          <th key={h} className={`px-4 py-2 font-medium ${h.includes("৳") ? "text-right" : h === "Rebate" ? "text-center" : "text-left"}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {purchaseRows.map((r, i) => (
                        <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="px-4 py-2 text-gray-400 text-xs">{i + 1}</td>
                          <td className="px-4 py-2 text-gray-600 text-xs">{r.entry_date}</td>
                          <td className="px-4 py-2 font-mono text-xs text-green-700">{r.invoice_no}</td>
                          <td className="px-4 py-2 text-gray-700 text-xs">{r.vendor_name || "—"}</td>
                          <td className="px-4 py-2 text-gray-500 text-xs max-w-xs truncate">{r.description || "—"}</td>
                          <td className="px-4 py-2 text-right text-gray-700 text-xs font-medium">{Number(r.taxable_value).toLocaleString()}</td>
                          <td className={`px-4 py-2 text-right text-xs font-bold ${r.rebateable ? "text-green-700" : "text-orange-500 line-through"}`}>
                            {Number(r.vat_amount).toLocaleString()}
                          </td>
                          <td className="px-4 py-2 text-center">
                            {r.rebateable
                              ? <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full font-medium">
                                  <CheckCircle className="w-3 h-3"/>Claimable
                                </span>
                              : <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-600 text-xs px-2 py-0.5 rounded-full font-medium">
                                  <XCircle className="w-3 h-3"/>Capital
                                </span>
                            }
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-green-50 text-xs font-semibold">
                        <td colSpan={5} className="px-4 py-2 text-green-800">মোট Claimable ITC</td>
                        <td className="px-4 py-2 text-right text-green-800">{Number(data.totalPurchase).toLocaleString()}</td>
                        <td className="px-4 py-2 text-right text-green-900">({Number(data.claimableITC).toLocaleString()})</td>
                        <td></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
            }
          </div>

          {/* Net Calculation */}
          <div className="bg-white rounded-xl border-2 border-green-800 shadow-md p-5">
            <h2 className="text-sm font-semibold text-green-900 mb-4 flex items-center gap-2">
              <DollarSign className="w-4 h-4"/> গ) নেট ভ্যাট হিসাব — Mushak 9.1
            </h2>
            <div className="space-y-2 max-w-sm">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Output VAT (বিক্রয়)</span>
                <span className="font-semibold text-gray-800">{fmt(data.outputVAT)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Less: ITC Rebate (ক্রয়)</span>
                <span className="font-semibold text-green-700">({fmt(data.claimableITC)})</span>
              </div>
              <div className="flex justify-between text-xs text-gray-500">
                <span>Non-claimable Input VAT (Capital)</span>
                <span className="text-orange-500">{fmt(data.nonClaimable)}</span>
              </div>
              <div className="border-t-2 border-green-800 pt-3 flex justify-between">
                <span className="text-green-900 font-bold text-base">নেট প্রদেয় ভ্যাট (NBR)</span>
                <span className="text-green-900 font-bold text-xl">{fmt(data.netPayable)}</span>
              </div>
              <p className="text-xs text-gray-400 pt-1">
                ITC Rebate এর কারণে সাশ্রয়: {fmt(data.claimableITC)} ({data.savingPct}%)
              </p>
            </div>
          </div>
        </>
      )}

      {!loading && !data && (
        <div className="text-center py-16 text-gray-400 text-sm">
          কোনো VAT data পাওয়া যায়নি। Month select করুন।
        </div>
      )}
    </div>
  );
}
