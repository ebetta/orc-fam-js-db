import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, Inbox, X, Printer, FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import BudgetGauge from '@/components/ui/BudgetGauge';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const formatCurrency = (amount) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount);

const percentOf = (gasto, orcado) => (orcado > 0 ? (gasto / orcado) * 100 : 0);

export default function BudgetOverrunReport({ groupedBudgets, tags, isLoading, onClose, isPopup = false, forPrint = false }) {
    const reportRef = useRef();

    const overrunGroups = useMemo(() => {
        return (groupedBudgets || [])
            .map(group => {
                // Group totals reflect ALL budgets in the category (not just the ones
                // that individually overran) so they match the real orçado/gasto shown
                // elsewhere in the app (e.g. the budget cards) — a category can go over
                // its total even when no single tag inside it does, and vice-versa.
                const groupTotalOrcado = group.groupTotalOrcado || 0;
                const groupTotalGasto = group.groupTotalGasto || 0;
                const groupTotalExcesso = groupTotalGasto - groupTotalOrcado;
                const overrunItems = group.budgets
                    .filter(item => {
                        const orcado = item.total_budgeted_for_period || 0;
                        const gasto = parseFloat(item.spent_amount || 0);
                        return gasto > orcado;
                    })
                    .map(item => {
                        const orcado = item.total_budgeted_for_period || 0;
                        const gasto = parseFloat(item.spent_amount || 0);
                        return { ...item, orcado, gasto, excesso: gasto - orcado };
                    })
                    .sort((a, b) => b.excesso - a.excesso);
                return {
                    parentTag: group.parentTag,
                    items: overrunItems,
                    groupTotalOrcado,
                    groupTotalGasto,
                    groupTotalExcesso,
                };
            })
            .filter(group => group.groupTotalExcesso > 0 && group.items.length > 0)
            .sort((a, b) => b.groupTotalExcesso - a.groupTotalExcesso);
    }, [groupedBudgets]);

    const grandTotals = useMemo(() => {
        return overrunGroups.reduce((acc, group) => ({
            orcado: acc.orcado + group.groupTotalOrcado,
            gasto: acc.gasto + group.groupTotalGasto,
            excesso: acc.excesso + group.groupTotalExcesso,
        }), { orcado: 0, gasto: 0, excesso: 0 });
    }, [overrunGroups]);

    // As categorias que ficaram dentro do orçamento não aparecem no relatório, mas a
    // economia delas é justamente o que separa o excesso bruto daqui do "Disponível"
    // líquido mostrado no cabeçalho da tela de Orçamentos. A reconciliação abaixo torna
    // essa diferença explícita para quem compara as duas telas.
    const reconciliation = useMemo(() => {
        const overrunIds = new Set(overrunGroups.map(g => g.parentTag.id));
        const otherGroups = (groupedBudgets || []).filter(g => !overrunIds.has(g.parentTag.id));
        const othersOrcado = otherGroups.reduce((sum, g) => sum + (g.groupTotalOrcado || 0), 0);
        const othersGasto = otherGroups.reduce((sum, g) => sum + (g.groupTotalGasto || 0), 0);
        const totalOrcado = grandTotals.orcado + othersOrcado;
        const totalGasto = grandTotals.gasto + othersGasto;
        return {
            hasOthers: otherGroups.length > 0,
            othersOrcado,
            othersGasto,
            othersExcesso: othersGasto - othersOrcado,
            totalOrcado,
            totalGasto,
            totalExcesso: totalGasto - totalOrcado,
            totalDisponivel: totalOrcado - totalGasto,
        };
    }, [groupedBudgets, overrunGroups, grandTotals]);

    const handleExportPDF = useCallback(async () => {
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

        const headerElement = input.querySelector('.report-header-for-pdf');
        if (headerElement) await renderElement(headerElement);

        const tableHeaderElement = input.querySelector('table > thead');
        let tableHeaderCanvasData = null;
        let tableHeaderImgHeight = 0;
        if (tableHeaderElement) {
            const canvas = await html2canvas(tableHeaderElement, { scale: 2, useCORS: true });
            tableHeaderCanvasData = canvas.toDataURL('image/png');
            tableHeaderImgHeight = (canvas.height * contentWidth) / canvas.width;
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

        const groupElements = input.querySelectorAll('.overrun-group');
        for (const groupEl of groupElements) {
            const canvas = await html2canvas(groupEl, { scale: 2, useCORS: true });
            const groupImgHeight = (canvas.height * contentWidth) / canvas.width;
            if (y + groupImgHeight > pageHeight - margin) {
                pdf.addPage();
                y = margin;
                addTableHeader();
            }
            const imgData = canvas.toDataURL('image/png');
            pdf.addImage(imgData, 'PNG', margin, y, contentWidth, groupImgHeight);
            y += groupImgHeight + 2;
        }

        for (const footerEl of input.querySelectorAll('.report-footer')) {
            await renderElement(footerEl);
        }

        if (buttons) buttons.style.display = 'flex';
        const now = new Date();
        const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
        pdf.save(`relatorio_orcamento_extrapolado_${timestamp}.pdf`);
    }, []);

    const handlePrint = useCallback(() => {
        const printContent = document.getElementById('budget-overrun-report-content');
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
                <head>
                    <title>Relatório de Orçamento Extrapolado</title>
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
                        .text-red { color: #ef4444; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>Relatório de Orçamento Extrapolado</h1>
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
        const reportContent = document.getElementById('budget-overrun-report-content');
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
                            <AlertTriangle className={`w-5 h-5 ${forPrint ? 'text-[#ba1a1a]' : 'text-red-600'}`} />
                            Orçamento Extrapolado
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
                <CardContent className="p-0" id="budget-overrun-report-content">
                    {isLoading ? (
                        <div className="p-6 space-y-2">
                            <Skeleton className="h-6 w-full" />
                            <Skeleton className="h-6 w-full" />
                            <Skeleton className="h-6 w-5/6" />
                        </div>
                    ) : overrunGroups.length > 0 ? (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="text-[#0b1c30]">Categoria / Tag</TableHead>
                                    <TableHead className="text-right text-[#0b1c30]">Orçado</TableHead>
                                    <TableHead className="text-right text-[#0b1c30]">Gasto</TableHead>
                                    <TableHead className="text-right text-[#0b1c30]">Excesso</TableHead>
                                    <TableHead className="text-right text-[#0b1c30]">% Orçado</TableHead>
                                </TableRow>
                            </TableHeader>
                            {overrunGroups.map(group => {
                                const groupPercentage = percentOf(group.groupTotalGasto, group.groupTotalOrcado);
                                return (
                                    <TableBody key={group.parentTag.id} className="overrun-group">
                                        <TableRow className={`${forPrint ? 'bg-white' : 'bg-[#eff4ff]'} hover:bg-[#eff4ff]`}>
                                            <TableCell className="font-bold text-[#0b1c30]">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: group.parentTag.color }}></span>
                                                    {group.parentTag.name}
                                                </div>
                                                <div className="mt-1">
                                                    <BudgetGauge
                                                        spent={group.groupTotalGasto}
                                                        budget={group.groupTotalOrcado}
                                                        height="h-1.5"
                                                    />
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right font-bold text-[#0b1c30] align-top">{formatCurrency(group.groupTotalOrcado)}</TableCell>
                                            <TableCell className="text-right font-bold text-[#0b1c30] align-top">{formatCurrency(group.groupTotalGasto)}</TableCell>
                                            <TableCell className="text-right font-bold text-[#ba1a1a] align-top">{formatCurrency(group.groupTotalExcesso)}</TableCell>
                                            <TableCell className="text-right font-bold text-[#ba1a1a] align-top">{groupPercentage.toFixed(1)}%</TableCell>
                                        </TableRow>
                                        {group.items.map(item => {
                                            const itemPercentage = percentOf(item.gasto, item.orcado);
                                            return (
                                                <TableRow key={item.id}>
                                                    <TableCell className="pl-8">
                                                        <div className="font-medium flex items-center gap-2 text-[#0b1c30]">
                                                            <span className="w-2.5 h-2.5 rounded-full tag-color" style={{ backgroundColor: item.tagColor }}></span>
                                                            {item.tagName}
                                                        </div>
                                                        <div className="mt-1">
                                                            <BudgetGauge
                                                                spent={item.gasto}
                                                                budget={item.orcado}
                                                                height="h-1.5"
                                                            />
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right text-[#0b1c30] align-top">{formatCurrency(item.orcado)}</TableCell>
                                                    <TableCell className="text-right font-medium text-[#ba1a1a] align-top">{formatCurrency(item.gasto)}</TableCell>
                                                    <TableCell className="text-right font-medium text-[#ba1a1a] align-top">{formatCurrency(item.excesso)}</TableCell>
                                                    <TableCell className="text-right font-medium text-[#ba1a1a] align-top">{itemPercentage.toFixed(1)}%</TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                );
                            })}
                            <TableFooter>
                                <TableRow className={`${forPrint ? 'bg-white' : 'bg-[#f8f9ff]'} hover:bg-[#f8f9ff] footer report-footer`}>
                                    <TableCell className="font-bold text-[#0b1c30]">Total Extrapolado</TableCell>
                                    <TableCell className="text-right font-bold text-[#0b1c30]">{formatCurrency(grandTotals.orcado)}</TableCell>
                                    <TableCell className="text-right font-bold text-[#0b1c30]">{formatCurrency(grandTotals.gasto)}</TableCell>
                                    <TableCell className="text-right font-bold text-[#ba1a1a]">{formatCurrency(grandTotals.excesso)}</TableCell>
                                    <TableCell className="text-right font-bold text-[#ba1a1a]">
                                        {percentOf(grandTotals.gasto, grandTotals.orcado).toFixed(1)}%
                                    </TableCell>
                                </TableRow>
                                {reconciliation.hasOthers && (
                                    <>
                                        <TableRow className={`${forPrint ? 'bg-white' : 'bg-[#f8f9ff]'} hover:bg-[#f8f9ff] footer report-footer`}>
                                            <TableCell className="font-medium text-[#3c4a42]">
                                                Demais categorias (dentro do orçamento)
                                            </TableCell>
                                            <TableCell className="text-right text-[#3c4a42]">{formatCurrency(reconciliation.othersOrcado)}</TableCell>
                                            <TableCell className="text-right text-[#3c4a42]">{formatCurrency(reconciliation.othersGasto)}</TableCell>
                                            <TableCell className="text-right font-medium text-[#006c49]">{formatCurrency(reconciliation.othersExcesso)}</TableCell>
                                            <TableCell className="text-right text-[#006c49]">
                                                {percentOf(reconciliation.othersGasto, reconciliation.othersOrcado).toFixed(1)}%
                                            </TableCell>
                                        </TableRow>
                                        <TableRow className={`${forPrint ? 'bg-white' : 'bg-[#f8f9ff]'} hover:bg-[#f8f9ff] footer report-footer`}>
                                            <TableCell className="font-bold text-[#0b1c30]">
                                                Total Geral (todas as categorias)
                                                <div className="text-xs font-normal text-[#6c7a71] mt-0.5">
                                                    Disponível: <span className={reconciliation.totalDisponivel < 0 ? 'text-[#ba1a1a] font-medium' : 'text-[#006c49] font-medium'}>
                                                        {formatCurrency(reconciliation.totalDisponivel)}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right font-bold text-[#0b1c30] align-top">{formatCurrency(reconciliation.totalOrcado)}</TableCell>
                                            <TableCell className="text-right font-bold text-[#0b1c30] align-top">{formatCurrency(reconciliation.totalGasto)}</TableCell>
                                            <TableCell className={`text-right font-bold align-top ${reconciliation.totalExcesso > 0 ? 'text-[#ba1a1a]' : 'text-[#006c49]'}`}>
                                                {formatCurrency(reconciliation.totalExcesso)}
                                            </TableCell>
                                            <TableCell className={`text-right font-bold align-top ${reconciliation.totalExcesso > 0 ? 'text-[#ba1a1a]' : 'text-[#006c49]'}`}>
                                                {percentOf(reconciliation.totalGasto, reconciliation.totalOrcado).toFixed(1)}%
                                            </TableCell>
                                        </TableRow>
                                    </>
                                )}
                            </TableFooter>
                        </Table>
                    ) : (
                        <div className="text-center py-12 px-6">
                            <Inbox className="w-12 h-12 text-[#bbcabf] mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-[#0b1c30]">Nenhum dado encontrado</h3>
                            <p className="text-[#6c7a71] text-sm">Nenhum orçamento foi extrapolado no período selecionado.</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
