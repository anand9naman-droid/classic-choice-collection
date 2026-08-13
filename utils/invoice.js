const PDFDocument = require('pdfkit');
const config = require('../config/config');

/**
 * Streams a single invoice PDF for an order into the given writable stream
 * (an HTTP response, or a file/zip entry). Returns the PDFDocument so the
 * caller can decide when to end it (needed for zipping multiple invoices).
 */
function renderInvoice(order, destStream) {
  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  doc.pipe(destStream);

  const biz = config.BUSINESS;

  // ---- Header ----
  doc.fontSize(18).fillColor('#ea580c').text(biz.name, { continued: false });
  doc.fontSize(10).fillColor('#555').text(`${biz.tagline} — ${biz.positioning}`);
  doc.text(biz.address);
  doc.text(`${biz.email}  |  ${biz.phones.join(' / ')}`);
  doc.moveDown(1);
  doc.strokeColor('#ea580c').lineWidth(1.5).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
  doc.moveDown(0.8);

  // ---- Invoice meta ----
  doc.fontSize(14).fillColor('#000').text('TAX INVOICE', { align: 'right' });
  doc.fontSize(10).fillColor('#333');
  doc.text(`Invoice / Order No: ${order.orderNumber}`, { align: 'right' });
  doc.text(`Date: ${new Date(order.createdAt).toLocaleDateString('en-IN')}`, { align: 'right' });
  doc.text(`Payment Method: ${order.paymentMethod || 'UPI'}`, { align: 'right' });
  doc.text(`Payment Status: ${order.paymentStatus}`, { align: 'right' });
  doc.text(`Order Status: ${order.status}`, { align: 'right' });
  doc.moveDown(1);

  // ---- Bill to ----
  doc.fontSize(11).fillColor('#000').text('Bill To / Ship To:', { underline: true });
  doc.fontSize(10).fillColor('#333');
  doc.text(order.address.name);
  doc.text(order.address.addressLine);
  doc.text(`${order.address.city}, ${order.address.district || ''} ${order.address.state} - ${order.address.pincode}`);
  doc.text(`Phone: ${order.address.phone}`);
  doc.moveDown(1);

  // ---- Items table ----
  const tableTop = doc.y;
  doc.fontSize(10).fillColor('#fff');
  doc.rect(40, tableTop, 515, 20).fill('#ea580c');
  doc.fillColor('#fff');
  doc.text('Item', 46, tableTop + 5, { width: 220 });
  doc.text('Size/Color', 270, tableTop + 5, { width: 100 });
  doc.text('Qty', 375, tableTop + 5, { width: 40, align: 'right' });
  doc.text('Price', 420, tableTop + 5, { width: 60, align: 'right' });
  doc.text('Amount', 485, tableTop + 5, { width: 65, align: 'right' });

  let y = tableTop + 24;
  doc.fillColor('#000').fontSize(9.5);
  order.items.forEach((item) => {
    const variant = [item.size, item.color].filter(Boolean).join(' / ') || '-';
    doc.text(item.name, 46, y, { width: 220 });
    doc.text(variant, 270, y, { width: 100 });
    doc.text(String(item.qty), 375, y, { width: 40, align: 'right' });
    doc.text(`₹${item.price}`, 420, y, { width: 60, align: 'right' });
    doc.text(`₹${item.price * item.qty}`, 485, y, { width: 65, align: 'right' });
    y += 20;
  });
  doc.moveTo(40, y).lineTo(555, y).strokeColor('#ddd').stroke();
  y += 10;

  // ---- Totals ----
  doc.fontSize(10);
  doc.text('Subtotal:', 400, y, { width: 90, align: 'right' });
  doc.text(`₹${order.subtotal}`, 485, y, { width: 65, align: 'right' });
  y += 16;
  doc.text('Delivery:', 400, y, { width: 90, align: 'right' });
  doc.text(order.delivery ? `₹${order.delivery}` : 'Free', 485, y, { width: 65, align: 'right' });
  y += 16;
  doc.fontSize(11).fillColor('#ea580c');
  doc.text('Total:', 400, y, { width: 90, align: 'right' });
  doc.text(`₹${order.total}`, 485, y, { width: 65, align: 'right' });
  y += 30;

  if (order.trackingNumber) {
    doc.fontSize(10).fillColor('#333');
    doc.text(`Courier: ${order.courierName || '-'}   Tracking No: ${order.trackingNumber}`, 40, y);
    y += 20;
  }

  doc.fontSize(8).fillColor('#999').text(
    'This is a computer-generated invoice. For queries contact us on WhatsApp or the phone numbers above.',
    40, 780, { width: 515, align: 'center' }
  );

  return doc;
}

module.exports = { renderInvoice };
