// public/js/pdf-export.js
// PERSONA 6 (Producto): exportación real a PDF con marca, en vez de solo window.print().
// Se usa jsPDF + html2canvas en el cliente (CDN, sin backend) para que también
// funcione sin conexión a internet, coherente con el enfoque offline-first del sistema.

export async function exportDocumentToPdf(paperEl, { fileName = 'Propuesta_Master_Hands.pdf', title = '', clientName = '' } = {}) {
  if (!window.jspdf || !window.html2canvas) {
    throw new Error('Las librerías de exportación PDF aún no cargan. Intenta de nuevo en unos segundos.');
  }
  const { jsPDF } = window.jspdf;

  const canvas = await window.html2canvas(paperEl, { scale: 2, backgroundColor: '#f6f3ec', useCORS: true });
  const imgData = canvas.toDataURL('image/png');

  const pdf = new jsPDF({ unit: 'pt', format: 'letter' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 36;
  const usableWidth = pageWidth - margin * 2;
  const imgHeight = (canvas.height * usableWidth) / canvas.width;

  // Encabezado de marca
  pdf.setFillColor(16, 17, 19);
  pdf.rect(0, 0, pageWidth, 46, 'F');
  pdf.setTextColor(224, 164, 104);
  pdf.setFontSize(13);
  pdf.text('MASTER HANDS — Acoustic Project OS', margin, 29);

  let heightLeft = imgHeight;
  let position = 56;
  pdf.addImage(imgData, 'PNG', margin, position, usableWidth, imgHeight);
  heightLeft -= (pageHeight - position - margin);

  while (heightLeft > 0) {
    pdf.addPage();
    position = heightLeft - imgHeight + margin;
    pdf.addImage(imgData, 'PNG', margin, position, usableWidth, imgHeight);
    heightLeft -= (pageHeight - margin * 2);
  }

  pdf.save(fileName);
  return pdf.output('datauristring').split(',')[1]; // base64 sin el prefijo, útil para adjuntar por email
}

export async function getDocumentPdfBase64(paperEl) {
  const { jsPDF } = window.jspdf;
  const canvas = await window.html2canvas(paperEl, { scale: 2, backgroundColor: '#f6f3ec', useCORS: true });
  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({ unit: 'pt', format: 'letter' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 36;
  const usableWidth = pageWidth - margin * 2;
  const imgHeight = (canvas.height * usableWidth) / canvas.width;
  pdf.addImage(imgData, 'PNG', margin, 40, usableWidth, imgHeight);
  return pdf.output('datauristring').split(',')[1];
}
