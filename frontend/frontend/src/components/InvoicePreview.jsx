import React, { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import axios from 'axios';
import { Download, Save } from 'lucide-react';

export default function InvoicePreview({ formData, items, totals, onSaved }) {
  const invoiceRef = useRef();
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedCopies, setSelectedCopies] = useState({ Original: true, Duplicate: false, Transport: false, Performance: false });
  const [activeCopyText, setActiveCopyText] = useState('ORIGINAL FOR RECIPIENT');
  const [invoiceTitle, setInvoiceTitle] = useState('TAX INVOICE');

  // Number to Words function for Indian Rupees
  const numberToWords = (num) => {
    const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    if ((num = num.toString()).length > 9) return 'overflow';
    const n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!n) return; var str = '';
    str += (n[1] != 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'Crore ' : '';
    str += (n[2] != 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'Lakh ' : '';
    str += (n[3] != 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'Thousand ' : '';
    str += (n[4] != 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'Hundred ' : '';
    str += (n[5] != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) + 'Only' : '';
    return str || 'Zero Hanya';
  };

  const amountInWords = React.useMemo(() => {
    const val = Math.round(parseFloat(totals.grand_total || 0));
    if (val === 0) return 'Zero Rupees Only';
    return numberToWords(val);
  }, [totals.grand_total]);

  const handleCheckboxChange = (type) => {
    setSelectedCopies(prev => ({ ...prev, [type]: !prev[type] }));
    // Instantly update preview in background if they are peeking behind modal
    if (type === 'Original') { setActiveCopyText('ORIGINAL FOR RECIPIENT'); setInvoiceTitle('TAX INVOICE'); }
    else if (type === 'Duplicate') { setActiveCopyText('DUPLICATE FOR RECIPIENT'); setInvoiceTitle('TAX INVOICE'); }
    else if (type === 'Transport') { setActiveCopyText('TRANSPORT FOR RECIPIENT'); setInvoiceTitle('TAX INVOICE'); }
    else if (type === 'Performance') { setActiveCopyText(''); setInvoiceTitle('PERFORMANCE INVOICE'); }
  };

  const handleSaveAndExport = async () => {
    setSaving(true);
    let dbSuccess = false;
    try {
      // 1. Save to DB automatically
      const payload = {
        ...formData,
        items,
        total_taxable_value: totals.total_taxable_value,
        total_cgst: totals.total_cgst,
        total_sgst: totals.total_sgst,
        grand_total: totals.grand_total,
        total_in_words: amountInWords
      };
      try {
        await axios.post('http://localhost:5000/api/invoices', payload);
        dbSuccess = true;
      } catch (dbErr) {
        console.error('Database save failed:', dbErr);
        alert('Warning: Could not save to Database (is backend running?). PDF will still be exported.');
      }

      // 2. Export into ONE single PDF containing exactly the selected number of pages
      const copiesToExport = Object.keys(selectedCopies).filter(k => selectedCopies[k]);
      if (copiesToExport.length === 0) {
        alert('Data successfully saved to DB! Select a copy type to download the PDF.');
        setSaving(false);
        setShowModal(false);
        if (onSaved) onSaved(); // wipes visual form and increments invoice no
        return;
      }

      const safeName = formData.customer_name ? formData.customer_name.replace(/[^a-zA-Z0-9]/g, '_') : 'Customer';
      const safeInv = formData.invoice_no ? formData.invoice_no.replace(/[^a-zA-Z0-9]/g, '_') : 'Draft';
      const fileName = `${safeName}_Invoice_${safeInv}.pdf`;
      
      const pdf = new jsPDF('p', 'mm', 'a4');

      for (let i = 0; i < copiesToExport.length; i++) {
        const copy = copiesToExport[i];
        let title = '';
        let mainTitle = 'TAX INVOICE';
        if (copy === 'Original') title = 'ORIGINAL FOR RECIPIENT';
        if (copy === 'Duplicate') title = 'DUPLICATE FOR RECIPIENT';
        if (copy === 'Transport') title = 'TRANSPORT FOR RECIPIENT';
        if (copy === 'Performance') { title = ''; mainTitle = 'PERFORMANCE INVOICE'; }
        
        setActiveCopyText(title);
        setInvoiceTitle(mainTitle);
        // Let React physically re-render to change the title text before capturing
        await new Promise(res => setTimeout(res, 600)); 
        
        // Use html2canvas directly on the visible element so the image is 100% accurate
        const canvas = await html2canvas(invoiceRef.current, {
           scale: 2, 
           useCORS: true, 
           scrollY: 0,
           allowTaint: true
        });
        
        const imgData = canvas.toDataURL('image/jpeg', 0.98);
        const imgProps = pdf.getImageProperties(imgData);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

        if (i > 0) {
           pdf.addPage();
        }
        
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      }
      
      const pdfBlob = pdf.output('blob');
      // Force Chrome to download by using octet-stream instead of application/pdf
      const forcedDownloadBlob = new Blob([pdfBlob], { type: 'application/octet-stream' });
      const blobUrl = URL.createObjectURL(forcedDownloadBlob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 100);


    } catch (err) {
      console.error(err);
      alert('Failed to process. Ensure backend is running.');
    } finally {
      setActiveCopyText('ORIGINAL FOR RECIPIENT'); // restore default state immediately
      setInvoiceTitle('TAX INVOICE');
      setSaving(false);
      setShowModal(false);
      // ONLY trigger onSaved to wipe the form AND increment ID after PDF logic completes!
      if (dbSuccess && onSaved) onSaved(); 
    }
  };

  const dynamicTableStyles = React.useMemo(() => {
    const len = items.length;
    // Maintain a consistent, comfortable size for up to 12 items
    if (len <= 12) return { '--r-pad': '3.5px 5px', '--f-row': '10.5px', '--f-hdr': '11px', '--g-mar': '6px', '--f-title': '28px', '--s-logo': '36px', '--f-sm': '9px', '--f-xs': '8px' };
    if (len <= 15) return { '--r-pad': '2.5px 4px', '--f-row': '10px', '--f-hdr': '10.5px', '--g-mar': '5px', '--f-title': '26px', '--s-logo': '34px', '--f-sm': '8px', '--f-xs': '8px' };
    if (len <= 18) return { '--r-pad': '2px 3px', '--f-row': '9px', '--f-hdr': '10px', '--g-mar': '4px', '--f-title': '24px', '--s-logo': '30px', '--f-sm': '8px', '--f-xs': '7px' };
    if (len <= 20) return { '--r-pad': '1px 2px', '--f-row': '8px', '--f-hdr': '9px', '--g-mar': '2px', '--f-title': '20px', '--s-logo': '26px', '--f-sm': '7px', '--f-xs': '6px' };
    return { '--r-pad': '0.5px 1px', '--f-row': '7px', '--f-hdr': '8px', '--g-mar': '1px', '--f-title': '18px', '--s-logo': '22px', '--f-sm': '6.5px', '--f-xs': '5px' };
  }, [items.length]);

  return (
    <div className="rhs-preview-container">
      
      {/* Modal Overlay */}
      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ backgroundColor: '#1e293b', color: 'white', padding: '25px 35px', borderRadius: '8px', minWidth: '400px', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)' }}>
            <h3 style={{ marginTop: 0, borderBottom: '1px solid #475569', paddingBottom: '15px', fontSize: '18px' }}>Select Copies to Export</h3>
            
            <div style={{ display: 'flex', gap: '25px', margin: '30px 0', fontSize: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: selectedCopies['Original'] ? '#22c55e' : '#cbd5e1' }}>
                <input type="checkbox" checked={selectedCopies['Original']} onChange={() => handleCheckboxChange('Original')} style={{ transform: 'scale(1.3)', cursor: 'pointer' }} /> Original
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: selectedCopies['Duplicate'] ? '#22c55e' : '#cbd5e1' }}>
                <input type="checkbox" checked={selectedCopies['Duplicate']} onChange={() => handleCheckboxChange('Duplicate')} style={{ transform: 'scale(1.3)', cursor: 'pointer' }} /> Duplicate
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: selectedCopies['Transport'] ? '#22c55e' : '#cbd5e1' }}>
                <input type="checkbox" checked={selectedCopies['Transport']} onChange={() => handleCheckboxChange('Transport')} style={{ transform: 'scale(1.3)', cursor: 'pointer' }} /> Transport
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: selectedCopies['Performance'] ? '#22c55e' : '#cbd5e1' }}>
                <input type="checkbox" checked={selectedCopies['Performance']} onChange={() => handleCheckboxChange('Performance')} style={{ transform: 'scale(1.3)', cursor: 'pointer' }} /> Performance
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '15px', marginTop: '35px' }}>
              <button 
                onClick={() => setShowModal(false)}
                style={{ padding: '10px 18px', background: 'transparent', color: '#cbd5e1', border: '1px solid #475569', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                disabled={saving}
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveAndExport}
                style={{ padding: '10px 18px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                disabled={saving}
              >
                {saving ? 'Exporting...' : 'Export as PDF'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="preview-actions" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', width: '100%', borderBottom: '1px solid #ccc', paddingBottom: '10px', marginBottom: '10px' }}>
        <button className="btn-primary" onClick={() => setShowModal(true)} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Save size={18} /> {saving ? 'Processing...' : 'Save & Print'}
        </button>
      </div>

      <div className="a4-paper" ref={invoiceRef} style={dynamicTableStyles}>
        
        {/* Top Section (Stretches to push footer down) */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>

        {/* Top Header Row: Company Name & Logo Centered */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 'var(--g-mar)' }}>
          <div style={{ color: '#2a2a6b', fontFamily: '"Impact", "Arial Black", sans-serif', fontSize: 'calc(var(--f-title) * 0.75)', fontWeight: '900', letterSpacing: '1px' }}>
            ABTS
          </div>
          <div style={{ display: 'flex', alignItems: 'center', backgroundColor: 'transparent', marginTop: '15px', marginBottom: '12px', transform: 'scale(1.5)' }}>
            <div style={{ color: '#e6241a', fontSize: 'calc(var(--f-title) * 1.8)', fontWeight: '900', fontFamily: 'Arial, sans-serif', lineHeight: '1', transform: 'scaleY(0.85)' }}>M</div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 4px', transform: 'translateY(-2px)' }}>
              <div style={{ color: '#e6241a', fontSize: 'calc(var(--f-title) * 0.70)', fontWeight: '900', fontFamily: 'Arial, sans-serif', lineHeight: '1' }}>ILLENNIU</div>
              <div style={{ color: '#555', fontSize: 'calc(var(--f-title) * 0.40)', fontWeight: '900', fontFamily: 'Arial, sans-serif', lineHeight: '1', marginTop: '1px', letterSpacing: '0.5px' }}>HYDRAULICS</div>
            </div>
            <div style={{ color: '#e6241a', fontSize: 'calc(var(--f-title) * 1.8)', fontWeight: '900', fontFamily: 'Arial, sans-serif', lineHeight: '1', transform: 'scaleY(0.85)' }}>M</div>
          </div>
        </div>

        {/* Teal Banner Row */}
        <div style={{ backgroundColor: '#090a0a', color: 'white', padding: 'var(--r-pad)', fontSize: 'var(--f-row)', fontWeight: 'bold', display: 'flex', justifyContent: 'center', textAlign: 'center', marginBottom: 'var(--g-mar)' }}>
          Manufacturing & Hydraulic Machine Servicing & Remodification
        </div>

        {/* Address & Contact Row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--f-sm)', marginBottom: 'var(--g-mar)', color: '#333' }}>
          <div style={{ lineHeight: '1.4' }}>
            No.17, Balaji Layout, (Opposite to CSI Church) Aarupuliyamaram,<br />
            Rajiv Gandhi Road, Ganapathy,<br />
            Coimbatore - 641 006
          </div>
          <div style={{ textAlign: 'right', lineHeight: '1.4' }}>
            <span style={{fontWeight: 'bold'}}>Tel :</span> 98433 18897 / 98943 16685<br />
            <span style={{fontWeight: 'bold'}}>Web :</span> www.hydraulicservice.in<br />
            <span style={{fontWeight: 'bold'}}>Email :</span> mmhydraulics2013@gmail.com
          </div>
        </div>

        {/* Tax Invoice Banner Row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '2px solid black', borderBottom: '1px solid black', padding: 'calc(var(--r-pad) * 1.5) var(--r-pad)', fontSize: 'var(--f-row)', fontWeight: '900', color: '#000' }}>
          <div style={{ flex: 1, fontSize: 'calc(var(--f-hdr) * 1.1)' }}>GSTIN : 33ARUPM7277N1ZR</div>
          <div style={{ flex: 1, textAlign: 'center', fontSize: 'calc(var(--f-hdr) * 1.4)', letterSpacing: '2px', whiteSpace: 'nowrap' }}>{invoiceTitle}</div>
          <div style={{ flex: 1, textAlign: 'right', fontSize: 'var(--f-hdr)' }}>{activeCopyText}</div>
        </div>

        {/* 2-Column Info Table Wrapper */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', height: '140px', borderBottom: '1px solid black', borderLeft: '1px solid black', borderRight: '1px solid black', backgroundColor: 'transparent', margin: 0 }}>
          {/* Left Column: Buyer's Details */}
          <div style={{ borderRight: '1px solid black', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: 'var(--f-row)', borderBottom: '1px solid black', padding: 'var(--r-pad)' }}>{"Buyer's Details"}</div>
            <div style={{ padding: 'var(--r-pad)', fontSize: 'var(--f-row)', display: 'grid', gridTemplateColumns: '85px 1fr', gap: '2px', flex: 1, overflow: 'hidden' }}>
              <strong style={{color: '#000'}}>M/S</strong> <div style={{color: '#000'}}>{formData.customer_name || 'Customer Name'}</div>
              <strong style={{color: '#000'}}>Address</strong> <div style={{color: '#000', whiteSpace: 'pre-wrap', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden'}}>{formData.customer_address || 'Customer Address here...'}</div>
              <strong style={{color: '#000'}}>Phone</strong> <div style={{color: '#000'}}>{formData.customer_phone || '---'}</div>
              <strong style={{color: '#000'}}>GSTIN</strong> <div style={{color: '#000'}}>{formData.customer_gstin || '---'}</div>
              <strong style={{color: '#000'}}>Place of Supply</strong> <div style={{color: '#000'}}>{formData.place_of_supply}</div>
            </div>
          </div>

          {/* Right Column: Meta Info (2x2 Grid) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', fontSize: 'var(--f-row)' }}>
            
            {/* Cell 1: Invoice No. */}
            <div style={{ borderRight: '1px solid black', borderBottom: '1px solid black', padding: 'var(--r-pad)', display: 'flex', flexDirection: 'column' }}>
              <span>Invoice No.</span>
              <strong style={{ marginTop: 'auto' }}>{formData.invoice_no || ' '}</strong>
            </div>

            {/* Cell 2: Dated */}
            <div style={{ borderBottom: '1px solid black', padding: 'var(--r-pad)', display: 'flex', flexDirection: 'column' }}>
              <span>Dated</span>
              <strong style={{ marginTop: 'auto' }}>{(() => {
                if (!formData.invoice_date) return ' ';
                const [year, month, day] = formData.invoice_date.split('-');
                const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
                return `${day}- ${months[parseInt(month, 10) - 1]}-${year}`;
              })()}</strong>
            </div>

            {/* Cell 3: Delivery Note */}
            <div style={{ borderRight: '1px solid black', padding: 'var(--r-pad)', display: 'flex', flexDirection: 'column' }}>
              <span>Delivery Note</span>
              <strong style={{ marginTop: 'auto', whiteSpace: 'pre-wrap' }}>{formData.delivery_note || ' '}</strong>
            </div>

            {/* Cell 4: Mode/Terms of Payment */}
            <div style={{ padding: 'var(--r-pad)', display: 'flex', flexDirection: 'column' }}>
              <span>Mode/Terms of Payment</span>
              <strong style={{ marginTop: 'auto', whiteSpace: 'pre-wrap' }}>{formData.mode_of_payment || ' '}</strong>
            </div>

          </div>
        </div>

        {/* Main Items Table */}
        <table className="inv-table" style={{ flex: 1, borderCollapse: 'collapse', width: '100%', borderTop: 'none', marginBottom: 0, border: '1px solid black' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid black' }}>
              <th width="5%" className="center" style={{ borderRight: '1px solid black', backgroundColor: 'transparent', color: '#000', textTransform: 'none', fontSize: 'var(--f-row)', padding: 'var(--r-pad)', borderTop: 'none' }}>Sr. No.</th>
              <th width="45%" className="center" style={{ borderRight: '1px solid black', backgroundColor: 'transparent', color: '#000', textTransform: 'none', fontSize: 'var(--f-row)', padding: 'var(--r-pad)', borderTop: 'none' }}>Name of Product / Service</th>
              <th width="10%" className="center" style={{ borderRight: '1px solid black', backgroundColor: 'transparent', color: '#000', textTransform: 'none', fontSize: 'var(--f-row)', padding: 'var(--r-pad)', borderTop: 'none' }}>HSN / SAC</th>
              <th width="10%" className="center" style={{ borderRight: '1px solid black', backgroundColor: 'transparent', color: '#000', textTransform: 'none', fontSize: 'var(--f-row)', padding: 'var(--r-pad)', borderTop: 'none' }}>Qty</th>
              <th width="12%" className="center" style={{ borderRight: '1px solid black', backgroundColor: 'transparent', color: '#000', textTransform: 'none', fontSize: 'var(--f-row)', padding: 'var(--r-pad)', borderTop: 'none' }}>Rate</th>
              <th width="18%" className="center" style={{ backgroundColor: 'transparent', color: '#000', textTransform: 'none', fontSize: 'var(--f-row)', padding: 'var(--r-pad)', borderTop: 'none' }}>Taxable Value</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, idx) => (
              <tr key={idx} style={{ borderBottom: 'none' }}>
                <td className="center" style={{ borderRight: '1px solid black', borderBottom: 'none', borderLeft: 'none', padding: 'var(--r-pad)', verticalAlign: 'top', fontSize: 'var(--f-row)' }}>{idx + 1}</td>
                <td style={{ borderRight: '1px solid black', borderBottom: 'none', borderLeft: 'none', padding: 'var(--r-pad)', fontWeight: 'bold', verticalAlign: 'top', fontSize: 'var(--f-row)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.product_name}</td>
                <td className="center" style={{ borderRight: '1px solid black', borderBottom: 'none', borderLeft: 'none', padding: 'var(--r-pad)', verticalAlign: 'top', fontSize: 'var(--f-row)' }}>{it.hsn_sac}</td>
                <td className="center" style={{ borderRight: '1px solid black', borderBottom: 'none', borderLeft: 'none', padding: 'var(--r-pad)', verticalAlign: 'top', fontSize: 'var(--f-row)' }}>{it.qty} NOS</td>
                <td className="right" style={{ borderRight: '1px solid black', borderBottom: 'none', borderLeft: 'none', padding: 'var(--r-pad)', verticalAlign: 'top', fontSize: 'var(--f-row)' }}>{Number(it.rate).toFixed(2)}</td>
                <td className="right" style={{ borderBottom: 'none', borderLeft: 'none', borderRight: 'none', padding: 'var(--r-pad)', verticalAlign: 'top', fontSize: 'var(--f-row)' }}>{Number(it.taxable_value).toFixed(2)}</td>
              </tr>
            ))}
            {/* Blank filler rows to make the table look full natively without blowing up flex height */}
            {Array.from({ length: Math.max(0, 8 - items.length) }).map((_, idx) => (
              <tr key={`blank-${idx}`} style={{ borderBottom: 'none' }}>
                <td style={{ borderRight: '1px solid black', borderBottom: 'none', borderLeft: 'none', padding: 'var(--r-pad)' }}>&nbsp;</td>
                <td style={{ borderRight: '1px solid black', borderBottom: 'none', borderLeft: 'none', padding: 'var(--r-pad)' }}>&nbsp;</td>
                <td style={{ borderRight: '1px solid black', borderBottom: 'none', borderLeft: 'none', padding: 'var(--r-pad)' }}>&nbsp;</td>
                <td style={{ borderRight: '1px solid black', borderBottom: 'none', borderLeft: 'none', padding: 'var(--r-pad)' }}>&nbsp;</td>
                <td style={{ borderRight: '1px solid black', borderBottom: 'none', borderLeft: 'none', padding: 'var(--r-pad)' }}>&nbsp;</td>
                <td style={{ borderBottom: 'none', borderLeft: 'none', borderRight: 'none', padding: 'var(--r-pad)' }}>&nbsp;</td>
              </tr>
            ))}
            {/* Taxable Value Row */}
            <tr>
              <td style={{ borderRight: '1px solid black', borderBottom: 'none', borderLeft: 'none', borderTop: 'none' }}></td>
              <td className="right" style={{ borderRight: '1px solid black', borderBottom: 'none', borderLeft: 'none', borderTop: 'none', padding: 'var(--r-pad)' }}></td>
              <td style={{ borderRight: '1px solid black', borderBottom: 'none', borderLeft: 'none', borderTop: 'none' }}></td>
              <td style={{ borderRight: '1px solid black', borderBottom: 'none', borderLeft: 'none', borderTop: 'none' }}></td>
              <td style={{ borderRight: '1px solid black', borderBottom: 'none', borderLeft: 'none', borderTop: 'none' }}></td>
              <td className="right" style={{ borderBottom: 'none', borderLeft: 'none', borderRight: 'none', borderTop: 'none', padding: '0' }}>
                <div style={{ borderTop: '1px solid black', padding: 'var(--r-pad)', margin: '0', display: 'flex', justifyContent: 'flex-end', fontSize: 'var(--f-row)' }}>
                  <strong>{totals.total_taxable_value.toFixed(2)}</strong>
                </div>
              </td>
            </tr>
            {/* CGST, SGST & IGST Rows inside Main Table */}
            {totals.total_cgst > 0 && (
            <tr>
              <td style={{ borderRight: '1px solid black', borderBottom: 'none', borderLeft: 'none', borderTop: 'none' }}></td>
              <td className="right" style={{ borderRight: '1px solid black', borderBottom: 'none', borderLeft: 'none', borderTop: 'none', padding: '2px var(--r-pad)', fontWeight: 'bold', fontSize: 'var(--f-row)' }}>
                CGST ({items[0]?.cgst_percent ? Number(items[0].cgst_percent).toFixed(2) : '9.00'} %)
              </td>
              <td style={{ borderRight: '1px solid black', borderBottom: 'none', borderLeft: 'none', borderTop: 'none' }}></td>
              <td style={{ borderRight: '1px solid black', borderBottom: 'none', borderLeft: 'none', borderTop: 'none' }}></td>
              <td style={{ borderRight: '1px solid black', borderBottom: 'none', borderLeft: 'none', borderTop: 'none' }}></td>
              <td className="right" style={{ borderBottom: 'none', borderLeft: 'none', borderRight: 'none', borderTop: 'none', padding: '2px var(--r-pad)', verticalAlign: 'middle', fontSize: 'var(--f-row)' }}>
                {totals.total_cgst.toFixed(2)}
              </td>
            </tr>
            )}
            {totals.total_sgst > 0 && (
            <tr>
              <td style={{ borderRight: '1px solid black', borderBottom: 'none', borderLeft: 'none', borderTop: 'none' }}></td>
              <td className="right" style={{ borderRight: '1px solid black', borderBottom: 'none', borderLeft: 'none', borderTop: 'none', padding: '2px var(--r-pad)', fontWeight: 'bold', fontSize: 'var(--f-row)' }}>
                SGST ({items[0]?.sgst_percent ? Number(items[0].sgst_percent).toFixed(2) : '9.00'} %)
              </td>
              <td style={{ borderRight: '1px solid black', borderBottom: 'none', borderLeft: 'none', borderTop: 'none' }}></td>
              <td style={{ borderRight: '1px solid black', borderBottom: 'none', borderLeft: 'none', borderTop: 'none' }}></td>
              <td style={{ borderRight: '1px solid black', borderBottom: 'none', borderLeft: 'none', borderTop: 'none' }}></td>
              <td className="right" style={{ borderBottom: 'none', borderLeft: 'none', borderRight: 'none', borderTop: 'none', padding: '2px var(--r-pad)', verticalAlign: 'middle', fontSize: 'var(--f-row)' }}>
                {totals.total_sgst.toFixed(2)}
              </td>
            </tr>
            )}
            {totals.total_igst > 0 && (
            <tr>
              <td style={{ borderRight: '1px solid black', borderBottom: 'none', borderLeft: 'none', borderTop: 'none' }}></td>
              <td className="right" style={{ borderRight: '1px solid black', borderBottom: 'none', borderLeft: 'none', borderTop: 'none', padding: '2px var(--r-pad)', fontWeight: 'bold', fontSize: 'var(--f-row)' }}>
                IGST ({items[0]?.igst_percent ? Number(items[0].igst_percent).toFixed(2) : '18.00'} %)
              </td>
              <td style={{ borderRight: '1px solid black', borderBottom: 'none', borderLeft: 'none', borderTop: 'none' }}></td>
              <td style={{ borderRight: '1px solid black', borderBottom: 'none', borderLeft: 'none', borderTop: 'none' }}></td>
              <td style={{ borderRight: '1px solid black', borderBottom: 'none', borderLeft: 'none', borderTop: 'none' }}></td>
              <td className="right" style={{ borderBottom: 'none', borderLeft: 'none', borderRight: 'none', borderTop: 'none', padding: '2px var(--r-pad)', verticalAlign: 'middle', fontSize: 'var(--f-row)' }}>
                {totals.total_igst.toFixed(2)}
              </td>
            </tr>
            )}
            {/* Blank Spacer Row so it looks nicely paced */}
            <tr>
               <td style={{ height: 'calc(var(--g-mar) * 2)', borderRight: '1px solid black', borderBottom: 'none', borderLeft: 'none', borderTop: 'none' }}></td>
               <td style={{ borderRight: '1px solid black', borderBottom: 'none', borderLeft: 'none', borderTop: 'none' }}></td>
               <td style={{ borderRight: '1px solid black', borderBottom: 'none', borderLeft: 'none', borderTop: 'none' }}></td>
               <td style={{ borderRight: '1px solid black', borderBottom: 'none', borderLeft: 'none', borderTop: 'none' }}></td>
               <td style={{ borderRight: '1px solid black', borderBottom: 'none', borderLeft: 'none', borderTop: 'none' }}></td>
               <td style={{ borderBottom: 'none', borderLeft: 'none', borderRight: 'none', borderTop: 'none' }}></td>
            </tr>
            {/* Footer Summary Row */}
            <tr style={{ borderTop: '1px solid black' }}>
              <td colSpan="3" className="right" style={{ borderRight: '1px solid black', borderBottom: 'none', borderLeft: 'none', padding: 'var(--r-pad)', fontWeight: 'bold', fontSize: 'var(--f-row)' }}>Total</td>
              <td className="center" style={{ borderRight: '1px solid black', borderBottom: 'none', borderLeft: 'none', padding: 'var(--r-pad)', fontWeight: 'bold', fontSize: 'var(--f-row)' }}>
                {items.reduce((acc, it) => acc + (parseFloat(it.qty) || 0), 0)} NOS
              </td>
              <td style={{ borderRight: '1px solid black', borderBottom: 'none', borderLeft: 'none' }}></td>
              <td className="right" style={{ borderBottom: 'none', borderLeft: 'none', borderRight: 'none', padding: 'var(--r-pad)', fontWeight: 'bold', fontSize: 'var(--f-row)' }}>
                ₹ {totals.grand_total.toFixed(2)}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Total in words row */}
        <div style={{ borderLeft: '1px solid black', borderRight: '1px solid black', borderBottom: '1px solid black', padding: 'var(--r-pad)', fontSize: 'var(--f-row)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Amount Chargeable (in words)</span>
            <span style={{ fontSize: 'var(--f-xs)', fontWeight: 'bold' }}>(E &amp; O.E.)</span>
          </div>
          <div style={{ fontWeight: 'bold', marginTop: 'var(--r-pad)' }}>
            {amountInWords.toUpperCase()}
          </div>
        </div>

        {/* Tax Summary Table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid black', borderTop: 'none', borderBottom: 'none' }}>
          <thead>
            <tr style={{ fontSize: 'calc(var(--f-xs) - 0.5px)' }}>
              <th rowSpan="2" style={{ borderBottom: '1px solid black', borderRight: '1px solid black', padding: 'var(--r-pad)', width: '10%' }}>HSN/SAC</th>
              <th rowSpan="2" style={{ borderBottom: '1px solid black', borderRight: '1px solid black', padding: 'var(--r-pad)', width: '15%' }}>Taxable Value</th>
              <th colSpan="2" style={{ borderBottom: '1px solid black', borderRight: '1px solid black', padding: 'var(--r-pad)' }}>CGST Tax</th>
              <th colSpan="2" style={{ borderBottom: '1px solid black', borderRight: '1px solid black', padding: 'var(--r-pad)' }}>SGST Tax</th>
              <th colSpan="2" style={{ borderBottom: '1px solid black', borderRight: '1px solid black', padding: 'var(--r-pad)' }}>IGST Tax</th>
              <th rowSpan="2" style={{ borderBottom: '1px solid black', padding: 'var(--r-pad)', width: '15%' }}>Total Tax Amount</th>
            </tr>
            <tr style={{ fontSize: 'calc(var(--f-xs) - 0.5px)' }}>
              <th style={{ borderBottom: '1px solid black', borderRight: '1px solid black', padding: 'var(--r-pad)', width: '8%', fontWeight: 'normal' }}>Rate</th>
              <th style={{ borderBottom: '1px solid black', borderRight: '1px solid black', padding: 'var(--r-pad)', width: '12%', fontWeight: 'normal' }}>Amount</th>
              <th style={{ borderBottom: '1px solid black', borderRight: '1px solid black', padding: 'var(--r-pad)', width: '8%', fontWeight: 'normal' }}>Rate</th>
              <th style={{ borderBottom: '1px solid black', borderRight: '1px solid black', padding: 'var(--r-pad)', width: '12%', fontWeight: 'normal' }}>Amount</th>
              <th style={{ borderBottom: '1px solid black', borderRight: '1px solid black', padding: 'var(--r-pad)', width: '8%', fontWeight: 'normal' }}>Rate</th>
              <th style={{ borderBottom: '1px solid black', borderRight: '1px solid black', padding: 'var(--r-pad)', width: '12%', fontWeight: 'normal' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ fontSize: 'var(--f-xs)', borderBottom: '1px solid black' }}>
              <td style={{ borderRight: '1px solid black', padding: 'var(--r-pad)', textAlign: 'center' }}>
                {items[0]?.hsn_sac || '---'}
              </td>
              <td style={{ borderRight: '1px solid black', padding: 'var(--r-pad)', textAlign: 'right' }}>
                {totals.total_taxable_value.toFixed(2)}
              </td>
              <td style={{ borderRight: '1px solid black', padding: 'var(--r-pad)', textAlign: 'center' }}>
                {items[0]?.cgst_percent ? Number(items[0].cgst_percent).toFixed(2) + '%' : '0%'}
              </td>
              <td style={{ borderRight: '1px solid black', padding: 'var(--r-pad)', textAlign: 'right' }}>
                {totals.total_cgst.toFixed(2)}
              </td>
              <td style={{ borderRight: '1px solid black', padding: 'var(--r-pad)', textAlign: 'center' }}>
                {items[0]?.sgst_percent ? Number(items[0].sgst_percent).toFixed(2) + '%' : '0%'}
              </td>
              <td style={{ borderRight: '1px solid black', padding: 'var(--r-pad)', textAlign: 'right' }}>
                {totals.total_sgst.toFixed(2)}
              </td>
              <td style={{ borderRight: '1px solid black', padding: 'var(--r-pad)', textAlign: 'center' }}>
                {items[0]?.igst_percent ? Number(items[0].igst_percent).toFixed(2) + '%' : '0%'}
              </td>
              <td style={{ borderRight: '1px solid black', padding: 'var(--r-pad)', textAlign: 'right' }}>
                {totals.total_igst.toFixed(2)}
              </td>
              <td style={{ padding: 'var(--r-pad)', textAlign: 'right' }}>
                {(totals.total_cgst + totals.total_sgst + totals.total_igst).toFixed(2)}
              </td>
            </tr>
            <tr style={{ fontSize: 'var(--f-xs)', fontWeight: 'bold', borderBottom: '1px solid black' }}>
              <td style={{ borderRight: '1px solid black', padding: 'var(--r-pad)', textAlign: 'right' }}>TOTAL</td>
              <td style={{ borderRight: '1px solid black', padding: 'var(--r-pad)', textAlign: 'right' }}>{totals.total_taxable_value.toFixed(2)}</td>
              <td style={{ borderRight: '1px solid black', padding: 'var(--r-pad)', textAlign: 'center' }}></td>
              <td style={{ borderRight: '1px solid black', padding: 'var(--r-pad)', textAlign: 'right' }}>{totals.total_cgst.toFixed(2)}</td>
              <td style={{ borderRight: '1px solid black', padding: 'var(--r-pad)', textAlign: 'center' }}></td>
              <td style={{ borderRight: '1px solid black', padding: 'var(--r-pad)', textAlign: 'right' }}>{totals.total_sgst.toFixed(2)}</td>
              <td style={{ borderRight: '1px solid black', padding: 'var(--r-pad)', textAlign: 'center' }}></td>
              <td style={{ borderRight: '1px solid black', padding: 'var(--r-pad)', textAlign: 'right' }}>{totals.total_igst.toFixed(2)}</td>
              <td style={{ padding: 'var(--r-pad)', textAlign: 'right' }}>{(totals.total_cgst + totals.total_sgst + totals.total_igst).toFixed(2)}</td>
            </tr>
          </tbody>
        </table>

        {/* GST Tax Amount In Words Section */}
        <div style={{ borderLeft: '1px solid black', borderRight: '1px solid black', borderBottom: '1px solid black', padding: 'var(--r-pad)', fontSize: 'var(--f-row)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Total Tax Amount (in words)</span>
          </div>
          <div style={{ fontWeight: 'bold', marginTop: 'var(--r-pad)' }}>
            {numberToWords(Math.round(totals.total_cgst + totals.total_sgst + totals.total_igst)).toUpperCase()}
          </div>
        </div>


        </div>

        {/* Bottom Section (Pinned to absolute bottom) */}
        <div>

        {/* Unified Footer Box */}
        <div style={{ border: '1px solid black', marginTop: 'var(--g-mar)', width: '100%', display: 'flex', flexDirection: 'column' }}>
          
          {/* Top Section (Bank Details) - Full Width */}
          <div style={{ borderBottom: '1px solid black' }}>
            <div style={{ fontWeight: 'bold', padding: 'var(--r-pad)', borderBottom: '1px solid black', fontSize: 'var(--f-sm)' }}>
              {"Company's Bank Details"}
            </div>
            <div style={{ padding: 'var(--g-mar)', display: 'grid', gridTemplateColumns: '130px 1fr', gap: '2px', fontSize: 'var(--f-row)' }}>
              <div style={{fontWeight: 'normal'}}>Bank Name</div> <div style={{fontWeight: 'bold'}}>: Canara Bank</div>
              <div style={{fontWeight: 'normal'}}>A/c No.</div> <div style={{fontWeight: 'bold'}}>: 6040201000073</div>
              <div style={{fontWeight: 'normal'}}>Branch &amp; IFS Code</div> <div style={{fontWeight: 'bold'}}>: Rathinapuri &amp; CNRB0006040</div>
            </div>
          </div>

          {/* Bottom Grid Section (Terms vs Signatory) */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.3fr', flex: 1 }}>
            
            {/* Left Column (Terms) */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ textAlign: 'center', fontWeight: 'bold', padding: 'var(--r-pad)', borderBottom: '1px solid black', fontSize: 'var(--f-sm)' }}>
                Terms and Conditions
              </div>
              <div style={{ padding: 'var(--g-mar)', lineHeight: '1.4', fontSize: 'var(--f-xs)', borderBottom: '1px solid black', flex: 1 }}>
                We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.
              </div>
              <div style={{ padding: 'var(--g-mar) var(--r-pad)', fontWeight: 'bold', fontSize: 'var(--f-sm)', height: '60px' }}>
                Customer Signature
              </div>
            </div>

            {/* Right Column (Signatory) */}
            <div style={{ display: 'flex', flexDirection: 'column', borderLeft: '1px solid black' }}>
              <div style={{ textAlign: 'center', fontSize: 'var(--f-xs)', padding: 'var(--r-pad)' }}>
                Certified that the particulars given above are true and correct.
              </div>
              <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: 'calc(var(--f-sm) * 1.5)', borderBottom: '1px solid black', paddingBottom: 'var(--r-pad)' }}>
                For Millennium Hydraulics
              </div>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '85px' }}>
                 {/* Stamp/Signature Context Space */}
              </div>
              <div style={{ borderTop: '1px solid black', textAlign: 'center', padding: 'var(--r-pad)', fontSize: 'calc(var(--f-sm) * 1.5)', fontWeight: 'bold' }}>
                Authorised Signatory
              </div>
            </div>
            
          </div>
          
        </div>

        <div style={{ marginTop: '4px', fontSize: 'var(--f-xs)', textAlign: 'center' }}>
          <div style={{ textTransform: 'uppercase' }}>{"CUSTOMER'S SERVICES IS OUR PRIMARY DUTY"}</div>
          <div>This is a Computer Generated Invoice</div>
        </div>

        </div>

        </div>
      </div>
  );
}
