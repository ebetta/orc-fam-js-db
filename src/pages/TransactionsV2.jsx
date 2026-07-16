
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { api, auth } from "@/lib/api";
import { useSidebarActions } from "./Layout";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/components/ui/use-toast";
import { startOfDay, endOfDay, parseISO, format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getTagPath, getChildTagIds } from "@/utils";

import { convertCurrency } from "../components/utils/CurrencyConverter";
import PeriodSummaryV2 from "../components/transactions/PeriodSummaryV2";

import TransactionForm from "../components/transactions/TransactionForm";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";

import {
  Search,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  ArrowLeftRight,
  Pencil,
  Trash2,
  X,
  Calendar as CalendarIcon,
  Wallet,
  PiggyBank,
  CreditCard,
  Banknote,
  BarChart3,
  Filter,
  SlidersHorizontal,
  ArrowUpRight,
  Landmark,
} from "lucide-react";

// ─── Progressive balance calculation (same logic as Transactions.jsx) ────────

const calculateProgressiveBalances = async (
  transactionsToDisplay,
  allSystemTransactions,
  accounts,
  filters
) => {
  if (filters.tagId !== "all" || !accounts.length || !transactionsToDisplay.length) {
    return transactionsToDisplay.map((t) => ({
      ...t,
      progressiveBalance: null,
      progressiveBalanceCurrency: null,
    }));
  }

  if (filters.accountId !== "all") {
    const selectedAccount = accounts.find((acc) => acc.id === filters.accountId);
    if (!selectedAccount) return transactionsToDisplay;

    let currentRunningBalance = parseFloat(selectedAccount.current_balance);
    if (isNaN(currentRunningBalance)) {
      currentRunningBalance = parseFloat(selectedAccount.initial_balance) || 0;
    }

    const calculatedCurrency = selectedAccount.currency || "BRL";
    const accountCurrencyMap = new Map(accounts.map((acc) => [acc.id, acc.currency || "BRL"]));

    const accountTransactions = allSystemTransactions
      .filter(
        (t) =>
          t.account_id === filters.accountId ||
          (t.transaction_type === "transfer" && t.destination_account_id === filters.accountId)
      )
      .sort((a, b) => {
        const dateA = parseISO(a.transaction_date).getTime();
        const dateB = parseISO(b.transaction_date).getTime();
        if (dateB !== dateA) return dateB - dateA;
        return (
          new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
        );
      });

    const balanceMap = new Map();

    for (const t of accountTransactions) {
      balanceMap.set(t.id, currentRunningBalance);

      let amountEffect = 0;
      const amount = parseFloat(t.amount);
      const sourceCurrency = accountCurrencyMap.get(t.account_id) || "BRL";

      if (t.account_id === filters.accountId) {
        let amountInAccountCurrency = amount;
        if (sourceCurrency !== calculatedCurrency) {
          amountInAccountCurrency = await convertCurrency(
            amount,
            sourceCurrency,
            calculatedCurrency,
            t.transaction_date
          );
        }
        if (t.transaction_type === "income") {
          amountEffect = -amountInAccountCurrency;
        } else {
          amountEffect = +amountInAccountCurrency;
        }
      } else {
        const destCurrency = calculatedCurrency;
        if (sourceCurrency !== destCurrency) {
          const converted = await convertCurrency(
            amount,
            sourceCurrency,
            destCurrency,
            t.transaction_date
          );
          amountEffect = -converted;
        } else {
          amountEffect = -amount;
        }
      }

      currentRunningBalance += amountEffect;
    }

    return transactionsToDisplay.map((t) => {
      const calculatedInitial = balanceMap.get(t.id);
      return {
        ...t,
        progressiveBalance: calculatedInitial !== undefined ? calculatedInitial : null,
        progressiveBalanceCurrency: calculatedCurrency,
      };
    });
  }

  // All accounts progressive (forward)
  const transactionsWithBalances = transactionsToDisplay.map((t) => ({ ...t }));
  const firstTxInView = transactionsWithBalances[0];
  let currencyForBalance = "BRL";

  const allTransactionsChronological = [...allSystemTransactions].sort((a, b) => {
    const dateA = parseISO(a.transaction_date).getTime();
    const dateB = parseISO(b.transaction_date).getTime();
    if (dateA !== dateB) return dateA - dateB;
    return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
  });

  const initialBalances = new Map();
  for (const acc of accounts) {
    const balance = parseFloat(acc.initial_balance || 0);
    const currency = acc.currency || "BRL";
    initialBalances.set(currency, (initialBalances.get(currency) || 0) + balance);
  }

  const runningBalances = new Map(initialBalances);
  const accountCurrencyMap = new Map(accounts.map((acc) => [acc.id, acc.currency || "BRL"]));

  for (const t of allTransactionsChronological) {
    const amount = parseFloat(t.amount);
    const sourceCurrency = accountCurrencyMap.get(t.account_id);

    if (!sourceCurrency) {
      if (t.id === firstTxInView.id) break;
      continue;
    }

    if (t.transaction_type === "income") {
      runningBalances.set(sourceCurrency, (runningBalances.get(sourceCurrency) || 0) + amount);
    } else if (t.transaction_type === "expense") {
      runningBalances.set(sourceCurrency, (runningBalances.get(sourceCurrency) || 0) - amount);
    } else if (t.transaction_type === "transfer") {
      const destCurrency = accountCurrencyMap.get(t.destination_account_id);
      if (destCurrency) {
        runningBalances.set(sourceCurrency, (runningBalances.get(sourceCurrency) || 0) - amount);
        if (sourceCurrency === destCurrency) {
          runningBalances.set(destCurrency, (runningBalances.get(destCurrency) || 0) + amount);
        } else {
          const convertedAmount = await convertCurrency(
            amount,
            sourceCurrency,
            destCurrency,
            t.transaction_date
          );
          runningBalances.set(
            destCurrency,
            (runningBalances.get(destCurrency) || 0) + convertedAmount
          );
        }
      }
    }

    if (t.id === firstTxInView.id) break;
  }

  let totalBalanceInBRL = 0;
  const conversionDate =
    filters.period.from || filters.period.to ? firstTxInView.transaction_date : null;

  for (const [currency, balance] of runningBalances.entries()) {
    if (currency === "BRL") {
      totalBalanceInBRL += balance;
    } else {
      const convertedBalance = await convertCurrency(balance, currency, "BRL", conversionDate);
      totalBalanceInBRL += convertedBalance;
    }
  }

  transactionsWithBalances[0].progressiveBalance = totalBalanceInBRL;
  transactionsWithBalances[0].progressiveBalanceCurrency = currencyForBalance;

  for (let i = 1; i < transactionsWithBalances.length; i++) {
    const prevTx = transactionsWithBalances[i - 1];
    const currentTx = transactionsWithBalances[i];
    let efeitoInversoTxAnterior = 0;
    const amountPrevTx = parseFloat(prevTx.amount);
    let amountPrevTxInCalc = amountPrevTx;

    if (currencyForBalance === "BRL" && prevTx.currency !== "BRL") {
      amountPrevTxInCalc = await convertCurrency(
        amountPrevTx,
        prevTx.currency,
        "BRL",
        prevTx.transaction_date
      );
    }

    if (prevTx.transaction_type === "income") efeitoInversoTxAnterior = -amountPrevTxInCalc;
    else if (prevTx.transaction_type === "expense") efeitoInversoTxAnterior = +amountPrevTxInCalc;

    currentTx.progressiveBalance = prevTx.progressiveBalance + efeitoInversoTxAnterior;
    currentTx.progressiveBalanceCurrency = prevTx.progressiveBalanceCurrency;
  }

  return transactionsWithBalances;
};

// ─── Helpers ────────────────────────────────────────────────────────────────

const accountTypeConfig = {
  checking: { icon: Wallet, label: "Corrente", colorClass: "text-blue-600", bgClass: "bg-blue-50", hoverBg: "hover:bg-blue-600", hoverText: "hover:text-white" },
  savings: { icon: PiggyBank, label: "Poupança", colorClass: "text-green-600", bgClass: "bg-green-50", hoverBg: "hover:bg-green-600", hoverText: "hover:text-white" },
  credit_card: { icon: CreditCard, label: "Cartão", colorClass: "text-purple-600", bgClass: "bg-purple-50", hoverBg: "hover:bg-purple-600", hoverText: "hover:text-white" },
  investment: { icon: BarChart3, label: "Investimento", colorClass: "text-indigo-600", bgClass: "bg-indigo-50", hoverBg: "hover:bg-indigo-600", hoverText: "hover:text-white" },
  cash: { icon: Banknote, label: "Dinheiro", colorClass: "text-emerald-600", bgClass: "bg-emerald-50", hoverBg: "hover:bg-emerald-600", hoverText: "hover:text-white" },
};

const getBankColorConfig = (bankName) => {
  const name = (bankName || "").toLowerCase();
  if (name.includes("itaú") || name.includes("itau")) {
    return { bg: "bg-[#EC7000]/10", text: "text-[#EC7000]", hoverBg: "hover:bg-[#EC7000]" };
  }
  if (name.includes("nubank") || name.includes("nu ") || name.includes("roxinho")) {
    return { bg: "bg-[#8A05BE]/10", text: "text-[#8A05BE]", hoverBg: "hover:bg-[#8A05BE]" };
  }
  if (name.includes("xp")) {
    return { bg: "bg-gray-900/10", text: "text-gray-900", hoverBg: "hover:bg-gray-900" };
  }
  if (name.includes("btg")) {
    return { bg: "bg-blue-900/10", text: "text-blue-900", hoverBg: "hover:bg-blue-900" };
  }
  if (name.includes("c6")) {
    return { bg: "bg-black/10", text: "text-black", hoverBg: "hover:bg-black" };
  }
  if (name.includes("inter")) {
    return { bg: "bg-orange-500/10", text: "text-orange-500", hoverBg: "hover:bg-orange-500" };
  }
  if (name.includes("crypto") || name.includes("ledger") || name.includes("binance")) {
    return { bg: "bg-yellow-500/10", text: "text-yellow-600", hoverBg: "hover:bg-yellow-500" };
  }
  if (name.includes("bradesco") || name.includes("brad")) {
    return { bg: "bg-red-600/10", text: "text-red-600", hoverBg: "hover:bg-red-600" };
  }
  return null;
};

const fmtCurrency = (value, currency = "BRL") => {
  if (value === null || value === undefined || isNaN(value)) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: currency || "BRL",
    minimumFractionDigits: 2,
  }).format(value);
};

const fmtDate = (dateStr) => {
  if (!dateStr) return "—";
  try {
    return format(parseISO(dateStr), "dd MMM, yyyy", { locale: ptBR });
  } catch {
    return dateStr;
  }
};

const typeLabels = {
  income: { label: "Receita", color: "text-primary-v2", bg: "bg-[#006c49]/10", icon: TrendingUp },
  expense: { label: "Despesa", color: "text-[#ba1a1a]", bg: "bg-[#ba1a1a]/10", icon: TrendingDown },
  transfer: { label: "Transferência", color: "text-secondary", bg: "bg-[#4648d4]/10", icon: ArrowLeftRight },
};

// ─── Sub-components ──────────────────────────────────────────────────────────

function HeroCard({ totalNetWorth, isLoading }) {
  return (
    <div className="relative overflow-hidden p-8 rounded-2xl text-white shadow-lg"
      style={{ background: "linear-gradient(135deg, #4648d4 0%, #6063ee 60%, #8b5cf6 100%)" }}>
      {/* Decorative blobs */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-20 -mt-20 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-black/10 rounded-full -ml-10 -mb-10 blur-2xl pointer-events-none" />

      <div className="relative z-10">
        <p className="font-label-md text-xs tracking-widest uppercase text-white/80 mb-2">
          Saldo Total Consolidado
        </p>
        {isLoading ? (
          <div className="h-14 w-64 bg-white/20 rounded-xl animate-pulse" />
        ) : (
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
            {fmtCurrency(totalNetWorth, "BRL")}
          </h2>
        )}
      </div>
    </div>
  );
}

function AccountGrid({ accounts, balances, onAccountClick, activeAccountId }) {
  if (!accounts || accounts.length === 0) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-headline-sm text-headline-sm text-on-background flex items-center gap-2">
          Saldo das Contas
        </h3>
        {activeAccountId && activeAccountId !== "all" && (
          <button
            onClick={() => onAccountClick("all")}
            className="text-xs text-secondary hover:underline font-semibold flex items-center gap-1 transition-colors"
          >
            <X className="w-3.5 h-3.5" /> Limpar filtro
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {(balances.length > 0 ? balances : accounts).map((account) => {
          const cfg = accountTypeConfig[account.account_type] || accountTypeConfig.checking;
          const Icon = cfg.icon;
          const isActive = activeAccountId === account.id;
          const balance = account.balance ?? account.current_balance ?? account.initial_balance ?? 0;
          const isNegative = parseFloat(balance) < 0;
          const currency = account.original_currency || account.currency || "BRL";
          const displayBalance = account.original_balance !== undefined ? account.original_balance : parseFloat(balance);
          const bankCfg = getBankColorConfig(account.bank || account.name);
          const hasForeignCurrency = currency !== "BRL" && account.original_balance !== undefined;

          return (
            <motion.div
              key={account.id}
              whileHover={{ scale: 1.03, boxShadow: "0 4px 20px rgba(0,0,0,0.12)" }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onAccountClick(isActive ? "all" : account.id)}
              className={`
                p-4 rounded-xl flex flex-col gap-2 cursor-pointer transition-all duration-200 border
                ${isActive
                  ? "bg-secondary text-white shadow-lg border-secondary"
                  : "glass-card hover:shadow-md hover:border-secondary/40"
                }
              `}
            >
              <div className="flex justify-between items-center mb-1">
                <div className={`p-1.5 rounded transition-colors ${isActive ? "bg-white/20 text-white" : (bankCfg ? `${bankCfg.bg} ${bankCfg.text}` : `${cfg.bgClass} ${cfg.colorClass}`)}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className={`font-label-md text-[10px] font-bold uppercase tracking-wider ${isActive ? "text-white/70" : "text-on-surface-variant"}`}>
                  {currency}
                </span>
              </div>
              <p className={`font-label-md text-[11px] truncate ${isActive ? "text-white/85" : "text-on-surface-variant/70"}`}>
                {account.name}
              </p>
              <p className={`font-bold text-base ${isActive ? "text-white" : isNegative ? "text-error" : "text-on-background"}`}>
                {fmtCurrency(parseFloat(balance), "BRL")}
              </p>
              {hasForeignCurrency && (
                <p className={`text-[10px] font-normal ${isActive ? "text-white/60" : "text-on-surface-variant"}`}>
                  ({fmtCurrency(displayBalance, currency)})
                </p>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function FiltersBar({ filters, onFiltersChange, accounts, tags, onClearFilters, transactionsCount }) {
  const [dateRange, setDateRange] = useState({
    from: filters.period.from ? parseISO(filters.period.from) : undefined,
    to: filters.period.to ? parseISO(filters.period.to) : undefined,
  });

  useEffect(() => {
    setDateRange({
      from: filters.period.from ? parseISO(filters.period.from) : undefined,
      to: filters.period.to ? parseISO(filters.period.to) : undefined,
    });
  }, [filters.period.from, filters.period.to]);

  const handleDateRangeChange = (range) => {
    setDateRange(range);
    onFiltersChange({
      ...filters,
      period: {
        ...filters.period,
        from: range?.from ? format(range.from, "yyyy-MM-dd") : null,
        to: range?.to ? format(range.to, "yyyy-MM-dd") : null,
      },
    });
  };

  const setPresetPeriod = (period) => {
    let from, to;
    const today = new Date();
    switch (period) {
      case "this_month":
        from = startOfMonth(today);
        to = endOfMonth(today);
        break;
      case "last_month":
        const lastMonthStart = startOfMonth(subMonths(today, 1));
        from = lastMonthStart;
        to = endOfMonth(lastMonthStart);
        break;
      default:
        from = undefined;
        to = undefined;
    }
    handleDateRangeChange({ from, to });
  };

  const hasActiveFilters =
    filters.type !== "all" ||
    filters.accountId !== "all" ||
    filters.tagId !== "all" ||
    filters.period.from ||
    filters.period.to ||
    filters.searchTerm;

  return (
    <div className="glass-card p-4 rounded-2xl flex flex-wrap gap-4 items-center shadow-sm">
      {/* Search */}
      <div className="flex-grow min-w-[200px] relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
        <input
          type="text"
          placeholder="Buscar por descrição, conta ou tag..."
          value={filters.searchTerm}
          onChange={(e) => onFiltersChange({ ...filters, searchTerm: e.target.value })}
          className="w-full pl-10 pr-4 py-3 bg-surface-container-low border-none rounded-xl font-body-sm text-body-sm text-on-background placeholder-gray-400 focus:ring-2 focus:ring-secondary focus:outline-none transition-all"
        />
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        {/* Type */}
        <select
          value={filters.type}
          onChange={(e) => onFiltersChange({ ...filters, type: e.target.value })}
          className="bg-surface-container-low border-none rounded-xl py-3 px-4 font-label-md text-label-md text-on-surface-variant focus:ring-2 focus:ring-secondary focus:outline-none cursor-pointer"
        >
          <option value="all">Tipo: Todos</option>
          <option value="income">Receitas</option>
          <option value="expense">Despesas</option>
          <option value="transfer">Transferências</option>
        </select>

        {/* Account */}
        <select
          value={filters.accountId}
          onChange={(e) => onFiltersChange({ ...filters, accountId: e.target.value })}
          className="bg-surface-container-low border-none rounded-xl py-3 px-4 font-label-md text-label-md text-on-surface-variant focus:ring-2 focus:ring-secondary focus:outline-none cursor-pointer"
        >
          <option value="all">Conta: Todas</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>

        {/* Tag */}
        <select
          value={filters.tagId}
          onChange={(e) => onFiltersChange({ ...filters, tagId: e.target.value })}
          className="bg-surface-container-low border-none rounded-xl py-3 px-4 font-label-md text-label-md text-on-surface-variant focus:ring-2 focus:ring-secondary focus:outline-none cursor-pointer"
        >
          <option value="all">Tag: Todas</option>
          {tags.map((t) => (
            <option key={t.id} value={t.id}>{getTagPath(t.id, tags)}</option>
          ))}
        </select>

        {/* Period */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              className="flex items-center gap-1.5 bg-surface-container-low border-none rounded-xl px-4 py-3 font-label-md text-label-md text-on-surface-variant hover:bg-surface-container-high transition-colors"
            >
              <CalendarIcon className="w-4 h-4 text-outline flex-shrink-0" />
              {dateRange?.from ? (
                dateRange.to ? (
                  <span className="text-sm">{format(dateRange.from, "dd/MM/yy")} - {format(dateRange.to, "dd/MM/yy")}</span>
                ) : (
                  <span className="text-sm">{format(dateRange.from, "dd/MM/yy")}</span>
                )
              ) : (
                <span>Período</span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <div className="p-2 space-x-1 flex">
              <Button variant="ghost" size="sm" onClick={() => setPresetPeriod("this_month")}>Este Mês</Button>
              <Button variant="ghost" size="sm" onClick={() => setPresetPeriod("last_month")}>Mês Passado</Button>
              <Button variant="ghost" size="sm" onClick={() => handleDateRangeChange({})}>Limpar</Button>
            </div>
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={dateRange?.from}
              selected={dateRange}
              onSelect={handleDateRangeChange}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>

        {/* Clear */}
        {hasActiveFilters && (
          <button
            onClick={onClearFilters}
            className="flex items-center gap-1.5 bg-red-50 text-red-600 border border-red-200 rounded-xl px-4 py-3 text-sm font-semibold hover:bg-red-100 transition-colors"
          >
            <X className="w-3.5 h-3.5" /> Limpar
          </button>
        )}
      </div>

      <span className="text-xs text-gray-400 font-semibold ml-auto">
        {transactionsCount} transaç{transactionsCount !== 1 ? "ões" : "ão"}
      </span>
    </div>
  );
}

function TransactionRow({ transaction, accounts, tags, onEdit, onDelete, index }) {
  const account = accounts.find((a) => a.id === transaction.account_id);
  const destAccount = accounts.find((a) => a.id === transaction.destination_account_id);
  const tag = tags.find((t) => t.id === transaction.tag_id);
  const typeCfg = typeLabels[transaction.transaction_type] || typeLabels.expense;
  const TypeIcon = typeCfg.icon;

  const amount = parseFloat(transaction.amount);
  const isNegativeAmount = transaction.transaction_type === "expense";
  
  const amountColor = transaction.transaction_type === "income"
    ? "text-primary-v2"
    : transaction.transaction_type === "expense"
    ? "text-[#ba1a1a]"
    : "text-secondary";

  const progressiveBalance = transaction.progressiveBalance;
  const pbColor =
    progressiveBalance === null || progressiveBalance === undefined
      ? "text-gray-400"
      : progressiveBalance >= 0
      ? "text-primary-v2"
      : "text-[#ba1a1a]";

  return (
    <motion.tr
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.02 }}
      className="hover:bg-surface-container-low transition-colors group"
    >
      {/* Date */}
      <td className="px-6 py-4 font-body-sm text-body-sm text-on-surface-variant whitespace-nowrap">
        {fmtDate(transaction.transaction_date)}
      </td>

      {/* Description */}
      <td className="px-6 py-4 max-w-[220px]">
        <div className="flex flex-col">
          <span className="font-bold font-body-md text-body-md text-on-background truncate" title={transaction.description}>
            {transaction.description}
          </span>
          {transaction.notes && (
            <span className="text-xs text-on-surface-variant truncate">{transaction.notes}</span>
          )}
          {transaction.transaction_type === "transfer" && destAccount && (
            <span className="text-xs text-secondary font-semibold mt-0.5">→ {destAccount.name}</span>
          )}
        </div>
      </td>

      {/* Tag/Category */}
      <td className="px-6 py-4">
        {tag ? (
          <span
            className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-tight"
            style={{
              backgroundColor: tag.color ? `${tag.color}15` : "#eff4ff",
              color: tag.color || "#4648d4",
              border: `1px solid ${tag.color ? `${tag.color}44` : "#bbcabf"}`,
            }}
            title={getTagPath(tag.id, tags)}
          >
            {getTagPath(tag.id, tags)}
          </span>
        ) : (
          <span className="text-xs text-gray-300 italic">—</span>
        )}
      </td>

      {/* Account */}
      <td className="px-6 py-4 font-body-sm text-body-sm text-on-surface-variant whitespace-nowrap">
        {account?.name || "—"}
      </td>

      {/* Type */}
      <td className="px-6 py-4">
        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold ${typeCfg.bg} ${typeCfg.color}`}>
          <TypeIcon className="w-3 h-3" />
          {typeCfg.label}
        </span>
      </td>

      {/* Amount */}
      <td className={`px-6 py-4 text-right font-bold font-body-md text-body-md whitespace-nowrap ${amountColor}`}>
        {isNegativeAmount ? "−" : "+"} {fmtCurrency(amount, transaction.currency || "BRL")}
      </td>

      {/* Progressive Balance */}
      <td className={`px-6 py-4 text-right font-bold font-body-md text-body-md whitespace-nowrap ${pbColor}`}>
        {progressiveBalance !== null && progressiveBalance !== undefined
          ? fmtCurrency(progressiveBalance, transaction.progressiveBalanceCurrency || "BRL")
          : <span className="text-gray-300 font-normal text-xs">—</span>}
      </td>

      {/* Actions */}
      <td className="px-6 py-4">
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onEdit(transaction)}
            className="p-1.5 rounded-lg text-on-surface-variant hover:text-secondary hover:bg-surface-container-high transition-colors"
            title="Editar"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(transaction.id)}
            className="p-1.5 rounded-lg text-on-surface-variant hover:text-error hover:bg-red-50 transition-colors"
            title="Excluir"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </motion.tr>
  );
}

function Pagination({ currentPage, totalPages, totalItems, itemsPerPage, onPageChange }) {
  const start = (currentPage - 1) * itemsPerPage + 1;
  const end = Math.min(currentPage * itemsPerPage, totalItems);

  const pages = [];
  const delta = 2;
  for (let i = Math.max(1, currentPage - delta); i <= Math.min(totalPages, currentPage + delta); i++) {
    pages.push(i);
  }

  return (
    <div className="px-6 py-4 bg-surface-container-low border-t border-outline-variant flex items-center justify-between flex-wrap gap-3">
      <span className="font-body-sm text-body-sm text-on-surface-variant">
        {totalItems > 0 ? `Mostrando ${start}–${end} de ${totalItems} transações` : "Nenhuma transação"}
      </span>
      <div className="flex gap-2">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-2 border border-outline-variant rounded-lg hover:bg-surface bg-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-on-surface-variant"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        {pages[0] > 1 && (
          <>
            <button onClick={() => onPageChange(1)} className="w-10 h-10 border border-outline-variant rounded-lg hover:bg-surface bg-white transition-colors text-sm font-body-sm text-body-sm text-on-surface-variant">1</button>
            {pages[0] > 2 && <span className="w-10 h-10 flex items-center justify-center text-on-surface-variant text-sm font-body-sm">…</span>}
          </>
        )}
        {pages.map((p) => (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={`w-10 h-10 rounded-lg text-sm font-body-sm text-body-sm font-bold transition-colors ${
              p === currentPage
                ? "bg-secondary text-on-secondary shadow-sm"
                : "border border-outline-variant hover:bg-surface bg-white text-on-surface-variant"
            }`}
          >
            {p}
          </button>
        ))}
        {pages[pages.length - 1] < totalPages && (
          <>
            {pages[pages.length - 1] < totalPages - 1 && (
              <span className="w-10 h-10 flex items-center justify-center text-on-surface-variant text-sm font-body-sm">…</span>
            )}
            <button onClick={() => onPageChange(totalPages)} className="w-10 h-10 border border-outline-variant rounded-lg hover:bg-surface bg-white transition-colors text-sm font-body-sm text-body-sm text-on-surface-variant">{totalPages}</button>
          </>
        )}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages || totalPages === 0}
          className="p-2 border border-outline-variant rounded-lg hover:bg-surface bg-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-on-surface-variant"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Main Page Component ─────────────────────────────────────────────────────

export default function TransactionsV2Page() {
  const [transactions, setTransactions] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [tags, setTags] = useState([]);
  const [processedTransactions, setProcessedTransactions] = useState([]);
  const [isCalculatingBalances, setIsCalculatingBalances] = useState(false);
  const [calculatedAccountBalances, setCalculatedAccountBalances] = useState([]);
  const [totalNetWorth, setTotalNetWorth] = useState(0);
  const [isCalculatingNetWorth, setIsCalculatingNetWorth] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const { toast } = useToast();
  const { registerNewTransactionHandler, unregisterNewTransactionHandler } = useSidebarActions();
  const openNewTransactionRef = useRef(null);
  const [searchParams] = useSearchParams();
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);

  const [filters, setFilters] = useState({
    type: "all",
    accountId: "all",
    tagId: "all",
    period: { from: null, to: null },
    searchTerm: "",
  });

  // Sync URL params → filters
  useEffect(() => {
    const accountIdFromUrl = searchParams.get("accountId");
    const tagIdFromUrl = searchParams.get("tagId");
    const periodFromUrl = searchParams.get("periodFrom");
    const periodToUrl = searchParams.get("periodTo");

    setFilters((prev) => ({
      ...prev,
      accountId: accountIdFromUrl || prev.accountId,
      tagId: tagIdFromUrl || prev.tagId,
      period: {
        from: periodFromUrl || prev.period.from,
        to: periodToUrl || prev.period.to,
      },
    }));
  }, [searchParams]);

  const loadInitialData = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await auth.getUser();
      if (!user) {
        toast({ title: "Usuário não autenticado.", variant: "destructive" });
        setIsLoading(false);
        return;
      }

      const [transRes, accRes, tagRes] = await Promise.all([
        api.get("transactions", { _sort: "transaction_date,created_at,updated_at", _order: "desc", _limit: 5000 }),
        api.get("accounts"),
        api.get("tags"),
      ]);

      if (transRes.error) throw transRes.error;
      if (accRes.error) throw accRes.error;
      if (tagRes.error) throw tagRes.error;

      const rawTransactions = transRes.data || [];
      const mappedTransactions = rawTransactions.map((t) => ({
        ...t,
        account_id: t.account_id,
        tag_id: t.tag_id,
        destination_account_id: t.destination_account_id,
      }));

      setTransactions(mappedTransactions);
      setAccounts(accRes.data || []);
      setTags(tagRes.data || []);
    } catch (error) {
      console.error("Erro ao carregar dados:", error.message);
      toast({ title: "Erro ao carregar dados", description: "Tente novamente.", variant: "destructive" });
    }
    setIsLoading(false);
  }, [toast]);

  useEffect(() => { loadInitialData(); }, [loadInitialData]);
  useEffect(() => { setCurrentPage(1); }, [filters]);

  openNewTransactionRef.current = () => {
    const template = filters.accountId !== "all" ? { account_id: filters.accountId } : null;
    setEditingTransaction(template);
    setShowForm(true);
  };

  useEffect(() => {
    registerNewTransactionHandler(() => openNewTransactionRef.current?.());
    return () => unregisterNewTransactionHandler();
  }, [registerNewTransactionHandler, unregisterNewTransactionHandler]);

  // CRUD handlers
  const handleFormSubmit = async (transactionData) => {
    const isEditing = !!editingTransaction?.id;
    try {
      const { data: { user } } = await auth.getUser();
      if (!user) throw new Error("Usuário não autenticado.");
      if (isEditing) {
        const { error } = await api.put("transactions", editingTransaction.id, transactionData);
        if (error) throw error;
      } else {
        const { error } = await api.post("transactions", transactionData);
        if (error) throw error;
      }
      toast({
        title: `Transação ${isEditing ? "Atualizada" : "Criada"}!`,
        description: `"${transactionData.description}" salva com sucesso.`,
        className: "bg-green-100 text-green-800 border-green-300",
      });
      setShowForm(false);
      setEditingTransaction(null);
      loadInitialData();
    } catch (error) {
      console.error("Erro ao salvar:", error);
      toast({ title: "Erro ao salvar transação", variant: "destructive" });
    }
  };

  const handleEditTransaction = (transaction) => { setEditingTransaction(transaction); setShowForm(true); };

  const handleDeleteTransaction = async (transactionId) => {
    try {
      const t = transactions.find((tx) => tx.id === transactionId);
      if (!t) { toast({ title: "Transação não encontrada.", variant: "destructive" }); return; }
      const { error } = await api.delete("transactions", transactionId);
      if (error) throw error;
      toast({ title: "Transação Excluída!", description: `"${t.description}" foi excluída.` });
      loadInitialData();
    } catch (error) {
      console.error("Erro ao excluir:", error);
      toast({ title: "Erro ao excluir transação", variant: "destructive" });
    }
  };

  const handleCancelForm = () => { setShowForm(false); setEditingTransaction(null); };
  const handleClearFilters = () => setFilters({ type: "all", accountId: "all", tagId: "all", period: { from: null, to: null }, searchTerm: "" });

  // Filtering & pagination
  const relevantTagIds = useMemo(() => {
    if (filters.tagId === "all" || !tags.length) return null;
    const ids = getChildTagIds(filters.tagId, tags);
    ids.add(filters.tagId);
    return ids;
  }, [filters.tagId, tags]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((transaction) => {
      const typeMatch = filters.type === "all" || transaction.transaction_type === filters.type;
      const accountMatch =
        filters.accountId === "all" ||
        transaction.account_id === filters.accountId ||
        (transaction.transaction_type === "transfer" && transaction.destination_account_id === filters.accountId);
      const tagMatch = filters.tagId === "all" || (relevantTagIds && relevantTagIds.has(transaction.tag_id));
      const transactionDate = parseISO(transaction.transaction_date);
      let periodMatch = true;
      if (filters.period.from) periodMatch = periodMatch && transactionDate >= startOfDay(parseISO(filters.period.from));
      if (filters.period.to) periodMatch = periodMatch && transactionDate <= endOfDay(parseISO(filters.period.to));
      const searchTermMatch =
        filters.searchTerm === "" ||
        transaction.description.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
        (accounts.find((a) => a.id === transaction.account_id)?.name.toLowerCase().includes(filters.searchTerm.toLowerCase())) ||
        (tags.find((t) => t.id === transaction.tag_id)?.name.toLowerCase().includes(filters.searchTerm.toLowerCase()));
      return typeMatch && accountMatch && tagMatch && periodMatch && searchTermMatch;
    }).sort((a, b) => {
      const dateA = parseISO(a.transaction_date).getTime();
      const dateB = parseISO(b.transaction_date).getTime();
      if (dateA !== dateB) return dateB - dateA;
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    });
  }, [transactions, filters, accounts, tags, relevantTagIds]);

  const totalItems = filteredTransactions.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;

  const paginatedTransactions = useMemo(
    () => filteredTransactions.slice(startIndex, endIndex),
    [filteredTransactions, startIndex, endIndex]
  );

  const accountCurrencyMap = useMemo(
    () => new Map(accounts.map((acc) => [acc.id, acc.currency])),
    [accounts]
  );

  const transactionsForDisplay = useMemo(() =>
    paginatedTransactions.map((t) => ({
      ...t,
      currency: accountCurrencyMap.get(t.account_id) || "BRL",
    })),
    [paginatedTransactions, accountCurrencyMap]
  );

  // Progressive balance effect
  useEffect(() => {
    if (transactionsForDisplay.length > 0 && accounts.length > 0 && !isLoading) {
      setIsCalculatingBalances(true);
      calculateProgressiveBalances(transactionsForDisplay, transactions, accounts, filters)
        .then(async (result) => {
          const selectedAccount = accounts.find((acc) => acc.id === filters.accountId);
          if (selectedAccount && selectedAccount.currency !== "BRL") {
            const convertedResult = await Promise.all(
              result.map(async (tx) => {
                if (tx.progressiveBalance !== null && tx.progressiveBalanceCurrency && tx.progressiveBalanceCurrency !== "BRL") {
                  const balanceInBRL = await convertCurrency(tx.progressiveBalance, tx.progressiveBalanceCurrency, "BRL", null);
                  return { ...tx, progressiveBalance: balanceInBRL, progressiveBalanceCurrency: "BRL" };
                }
                return tx;
              })
            );
            setProcessedTransactions(convertedResult);
          } else {
            setProcessedTransactions(result);
          }
        })
        .catch(() => {
          setProcessedTransactions(transactionsForDisplay.map((t) => ({ ...t, progressiveBalance: null, progressiveBalanceCurrency: null })));
        })
        .finally(() => setIsCalculatingBalances(false));
    } else if (transactionsForDisplay.length === 0 && !isLoading) {
      setProcessedTransactions([]);
      setIsCalculatingBalances(false);
    }
  }, [transactionsForDisplay, transactions, accounts, filters, isLoading]);

  // Net worth effect
  useEffect(() => {
    const calculateSummaries = async () => {
      if (isLoading || !accounts.length) { setIsCalculatingNetWorth(false); return; }
      setIsCalculatingNetWorth(true);
      try {
        const balancesPromises = accounts.map(async (account) => {
          let currentBalance = parseFloat(account.current_balance);
          if (isNaN(currentBalance)) currentBalance = parseFloat(account.initial_balance) || 0;
          let balanceInBRL = currentBalance;
          if (account.currency !== "BRL") {
            balanceInBRL = await convertCurrency(currentBalance, account.currency, "BRL", null);
          }
          return {
            id: account.id,
            name: account.name,
            balance: balanceInBRL,
            currency: "BRL",
            original_balance: currentBalance,
            original_currency: account.currency,
            account_type: account.account_type,
          };
        });
        const resolvedBalances = await Promise.all(balancesPromises);
        resolvedBalances.sort((a, b) => a.name.localeCompare(b.name));
        setCalculatedAccountBalances(resolvedBalances);
        setTotalNetWorth(resolvedBalances.reduce((sum, acc) => sum + acc.balance, 0));
      } catch (error) {
        console.error("Error calculating summaries:", error);
      } finally {
        setIsCalculatingNetWorth(false);
      }
    };
    calculateSummaries();
  }, [accounts, isLoading]);

  const handleAccountCardClick = (accountId) => {
    setFilters((prev) => ({ ...prev, accountId }));
  };

  const showLoadingState = isLoading || isCalculatingBalances;

  return (
    <div className="v2-theme font-body-md text-body-md text-on-background bg-background min-h-screen">
      <div className="p-6 lg:p-10 space-y-8">

        {/* ── Hero Balance Card ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
        >
          <HeroCard
            totalNetWorth={totalNetWorth}
            isLoading={isCalculatingNetWorth}
          />
        </motion.div>

        {/* ── Account Grid ── */}
        {accounts.length > 0 && !isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <AccountGrid
              accounts={accounts}
              balances={calculatedAccountBalances}
              onAccountClick={handleAccountCardClick}
              activeAccountId={filters.accountId}
            />
          </motion.div>
        )}

        <PeriodSummaryV2
          transactions={filteredTransactions}
          filters={filters}
          accounts={accounts}
        />

        {/* ── Filters Bar ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
        >
          <FiltersBar
            filters={filters}
            onFiltersChange={setFilters}
            accounts={accounts}
            tags={tags}
            onClearFilters={handleClearFilters}
            transactionsCount={totalItems}
          />
        </motion.div>

        {/* ── Transactions Table ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-sm overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-outline-variant flex items-center justify-between">
            <h3 className="font-headline-sm text-headline-sm text-on-background">
              Histórico Recente
            </h3>
            {isCalculatingBalances && (
              <span className="text-xs text-secondary animate-pulse flex items-center gap-1">
                <div className="w-2 h-2 bg-secondary rounded-full animate-bounce" />
                Calculando saldos...
              </span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-surface-container-low border-b border-outline-variant">
                  <th className="px-6 py-3 font-bold font-label-md text-on-surface uppercase tracking-wider text-left">Data</th>
                  <th className="px-6 py-3 font-bold font-label-md text-on-surface uppercase tracking-wider text-left">Descrição</th>
                  <th className="px-6 py-3 font-bold font-label-md text-on-surface uppercase tracking-wider text-left">Categoria</th>
                  <th className="px-6 py-3 font-bold font-label-md text-on-surface uppercase tracking-wider text-left">Conta</th>
                  <th className="px-6 py-3 font-bold font-label-md text-on-surface uppercase tracking-wider text-left">Tipo</th>
                  <th className="px-6 py-3 font-bold font-label-md text-on-surface uppercase tracking-wider text-right">Valor</th>
                  <th className="px-6 py-3 font-bold font-label-md text-on-surface uppercase tracking-wider text-right">Saldo</th>
                  <th className="px-6 py-3 font-bold font-label-md text-on-surface uppercase tracking-wider text-left">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {showLoadingState ? (
                  [...Array(8)].map((_, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      {[...Array(8)].map((_, j) => (
                        <td key={j} className="px-4 py-3.5">
                          <div className="h-4 bg-gray-100 rounded animate-pulse" style={{ width: `${60 + Math.random() * 40}%` }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : processedTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-16 h-16 rounded-full bg-surface-container-low flex items-center justify-center">
                          <ArrowUpRight className="w-8 h-8 text-secondary/60" />
                        </div>
                        <p className="text-on-surface-variant font-semibold text-sm">Nenhuma transação encontrada</p>
                        <p className="text-gray-400 text-xs">Ajuste os filtros ou adicione uma nova transação</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  processedTransactions.map((transaction, index) => (
                    <TransactionRow
                      key={transaction.id}
                      transaction={transaction}
                      accounts={accounts}
                      tags={tags}
                      onEdit={handleEditTransaction}
                      onDelete={handleDeleteTransaction}
                      index={index}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!showLoadingState && totalPages > 0 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalItems}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
            />
          )}
        </motion.div>
      </div>

      {/* ── Transaction Form Modal ── */}
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
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl"
            >
              <TransactionForm
                transaction={editingTransaction}
                accounts={accounts.filter((acc) => acc.is_active !== false)}
                tags={tags.filter((t) => t.is_active !== false)}
                onSave={handleFormSubmit}
                onCancel={handleCancelForm}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
