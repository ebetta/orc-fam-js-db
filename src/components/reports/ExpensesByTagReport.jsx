import React, { useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingDown, Inbox, X, Printer, FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const formatCurrency = (amount) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount);

export default function ExpensesByTagReport({ transactions, tags, isLoading, onClose, isPopup = false, forPrint = false }) {
    const reportRef = useRef();
    const reportData = React.useMemo(() => {
        const expenseTransactions = transactions.filter(t => t.transaction_type === 'expense');
        const dataByTag = {};
        expenseTransactions.forEach(t => {
            const tag = tags.find(tag => tag.id === t.tag_id);
            const tagName = tag ? tag.name : 'Sem Tag';
            const tagColor = tag ? tag.color : '#A1A1AA';
            if (!dataByTag[tagName]) {
                dataByTag[tagName] = { total: 0, count: 0, color: tagColor };
            }
            dataByTag[tagName].total += parseFloat(t.amount || 0);
            dataByTag[tagName].count++;
        });
        return Object.entries(dataByTag)
            .map(([name, data]) => ({ name, ...data }))
            .sort((a, b) => b.total - a.total);
    }, [transactions, tags]);

    const totalExpenses = reportData.reduce((sum, item) => sum + item.total, 0);

    const handleExportPDF = React.useCallback(async () => {
        const input = reportRef.current;
        const buttons = input.querySelector('.report-buttons');
        if (buttons) buttons.style.display = 'none';
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 14;
        const contentWidth = pageWidth - margin * 2;
        let y = margin;

        const renderElement = async (el) => {
            const canvas = await html2canvas(el, { scale: 2, useCORS: true });
            const imgData = canvas.toDataURL('image/png');
            const imgHeight = (canvas.height * contentWidth) / canvas.width;
            if (y + imgHeight > pageHeight - margin) {
                pdf.addPage();
                y = margin;
            }
            pdf.addImage(imgData, 'PNG', margin, y, contentWidth, imgHeight);
            y += imgHeight + 2;
        };

        const headerEl = input.querySelector('.report-header-for-pdf');
        if (headerEl) await renderElement(headerEl);

        const tableHeaderEl = input.querySelector('table > thead');
        let tableHeaderCanvasData = null;
        let tableHeaderImgHeight = 0;
        if (tableHeaderEl) {
            const thCanvas = await html2canvas(tableHeaderEl, { scale: 2, useCORS: true });
            tableHeaderCanvasData = thCanvas.toDataURL('image/png');
            tableHeaderImgHeight = (thCanvas.height * contentWidth) / thCanvas.width;
        }

        const addTableHeader = () => {
            if (!tableHeaderCanvasData) return;
            if (y + tableHeaderImgHeight > pageHeight - margin) {
                pdf.addPage();
                y = margin;
            }
            pdf.addImage(tableHeaderCanvasData, 'PNG', margin, y, contentWidth, tableHeaderImgHeight);
            y += tableHeaderImgHeight + 2;
        };

        if (tableHeaderCanvasData) addTableHeader();

        const rowEls = input.querySelectorAll('.expense-row');
        for (const rowEl of rowEls) {
            const canvas = await html2canvas(rowEl, { scale: 2, useCORS: true });
            const rowImgHeight = (canvas.height * contentWidth) / canvas.width;
            if (y + rowImgHeight > pageHeight - margin) {
                pdf.addPage();
                y = margin;
                addTableHeader();
            }
            const imgData = canvas.toDataURL('image/png');
            pdf.addImage(imgData, 'PNG', margin, y, contentWidth, rowImgHeight);
            y += rowImgHeight + 2;
        }

        const footerEl = input.querySelector('.report-footer');
        if (footerEl) await renderElement(footerEl);

        if (buttons) buttons.style.display = 'flex';
        const now = new Date();
        const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
        pdf.save(`relatorio_despesas_por_tag_${timestamp}.pdf`);
    }, []);

    const handlePrint = React.useCallback(() => {
        const printContent = document.getElementById('expenses-report-content');
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
                <head>
                    <title>Relatório de Despesas por Tags</title>
                    <style>
                        body { font-family: Arial, sans-serif; margin: 20px; }
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                        th { background-color: #f5f5f5; font-weight: bold; }
                        .header { text-align: center; margin-bottom: 20px; }
                        .tag-color { width: 10px; height: 10px; border-radius: 50%; display: inline-block; margin-right: 8px; }
                        .text-right { text-align: right; }
                        .text-center { text-align: center; }
                        .footer { background-color: #f5f5f5; font-weight: bold; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>Relatório de Despesas por Tags</h1>
                        <p>Gerado em: ${new Date().toLocaleDateString('pt-BR')}</p>
                    </div>
                    ${printContent.innerHTML}
                </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.print();
        printWindow.close();
    }, []);

    useEffect(() => {
        const reportContent = document.getElementById('expenses-report-content');
        if (reportContent) {
            const handleExportEvent = () => handleExportPDF();
            const handlePrintEvent = () => handlePrint();
            reportContent.addEventListener('exportPDF', handleExportEvent);
            reportContent.addEventListener('printReport', handlePrintEvent);
            return () => {
                reportContent.removeEventListener('exportPDF', handleExportEvent);
                reportContent.removeEventListener('printReport', handlePrintEvent);
            };
        }
    }, [handleExportPDF, handlePrint]);

    return (
        <div ref={reportRef}>
            <Card className={`${forPrint ? 'shadow-none border border-[#E2E8F0] rounded-none' : 'shadow-lg border-0'} ${isPopup ? 'bg-white' : ''}`}>
                <CardHeader className={`border-b ${forPrint ? 'bg-white' : 'bg-[#eff4ff]'} report-header-for-pdf`}>
                    <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2 text-[#0b1c30]">
                            <TrendingDown className={`w-5 h-5 ${forPrint ? 'text-[#ba1a1a]' : 'text-red-600'}`} />
                            Despesas por Tags
                        </CardTitle>
                        {isPopup && (
                            <div className="flex items-center gap-2 report-buttons">
                                <Button variant="ghost" size="icon" onClick={handleExportPDF} title="Salvar como PDF">
                                    <FileDown className="w-5 h-5" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={handlePrint} title="Imprimir relatório">
                                    <Printer className="w-5 h-5" />
                                </Button>
                                {onClose && (
                                    <Button variant="ghost" size="icon" onClick={onClose}>
                                        <X className="w-5 h-5" />
                                    </Button>
                                )}
                            </div>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="p-0" id="expenses-report-content">
                    {isLoading ? (
                        <div className="p-6 space-y-2">
                            <Skeleton className="h-6 w-full" />
                            <Skeleton className="h-6 w-full" />
                            <Skeleton className="h-6 w-5/6" />
                        </div>
                    ) : reportData.length > 0 ? (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="text-[#0b1c30]">Tag</TableHead>
                                    <TableHead className="text-center text-[#0b1c30]">Qtd.</TableHead>
                                    <TableHead className="text-right text-[#0b1c30]">Total Gasto</TableHead>
                                </TableRow>
                            </TableHeader>
                            {reportData.map(item => (
                                <TableBody key={item.name} className="expense-row">
                                    <TableRow>
                                        <TableCell className="font-medium flex items-center gap-2 text-[#0b1c30]">
                                            <span className="w-2.5 h-2.5 rounded-full tag-color" style={{ backgroundColor: item.color }}></span>
                                            {item.name}
                                        </TableCell>
                                        <TableCell className="text-center text-[#3c4a42]">{item.count}</TableCell>
                                        <TableCell className="text-right font-medium text-[#0b1c30]">{formatCurrency(item.total)}</TableCell>
                                    </TableRow>
                                </TableBody>
                            ))}
                            <TableFooter>
                                <TableRow className={`${forPrint ? 'bg-white' : 'bg-[#f8f9ff]'} hover:bg-[#f8f9ff] footer report-footer`}>
                                    <TableCell colSpan={2} className="font-bold text-[#0b1c30]">Total Geral</TableCell>
                                    <TableCell className="text-right font-bold text-[#0b1c30]">{formatCurrency(totalExpenses)}</TableCell>
                                </TableRow>
                            </TableFooter>
                        </Table>
                    ) : (
                        <div className="text-center py-12 px-6">
                            <Inbox className="w-12 h-12 text-[#bbcabf] mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-[#0b1c30]">Nenhum dado encontrado</h3>
                            <p className="text-[#6c7a71] text-sm">Nenhuma despesa encontrada para os filtros selecionados.</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
