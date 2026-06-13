import React, { useState, useEffect, useMemo } from "react";
import { TrendingUp, TrendingDown, ArrowLeftRight, Calendar } from "lucide-react";
import { motion } from "framer-motion";
import { parseISO, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { convertCurrency, formatCurrencyWithSymbol } from "../utils/CurrencyConverter";

export default function PeriodSummaryV2({ transactions, filters, accounts }) {
  const [convertedTotals, setConvertedTotals] = useState(null);

  const accountCurrencyMap = useMemo(
    () => new Map((accounts || []).map(acc => [acc.id, acc.currency || 'BRL'])),
    [accounts]
  );

  useEffect(() => {
    if (!filters.period.from || !filters.period.to) {
      setConvertedTotals(null);
      return;
    }

    const convertTotals = async () => {
      let income = 0;
      let expense = 0;
      let transfer = 0;

      for (const transaction of transactions) {
        const amount = parseFloat(transaction.amount || 0);
        if (amount === 0) continue;

        const currency = accountCurrencyMap.get(transaction.account_id) || 'BRL';
        let amountInBRL = amount;

        if (currency !== 'BRL') {
          amountInBRL = await convertCurrency(amount, currency, 'BRL', transaction.transaction_date);
        }

        switch (transaction.transaction_type) {
          case 'income':
            income += amountInBRL;
            break;
          case 'expense':
            expense += amountInBRL;
            break;
          case 'transfer':
            transfer += amountInBRL;
            break;
        }
      }

      setConvertedTotals({ income, expense, transfer, balance: income - expense });
    };

    convertTotals();
  }, [transactions, filters.period.from, filters.period.to, accountCurrencyMap]);

  if (!filters.period.from || !filters.period.to) {
    return null;
  }

  const totals = convertedTotals || { income: 0, expense: 0, transfer: 0, balance: 0 };
  const { income, expense, transfer, balance } = totals;
  const totalTransactions = transactions.length;

  const formatPeriod = () => {
    try {
      const fromDate = parseISO(filters.period.from);
      const toDate = parseISO(filters.period.to);
      return `${format(fromDate, "dd/MM/yyyy", { locale: ptBR })} - ${format(toDate, "dd/MM/yyyy", { locale: ptBR })}`;
    } catch (e) {
      return "";
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="p-6 rounded-2xl border border-outline-variant bg-surface-container-low shadow-sm"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6 border-b border-outline-variant/50 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-surface-container-high flex items-center justify-center text-secondary">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-headline-sm text-headline-sm text-on-background">
              Resumo do Período
            </h3>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              {formatPeriod()}
            </p>
          </div>
        </div>
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-label-md text-label-md text-on-surface-variant bg-surface-container-high">
            {totalTransactions} transaç{totalTransactions !== 1 ? 'ões' : 'ão'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Receitas */}
        <div className="bg-surface-container-lowest rounded-xl p-4 border border-outline-variant/60 flex flex-col justify-between shadow-sm min-h-[96px]">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Receitas</span>
            <div className="w-7 h-7 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <span className="text-xl md:text-2xl font-bold font-body-lg text-emerald-600">
            {formatCurrencyWithSymbol(totals.income, 'BRL')}
          </span>
        </div>

        {/* Despesas */}
        <div className="bg-surface-container-lowest rounded-xl p-4 border border-outline-variant/60 flex flex-col justify-between shadow-sm min-h-[96px]">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Despesas</span>
            <div className="w-7 h-7 rounded-full bg-red-50 flex items-center justify-center text-red-600">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <span className="text-xl md:text-2xl font-bold font-body-lg text-red-600">
            {formatCurrencyWithSymbol(totals.expense, 'BRL')}
          </span>
        </div>

        {/* Transferências */}
        <div className="bg-surface-container-lowest rounded-xl p-4 border border-outline-variant/60 flex flex-col justify-between shadow-sm min-h-[96px]">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Transferências</span>
            <div className="w-7 h-7 rounded-full bg-indigo-50 flex items-center justify-center text-secondary">
              <ArrowLeftRight className="w-4 h-4" />
            </div>
          </div>
          <span className="text-xl md:text-2xl font-bold font-body-lg text-secondary">
            {formatCurrencyWithSymbol(totals.transfer, 'BRL')}
          </span>
        </div>

        {/* Saldo */}
        <div className="bg-surface-container-lowest rounded-xl p-4 border border-outline-variant/60 flex flex-col justify-between shadow-sm min-h-[96px]">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Saldo</span>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center ${
              balance >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
            }`}>
              {balance >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            </div>
          </div>
          <span className={`text-xl md:text-2xl font-bold font-body-lg ${
            balance >= 0 ? 'text-emerald-600' : 'text-red-600'
          }`}>
            {formatCurrencyWithSymbol(balance, 'BRL')}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
