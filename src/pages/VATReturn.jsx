// src/pages/VATReturn.jsx
import { useState, useEffect } from "react";
import { supabase } from "../supabase";
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
  const ml = monthLabel();
  const [y, m] = month.split("-");
  const taxPeriod = `${m}/${y}`;
  const today = new Date().toLocaleDateString("en-GB");

  win.document.write(`<!DOCTYPE html><html><head>
    <title>মূসক ৯.১ — ${ml}</title>
    <meta charset="UTF-8"/>
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:"Arial",sans-serif;font-size:11px;color:#000;padding:15px;background:#fff}
      .page{max-width:900px;margin:0 auto;border:2px solid #000;padding:10px}
      .header{text-align:center;border-bottom:2px solid #000;padding-bottom:8px;margin-bottom:8px}
      .header h1{font-size:14px;font-weight:bold;letter-spacing:1px}
      .header h2{font-size:12px;font-weight:bold;margin-top:2px}
      .header h3{font-size:11px;font-weight:normal;margin-top:2px}
      .section{border:1px solid #000;margin-bottom:6px}
      .section-title{background:#d0d0d0;font-weight:bold;font-size:11px;padding:3px 6px;border-bottom:1px solid #000}
      .row{display:flex;border-bottom:1px solid #ccc;min-height:20px}
      .row:last-child{border-bottom:none}
      .note-no{width:28px;border-right:1px solid #ccc;text-align:center;padding:2px;font-weight:bold;font-size:10px;color:#333;flex-shrink:0}
      .label{flex:1;padding:2px 5px;border-right:1px solid #ccc}
      .val{width:130px;text-align:right;padding:2px 5px;border-right:1px solid #ccc;font-weight:600}
      .val2{width:100px;text-align:right;padding:2px 5px;border-right:1px solid #ccc}
      .val3{width:100px;text-align:right;padding:2px 5px}
      .bold{font-weight:bold}
      .total-row{background:#f0f0f0}
      .net-row{background:#c8e6c9;font-weight:bold}
      .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:0}
      .info-cell{padding:3px 6px;border-bottom:1px solid #ccc;border-right:1px solid #ccc;display:flex;gap:5px}
      .info-cell:nth-child(even){border-right:none}
      .info-label{font-weight:bold;min-width:120px;color:#333}
      .sub-table{width:100%;border-collapse:collapse;font-size:10px}
      .sub-table th{background:#e0e0e0;border:1px solid #999;padding:3px 5px;text-align:center;font-weight:bold}
      .sub-table td{border:1px solid #ccc;padding:2px 5px}
      .sub-table .num{text-align:right}
      .sub-table .total-row td{background:#e8f5e9;font-weight:bold}
      .col-note{width:35px;text-align:center}
      .col-val{width:120px;text-align:right}
      .col-sd{width:100px;text-align:right}
      .col-vat{width:100px;text-align:right}
      .decl{margin-top:6px;border:1px solid #000;padding:8px;font-size:10px}
      .decl p{margin-bottom:4px}
      .sig-row{display:flex;justify-content:space-between;margin-top:30px}
      .sig-box{text-align:center;width:200px}
      .sig-box .line{border-top:1px solid #000;padding-top:4px;margin-top:20px;font-size:10px}
      @media print{
        body{padding:5px}
        .page{border:none;padding:5px}
        button{display:none}
        .section{page-break-inside:avoid}
      }
    </style></head><body>
  <div class="page">

    <!-- HEADER -->
    <div class="header">
      <h1>গণপ্রজাতন্ত্রী বাংলাদেশ সরকার</h1>
      <h1>GOVERNMENT OF THE PEOPLE'S REPUBLIC OF BANGLADESH</h1>
      <h2>জাতীয় রাজস্ব বোর্ড / NATIONAL BOARD OF REVENUE</h2>
      <h2>মূল্য সংযোজন কর রিটার্ন ফরম / VALUE ADDED TAX RETURN FORM</h2>
      <h3>[বিধি ৪৭(১)] / [Rule 47(1)]</h3>
      <h2 style="margin-top:4px;background:#333;color:#fff;padding:3px">মূসক-৯.১ / MUSHAK-9.1</h2>
    </div>

    <!-- SECTION 1: TAXPAYER INFO -->
    <div class="section">
      <div class="section-title">SECTION - 1: TAXPAYER'S INFORMATION / করদাতার তথ্য</div>
      <div class="info-grid">
        <div class="info-cell"><span class="info-label">1. BIN:</span> <span>${"N/A"}</span></div>
        <div class="info-cell"><span class="info-label">4. Nature of Business:</span> <span>Hotel/Resort Service</span></div>
        <div class="info-cell" style="grid-column:1/-1"><span class="info-label">2. Name of Taxpayer:</span> <span>${companyName}</span></div>
        <div class="info-cell" style="grid-column:1/-1"><span class="info-label">3. Address:</span> <span>Sreemangal, Moulvibazar, Sylhet, Bangladesh</span></div>
        <div class="info-cell"><span class="info-label">5. Economic Activity:</span> <span>Accommodation, Food & Beverage</span></div>
        <div class="info-cell"><span class="info-label">VAT Circle:</span> <span>Sreemangal</span></div>
      </div>
    </div>

    <!-- SECTION 2: RETURN SUBMISSION DATA -->
    <div class="section">
      <div class="section-title">SECTION - 2: RETURN SUBMISSION DATA / রিটার্ন দাখিলের তথ্য</div>
      <div class="info-grid">
        <div class="info-cell"><span class="info-label">1. Tax Period:</span> <span>${taxPeriod}</span></div>
        <div class="info-cell"><span class="info-label">4. Date of Submission:</span> <span>${today}</span></div>
        <div class="info-cell"><span class="info-label">2. Type of Return:</span> <span>✅ A) Main/Original Return (Section 64)</span></div>
        <div class="info-cell"><span class="info-label">3. Any activities?</span> <span>✅ Yes</span></div>
      </div>
    </div>

    <!-- SECTION 3: SUPPLY - OUTPUT TAX -->
    <div class="section">
      <div class="section-title">SECTION - 3: SUPPLY - OUTPUT TAX / সরবরাহ - আউটপুট কর</div>
      <table class="sub-table">
        <thead>
          <tr>
            <th class="col-note">Note</th>
            <th>Nature of Supply / সরবরাহের ধরন</th>
            <th class="col-val">Value (a) / মূল্য (ক)</th>
            <th class="col-sd">SD (b)</th>
            <th class="col-vat">VAT (c) / মূসক (গ)</th>
          </tr>
        </thead>
        <tbody>
          <tr><td class="col-note">1</td><td>Zero Rated Goods/Service — Direct Export</td><td class="num">0.00</td><td class="num">0.00</td><td class="num">0.00</td></tr>
          <tr><td class="col-note">2</td><td>Deemed Export</td><td class="num">0.00</td><td class="num">0.00</td><td class="num">0.00</td></tr>
          <tr><td class="col-note">3</td><td>Exempted Goods/Service</td><td class="num">0.00</td><td class="num">0.00</td><td class="num">0.00</td></tr>
          <tr><td class="col-note">4</td><td>Standard Rated Goods/Service (Room @ 15%) / কক্ষ ভাড়া</td>
            <td class="num">${salesRows.filter(r=>+r.vat/+r.taxable_value > 0.1).reduce((s,r)=>s+ +r.taxable_value,0).toLocaleString("en-BD",{minimumFractionDigits:2})}</td>
            <td class="num">0.00</td>
            <td class="num">${salesRows.filter(r=>+r.vat/+r.taxable_value > 0.1).reduce((s,r)=>s+ +r.vat,0).toLocaleString("en-BD",{minimumFractionDigits:2})}</td>
          </tr>
          <tr><td class="col-note">5</td><td>Goods Based on MRP</td><td class="num">0.00</td><td class="num">0.00</td><td class="num">0.00</td></tr>
          <tr><td class="col-note">6</td><td>Goods/Service Based on Specific VAT</td><td class="num">0.00</td><td class="num">0.00</td><td class="num">0.00</td></tr>
          <tr><td class="col-note">7</td><td>Goods/Service Other than Standard Rate (Restaurant @ 5%) / রেস্তোরাঁ</td>
            <td class="num">${salesRows.filter(r=>+r.vat/+r.taxable_value <= 0.1 && +r.vat > 0).reduce((s,r)=>s+ +r.taxable_value,0).toLocaleString("en-BD",{minimumFractionDigits:2})}</td>
            <td class="num">0.00</td>
            <td class="num">${salesRows.filter(r=>+r.vat/+r.taxable_value <= 0.1 && +r.vat > 0).reduce((s,r)=>s+ +r.vat,0).toLocaleString("en-BD",{minimumFractionDigits:2})}</td>
          </tr>
          <tr><td class="col-note">8</td><td>Retail/Wholesale/Trade Based Supply</td><td class="num">0.00</td><td class="num">0.00</td><td class="num">0.00</td></tr>
          <tr class="total-row">
            <td class="col-note bold">9</td>
            <td class="bold">Total Sales Value & Total Payable Taxes / মোট বিক্রয় ও প্রদেয় কর</td>
            <td class="num bold">${Number(data?.totalTaxable).toLocaleString("en-BD",{minimumFractionDigits:2})}</td>
            <td class="num bold">0.00</td>
            <td class="num bold">${Number(data?.outputVAT).toLocaleString("en-BD",{minimumFractionDigits:2})}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- SECTION 4: PURCHASE - INPUT TAX -->
    <div class="section">
      <div class="section-title">SECTION - 4: PURCHASE - INPUT TAX / ক্রয় - ইনপুট কর (রেয়াত)</div>
      <table class="sub-table">
        <thead>
          <tr>
            <th class="col-note">Note</th>
            <th>Nature of Purchase / ক্রয়ের ধরন</th>
            <th class="col-val">Value (a) / মূল্য (ক)</th>
            <th class="col-vat">VAT (b) / মূসক (খ)</th>
            <th style="width:80px;text-align:center">Rebate / রেয়াত</th>
          </tr>
        </thead>
        <tbody>
          <tr><td class="col-note">10</td><td>Zero Rated Goods/Service</td><td class="num">0.00</td><td class="num">0.00</td><td class="num">—</td></tr>
          <tr><td class="col-note">11</td><td>Exempted Goods/Service</td><td class="num">0.00</td><td class="num">0.00</td><td class="num">—</td></tr>
          ${purchaseRows.filter(r=>r.rebateable).map((r,i)=>`
          <tr>
            <td class="col-note">${12+i}</td>
            <td>Standard Rated — ${r.vendor_name} (${r.invoice_no})</td>
            <td class="num">${Number(r.taxable_value).toLocaleString("en-BD",{minimumFractionDigits:2})}</td>
            <td class="num">${Number(r.vat_amount).toLocaleString("en-BD",{minimumFractionDigits:2})}</td>
            <td class="num" style="color:green">✅ Claimable</td>
          </tr>`).join("")}
          ${purchaseRows.filter(r=>!r.rebateable).map(r=>`
          <tr style="color:#888">
            <td class="col-note">—</td>
            <td>Non-Admissible (Capital Asset) — ${r.vendor_name} (${r.invoice_no})</td>
            <td class="num">${Number(r.taxable_value).toLocaleString("en-BD",{minimumFractionDigits:2})}</td>
            <td class="num">${Number(r.vat_amount).toLocaleString("en-BD",{minimumFractionDigits:2})}</td>
            <td class="num" style="color:orange">❌ Capital</td>
          </tr>`).join("")}
          <tr class="total-row">
            <td class="col-note bold">23</td>
            <td class="bold">Total Input Tax Credit / মোট ইনপুট কর রেয়াত</td>
            <td class="num bold">${Number(data?.totalPurchase).toLocaleString("en-BD",{minimumFractionDigits:2})}</td>
            <td class="num bold">${Number(data?.claimableITC).toLocaleString("en-BD",{minimumFractionDigits:2})}</td>
            <td></td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- SECTION 5 & 6: ADJUSTMENTS -->
    <div class="section">
      <div class="section-title">SECTION - 5 & 6: ADJUSTMENTS / সমন্বয়</div>
      <div class="row"><div class="note-no">24</div><div class="label">Increasing Adjustment — VAT Deducted at Source (VDS)</div><div class="val">0.00</div></div>
      <div class="row"><div class="note-no">28</div><div class="label">Total Increasing Adjustment / মোট বর্ধিত সমন্বয়</div><div class="val bold">0.00</div></div>
      <div class="row"><div class="note-no">29</div><div class="label">Decreasing Adjustment — Credit Note</div><div class="val">0.00</div></div>
      <div class="row"><div class="note-no">33</div><div class="label">Total Decreasing Adjustment / মোট হ্রাসকৃত সমন্বয়</div><div class="val bold">0.00</div></div>
    </div>

    <!-- SECTION 7: NET TAX CALCULATION -->
    <div class="section">
      <div class="section-title">SECTION - 7: NET TAX CALCULATION / নেট কর গণনা</div>
      <div class="row"><div class="note-no">9C</div><div class="label">Total Output VAT (from Section 3) / মোট আউটপুট মূসক</div><div class="val">${Number(data?.outputVAT).toLocaleString("en-BD",{minimumFractionDigits:2})}</div></div>
      <div class="row"><div class="note-no">23B</div><div class="label">Total Input Tax Credit / Rebate (from Section 4) / মোট রেয়াত</div><div class="val">(${Number(data?.claimableITC).toLocaleString("en-BD",{minimumFractionDigits:2})})</div></div>
      <div class="row"><div class="note-no">28</div><div class="label">Total Increasing Adjustment</div><div class="val">0.00</div></div>
      <div class="row"><div class="note-no">33</div><div class="label">Total Decreasing Adjustment</div><div class="val">0.00</div></div>
      <div class="row net-row"><div class="note-no">34</div><div class="label bold">Net Payable VAT for the Tax Period (9C - 23B + 28 - 33) / নেট প্রদেয় মূসক</div><div class="val">${Number(data?.netPayable).toLocaleString("en-BD",{minimumFractionDigits:2})}</div></div>
      <div class="row"><div class="note-no">41</div><div class="label">Interest on Overdue VAT</div><div class="val">0.00</div></div>
      <div class="row"><div class="note-no">43</div><div class="label">Fine/Penalty for Non-submission of Return</div><div class="val">0.00</div></div>
      <div class="row net-row"><div class="note-no">50</div><div class="label bold">Net Payable VAT for Treasury Deposit (35+41+43+44) / কোষাগারে জমাযোগ্য মূসক</div><div class="val">${Number(data?.netPayable).toLocaleString("en-BD",{minimumFractionDigits:2})}</div></div>
    </div>

    <!-- SECTION 9: TREASURY PAYMENT -->
    <div class="section">
      <div class="section-title">SECTION - 9: ACCOUNTS CODE WISE PAYMENT SCHEDULE (TREASURY DEPOSIT) / কোষাগার জমার তফসিল</div>
      <div class="row"><div class="note-no">58</div><div class="label">VAT Deposit for Current Tax Period / চলতি করকালের মূসক জমা</div><div class="val">${Number(data?.netPayable).toLocaleString("en-BD",{minimumFractionDigits:2})}</div><div class="val2">A/C: 1/1133/0030/0311</div></div>
      <div class="row"><div class="note-no">59</div><div class="label">SD Deposit for Current Tax Period</div><div class="val">0.00</div><div class="val2">A/C: 1/1133/0018/0711</div></div>
    </div>

    <!-- SECTION 11: CLOSING BALANCE -->
    <div class="section">
      <div class="section-title">SECTION - 11: CLOSING BALANCE / সমাপনী জের</div>
      <div class="row"><div class="note-no">65</div><div class="label">Closing Balance (VAT) / সমাপনী জের (মূসক)</div><div class="val">0.00</div></div>
      <div class="row"><div class="note-no">66</div><div class="label">Closing Balance (SD) / সমাপনী জের (এসডি)</div><div class="val">0.00</div></div>
    </div>

    <!-- SECTION 12: DECLARATION -->
    <div class="decl">
      <div class="section-title" style="margin:-8px -8px 8px;padding:3px 6px">SECTION - 12: DECLARATION / ঘোষণা</div>
      <p>আমি এতদ্বারা ঘোষণা করছি যে, এই রিটার্ন ফরমে প্রদত্ত সকল তথ্য সম্পূর্ণ, সত্য ও নির্ভুল।</p>
      <p>I hereby declare that all information provided in this Return Form are complete, true &amp; accurate. In case of any untrue/incomplete statement, I may be subjected to penal action under The Value Added Tax and Supplementary Duty Act, 2012.</p>
      <div class="sig-row">
        <div class="sig-box">
          <div class="line">হিসাব কর্মকর্তা<br/>Accounts Officer</div>
        </div>
        <div class="sig-box">
          <div class="line">ব্যবস্থাপক<br/>Manager</div>
        </div>
        <div class="sig-box">
          <div class="line">অধিকৃত স্বাক্ষর<br/>Authorized Signatory<br/><small>Date: ${today}</small></div>
        </div>
      </div>
    </div>

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
