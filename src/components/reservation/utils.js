export const generateInvoiceNo = (resNo) => `INV-${resNo}-${Date.now().toString().slice(-6)}`

export const resDiscount = (res) =>
  res.discount_type === 'fixed'
    ? { type: 'fixed', value: Number(res.discount_val) || 0 }
    : (Number(res.discount_pct) || 0)

export const PRESET_PREFERENCES = [
  'Quiet room', 'High floor', 'Low floor', 'Twin beds', 'King bed',
  'Extra pillows', 'Extra blanket', 'Early check-in', 'Late check-out',
  'Airport pickup', 'Vegan meals', 'Vegetarian', 'Halal meals',
  'No smoking', 'Accessible room', 'Baby cot', 'Honeymoon setup',
]
