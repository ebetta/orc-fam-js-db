import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, ArrowLeftRight, Calendar } from "lucide-react";
import { motion } from "framer-motion";
import { convertCurrency, formatCurrencyWithSymbol } from "@/components/utils/CurrencyConverter";

export default function PeriodSummary({ transactions, filters, accounts }) {
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

  // Só mostrar se houver um período definido
  if (!filters.period.from || !filters.period.to) {
    return null;
  }

  const totals = convertedTotals || { income: 0, expense: 0, transfer: 0, balance: 0 };
  const { income, expense, transfer, balance } = totals;
  const totalTransactions = transactions.length;

  // Formatar período para exibição
  const formatPeriod = () => {
    const fromDate = new Date(filters.period.from.replace(/-/g, '/'));
    const toDate = new Date(filters.period.to.replace(/-/g, '/'));
    
    return `${fromDate.toLocaleDateString('pt-BR')} - ${toDate.toLocaleDateString('pt-BR')}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 shadow-md">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-800">
              Resumo do Período: {formatPeriod()}
            </h3>
            <span className="text-sm text-gray-500">
              ({totalTransactions} transaç{totalTransactions !== 1 ? 'ões' : 'ão'})
            </span>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg p-4 border border-green-200">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-gray-600">Receitas</span>
              </div>
              <p className="text-xl font-bold text-green-600">
                {formatCurrencyWithSymbol(totals.income, 'BRL')}
              </p>
            </div>

            <div className="bg-white rounded-lg p-4 border border-red-200">
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="w-4 h-4 text-red-600" />
                <span className="text-sm font-medium text-gray-600">Despesas</span>
              </div>
              <p className="text-xl font-bold text-red-600">
                {formatCurrencyWithSymbol(totals.expense, 'BRL')}
              </p>
            </div>

            <div className="bg-white rounded-lg p-4 border border-blue-200">
              <div className="flex items-center gap-2 mb-2">
                <ArrowLeftRight className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-gray-600">Transferências</span>
              </div>
              <p className="text-xl font-bold text-blue-600">
                {formatCurrencyWithSymbol(totals.transfer, 'BRL')}
              </p>
            </div>

            <div className={`bg-white rounded-lg p-4 border ${balance >= 0 ? 'border-green-200' : 'border-red-200'}`}>
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className={`w-4 h-4 ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`} />
                <span className="text-sm font-medium text-gray-600">Saldo</span>
              </div>
              <p className={`text-xl font-bold ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrencyWithSymbol(balance, 'BRL')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}