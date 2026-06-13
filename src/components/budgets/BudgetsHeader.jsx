
import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, TrendingUp, TrendingDown, DollarSign, X } from "lucide-react";
import { motion } from "framer-motion";

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(amount || 0);
};

/* ── Page Header ─────────────────────────────────────────────────────────── */
export function BudgetsPageHeader({ onAddBudget }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col md:flex-row md:items-center justify-between gap-4"
    >
      <div>
        <h2 className="font-headline-lg text-headline-lg text-[#F97316]">Orçamentos</h2>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={onAddBudget}
          className="flex items-center gap-2 px-5 py-2.5 font-label-md text-label-md text-white bg-[#F97316] hover:bg-[#e2620b] rounded-xl shadow-md active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4" />
          Novo Orçamento
        </button>
      </div>
    </motion.div>
  );
}

/* ── Hero Card ───────────────────────────────────────────────────────────── */
export function BudgetsHeroCard({ summaryTotals, isLoading }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.05 }}
    >
      <div
        className="relative overflow-hidden p-6 md:p-8 rounded-2xl text-white shadow-lg"
        style={{ background: "linear-gradient(135deg, #9d4300 0%, #F97316 60%, #ff7e2d 100%)" }}
      >
        {/* Decorative blobs */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-20 -mt-20 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-black/10 rounded-full -ml-10 -mb-10 blur-2xl pointer-events-none" />

        <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-white/20">
          {/* Orçado */}
          <div className="flex flex-col items-center justify-center p-4">
            <p className="text-xs font-label-md text-white/80 uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-white/90" /> Orçado
            </p>
            {isLoading ? (
              <div className="h-9 w-36 bg-white/20 rounded-xl animate-pulse" />
            ) : (
              <span className="text-2xl md:text-3xl font-bold tracking-tight text-white">
                {formatCurrency(summaryTotals.orcado)}
              </span>
            )}
          </div>

          {/* Gasto */}
          <div className="flex flex-col items-center justify-center p-4">
            <p className="text-xs font-label-md text-white/80 uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <TrendingDown className="w-3.5 h-3.5 text-red-200" /> Gasto
            </p>
            {isLoading ? (
              <div className="h-9 w-36 bg-white/20 rounded-xl animate-pulse" />
            ) : (
              <span className="text-2xl md:text-3xl font-bold tracking-tight text-red-200">
                {formatCurrency(summaryTotals.gasto)}
              </span>
            )}
          </div>

          {/* Disponível */}
          <div className="flex flex-col items-center justify-center p-4">
            <p className="text-xs font-label-md text-white/80 uppercase tracking-widest mb-2 flex items-center gap-1.5">
              {summaryTotals.disponivel >= 0 ? (
                <TrendingUp className="w-3.5 h-3.5 text-emerald-300" />
              ) : (
                <TrendingDown className="w-3.5 h-3.5 text-red-300" />
              )} Disponível
            </p>
            {isLoading ? (
              <div className="h-9 w-36 bg-white/20 rounded-xl animate-pulse" />
            ) : (
              <span className={`text-2xl md:text-3xl font-bold tracking-tight ${
                summaryTotals.disponivel >= 0 ? "text-emerald-300" : "text-red-300"
              }`}>
                {summaryTotals.disponivel >= 0 ? "+" : ""}{formatCurrency(summaryTotals.disponivel)}
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ── Filters Bar ─────────────────────────────────────────────────────────── */
export function BudgetsFiltersBar({ filters, onFiltersChange, tags, budgetsCount }) {
  const hasActiveFilters =
    filters.period !== "current_month" ||
    filters.tagId !== "all" ||
    filters.status !== "all";

  const handleClearFilters = () => {
    onFiltersChange(() => ({
      period: "current_month",
      tagId: "all",
      status: "all",
    }));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
    >
      <div className="glass-card p-4 rounded-2xl flex flex-wrap gap-4 items-center shadow-sm">
        {/* Period */}
        <select
          value={filters.period}
          onChange={(e) => onFiltersChange(prev => ({ ...prev, period: e.target.value }))}
          className="bg-surface-container-low border-none rounded-xl py-3 px-4 font-label-md text-label-md text-on-surface-variant focus:ring-2 focus:ring-secondary focus:outline-none cursor-pointer"
        >
          <option value="current_month">Mês Atual</option>
          <option value="last_month">Mês Anterior</option>
          <option value="two_months_ago">Mês Retrasado</option>
          <option value="current_quarter">Trimestre Atual</option>
          <option value="this_year">Este Ano</option>
          <option value="all">Todos os Períodos</option>
        </select>

        {/* Tag */}
        <select
          value={filters.tagId}
          onChange={(e) => onFiltersChange(prev => ({ ...prev, tagId: e.target.value }))}
          className="bg-surface-container-low border-none rounded-xl py-3 px-4 font-label-md text-label-md text-on-surface-variant focus:ring-2 focus:ring-secondary focus:outline-none cursor-pointer"
        >
          <option value="all">Tag: Todas</option>
          {tags.map(tag => (
            <option key={tag.id} value={tag.id}>{tag.name}</option>
          ))}
        </select>

        {/* Status */}
        <select
          value={filters.status}
          onChange={(e) => onFiltersChange(prev => ({ ...prev, status: e.target.value }))}
          className="bg-surface-container-low border-none rounded-xl py-3 px-4 font-label-md text-label-md text-on-surface-variant focus:ring-2 focus:ring-secondary focus:outline-none cursor-pointer"
        >
          <option value="all">Status: Todos</option>
          <option value="active">Ativos</option>
          <option value="exceeded">Excedidos</option>
          <option value="near_limit">Próx. do Limite</option>
        </select>

        {/* Clear */}
        {hasActiveFilters && (
          <button
            onClick={handleClearFilters}
            className="flex items-center gap-1.5 bg-red-50 text-red-600 border border-red-200 rounded-xl px-4 py-3 text-sm font-semibold hover:bg-red-100 transition-colors"
          >
            <X className="w-3.5 h-3.5" /> Limpar
          </button>
        )}

        <span className="text-xs text-gray-400 font-semibold ml-auto">
          {budgetsCount} orçamento{budgetsCount !== 1 ? "s" : ""} ativo{budgetsCount !== 1 ? "s" : ""}
        </span>
      </div>
    </motion.div>
  );
}

// Default export for backwards-compat (no longer used by updated Budgets.jsx)
export default function BudgetsHeader(props) {
  return (
    <>
      <BudgetsPageHeader onAddBudget={props.onAddBudget} />
      <BudgetsHeroCard summaryTotals={props.summaryTotals} isLoading={false} />
      <BudgetsFiltersBar
        filters={props.filters}
        onFiltersChange={props.onFiltersChange}
        tags={props.tags}
        budgetsCount={props.budgetsCount}
      />
    </>
  );
}
