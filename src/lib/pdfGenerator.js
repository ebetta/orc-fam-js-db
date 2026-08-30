import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const MARGIN = 14;

async function renderToPdfImage(el, pdf, y, contentWidth, pageHeight) {
    const canvas = await html2canvas(el, { scale: 2, useCORS: true, logging: false });
    const imgData = canvas.toDataURL('image/png');
    const imgHeight = (canvas.height * contentWidth) / canvas.width;

    if (y + imgHeight > pageHeight - MARGIN) {
        pdf.addPage();
        y = MARGIN;
    }

    pdf.addImage(imgData, 'PNG', MARGIN, y, contentWidth, imgHeight);
    return y + imgHeight + 2;
}

export async function generatePdfBlobUrl(elementId) {
    const element = document.getElementById(elementId);
    if (!element) throw new Error('Elemento não encontrado');

    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const contentWidth = pageWidth - MARGIN * 2;
    let y = MARGIN;

    const headerEl = element.querySelector('.report-header-for-pdf');
    const tableHeaderEl = element.querySelector('table > thead');

    let tableHeaderCanvasData = null;
    let tableHeaderImgHeight = 0;

    if (headerEl) {
        y = await renderToPdfImage(headerEl, pdf, y, contentWidth, pageHeight);
    }

    if (tableHeaderEl) {
        const headerCanvas = await html2canvas(tableHeaderEl, { scale: 2, useCORS: true, logging: false });
        tableHeaderCanvasData = headerCanvas.toDataURL('image/png');
        tableHeaderImgHeight = (headerCanvas.height * contentWidth) / headerCanvas.width;
    }

    const addTableHeader = (pdf, yPos) => {
        if (!tableHeaderCanvasData) return yPos;
        if (yPos + tableHeaderImgHeight > pageHeight - MARGIN) {
            pdf.addPage();
            yPos = MARGIN;
        }
        pdf.addImage(tableHeaderCanvasData, 'PNG', MARGIN, yPos, contentWidth, tableHeaderImgHeight);
        return yPos + tableHeaderImgHeight + 2;
    };

    if (tableHeaderCanvasData) {
        y = addTableHeader(pdf, y);
    }

    const groupEls = element.querySelectorAll('.budget-group, .overrun-group');
    const rowEls = element.querySelectorAll('.expense-row');

    const items = groupEls.length > 0 ? groupEls : rowEls;

    for (const item of items) {
        const canvas = await html2canvas(item, { scale: 2, useCORS: true, logging: false });
        const itemImgHeight = (canvas.height * contentWidth) / canvas.width;

        if (y + itemImgHeight > pageHeight - MARGIN) {
            pdf.addPage();
            y = MARGIN;
            if (tableHeaderCanvasData) {
                y = addTableHeader(pdf, y);
            }
        }

        const imgData = canvas.toDataURL('image/png');
        pdf.addImage(imgData, 'PNG', MARGIN, y, contentWidth, itemImgHeight);
        y += itemImgHeight + 2;
    }

    // Um relatório pode ter mais de uma linha de rodapé (ex.: totais + reconciliação).
    const footerEls = element.querySelectorAll('.report-footer');
    for (const footerEl of footerEls) {
        if (y > pageHeight - MARGIN - 30) {
            pdf.addPage();
            y = MARGIN;
        }
        y = await renderToPdfImage(footerEl, pdf, y, contentWidth, pageHeight);
    }

    const blob = pdf.output('blob');
    return URL.createObjectURL(blob);
}
