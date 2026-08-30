
import React, { useState, useEffect, useCallback, useRef } from "react";
import { api, auth } from "@/lib/api";
import { useSidebarActions } from "./Layout";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/components/ui/use-toast";
import {
  startOfMonth, endOfMonth, subDays, parseISO, isWithinInterval,
  max, min, startOfYear, endOfYear, startOfQuarter, endOfQuarter,
  differenceInCalendarMonths, differenceInCalendarWeeks, differenceInCalendarYears,
  format, getQuarter
} from "date-fns";
import { ptBR } from "date-fns/locale";


import { BudgetsHeroCard, BudgetsFiltersBar } from "../components/budgets/BudgetsHeader";
import BudgetForm from "../components/budgets/BudgetForm";
import BudgetsList from "../components/budgets/BudgetsList";
import EndBudgetDialog from "../components/budgets/EndBudgetDialog";
import BudgetsReconciliation from "../components/budgets/BudgetsReconciliation";

// Helper para calcular o número de períodos de um orçamento dentro do filtro
const getNumberOfPeriods = (budget, filterStart, filterEnd) => {
  if (!filterStart || !filterEnd) return 1; // Para o filtro "Todos os períodos"

  // Intersecção entre o período do orçamento e o período do filtro.
  // Orçamentos sem end_date estão vigentes (em aberto), então usamos o limite do filtro no lugar.
  const budgetStart = max([parseISO(budget.start_date), filterStart]);
  const budgetEndRaw = budget.end_date ? parseISO(budget.end_date) : filterEnd;
  const budgetEnd = min([budgetEndRaw, filterEnd]);

  if (budgetEnd < budgetStart) return 0; // Orçamento fora do período do filtro

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

// Quando um orçamento é encerrado e substituído no meio do período filtrado, as duas linhas
// (a encerrada e a nova) aparecem juntas. Sem isso, o gasto do período inteiro seria contado
// em dobro (uma vez por linha). Cada orçamento soma apenas os gastos da sua própria vigência.
const getBudgetScopedTransactions = (budget, transactionsInPeriod, filterStart, filterEnd) => {
  if (!filterStart || !filterEnd) return transactionsInPeriod;

  const scopeStart = max([parseISO(budget.start_date), filterStart]);
  const scopeEndRaw = budget.end_date ? parseISO(budget.end_date) : filterEnd;
  const scopeEnd = min([scopeEndRaw, filterEnd]);

  const startStr = format(scopeStart, 'yyyy-MM-dd');
  const endStr = format(scopeEnd, 'yyyy-MM-dd');
  return transactionsInPeriod.filter(t => t.transaction_date >= startStr && t.transaction_date <= endStr);
};

// Rótulo legível do período filtrado, usado no card de conciliação.
const getPeriodLabel = (filters) => {
  const today = new Date();
  switch (filters.period) {
    case "specific_month":
      return format(new Date(filters.year, filters.month, 1), "MMMM 'de' yyyy", { locale: ptBR });
    case "current_quarter":
      return `${getQuarter(today)}º trimestre de ${today.getFullYear()}`;
    case "this_year":
      return `Ano de ${today.getFullYear()}`;
    default:
      return "Todos os períodos";
  }
};

export default function BudgetsPage() {
  const [budgets, setBudgets] = useState([]);
  const [tags, setTags] = useState([]);
  const [allTags, setAllTags] = useState([]);
  const [transactions, setTransactions] = useState([]);

  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingBudget, setEditingBudget] = useState(null);
  const [endingBudget, setEndingBudget] = useState(null);
  const { toast } = useToast();
  const { registerNewBudgetHandler, unregisterNewBudgetHandler } = useSidebarActions();
  const openNewBudgetRef = useRef(null);

  const today = new Date();
  const [filters, setFilters] = useState({
    period: "specific_month",
    month: today.getMonth(),
    year: today.getFullYear(),
    tagId: "all",
    status: "all",
  });

  const [groupedBudgetsForAccordion, setGroupedBudgetsForAccordion] = useState([]);
  const [summaryTotals, setSummaryTotals] = useState({ orcado: 0, gasto: 0, disponivel: 0 });
  const [reconciliation, setReconciliation] = useState(null);

  const calculateSpentAmountForPeriod = useCallback((budget, transactionsInPeriod, allTags) => {
    if (!budget.tag_id) return 0; // budget.tag_id é o ID da tag específica do orçamento.

    // Encontrar todas as tags filhas (e a própria tag) que pertencem à tag do orçamento.
    // Isso é necessário porque uma transação pode estar em uma sub-tag, mas ainda deve contar para o orçamento da tag pai.
    const relevantTagIds = new Set();
    const budgetTag = allTags.find(t => t.id === budget.tag_id);

    if (budgetTag) {
      relevantTagIds.add(budgetTag.id); // Adiciona a própria tag do orçamento

      // Função para encontrar todas as tags filhas recursivamente
      const findChildTags = (parentId) => {
        allTags.forEach(tag => {
          if (tag.parent_tag_id === parentId) {
            relevantTagIds.add(tag.id);
            findChildTags(tag.id); // Recursão para encontrar netas, etc.
          }
        });
      };

      findChildTags(budgetTag.id); // Encontra todas as tags filhas da tag do orçamento
    } else {
      // Se a tag do orçamento não for encontrada, não podemos calcular os gastos.
      // Isso pode indicar um problema de dados ou uma tag inativa.
      return 0;
    }

    return transactionsInPeriod
      .filter(t => t.transaction_type === 'expense' && relevantTagIds.has(t.tag_id)) // Verifica se a transação pertence a qualquer uma das tags relevantes (principal ou filhas)
      .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
  }, []);

  const loadInitialData = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await auth.getUser();
      if (!user) {
        toast({ title: "Usuário não autenticado.", variant: "destructive" });
        setIsLoading(false);
        return;
      }

      const [budgetsResponse, tagsResponse, transactionsResponse] = await Promise.all([
        api.get('budgets', { _sort: 'updated_at', _order: 'desc' }),
        api.get('tags'),
        api.get('transactions', { _sort: 'transaction_date', _order: 'desc', _limit: 5000 })
      ]);

      if (budgetsResponse.error) throw budgetsResponse.error;
      if (tagsResponse.error) throw tagsResponse.error;
      if (transactionsResponse.error) throw transactionsResponse.error;

      setBudgets((budgetsResponse.data || []).filter(b => b.is_active !== false));
      setAllTags(tagsResponse.data || []);
      setTags((tagsResponse.data || []).filter(t => t.is_active !== false && (t.tag_type === 'expense' || t.tag_type === 'both')));
      setTransactions(transactionsResponse.data || []);

    } catch (error) {
      console.error("Erro ao carregar dados de orçamentos:", error.message);
      toast({
        title: "Erro ao carregar dados",
        description: "Ocorreu um problema ao buscar os dados. Tente novamente.",
        variant: "destructive",
      });
    }
    setIsLoading(false);
  }, [toast]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  openNewBudgetRef.current = () => {
    setEditingBudget(null);
    setShowForm(true);
  };

  useEffect(() => {
    registerNewBudgetHandler(() => openNewBudgetRef.current?.());
    return () => unregisterNewBudgetHandler();
  }, [registerNewBudgetHandler, unregisterNewBudgetHandler]);

  // Efeito principal para filtrar e agrupar orçamentos baseado no período selecionado
  useEffect(() => {
    if (isLoading) return;

    // 1. Determinar o intervalo de datas do filtro
    let periodStart, periodEnd;
    const todayForFilter = new Date();

    switch (filters.period) {
      case "specific_month": {
        const selectedMonth = new Date(filters.year, filters.month, 1);
        periodStart = startOfMonth(selectedMonth);
        periodEnd = endOfMonth(selectedMonth);
        break;
      }
      case "current_quarter":
        periodStart = startOfQuarter(todayForFilter);
        periodEnd = endOfQuarter(todayForFilter);
        break;
      case "this_year":
        periodStart = startOfYear(todayForFilter);
        periodEnd = endOfYear(todayForFilter);
        break;
      case "all":
      default:
        break;
    }

    // 2. Filtrar transações para corresponder ao período do filtro
    const transactionsForPeriod = periodStart && periodEnd
      ? transactions.filter(t => {
        // Use string comparison for dates to avoid timezone issues
        const startStr = format(periodStart, 'yyyy-MM-dd');
        const endStr = format(periodEnd, 'yyyy-MM-dd');
        return t.transaction_date >= startStr && t.transaction_date <= endStr;
      })
      : transactions;

    // 3. Filtrar orçamentos que são relevantes para o período do filtro
    // Orçamentos sem end_date ainda estão vigentes, então valem para qualquer período a partir do início.
    const relevantBudgets = periodStart && periodEnd
      ? budgets.filter(budget => {
        const budgetStart = parseISO(budget.start_date);
        const budgetIsOpenOrCoversStart = !budget.end_date || parseISO(budget.end_date) >= periodStart;
        return budgetStart <= periodEnd && budgetIsOpenOrCoversStart;
      })
      : budgets;

    // 4. Preparar lista unificada de orçamentos (Reais + Virtuais)
    const allBudgetItems = [];

    if (tags.length) {
      const parentTagIds = new Set(tags.map(t => t.parent_tag_id).filter(Boolean));
      const activeExpenseTags = tags.filter(t =>
        t.is_active !== false &&
        t.tag_type === 'expense' &&
        (t.parent_tag_id || !parentTagIds.has(t.id))
      );

      activeExpenseTags.forEach(tag => {
        // Encontrar orçamentos existentes para esta tag no período
        const tagBudgets = relevantBudgets.filter(b => b.tag_id === tag.id);

        if (tagBudgets.length > 0) {
          // Adicionar orçamentos reais
          tagBudgets.forEach(budget => {
            const periodsInFilter = getNumberOfPeriods(budget, periodStart, periodEnd);
            const totalBudgetedForPeriod = (parseFloat(budget.amount) || 0) * periodsInFilter;

            allBudgetItems.push({
              ...budget,
              tagName: tag.name,
              tagColor: tag.color,
              tagIcon: tag.icon,
              spent_amount: calculateSpentAmountForPeriod(
                budget,
                getBudgetScopedTransactions(budget, transactionsForPeriod, periodStart, periodEnd),
                tags
              ),
              total_budgeted_for_period: totalBudgetedForPeriod,
              isVirtual: false
            });
          });
        } else {
          // Adicionar orçamento virtual (placeholder para a tag)
          // Necessário para mostrar o gasto da tag mesmo sem orçamento definido
          const virtualBudget = {
            id: `virtual-${tag.id}`,
            tag_id: tag.id,
            amount: 0,
            start_date: periodStart ? format(periodStart, 'yyyy-MM-dd') : null,
            end_date: periodEnd ? format(periodEnd, 'yyyy-MM-dd') : null,
            period: 'monthly',
            tagName: tag.name,
            tagColor: tag.color,
            tagIcon: tag.icon,
            isVirtual: true,
            is_active: true
          };

          allBudgetItems.push({
            ...virtualBudget,
            spent_amount: calculateSpentAmountForPeriod({ tag_id: tag.id }, transactionsForPeriod, tags),
            total_budgeted_for_period: 0
          });
        }
      });
    }

    // 5. Calcular os totais para o cabeçalho
    const totalOrcado = allBudgetItems.reduce((sum, b) => sum + (b.total_budgeted_for_period || 0), 0);
    const totalGasto = allBudgetItems.reduce((sum, b) => sum + (parseFloat(b.spent_amount) || 0), 0);
    setSummaryTotals({
      orcado: totalOrcado,
      gasto: totalGasto,
      disponivel: totalOrcado - totalGasto,
    });

    // 5b. Conciliação com o total de despesas do período
    // O card "Gasto" só enxerga tags de despesa que podem receber um orçamento.
    // Tudo que fica de fora (sem tag, tags "Ambos", inativas, de receita, ou lançado
    // direto numa tag pai) é listado ao final da tela em vez de sumir da conta —
    // é justamente essa a diferença para o gráfico "Despesas por Categoria" do Dashboard.
    const collectTagTree = (rootId) => {
      const ids = new Set();
      const walk = (id) => {
        if (!id || ids.has(id)) return;
        ids.add(id);
        tags.forEach(t => { if (t.parent_tag_id === id) walk(t.id); });
      };
      walk(rootId);
      return ids;
    };

    const countedTagIds = new Set();
    allBudgetItems.forEach(item => {
      collectTagTree(item.tag_id).forEach(id => countedTagIds.add(id));
    });

    const expensesInPeriod = transactionsForPeriod.filter(t => t.transaction_type === 'expense');
    const totalDespesasPeriodo = expensesInPeriod.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

    const allTagsById = Object.fromEntries(allTags.map(t => [t.id, t]));
    const tagsWithChildren = new Set(allTags.map(t => t.parent_tag_id).filter(Boolean));

    const REASON_LABELS = {
      no_tag: 'Lançamentos sem tag',
      inactive: 'Tags inativas',
      income: 'Tags de receita',
      both: 'Tags do tipo "Ambos"',
      parent: 'Lançados direto na tag pai',
      no_budget: 'Tags fora dos orçamentos',
      scope: 'Fora da vigência dos orçamentos',
      overlap: 'Contabilizado em mais de um orçamento',
    };
    const REASON_ORDER = ['both', 'no_tag', 'inactive', 'income', 'parent', 'no_budget', 'scope', 'overlap'];

    const buckets = new Map();
    const addToBucket = (reason, amount, tagName) => {
      if (!buckets.has(reason)) buckets.set(reason, { reason, amount: 0, count: 0, tagNames: new Set() });
      const bucket = buckets.get(reason);
      bucket.amount += amount;
      bucket.count += 1;
      if (tagName) bucket.tagNames.add(tagName);
    };

    let somaContada = 0;
    expensesInPeriod.forEach(t => {
      const amount = parseFloat(t.amount) || 0;
      if (t.tag_id && countedTagIds.has(t.tag_id)) {
        somaContada += amount;
        return;
      }
      const tag = t.tag_id ? allTagsById[t.tag_id] : null;
      let reason;
      if (!tag) reason = 'no_tag';
      else if (tag.is_active === false) reason = 'inactive';
      else if (tag.tag_type === 'income') reason = 'income';
      else if (tag.tag_type === 'both') reason = 'both';
      else if (!tag.parent_tag_id && tagsWithChildren.has(tag.id)) reason = 'parent';
      else reason = 'no_budget';
      addToBucket(reason, amount, tag?.name);
    });

    // Resto: transações dentro de uma tag orçada mas fora da vigência do orçamento
    // (ou, no caso oposto, contadas por mais de um orçamento aninhado).
    const ajusteVigencia = somaContada - totalGasto;
    if (Math.abs(ajusteVigencia) >= 0.005) {
      const reason = ajusteVigencia > 0 ? 'scope' : 'overlap';
      buckets.set(reason, { reason, amount: ajusteVigencia, count: 0, tagNames: new Set() });
    }

    const itensConciliacao = REASON_ORDER
      .filter(reason => buckets.has(reason))
      .map(reason => {
        const bucket = buckets.get(reason);
        return {
          reason,
          label: REASON_LABELS[reason],
          amount: bucket.amount,
          count: bucket.count,
          tagNames: [...bucket.tagNames].sort((a, b) => a.localeCompare(b)),
        };
      });

    setReconciliation({
      totalDespesas: totalDespesasPeriodo,
      totalGasto,
      diferenca: totalDespesasPeriodo - totalGasto,
      itens: itensConciliacao,
      periodLabel: getPeriodLabel(filters),
    });

    // 6. Agrupar os orçamentos para o Accordion
    if (!allBudgetItems.length) {
      setGroupedBudgetsForAccordion([]);
      return;
    }

    // Mapa de tags pelo ID para o agrupamento
    const tagMapById = Object.fromEntries(tags.map(t => [t.id, t]));

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

  }, [budgets, transactions, tags, allTags, isLoading, filters, calculateSpentAmountForPeriod]);


  const handleFormSubmit = async (budgetData) => {
    try {
      const dataToSave = { ...budgetData }; // Ensure budgetData from form matches table columns
      const { data: { user } } = await auth.getUser();
      if (!user) throw new Error("Usuário não autenticado.");

      if (editingBudget && !editingBudget.isVirtual) {
        const { error } = await api.put('budgets', editingBudget.id, dataToSave);
        if (error) throw error;
        toast({
          title: "Orçamento Atualizado!",
          description: `O orçamento "${budgetData.name}" foi atualizado.`,
          className: "bg-green-100 text-green-800 border-green-300",
        });
      } else {
        // Um novo orçamento para a mesma tag encerra automaticamente qualquer orçamento
        // daquela tag que ainda estivesse vigente na nova data de início (sem end_date,
        // ou com end_date igual/posterior a ela), no dia anterior ao novo início.
        const previousOpenBudget = budgets.find(b =>
          b.tag_id === dataToSave.tag_id &&
          b.start_date <= dataToSave.start_date &&
          (!b.end_date || b.end_date >= dataToSave.start_date)
        );

        if (previousOpenBudget) {
          const dayBeforeNewStart = format(subDays(parseISO(dataToSave.start_date), 1), 'yyyy-MM-dd');
          const closingDate = dayBeforeNewStart >= previousOpenBudget.start_date
            ? dayBeforeNewStart
            : previousOpenBudget.start_date;
          const { error: closeError } = await api.put('budgets', previousOpenBudget.id, { end_date: closingDate });
          if (closeError) throw closeError;
        }

        // spent_amount is not a field in the budgets table, it's calculated
        const budgetPayload = { ...dataToSave, end_date: null, user_id: user.id };
        const { error } = await api.post('budgets', budgetPayload);
        if (error) throw error;

        toast({
          title: "Orçamento Criado!",
          description: previousOpenBudget
            ? `O orçamento anterior desta tag foi encerrado automaticamente e "${budgetData.name}" está vigente.`
            : `O orçamento "${budgetData.name}" foi criado.`,
          className: "bg-green-100 text-green-800 border-green-300",
        });
      }
      setShowForm(false);
      setEditingBudget(null);
      loadInitialData();
    } catch (error) {
      console.error("Erro ao salvar orçamento:", error.message);
      toast({
        title: "Erro ao salvar orçamento",
        description: "Não foi possível salvar. Verifique os dados e tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleEditBudget = (budget) => {
    setEditingBudget(budget);
    setShowForm(true);
  };

  const handleDeleteBudget = async (budgetId) => {
    try {
      if (typeof budgetId === 'string' && budgetId.startsWith('virtual-')) {
        return;
      }
      const budgetToDelete = budgets.find(b => b.id === budgetId);
      const { error } = await api.delete('budgets', budgetId);
      if (error) throw error;
      toast({
        title: "Orçamento Excluído!",
        description: `O orçamento "${budgetToDelete?.name}" foi excluído.`,
      });
      loadInitialData();
    } catch (error) {
      console.error("Erro ao excluir orçamento:", error.message);
      toast({
        title: "Erro ao excluir orçamento",
        variant: "destructive",
      });
    }
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingBudget(null);
  };

  const handleRequestEndBudget = (budget) => {
    setEndingBudget(budget);
  };

  const handleConfirmEndBudget = async (endDate) => {
    if (!endingBudget) return;
    try {
      const { error } = await api.put('budgets', endingBudget.id, { end_date: format(endDate, 'yyyy-MM-dd') });
      if (error) throw error;
      toast({
        title: "Orçamento Encerrado!",
        description: `O orçamento de "${endingBudget.tagName}" foi encerrado em ${format(endDate, 'dd/MM/yyyy')}.`,
      });
      setEndingBudget(null);
      loadInitialData();
    } catch (error) {
      console.error("Erro ao encerrar orçamento:", error.message);
      toast({
        title: "Erro ao encerrar orçamento",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="v2-theme font-body-md text-body-md text-on-background bg-background min-h-screen">
      <div className="p-6 lg:p-10 space-y-8">

        {/* ── Hero Card ── */}
        <BudgetsHeroCard
          summaryTotals={summaryTotals}
          isLoading={isLoading}
        />

        {/* ── Filters Bar ── */}
        <BudgetsFiltersBar
          filters={filters}
          onFiltersChange={setFilters}
          tags={tags}
          budgetsCount={budgets.length}
        />

        {/* ── Budget Form Modal ── */}
        <AnimatePresence>
          {showForm && (
            <motion.div
              key="modal-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 flex justify-center items-center p-4 overflow-auto"
              onClick={handleCancelForm}
            >
              <motion.div
                key="modal-content"
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ duration: 0.25 }}
                onClick={e => e.stopPropagation()}
                className="w-full max-w-2xl"
              >
                <BudgetForm
                  budget={editingBudget}
                  tags={tags}
                  onSave={handleFormSubmit}
                  onCancel={handleCancelForm}
                />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Budgets List ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
        >
          <BudgetsList
            groupedBudgets={groupedBudgetsForAccordion}
            isLoading={isLoading}
            onEditBudget={handleEditBudget}
            onDeleteBudget={handleDeleteBudget}
            onRequestEndBudget={handleRequestEndBudget}
            currentPeriodFilter={filters}
          />
        </motion.div>

        {/* ── Conciliação com as despesas do período ── */}
        <BudgetsReconciliation reconciliation={reconciliation} isLoading={isLoading} />

        <EndBudgetDialog
          budget={endingBudget}
          onConfirm={handleConfirmEndBudget}
          onCancel={() => setEndingBudget(null)}
        />
      </div>
    </div>
  );
}
