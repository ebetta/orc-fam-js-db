import React, { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Scale, CheckCircle2, TagIcon, ChevronDown, ExternalLink } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { createPageUrl } from "@/utils";

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(amount || 0);
};

/**
 * Explica, ao final da tela de Orçamentos, por que o "Gasto" do card superior
 * não bate com o total de despesas do período (o mesmo número que aparece no
 * gráfico "Despesas por Categoria" do Dashboard).
 *
 * Os orçamentos só enxergam tags de despesa que possam receber um orçamento;
 * tudo que fica de fora (sem tag, tags do tipo "Ambos", tags inativas, etc.)
 * é listado aqui em vez de simplesmente sumir da conta.
 */
const formatDate = (date) => {
  try {
    return format(parseISO(String(date).slice(0, 10)), "dd MMM yyyy", { locale: ptBR });
  } catch {
    return String(date);
  }
};

function ReconciliationItem({ item }) {
  const [open, setOpen] = useState(false);
  const transactions = item.transactions || [];
  const expandable = transactions.length > 0;

  return (
    <li className="rounded-xl bg-surface-container-low overflow-hidden">
      <button
        type="button"
        onClick={() => expandable && setOpen(o => !o)}
        disabled={!expandable}
        aria-expanded={expandable ? open : undefined}
        className={`w-full flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2 px-3 text-left ${expandable ? 'hover:bg-surface-container-high cursor-pointer' : 'cursor-default'} transition-colors`}
      >
        <TagIcon className="w-3.5 h-3.5 text-on-surface-variant self-center shrink-0" />
        <span className="font-body-md text-body-md text-on-background font-medium">
          {item.label}
        </span>
        <span className="font-body-sm text-body-sm text-on-surface-variant">
          {item.count} lançamento{item.count !== 1 ? 's' : ''}
          {item.tagNames.length > 0 && ` · ${item.tagNames.join(', ')}`}
        </span>
        <span className="ml-auto font-semibold text-on-background whitespace-nowrap">
          {formatCurrency(item.amount)}
        </span>
        {expandable && (
          <ChevronDown
            className={`w-4 h-4 self-center text-on-surface-variant transition-transform ${open ? 'rotate-180' : ''}`}
          />
        )}
      </button>

      {expandable && open && (
        <ul className="border-t border-outline-variant divide-y divide-outline-variant bg-surface-container-lowest">
          {transactions.map(tx => (
            <li key={tx.id}>
              <Link
                to={`${createPageUrl("TransactionsV2")}?transactionId=${tx.id}`}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-2 pl-9 pr-3 hover:bg-indigo-50 transition-colors group"
                title="Abrir na tela de Transações"
              >
                <span className="font-body-sm text-body-sm text-on-surface-variant whitespace-nowrap w-24 shrink-0">
                  {formatDate(tx.transaction_date)}
                </span>
                <span className="font-body-sm text-body-sm text-on-background font-medium truncate min-w-0 flex-1">
                  {tx.description}
                </span>
                {tx.tagName && (
                  <span className="font-body-sm text-body-sm text-on-surface-variant whitespace-nowrap">
                    {tx.tagName}
                  </span>
                )}
                <span className="font-body-sm text-body-sm font-semibold text-on-background whitespace-nowrap">
                  {formatCurrency(tx.amount)}
                </span>
                <ExternalLink className="w-3.5 h-3.5 self-center text-on-surface-variant opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export default function BudgetsReconciliation({ reconciliation, isLoading }) {
  if (isLoading) {
    return (
      <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant shadow-sm">
        <Skeleton className="h-6 w-64 mb-4" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (!reconciliation || reconciliation.totalDespesas === 0) return null;

  const { totalDespesas, totalGasto, diferenca, itens, periodLabel } = reconciliation;
  const conciliado = Math.abs(diferenca) < 0.005;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="bg-surface-container-lowest rounded-2xl border border-outline-variant shadow-sm overflow-hidden"
    >
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center gap-3 px-6 py-4 border-b border-outline-variant bg-surface-container-low">
        <Scale className="w-5 h-5 text-[#F97316]" />
        <h3 className="font-headline-sm text-headline-sm text-on-background">
          Conciliação com as despesas do período
        </h3>
        <span className="ml-auto font-label-md text-label-md text-on-surface-variant">
          {periodLabel}
        </span>
      </div>

      {/* Totais */}
      <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-outline-variant">
        <div className="px-6 py-4">
          <span className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider block mb-1">
            Despesas do período
          </span>
          <span className="font-bold text-xl text-on-background">{formatCurrency(totalDespesas)}</span>
          <span className="block font-body-sm text-body-sm text-on-surface-variant mt-0.5">
            Todos os lançamentos de despesa
          </span>
        </div>
        <div className="px-6 py-4">
          <span className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider block mb-1">
            Gasto nos orçamentos
          </span>
          <span className="font-bold text-xl text-on-background">{formatCurrency(totalGasto)}</span>
          <span className="block font-body-sm text-body-sm text-on-surface-variant mt-0.5">
            O valor exibido no topo da tela
          </span>
        </div>
        <div className="px-6 py-4">
          <span className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider block mb-1">
            Fora dos orçamentos
          </span>
          <span className={`font-bold text-xl ${conciliado ? 'text-emerald-600' : 'text-[#F97316]'}`}>
            {formatCurrency(diferenca)}
          </span>
          <span className="block font-body-sm text-body-sm text-on-surface-variant mt-0.5">
            {totalDespesas > 0
              ? `${((diferenca / totalDespesas) * 100).toFixed(1)}% das despesas`
              : '—'}
          </span>
        </div>
      </div>

      {/* Detalhamento */}
      <div className="border-t border-outline-variant px-6 py-4">
        {conciliado && itens.length === 0 ? (
          <div className="flex items-center gap-2 font-body-sm text-body-sm text-emerald-700">
            <CheckCircle2 className="w-4 h-4" />
            Todas as despesas do período estão contempladas pelos orçamentos.
          </div>
        ) : (
          <>
            <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-3">
              O que ficou de fora
            </p>
            <ul className="space-y-2">
              {itens.map(item => (
                <ReconciliationItem key={item.reason} item={item} />
              ))}
            </ul>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-3">
              Só entram no orçamento as tags de despesa que podem receber um orçamento.
              Lançamentos sem tag, em tags do tipo &quot;Ambos&quot;, inativas ou de receita
              ficam fora da conta — por isso o total acima difere do gráfico
              &quot;Despesas por Categoria&quot; do Dashboard. Clique em um grupo para ver
              os lançamentos e em um lançamento para abri-lo na tela de Transações.
            </p>
          </>
        )}
      </div>
    </motion.div>
  );
}
