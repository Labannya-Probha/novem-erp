// src/pages/VATReturn.jsx
import { useState, useEffect } from "react";
import { supabase } from "../supabase";
import { getCompanySettingsQuery, withTenantScope } from "../lib/companySettings";
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
    getCompanySettingsQuery("name").limit(1).single()
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
      withTenantScope(supabase
        .from("vat_sales_register")
        .select("*")
        .gte("issue_date", from)
        .lte("issue_date", to)
        .eq("is_void", false)
        .order("issue_date")),
      withTenantScope(supabase
        .from("vat_purchase_register")
        .select("*")
        .gte("entry_date", from)
        .lte("entry_date", to)
        .order("entry_date")),
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
  const [y, m] = month.split("-");
  const taxPeriodLabel = new Date(+y, +m - 1, 1)
    .toLocaleString("en-BD", { month: "long", year: "numeric" });
  const today = new Date().toLocaleDateString("en-GB").replace(/\//g, "/");

  // Split sales by rate
  const roomSales = salesRows.filter(r => (+r.vat / +r.taxable_value) > 0.10);
  const restSales = salesRows.filter(r => (+r.vat / +r.taxable_value) <= 0.10 && +r.vat > 0);
  const roomTaxable = roomSales.reduce((s, r) => s + +r.taxable_value, 0);
  const roomVAT     = roomSales.reduce((s, r) => s + +r.vat, 0);
  const restTaxable = restSales.reduce((s, r) => s + +r.taxable_value, 0);
  const restVAT     = restSales.reduce((s, r) => s + +r.vat, 0);

  const n = v => Number(v).toLocaleString("en-BD", { minimumFractionDigits: 2 });
  const blank = `<td></td>`;

  win.document.write(`<!DOCTYPE html><html><head>
    <title>Mushak-9.1 — ${taxPeriodLabel}</title>
    <meta charset="UTF-8"/>
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:Arial,sans-serif;font-size:11px;color:#000;background:#fff;padding:20px}
      .page{max-width:820px;margin:0 auto}
      /* Header */
      .hdr{text-align:center;margin-bottom:12px}
      .hdr img{height:60px}
      .hdr h1{font-size:13px;font-weight:bold}
      .hdr h2{font-size:12px;font-weight:bold;margin-top:2px}
      .hdr .form-tag{float:right;border:2px solid #000;padding:4px 10px;font-weight:bold;font-size:12px;margin-top:-36px}
      /* Tables */
      table{width:100%;border-collapse:collapse;margin-bottom:10px;font-size:11px}
      th,td{border:1px solid #000;padding:4px 6px;vertical-align:top}
      th{background:#f0f0f0;font-weight:bold;text-align:center}
      .part-title{background:#000;color:#fff;font-weight:bold;text-align:center;font-size:11px;padding:3px;margin:8px 0 4px;letter-spacing:.5px}
      .label-col{width:65%;font-weight:normal}
      .note-col{width:8%;text-align:center;font-weight:bold}
      .val-col{width:27%;text-align:right;font-weight:600}
      .amt-col{text-align:right}
      .bold{font-weight:bold}
      .total{background:#e8e8e8;font-weight:bold}
      .net{background:#c8e6c9;font-weight:bold}
      .subform-title{font-weight:bold;text-decoration:underline;margin:8px 0 3px;font-size:11px}
      /* Declaration */
      .decl-table td{border:1px solid #000;padding:5px 8px}
      .sig{margin-top:40px;display:flex;justify-content:space-between}
      .sig-box{text-align:center;width:220px}
      .sig-box .line{border-top:1px solid #000;padding-top:5px;margin-top:30px;font-size:10px}
      @media print{body{padding:5px} button{display:none} .page{page-break-after:always}}
    </style></head><body>
  <div class="page">

    <!-- HEADER -->
    <div class="hdr">
      <h1>Government of the People's Republic of Bangladesh</h1>
      <h2>National Board of Revenue</h2>
      <h2 style="margin-top:6px;font-size:13px">VALUE ADDED TAX RETURN FORM</h2>
      <p style="font-size:10px">[See Rule 47(1)]</p>
      <p style="font-size:10px">[Please read the instructions before filling up this form]</p>
      <div class="form-tag">Mushak-9.1</div>
      <div style="clear:both"></div>
    </div>

    <!-- PART 1 -->
    <div class="part-title">PART - 1: TAXPAYER'S INFORMATION</div>
    <table>
      <tr><td class="bold" style="width:30%">1. BIN</td><td>${"001892112-0702"}</td></tr>
      <tr><td class="bold">2. Name of Taxpayer</td><td>${companyName.toUpperCase()}</td></tr>
      <tr><td class="bold">3. Address of Taxpayer</td><td>Bishamoni, Sreemangal, Moulvibazar, PO: 3210; Sreemangal PS; Moulvibazar - 3210; Bangladesh</td></tr>
      <tr><td class="bold">4. Type of Ownership</td><td>Private Limited</td></tr>
      <tr><td class="bold">5. Economic Activity</td><td>Services</td></tr>
    </table>

    <!-- PART 2 -->
    <div class="part-title">PART - 2: RETURN SUBMISSION DATA</div>
    <table>
      <tr><td class="bold" style="width:60%">1. Tax Period</td><td>${taxPeriodLabel}</td></tr>
      <tr><td class="bold">2. Type of Return</td><td>A) Main/Original Return (Section 64)</td></tr>
      <tr><td class="bold">Reason for Amendment</td><td></td></tr>
      <tr><td class="bold">2a. Economic Activity is Trader or Approved Wholesaler and Want to Pay VAT at 7.5% or 5% or 1.5%?</td><td>☑ No</td></tr>
      <tr><td class="bold">2b. Any transactions above 2 lakh taka for this tax period?</td><td>☑ ${data?.totalTaxable > 200000 ? "Yes" : "No"}</td></tr>
      <tr><td class="bold">3. Any activities in this Tax Period?</td><td>☑ Yes</td></tr>
      <tr><td class="bold">4. Date of Submission</td><td>${today}</td></tr>
      <tr><td class="bold">5. Last Amendment Date</td><td></td></tr>
    </table>

    <!-- PART 3 -->
    <div class="part-title">PART - 3: SUPPLY - OUTPUT TAX</div>
    <table>
      <tr>
        <th style="width:38%">Nature of Supply</th>
        <th style="width:7%">Note</th>
        <th style="width:20%">Value (a)</th>
        <th style="width:17%">SD (b)</th>
        <th style="width:18%">VAT (c)</th>
      </tr>
      <tr><td>Zero Rated Goods/Service — Direct Export</td><td style="text-align:center">1</td><td class="amt-col"></td><td class="amt-col"></td><td class="amt-col"></td></tr>
      <tr><td>Deemed Export</td><td style="text-align:center">2</td><td class="amt-col"></td><td class="amt-col"></td><td class="amt-col"></td></tr>
      <tr><td>Exempted Goods/Service</td><td style="text-align:center">3</td><td class="amt-col"></td><td class="amt-col"></td><td class="amt-col"></td></tr>
      <tr><td>Standard Rated Goods/Service</td><td style="text-align:center">4</td><td class="amt-col">${n(roomTaxable)}</td><td class="amt-col"></td><td class="amt-col">${n(roomVAT)}</td></tr>
      <tr><td>Goods Based on MRP</td><td style="text-align:center">5</td><td class="amt-col"></td><td class="amt-col"></td><td class="amt-col"></td></tr>
      <tr><td>Goods/Service Based on Specific VAT</td><td style="text-align:center">6</td><td class="amt-col"></td><td class="amt-col"></td><td class="amt-col"></td></tr>
      <tr><td>Goods/Service Other than Standard Rate</td><td style="text-align:center">7</td><td class="amt-col">${n(restTaxable)}</td><td class="amt-col"></td><td class="amt-col">${n(restVAT)}</td></tr>
      <tr><td>Retail/Wholesale/Trade Based Supply</td><td style="text-align:center">8</td><td class="amt-col"></td><td class="amt-col"></td><td class="amt-col"></td></tr>
      <tr class="total"><td>Total Sales Value &amp; Total Payable Taxes</td><td style="text-align:center">9</td><td class="amt-col">${n(data?.totalTaxable)}</td><td class="amt-col"></td><td class="amt-col">${n(data?.outputVAT)}</td></tr>
    </table>

    <!-- PART 4 -->
    <div class="part-title">PART - 4: PURCHASE - INPUT TAX</div>
    <table>
      <tr>
        <th style="width:38%">Nature of Purchase</th>
        <th style="width:7%">Note</th>
        <th style="width:27%">Value (a)</th>
        <th style="width:28%">VAT (b)</th>
      </tr>
      <tr><td>Zero Rated Goods/Service — Local Purchase / Import</td><td style="text-align:center">10 / 11</td><td class="amt-col"></td><td class="amt-col"></td></tr>
      <tr><td>Exempted Goods/Service — Local Purchase / Import</td><td style="text-align:center">12 / 13</td><td class="amt-col"></td><td class="amt-col"></td></tr>
      <tr><td>Standard Rated Goods/Service — Local Purchase</td><td style="text-align:center">14</td>
        <td class="amt-col">${n(purchaseRows.filter(r=>r.rebateable).reduce((s,r)=>s+ +r.taxable_value,0))}</td>
        <td class="amt-col">${n(data?.claimableITC)}</td>
      </tr>
      <tr><td>Standard Rated Goods/Service — Import</td><td style="text-align:center">15</td><td class="amt-col"></td><td class="amt-col"></td></tr>
      <tr><td>Goods/Service Other than Standard Rate — Local Purchase / Import</td><td style="text-align:center">16 / 17</td><td class="amt-col"></td><td class="amt-col"></td></tr>
      <tr><td>Goods/Service Based on Specific VAT — Local / Import</td><td style="text-align:center">18 / 18a</td><td class="amt-col"></td><td class="amt-col"></td></tr>
      <tr><td>Goods/Service Not Admissible for Credit (Capital Assets)</td><td style="text-align:center">19 / 20</td>
        <td class="amt-col">${n(purchaseRows.filter(r=>!r.rebateable).reduce((s,r)=>s+ +r.taxable_value,0))}</td>
        <td class="amt-col">${n(data?.nonClaimable)}</td>
      </tr>
      <tr><td>Credits not taken / Other Non-admissible</td><td style="text-align:center">21 / 22</td><td class="amt-col"></td><td class="amt-col"></td></tr>
      <tr class="total"><td>Total Input Tax Credit</td><td style="text-align:center">23</td><td class="amt-col">${n(data?.totalPurchase)}</td><td class="amt-col">${n(data?.claimableITC)}</td></tr>
    </table>

    <!-- PART 5 -->
    <div class="part-title">PART - 5: INCREASING ADJUSTMENTS (VAT)</div>
    <table>
      <tr><th style="width:65%">Adjustment Details</th><th style="width:10%">Note</th><th>VAT Amount</th></tr>
      <tr><td>Due to VAT Deducted at Source by the Supply Receiver</td><td style="text-align:center">24</td><td class="amt-col"></td></tr>
      <tr><td>Payment Not Made Through Banking Channel</td><td style="text-align:center">25</td><td class="amt-col"></td></tr>
      <tr><td>Issuance of Debit Note</td><td style="text-align:center">26</td><td class="amt-col"></td></tr>
      <tr><td>Any Other Adjustments</td><td style="text-align:center">27</td><td class="amt-col"></td></tr>
      <tr class="total"><td>Total Increasing Adjustment</td><td style="text-align:center">28</td><td class="amt-col">0.00</td></tr>
    </table>

    <!-- PART 6 -->
    <div class="part-title">PART - 6: DECREASING ADJUSTMENTS (VAT)</div>
    <table>
      <tr><th style="width:65%">Adjustment Details</th><th style="width:10%">Note</th><th>VAT Amount</th></tr>
      <tr><td>Due to VAT Deducted at Source from the Supplies Delivered</td><td style="text-align:center">29</td><td class="amt-col"></td></tr>
      <tr><td>Advance Tax Paid at Import Stage</td><td style="text-align:center">30</td><td class="amt-col"></td></tr>
      <tr><td>Issuance of Credit Note</td><td style="text-align:center">31</td><td class="amt-col"></td></tr>
      <tr><td>Any Other Adjustments</td><td style="text-align:center">32</td><td class="amt-col"></td></tr>
      <tr class="total"><td>Total Decreasing Adjustment</td><td style="text-align:center">33</td><td class="amt-col">0.00</td></tr>
    </table>

    <!-- PART 7 -->
    <div class="part-title">PART - 7: NET TAX CALCULATION</div>
    <table>
      <tr><th style="width:65%">Items</th><th style="width:10%">Note</th><th>Amount (Tax)</th></tr>
      <tr><td>Net Payable VAT for the Tax Period (Section-45) (9c - 23b + 28 - 33)</td><td style="text-align:center">34</td><td class="amt-col">${n(data?.netPayable)}</td></tr>
      <tr class="net"><td>Net Payable VAT after Adjustment with Closing Balance and balance of form 18.6 [34-(52+56)]</td><td style="text-align:center">35</td><td class="amt-col">${n(data?.netPayable)}</td></tr>
      <tr><td>Net Payable Supplementary Duty (Before adjustment) [9b+38-(39+40)]</td><td style="text-align:center">36</td><td class="amt-col"></td></tr>
      <tr><td>Net Payable SD after Adjustment [36-(53+57)]</td><td style="text-align:center">37</td><td class="amt-col"></td></tr>
      <tr><td>Increasing Adjustment of Supplementary Duty</td><td style="text-align:center">38</td><td class="amt-col"></td></tr>
      <tr><td>Decreasing Adjustment of Supplementary Duty</td><td style="text-align:center">39</td><td class="amt-col"></td></tr>
      <tr><td>Supplementary Duty Paid on Inputs Against Exports</td><td style="text-align:center">40</td><td class="amt-col"></td></tr>
      <tr><td>Interest on Overdue VAT (Based on note 35)</td><td style="text-align:center">41</td><td class="amt-col"></td></tr>
      <tr><td>Interest on Overdue SD (Based on note 37)</td><td style="text-align:center">42</td><td class="amt-col"></td></tr>
      <tr><td>Fine/Penalty for Non-submission of Return</td><td style="text-align:center">43</td><td class="amt-col"></td></tr>
      <tr><td>Other Fine/Penalty/Interest</td><td style="text-align:center">44</td><td class="amt-col"></td></tr>
      <tr><td>Payable Excise Duty</td><td style="text-align:center">45</td><td class="amt-col"></td></tr>
      <tr><td>Payable Development Surcharge</td><td style="text-align:center">46</td><td class="amt-col"></td></tr>
      <tr><td>Payable ICT Development Surcharge</td><td style="text-align:center">47</td><td class="amt-col"></td></tr>
      <tr><td>Payable Health Care Surcharge</td><td style="text-align:center">48</td><td class="amt-col"></td></tr>
      <tr><td>Payable Environmental Protection Surcharge</td><td style="text-align:center">49</td><td class="amt-col"></td></tr>
      <tr class="net"><td class="bold">Net Payable VAT for Treasury Deposit (35+41+43+44)</td><td style="text-align:center">50</td><td class="amt-col bold">${n(data?.netPayable)}</td></tr>
      <tr><td>Net Payable SD for Treasury Deposit (37+42)</td><td style="text-align:center">51</td><td class="amt-col"></td></tr>
      <tr><td>Closing Balance of Last Tax Period (VAT)</td><td style="text-align:center">52</td><td class="amt-col">0.00</td></tr>
      <tr><td>Closing Balance of Last Tax Period (SD)</td><td style="text-align:center">53</td><td class="amt-col"></td></tr>
    </table>

    <!-- PART 8 -->
    <div class="part-title">PART - 8: ADJUSTMENT FOR OLD ACCOUNT CURRENT BALANCE</div>
    <table>
      <tr><th style="width:75%">Items</th><th style="width:10%">Note</th><th>Amount</th></tr>
      <tr><td>Remaining Balance (VAT) from Mushak-18.6, [Rule 118(5)]</td><td style="text-align:center">54</td><td class="amt-col"></td></tr>
      <tr><td>Remaining Balance (SD) from Mushak-18.6, [Rule 118(5)]</td><td style="text-align:center">55</td><td class="amt-col"></td></tr>
      <tr><td>Decreasing Adjustment for Note 54 (up to 30% of Note 34)</td><td style="text-align:center">56</td><td class="amt-col"></td></tr>
      <tr><td>Decreasing Adjustment for Note 55 (up to 30% of Note 36)</td><td style="text-align:center">57</td><td class="amt-col"></td></tr>
    </table>

    <!-- PART 9 -->
    <div class="part-title">PART - 9: ACCOUNTS CODE WISE PAYMENT SCHEDULE (TREASURY DEPOSIT)</div>
    <table>
      <tr><th style="width:40%">Items</th><th style="width:8%">Note</th><th style="width:25%">Account Code</th><th>Amount</th></tr>
      <tr><td>VAT Deposit for the Current Tax Period</td><td style="text-align:center">58</td><td>1 / 1133 / 0018 / 0311</td><td class="amt-col">${n(data?.netPayable)}</td></tr>
      <tr><td>SD Deposit for the Current Tax Period</td><td style="text-align:center">59</td><td>1 / 1133 / 0018 / 0711</td><td class="amt-col"></td></tr>
      <tr><td>Excise Duty</td><td style="text-align:center">60</td><td>1 / 1133 / 0018 / 0601</td><td class="amt-col"></td></tr>
      <tr><td>Development Surcharge</td><td style="text-align:center">61</td><td>1 / 1103 / 0000 / 2225</td><td class="amt-col"></td></tr>
      <tr><td>ICT Development Surcharge</td><td style="text-align:center">62</td><td>1 / 1103 / 0000 / 2214</td><td class="amt-col"></td></tr>
      <tr><td>Health Care Surcharge</td><td style="text-align:center">63</td><td>1 / 1103 / 0000 / 2212</td><td class="amt-col"></td></tr>
      <tr><td>Environmental Protection Surcharge</td><td style="text-align:center">64</td><td>1 / 1103 / 0000 / 2213</td><td class="amt-col"></td></tr>
    </table>

    <!-- PART 10 -->
    <div class="part-title">PART - 10: CLOSING BALANCE</div>
    <table>
      <tr><th style="width:75%">Items</th><th style="width:10%">Note</th><th>Amount</th></tr>
      <tr><td>Closing Balance (VAT) [58 - (50 + 67) + The Refund Amount Not Approved]</td><td style="text-align:center">65</td><td class="amt-col">0.00</td></tr>
      <tr><td>Closing Balance (SD) [59 - (51 + 68) + The Refund amount Not Approved]</td><td style="text-align:center">66</td><td class="amt-col"></td></tr>
    </table>

    <!-- PART 11 -->
    <div class="part-title">PART - 11: REFUND</div>
    <table>
      <tr><td style="width:75%">I am interested to get refund of my Closing Balance</td><td>☑ No</td></tr>
      <tr><th>Items</th><th>Note</th><th>Amount</th></tr>
      <tr><td>Requested Amount for Refund (VAT)</td><td style="text-align:center">67</td><td class="amt-col"></td></tr>
      <tr><td>Requested Amount for Refund (SD)</td><td style="text-align:center">68</td><td class="amt-col"></td></tr>
    </table>
    <p style="font-size:10px;margin-bottom:8px">Note: To claim Refund taxpayer must have TIN and Local Bank Account</p>

    <!-- PART 12 -->
    <div class="part-title">PART - 12: DECLARATION</div>
    <table class="decl-table">
      <tr><td style="width:30%" class="bold">Name *</td><td></td></tr>
      <tr><td class="bold">Designation</td><td></td></tr>
      <tr><td class="bold">Mobile Number *</td><td></td></tr>
      <tr><td class="bold">National ID/Passport Number *</td><td></td></tr>
      <tr><td class="bold">Email *</td><td></td></tr>
    </table>
    <p style="font-size:10px;margin:8px 0">
      ☑ I hereby declare that all information provided in this Return Form are complete, true &amp; accurate.
      In case of any untrue/incomplete statement, I may be subjected to penal action under The Value Added
      Tax and Supplementary Duty Act, 2012 or any other applicable Act prevailing at present.
    </p>
    <p style="font-size:10px">Signature [Not required for electronic submission]</p>

    <hr style="margin:20px 0 10px"/>

    <!-- SUB-FORMS -->
    <div class="part-title">Sub-form of Part - 3.4: Standard Rated Goods/Service</div>
    <table>
      <tr>
        <th>Goods/Service Commercial Description</th>
        <th>Goods/Service Code</th>
        <th>Goods/Service Name</th>
        <th>Value (a)</th>
        <th>SD (b)</th>
        <th>VAT (c)</th>
        <th>Notes</th>
      </tr>
      ${roomSales.length > 0
        ? `<tr><td>Service</td><td>S001.10</td><td>Hotel: without bar &amp; floor show</td><td class="amt-col">${n(roomTaxable)}</td><td class="amt-col">0</td><td class="amt-col">${n(roomVAT)}</td><td></td></tr>`
        : `<tr><td colspan="7" style="text-align:center;color:#999">No standard rated sales this period</td></tr>`
      }
      <tr class="total"><td colspan="3">TOTAL</td><td class="amt-col">${n(roomTaxable)}</td><td class="amt-col">0</td><td class="amt-col">${n(roomVAT)}</td><td></td></tr>
    </table>

    <div class="part-title">Sub-form of Part - 3.7: Goods/Service Based on Minimum Value Addition/Other Rates</div>
    <table>
      <tr>
        <th>Goods/Service Commercial Description</th>
        <th>Goods/Service Code</th>
        <th>Goods/Service Name</th>
        <th>Value (a)</th>
        <th>SD (b)</th>
        <th>VAT (c)</th>
        <th>Notes</th>
      </tr>
      ${restSales.length > 0
        ? `<tr><td>Service</td><td>S001.20</td><td>Restaurant: without bar/floor show</td><td class="amt-col">${n(restTaxable)}</td><td class="amt-col">0</td><td class="amt-col">${n(restVAT)}</td><td>VAT for ${taxPeriodLabel}</td></tr>`
        : `<tr><td colspan="7" style="text-align:center;color:#999">No restaurant sales this period</td></tr>`
      }
      <tr class="total"><td colspan="3">TOTAL</td><td class="amt-col">${n(restTaxable)}</td><td class="amt-col">0</td><td class="amt-col">${n(restVAT)}</td><td></td></tr>
    </table>

    <div class="part-title">Sub-form of Part - 4.14: Standard Rated Purchase — Input Tax Credit</div>
    <table>
      <tr>
        <th>Treasury Challan / Invoice No.</th>
        <th>Date</th>
        <th>Vendor Name</th>
        <th>Vendor BIN</th>
        <th>Description</th>
        <th>Value (a)</th>
        <th>VAT (b)</th>
        <th>Rebate</th>
      </tr>
      ${purchaseRows.map(r => `
      <tr>
        <td>${r.invoice_no}</td>
        <td>${r.entry_date}</td>
        <td>${r.vendor_name}</td>
        <td>${r.vendor_bin || "—"}</td>
        <td style="font-size:10px">${r.description || "—"}</td>
        <td class="amt-col">${n(r.taxable_value)}</td>
        <td class="amt-col">${n(r.vat_amount)}</td>
        <td style="text-align:center">${r.rebateable ? "✅" : "❌ Capital"}</td>
      </tr>`).join("")}
      <tr class="total">
        <td colspan="5">TOTAL Claimable ITC</td>
        <td class="amt-col">${n(data?.totalPurchase)}</td>
        <td class="amt-col">${n(data?.claimableITC)}</td>
        <td></td>
      </tr>
    </table>

    <div class="part-title">Sub-form of Part - 9.58: VAT Deposit for The Tax Period</div>
    <table>
      <tr>
        <th>Treasury Challan Number/Token Number</th>
        <th>Bank</th>
        <th>Branch</th>
        <th>Date</th>
        <th>Account Code</th>
        <th>Amount</th>
        <th>Notes</th>
      </tr>
      <tr><td></td><td></td><td></td><td>${today}</td><td>1 / 1133 / 0018 / 0311</td><td class="amt-col">${n(data?.netPayable)}</td><td>VAT for ${taxPeriodLabel}</td></tr>
      <tr class="total"><td colspan="5">TOTAL</td><td class="amt-col">${n(data?.netPayable)}</td><td></td></tr>
    </table>

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
