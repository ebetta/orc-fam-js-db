import { useState, useEffect, useMemo, useCallback } from "react";
import { api } from "@/lib/api"; 
import { motion, AnimatePresence } from "framer-motion";
import { Maximize, Minimize, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

import ReportsHeader from "../components/reports/ReportsHeader";
import ReportFilters from "../components/reports/ReportFilters";
import ExpensesByTagReport from "../components/reports/ExpensesByTagReport";
import BudgetReport from "../components/reports/BudgetReport";
import BudgetOverrunReport from "../components/reports/BudgetOverrunReport";
import { generatePdfBlobUrl } from "@/lib/pdfGenerator";
import { startOfMonth, endOfMonth, parseISO, max, min, format, differenceInCalendarMonths, differenceInCalendarWeeks, differenceInCalendarYears } from "date-fns";

const getNumberOfPeriods = (budget, filterStart, filterEnd) => {
  if (!filterStart || !filterEnd) return 1;
  const budgetStart = max([parseISO(budget.start_date), filterStart]);
  const budgetEnd = min([parseISO(budget.end_date), filterEnd]);
  if (budgetEnd < budgetStart) return 0;
  switch (budget.period) {
    case 'monthly':
      return differenceInCalendarMonths(budgetEnd, budgetStart) + 1;
    case 'weekly':
      return differenceInCalendarWeeks(budgetEnd, budgetStart, { weekStartsOn: 1 }) + 1;
    case 'yearly':
      return differenceInCalendarYears(budgetEnd, budgetStart) + 1;
    default:
      return 1;
  }
};

export default function ReportsPage() {
  const [allTags, setAllTags] = useState([]);
  const [allTransactions, setAllTransactions] = useState([]);
  const [allBudgets, setAllBudgets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeReport, setActiveReport] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [generationKey, setGenerationKey] = useState(0);
  const [modalSize, setModalSize] = useState('normal'); // 'normal' | 'maximized'

  const [filters, setFilters] = useState({
    period: {
      from: startOfMonth(new Date()),
      to: endOfMonth(new Date()),
    },
    selectedTags: {},
    reportType: 'expenses_by_tag',
  });

  const calculateSpentAmountForPeriod = useCallback((budget, transactionsInPeriod, allTags) => {
    if (!budget.tag_id) return 0;
    const relevantTagIds = new Set();
    const budgetTag = allTags.find(t => t.id === budget.tag_id);
    if (budgetTag) {
      relevantTagIds.add(budgetTag.id);
      const findChildTags = (parentId) => {
        allTags.forEach(tag => {
          if (tag.parent_tag_id === parentId) {
            relevantTagIds.add(tag.id);
            findChildTags(tag.id);
          }
        });
      };
      findChildTags(budgetTag.id);
    } else {
      return 0;
    }
    return transactionsInPeriod
      .filter(t => t.transaction_type === 'expense' && relevantTagIds.has(t.tag_id))
      .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
  }, []);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [tagsResponse, transactionsResponse, budgetsResponse] = await Promise.all([
        api.get('tags'),
        api.get('transactions', { _sort: 'transaction_date', _order: 'desc', _limit: 5000 }),
        api.get('budgets'),
      ]);
      if (tagsResponse.error) throw tagsResponse.error;
      if (transactionsResponse.error) throw transactionsResponse.error;
      if (budgetsResponse.error) throw budgetsResponse.error;
      const tagsData = tagsResponse.data || [];
      const transactionsData = transactionsResponse.data || [];
      const budgetsData = budgetsResponse.data || [];
      setAllTags(tagsData);
      setAllTransactions(transactionsData);
      const initialSelectedTags = {};
      tagsData.forEach(tag => {
        initialSelectedTags[tag.id] = true;
      });
      setFilters(prev => ({ ...prev, selectedTags: initialSelectedTags }));
      setAllBudgets(budgetsData);
    } catch (error) {
      console.error("Error loading report data:", error.message);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredTransactions = useMemo(() => {
    if (isLoading) return [];
    const selectedTagIds = Object.keys(filters.selectedTags).filter(id => filters.selectedTags[id]);
    return allTransactions.filter(t => {
      const transactionDateStr = t.transaction_date;
      let isAfterStart = true;
      if (filters.period.from) {
        const fromStr = format(filters.period.from, 'yyyy-MM-dd');
        isAfterStart = transactionDateStr >= fromStr;
      }
      let isBeforeEnd = true;
      if (filters.period.to) {
        const toStr = format(filters.period.to, 'yyyy-MM-dd');
        isBeforeEnd = transactionDateStr <= toStr;
      }
      const isTagSelected = selectedTagIds.includes(t.tag_id);
      return isAfterStart && isBeforeEnd && isTagSelected;
    });
  }, [allTransactions, filters, isLoading]);

  const [groupedBudgetsForAccordion, setGroupedBudgetsForAccordion] = useState([]);
  const [summaryTotals, setSummaryTotals] = useState({ orcado: 0, gasto: 0, disponivel: 0 });

  useEffect(() => {
    if (isLoading) return;
    let periodStart, periodEnd;
    periodStart = filters.period.from;
    periodEnd = filters.period.to;
    const transactionsForPeriod = periodStart && periodEnd
      ? allTransactions.filter(t => {
        const startStr = format(periodStart, 'yyyy-MM-dd');
        const endStr = format(periodEnd, 'yyyy-MM-dd');
        return t.transaction_date >= startStr && t.transaction_date <= endStr;
      })
      : allTransactions;
    const relevantBudgets = periodStart && periodEnd
      ? allBudgets.filter(budget => {
        const budgetStart = parseISO(budget.start_date);
        const budgetEnd = parseISO(budget.end_date);
        return budgetStart <= periodEnd && budgetEnd >= periodStart;
      })
      : allBudgets;
    const allBudgetItems = [];
    if (allTags.length) {
      const parentTagIds = new Set(allTags.map(t => t.parent_tag_id).filter(Boolean));
      const activeExpenseTags = allTags.filter(t =>
        t.is_active !== false &&
        t.tag_type === 'expense' &&
        (t.parent_tag_id || !parentTagIds.has(t.id))
      );
      activeExpenseTags.forEach(tag => {
        const tagBudgets = relevantBudgets.filter(b => b.tag_id === tag.id);
        if (tagBudgets.length > 0) {
          tagBudgets.forEach(budget => {
            const periodsInFilter = getNumberOfPeriods(budget, periodStart, periodEnd);
            const totalBudgetedForPeriod = (parseFloat(budget.amount) || 0) * periodsInFilter;
            allBudgetItems.push({
              ...budget,
              tagName: tag.name,
              tagColor: tag.color,
              spent_amount: calculateSpentAmountForPeriod(budget, transactionsForPeriod, allTags),
              total_budgeted_for_period: totalBudgetedForPeriod,
              isVirtual: false
            });
          });
        } else {
          const virtualBudget = {
            id: `virtual-${tag.id}`,
            tag_id: tag.id,
            amount: 0,
            start_date: periodStart ? format(periodStart, 'yyyy-MM-dd') : null,
            end_date: periodEnd ? format(periodEnd, 'yyyy-MM-dd') : null,
            period: 'monthly',
            tagName: tag.name,
            tagColor: tag.color,
            isVirtual: true,
            is_active: true
          };
          allBudgetItems.push({
            ...virtualBudget,
            spent_amount: calculateSpentAmountForPeriod({ tag_id: tag.id }, transactionsForPeriod, allTags),
            total_budgeted_for_period: 0
          });
        }
      });
    }
    const totalOrcado = allBudgetItems.reduce((sum, b) => sum + (b.total_budgeted_for_period || 0), 0);
    const totalGasto = allBudgetItems.reduce((sum, b) => sum + (parseFloat(b.spent_amount || 0)), 0);
    setSummaryTotals({
      orcado: totalOrcado,
      gasto: totalGasto,
      disponivel: totalOrcado - totalGasto,
    });
    if (!allBudgetItems.length) {
      setGroupedBudgetsForAccordion([]);
      return;
    }
    const tagMapById = Object.fromEntries(allTags.map(t => [t.id, t]));
    const getRootTagForBudget = (budgetTagId) => {
      let currentTag = tagMapById[budgetTagId];
      if (!currentTag) {
        return {
          id: `unmapped_budget_tag_${budgetTagId}`,
          name: 'Tags Não Mapeadas',
          color: '#9ca3af',
          isRoot: true
        };
      }
      let rootTag = currentTag;
      while (rootTag.parent_tag_id && tagMapById[rootTag.parent_tag_id]) {
        const parent = tagMapById[rootTag.parent_tag_id];
        if (parent.tag_type === 'income' || parent.is_active === false) break;
        rootTag = parent;
      }
      return { ...rootTag, isRoot: true };
    };
    const groups = {};
    allBudgetItems.forEach(item => {
      const rootTag = getRootTagForBudget(item.tag_id);
      if (!groups[rootTag.id]) {
        groups[rootTag.id] = {
          parentTag: rootTag,
          budgets: [],
          groupTotalOrcado: 0,
          groupTotalGasto: 0
        };
      }
      groups[rootTag.id].budgets.push(item);
      groups[rootTag.id].groupTotalOrcado += item.total_budgeted_for_period || 0;
      groups[rootTag.id].groupTotalGasto += parseFloat(item.spent_amount || 0);
    });
    const processedGroups = Object.values(groups).map(group => ({
      ...group,
      groupTotalDisponivel: group.groupTotalOrcado - group.groupTotalGasto
    })).sort((a, b) => {
      if (b.groupTotalGasto !== a.groupTotalGasto) {
        return b.groupTotalGasto - a.groupTotalGasto;
      }
      return b.groupTotalOrcado - a.groupTotalOrcado;
    });
    setGroupedBudgetsForAccordion(processedGroups);
  }, [allBudgets, allTransactions, allTags, isLoading, filters.period, calculateSpentAmountForPeriod]);

  const reportTypeToActiveReport = {
    expenses_by_tag: 'expenses',
    budget: 'budget',
    budget_overrun: 'budget_overrun',
  };

  const handleGenerateReport = () => {
    setPdfUrl(null);
    setModalSize('normal');
    setGenerationKey(k => k + 1);
    setActiveReport(reportTypeToActiveReport[filters.reportType] || 'expenses');
    setIsGeneratingPdf(true);
  };

  const handleCloseReport = () => {
    setActiveReport(null);
    setPdfUrl(null);
    setIsGeneratingPdf(false);
    setModalSize('normal');
  };

  const toggleModalSize = () => {
    setModalSize(prev => prev === 'normal' ? 'maximized' : 'normal');
  };

  useEffect(() => {
    if (!activeReport || isLoading) return;
    const generate = async () => {
      try {
        const elementIdMap = {
          expenses: 'hidden-expenses-report',
          budget: 'hidden-budget-report',
          budget_overrun: 'hidden-budget-overrun-report',
        };
        const elementId = elementIdMap[activeReport] || 'hidden-expenses-report';
        const url = await generatePdfBlobUrl(elementId);
        setPdfUrl(url);
      } catch (error) {
        console.error('Erro ao gerar PDF:', error);
      } finally {
        setIsGeneratingPdf(false);
      }
    };
    const timer = setTimeout(generate, 100);
    return () => clearTimeout(timer);
  }, [activeReport, isLoading, generationKey]);

  return (
    <div className="v2-theme font-body-md text-body-md text-on-background bg-background min-h-screen">
      <div className="p-6 lg:p-10 space-y-6">
        {/* ── Page Header ── */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <ReportsHeader />
        </motion.div>

        {/* ── Filters ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
        >
          <ReportFilters
            allTags={allTags}
            filters={filters}
            onFiltersChange={setFilters}
            onGenerateReport={handleGenerateReport}
            isLoading={isLoading}
          />
        </motion.div>
      </div>

      {/* Hidden rendering area for PDF generation */}
      <div style={{ position: 'absolute', left: '-9999px', top: 0, width: '794px' }}>
        {activeReport === 'expenses' && (
          <div id="hidden-expenses-report">
            <ExpensesByTagReport
              transactions={filteredTransactions}
              tags={allTags}
              isLoading={false}
              forPrint={true}
            />
          </div>
        )}
        {activeReport === 'budget' && (
          <div id="hidden-budget-report">
            <BudgetReport
              groupedBudgets={groupedBudgetsForAccordion}
              summaryTotals={summaryTotals}
              tags={allTags}
              isLoading={false}
              forPrint={true}
            />
          </div>
        )}
        {activeReport === 'budget_overrun' && (
          <div id="hidden-budget-overrun-report">
            <BudgetOverrunReport
              groupedBudgets={groupedBudgetsForAccordion}
              tags={allTags}
              isLoading={false}
              forPrint={true}
            />
          </div>
        )}
      </div>

      {/* PDF Viewer Modal */}
      <AnimatePresence>
        {activeReport && (
          <motion.div
            key="pdf-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex justify-center items-center p-4 bg-[#0b1c30]/40 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.25 }}
              className={`bg-white rounded-xl border border-[#bbcabf] shadow-[0_8px_30px_rgba(0,0,0,0.04)] flex flex-col overflow-hidden transition-all duration-300 ease-in-out ${
                modalSize === 'maximized'
                  ? 'w-[98vw] h-[96vh] max-w-none'
                  : 'w-full max-w-5xl h-[92vh]'
              }`}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-[#bbcabf] bg-[#eff4ff] flex-shrink-0">
                <h2 className="text-[#0b1c30] font-semibold text-base font-sans">
                  {activeReport === 'expenses'
                    ? 'Relatório de Despesas'
                    : activeReport === 'budget_overrun'
                      ? 'Relatório de Orçamento Extrapolado'
                      : 'Relatório de Orçamento'}
                </h2>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleModalSize}
                    title={modalSize === 'normal' ? 'Maximizar' : 'Restaurar'}
                    className="hover:bg-[#dce9ff]"
                  >
                    {modalSize === 'normal' ? (
                      <Maximize className="w-4 h-4 text-[#006c49]" />
                    ) : (
                      <Minimize className="w-4 h-4 text-[#006c49]" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleCloseReport}
                    title="Fechar"
                    className="hover:bg-[#dce9ff]"
                  >
                    <X className="w-5 h-5 text-[#0b1c30]" />
                  </Button>
                </div>
              </div>
              {/* Content */}
              <div className="flex-grow bg-[#f8f9ff] relative">
                {isGeneratingPdf ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#006c49]"></div>
                    <p className="text-[#6c7a71] text-sm font-medium">Gerando PDF...</p>
                  </div>
                ) : pdfUrl ? (
                  <iframe 
                    src={pdfUrl} 
                    className="w-full h-full border-0" 
                    title="PDF Viewer" 
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-[#6c7a71]">
                    Não foi possível gerar o PDF.
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
