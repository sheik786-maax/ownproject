import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import InvoiceForm from './components/InvoiceForm';
import InvoicePreview from './components/InvoicePreview';

function App() {
  const [formData, setFormData] = useState({
    invoice_no: '',
    invoice_date: new Date().toISOString().split('T')[0],
    customer_name: '',
    customer_address: '',
    customer_phone: '',
    customer_gstin: '',
    place_of_supply: '',
    delivery_note: '',
    mode_of_payment: ''
  });

  const [items, setItems] = useState([
    {
      product_name: '',
      hsn_sac: '',
      qty: 1,
      rate: 0,
      taxable_value: 0,
      cgst_percent: 9,
      cgst_amount: 0,
      sgst_percent: 9,
      sgst_amount: 0,
      igst_percent: 0,
      igst_amount: 0,
      total: 0
    }
  ]);

  // Fetch next invoice number on mount
  useEffect(() => {
    async function fetchNextInvoiceNo() {
      try {
        const res = await axios.get('http://localhost:5000/api/invoices/next-number');
        if (res.data.nextInvoiceNo) {
          setFormData((prev) => ({ ...prev, invoice_no: res.data.nextInvoiceNo }));
        }
      } catch (err) {
        console.error("Failed to fetch invoice number", err);
      }
    }
    fetchNextInvoiceNo();
  }, []);

  const totals = useMemo(() => {
    let tv = 0, cgst = 0, sgst = 0, igst = 0, gTotal = 0;
    items.forEach(it => {
      tv += parseFloat(it.taxable_value) || 0;
      cgst += parseFloat(it.cgst_amount) || 0;
      sgst += parseFloat(it.sgst_amount) || 0;
      igst += parseFloat(it.igst_amount) || 0;
      gTotal += parseFloat(it.total) || 0;
    });
    return {
      total_taxable_value: tv,
      total_cgst: cgst,
      total_sgst: sgst,
      total_igst: igst,
      grand_total: gTotal
    };
  }, [items]);

  const handleExportPdf = () => {
    // Optionally auto-increment invoice number mathematically on export
    setFormData(prev => {
      const parts = prev.invoice_no.split('-');
      if (parts.length === 3 && !isNaN(parts[2])) {
        const num = parseInt(parts[2], 10) + 1;
        const newInvoiceNo = `${parts[0]}-${parts[1]}-${String(num).padStart(4, '0')}`;
        return { ...prev, invoice_no: newInvoiceNo };
      }
      return prev;
    });
  };

  const handleSaved = async () => {
    // Optionally clear form or refetch next invoice no
    try {
      const res = await axios.get('http://localhost:5000/api/invoices/next-number');
      if (res.data.nextInvoiceNo) {
        setFormData({
          invoice_no: res.data.nextInvoiceNo,
          invoice_date: new Date().toISOString().split('T')[0],
          customer_name: '',
          customer_address: '',
          customer_phone: '',
          customer_gstin: '',
          place_of_supply: 'Tamil Nadu (33)'
        });
        setItems([{ product_name: '', hsn_sac: '', qty: 1, rate: 0, taxable_value: 0, cgst_percent: 9, cgst_amount: 0, sgst_percent: 9, sgst_amount: 0, igst_percent: 0, igst_amount: 0, total: 0 }]);
      }
    } catch (err) {
      console.error("Failed to refresh next invoice number on save", err);
    }
  };

  return (
    <div className="app-container">
      <InvoiceForm
        formData={formData}
        setFormData={setFormData}
        items={items}
        setItems={setItems}
      />
      <InvoicePreview
        formData={formData}
        items={items}
        totals={totals}
        onSaved={handleSaved}
        onExport={handleExportPdf}
      />
    </div>
  );
}

export default App;
