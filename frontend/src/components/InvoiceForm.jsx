import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import axios from 'axios';

export default function InvoiceForm({ formData, setFormData, items, setItems }) {
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleGstinBlur = async () => {
    if (!formData.customer_gstin || formData.customer_gstin.trim() === '') return;
    try {
      const res = await axios.get(`http://localhost:5000/api/customers/${formData.customer_gstin}`);
      if (res.data) {
        setFormData(prev => ({
          ...prev,
          customer_name: res.data.customer_name || prev.customer_name || '',
          customer_address: res.data.customer_address || prev.customer_address || '',
          customer_phone: res.data.customer_phone || prev.customer_phone || ''
        }));
      }
    } catch(err) {
      // Ignore gracefully if this is a new customer not in the DB
    }
  };

  const handleItemChange = (index, e) => {
    const { name, value } = e.target;
    const newItems = [...items];
    newItems[index][name] = value;
    
    // Auto-fill HSN/SAC and full names based on specific product keywords
    if (name === 'product_name') {
      let currentVal = value;
      const lowerName = value.toLowerCase();
      
      // Auto-replace shortcuts
      if (lowerName === 'cylinder service' || lowerName === 'hydraulic cylinder service') {
        currentVal = 'Hydraulic Cylinder Service';
        newItems[index].hsn_sac = '998719';
      } else if (lowerName === 'cylinder manufacturers' || lowerName === 'hydraulic cylinder manufacturers') {
        currentVal = 'Hydraulic Cylinder Manufacturers';
        newItems[index].hsn_sac = '84122100';
      } else if (lowerName === 'power pack manufacturers' || lowerName === 'hydraulic power pack manufacturers') {
        currentVal = 'Hydraulic Power Pack Manufacturers';
        newItems[index].hsn_sac = '84122990';
      } else if (lowerName === 'power pack services' || lowerName === 'hydraulic power pack services') {
        currentVal = 'Hydraulic Power Pack Services';
        newItems[index].hsn_sac = '998719';
      } else if (lowerName.includes('pipe') || lowerName.includes('pip')) {
        newItems[index].hsn_sac = '4009';
      } else if (lowerName.includes('pump') || lowerName.includes('pum')) {
        newItems[index].hsn_sac = '8413';
      }

      newItems[index].product_name = currentVal;
    }

    // Auto calculate if qty, rate or cgst/sgst/igst changes
    if (['qty', 'rate', 'cgst_percent', 'sgst_percent', 'igst_percent'].includes(name)) {
      const qty = parseFloat(newItems[index].qty) || 0;
      const rate = parseFloat(newItems[index].rate) || 0;
      const taxable = qty * rate;
      const cgstPercent = parseFloat(newItems[index].cgst_percent) || 0;
      const sgstPercent = parseFloat(newItems[index].sgst_percent) || 0;
      const igstPercent = parseFloat(newItems[index].igst_percent) || 0;
      
      const cgstAmount = (taxable * cgstPercent) / 100;
      const sgstAmount = (taxable * sgstPercent) / 100;
      const igstAmount = (taxable * igstPercent) / 100;
      
      newItems[index].taxable_value = taxable.toFixed(2);
      newItems[index].cgst_amount = cgstAmount.toFixed(2);
      newItems[index].sgst_amount = sgstAmount.toFixed(2);
      newItems[index].igst_amount = igstAmount.toFixed(2);
      newItems[index].total = (taxable + cgstAmount + sgstAmount + igstAmount).toFixed(2);
    }
    
    setItems(newItems);
  };

  const addItem = () => {
    const lastItem = items[items.length - 1];
    setItems((prev) => [
      ...prev,
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
        total: 0
      }
    ]);
  };

  const removeItem = (index) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="lhs-form">
      <datalist id="common-products">
        <option value="Hydraulic Cylinder Service" />
        <option value="Hydraulic Cylinder Manufacturers" />
        <option value="Hydraulic Power Pack Manufacturers" />
        <option value="Hydraulic Power Pack Services" />
      </datalist>

      <h1 className="app-title">Millennium Hydraulics - Billing</h1>
      
      <div className="form-section">
        <h2 className="form-title">Invoice Details</h2>
        <div className="grid-2">
          <div className="form-group">
            <label>Invoice Number</label>
            <input type="text" className="form-control" name="invoice_no" value={formData.invoice_no || ''} onChange={handleChange} placeholder="Fetching..." />
          </div>
          <div className="form-group">
            <label>Invoice Date</label>
            <input type="date" className="form-control" name="invoice_date" value={formData.invoice_date || ''} onChange={handleChange} />
          </div>
        </div>
        <div className="grid-2" style={{ marginTop: '1rem' }}>
          <div className="form-group">
            <label>Delivery Note</label>
            <input type="text" className="form-control" name="delivery_note" value={formData.delivery_note || ''} onChange={handleChange} placeholder="Optional" />
          </div>
          <div className="form-group">
            <label>Mode/Terms of Payment</label>
            <input type="text" className="form-control" name="mode_of_payment" value={formData.mode_of_payment || ''} onChange={handleChange} placeholder="Optional" />
          </div>
        </div>
      </div>

      <div className="form-section">
        <h2 className="form-title">Buyers Details</h2>
        <div className="form-group" style={{ marginBottom: '1rem' }}>
          <label>Customer Name</label>
          <input type="text" className="form-control" name="customer_name" value={formData.customer_name || ''} onChange={handleChange} placeholder="E.g. XYZ Enterprises" />
        </div>
        <div className="form-group" style={{ marginBottom: '1rem' }}>
          <label>Address</label>
          <textarea className="form-control" name="customer_address" value={formData.customer_address || ''} onChange={handleChange} rows="3" placeholder="Customer address..."></textarea>
        </div>
        <div className="grid-2" style={{ marginBottom: '1rem' }}>
          <div className="form-group">
            <label>Phone Number</label>
            <input type="tel" className="form-control" name="customer_phone" value={formData.customer_phone || ''} onChange={handleChange} placeholder="1234567890" />
          </div>
          <div className="form-group">
            <label>GSTIN</label>
            <input type="text" className="form-control" name="customer_gstin" value={formData.customer_gstin || ''} onChange={handleChange} onBlur={handleGstinBlur} placeholder="e.g. 33AAAAA0000A1Z5" />
          </div>
        </div>
        <div className="form-group" style={{ marginBottom: '1rem' }}>
          <label>Place of Supply</label>
          <select className="form-control" name="place_of_supply" value={formData.place_of_supply || 'Tamil Nadu (33)'} onChange={handleChange}>
            <option value="Kerala (32)">Kerala (32)</option>
            <option value="Tamil Nadu (33)">Tamil Nadu (33)</option>
            <option value="Puducherry (Pondicherry) (34)">Puducherry (Pondicherry) (34)</option>
          </select>
        </div>
      </div>

      <div className="form-section">
        <h2 className="form-title">Products / Services</h2>
        {items.map((item, index) => (
          <div key={index} className="item-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontWeight: 'bold', color: 'var(--primary)' }}>Sl No: {index + 1}</span>
              {items.length > 1 && (
                <button className="btn-remove" onClick={() => removeItem(index)} title="Remove Item"><Trash2 size={16} /></button>
              )}
            </div>
            <div className="form-group" style={{ marginBottom: '1rem', paddingRight: '2rem' }}>
              <label>Product Name</label>
              <input type="text" className="form-control" name="product_name" list="common-products" value={item.product_name} onChange={(e) => handleItemChange(index, e)} placeholder="Description of Product/Service" />
            </div>
            <div className="grid-2" style={{ gridTemplateColumns: '1.2fr 0.8fr 1.2fr 0.8fr 0.8fr 0.8fr', gap: '10px' }}>
              <div className="form-group">
                <label>HSN / SAC</label>
                <input type="text" className="form-control" name="hsn_sac" value={item.hsn_sac} onChange={(e) => handleItemChange(index, e)} />
              </div>
              <div className="form-group">
                <label>Qty</label>
                <input type="number" step="0.01" className="form-control" name="qty" value={item.qty} onChange={(e) => handleItemChange(index, e)} />
              </div>
              <div className="form-group">
                <label>Rate (₹)</label>
                <input type="number" step="0.01" className="form-control" name="rate" value={item.rate === 0 ? '' : item.rate} onChange={(e) => handleItemChange(index, e)} />
              </div>
              <div className="form-group">
                <label>CGST (%)</label>
                <input type="number" step="1" className="form-control" name="cgst_percent" value={item.cgst_percent} onChange={(e) => handleItemChange(index, e)} />
              </div>
              <div className="form-group">
                <label>SGST (%)</label>
                <input type="number" step="1" className="form-control" name="sgst_percent" value={item.sgst_percent} onChange={(e) => handleItemChange(index, e)} />
              </div>
              <div className="form-group">
                <label>IGST (%)</label>
                <input type="number" step="1" className="form-control" name="igst_percent" value={item.igst_percent} onChange={(e) => handleItemChange(index, e)} />
              </div>
            </div>

            
            <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'var(--panel-bg)', borderRadius: '6px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Taxable: ₹{item.taxable_value} | CGST: ₹{item.cgst_amount} | SGST: ₹{item.sgst_amount} | IGST: ₹{item.igst_amount} | <strong style={{color: 'var(--text-main)'}}>Line Total: ₹{item.total}</strong>
            </div>
          </div>
        ))}
        
        <button onClick={addItem} className="btn-add">
          <Plus size={18} /> Add Another Item
        </button>
      </div>

    </div>
  );
}
