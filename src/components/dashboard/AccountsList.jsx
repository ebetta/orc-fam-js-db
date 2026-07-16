
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  CreditCard, 
  Wallet, 
  PiggyBank, 
  TrendingUp, 
  Banknote,
  Plus,
  ArrowRight
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { formatCurrencyWithSymbol, convertCurrency } from "../utils/CurrencyConverter";

const accountTypeConfig = {
  checking: {
    label: "Conta Corrente",
    icon: Wallet,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200"
  },
  savings: {
    label: "Poupança",
    icon: PiggyBank,
    color: "text-green-600",
    bgColor: "bg-green-50",
    borderColor: "border-green-200"
  },
  credit_card: {
    label: "Cartão de Crédito",
    icon: CreditCard,
    color: "text-purple-600",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-200"
  },
  investment: {
    label: "Investimentos",
    icon: TrendingUp,
    color: "text-orange-600",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-200"
  },
  cash: {
    label: "Dinheiro",
    icon: Banknote,
    color: "text-gray-600",
    bgColor: "bg-gray-50",
    borderColor: "border-gray-200"
  }
};

const AccountGroup = ({ config, accounts, totalBalanceInBRL, hasMultipleCurrencies, handleAccountClick }) => {
  if (!accounts || accounts.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="p-4 rounded-xl border border-outline-variant bg-surface-container-lowest shadow-sm"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg bg-secondary/10 text-secondary`}>
            <config.icon className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-headline-sm text-headline-sm">{config.label}</h4>
            <p className="font-body-sm text-body-sm text-on-surface-variant">{accounts.length} conta{accounts.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <div className="text-right">
          {totalBalanceInBRL !== null ? (
            <div className={`font-bold font-headline-sm text-headline-sm ${totalBalanceInBRL < 0 ? 'text-error' : 'text-on-background'}`}>
              {formatCurrencyWithSymbol(totalBalanceInBRL, 'BRL')}
              {hasMultipleCurrencies && (
                <p className="font-body-sm text-body-sm font-normal text-on-surface-variant">(convertido)</p>
              )}
            </div>
          ) : (
            <Skeleton className="h-5 w-20" />
          )}
        </div>
      </div>
      
      <div className="space-y-2">
        {accounts.map((account) => {
          const brlBalance = account.brlBalance;
          const originalCurrency = account.currency || 'BRL';
          return (
            <div 
              key={account.id} 
              className="flex items-center justify-between font-body-sm text-body-sm cursor-pointer hover:bg-surface-container-low rounded-lg p-2 -m-2 transition-colors duration-200"
              onClick={() => handleAccountClick(account.id)}
              title={`Clique para ver transações de ${account.name}`}
            >
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-outline-variant rounded-full" />
                <span className="text-on-background truncate font-semibold">{account.name}</span>
                {account.bank && (
                  <Badge variant="outline" className="text-xs border-outline-variant text-on-surface-variant font-label-md">
                    {account.bank}
                  </Badge>
                )}
              </div>
              <span className={`font-semibold text-on-background ${brlBalance < 0 ? 'text-error' : ''}`}>
                {formatCurrencyWithSymbol(brlBalance, 'BRL')}
                {originalCurrency !== 'BRL' && (
                  <span className="font-body-sm text-body-sm text-on-surface-variant ml-1">
                    ({formatCurrencyWithSymbol(account.current_balance || account.initial_balance || 0, originalCurrency)})
                  </span>
                )}
              </span>
            </div>
          )
        })}
      </div>
    </motion.div>
  );
};

export default function AccountsList({ groupedAccounts, isLoading }) {
  const navigate = useNavigate();
  const [sortedGroups, setSortedGroups] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Debounce para evitar cálculos excessivos
  const [debouncedGroupedAccounts, setDebouncedGroupedAccounts] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedGroupedAccounts(groupedAccounts);
    }, 300);

    return () => clearTimeout(timer);
  }, [groupedAccounts]);

  useEffect(() => {
    if (isLoading || !debouncedGroupedAccounts) {
      setSortedGroups([]);
      return;
    }

    const processAndSort = async () => {
      setIsProcessing(true);
      const groupsArray = [];

      // Processar um grupo por vez para evitar sobrecarregar o sistema
      for (const type in debouncedGroupedAccounts) {
        const accounts = debouncedGroupedAccounts[type];
        if (accounts.length === 0) continue;

        let totalBrlBalance = 0;
        const uniqueCurrencies = [...new Set(accounts.map(acc => acc.currency || 'BRL'))];
        const hasMultipleCurrencies = uniqueCurrencies.length > 1 || uniqueCurrencies[0] !== 'BRL';

        // Processar contas em lotes pequenos para evitar rate limit
        const batchSize = 3;
        const accountsWithBrlBalance = [];
        
        for (let i = 0; i < accounts.length; i += batchSize) {
          const batch = accounts.slice(i, i + batchSize);
          const batchPromises = batch.map(async (acc) => {
            const brlBalance = await convertCurrency(
              acc.current_balance || acc.initial_balance || 0,
              acc.currency || 'BRL',
              'BRL'
            );
            return { ...acc, brlBalance };
          });
          
          const batchResults = await Promise.all(batchPromises);
          accountsWithBrlBalance.push(...batchResults);
          
          // Pequena pausa entre lotes
          if (i + batchSize < accounts.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
        
        totalBrlBalance = accountsWithBrlBalance.reduce((sum, acc) => sum + acc.brlBalance, 0);
        const sortedAccounts = accountsWithBrlBalance.sort((a, b) => b.brlBalance - a.brlBalance);
        
        groupsArray.push({
          type,
          accounts: sortedAccounts,
          totalBrlBalance,
          hasMultipleCurrencies,
          config: accountTypeConfig[type]
        });

        // Pausa entre grupos
        await new Promise(resolve => setTimeout(resolve, 150));
      }
      
      groupsArray.sort((a, b) => b.totalBrlBalance - a.totalBrlBalance);
      setSortedGroups(groupsArray);
      setIsProcessing(false);
    };

    processAndSort();

  }, [debouncedGroupedAccounts, isLoading]);

  const handleAccountClick = (accountId) => {
    navigate(createPageUrl("Transactions") + `?accountId=${accountId}`);
  };

  const showSkeleton = isLoading || isProcessing;

  return (
    <Card className="bg-surface-container-lowest border border-outline-variant shadow-sm rounded-2xl overflow-hidden">
      <CardHeader className="border-b border-outline-variant bg-surface-container-low">
        <div className="flex items-center justify-between">
          <CardTitle className="font-headline-sm text-headline-sm flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-secondary" />
            Suas Contas
          </CardTitle>
          <Link to={createPageUrl("Accounts")}>
            <Button variant="outline" size="sm" className="gap-2 border-outline-variant text-on-surface-variant hover:bg-surface-container-high">
              Ver todas
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      
      <CardContent className="p-6">
        {showSkeleton ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="p-4 border rounded-lg">
                <div className="flex items-center gap-3 mb-3">
                  <Skeleton className="w-9 h-9 rounded-lg" />
                  <div>
                    <Skeleton className="h-4 w-24 mb-1" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
                <Skeleton className="h-6 w-20" />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {sortedGroups.map((group) => (
              <AccountGroup
                key={group.type}
                config={group.config}
                accounts={group.accounts}
                totalBalanceInBRL={group.totalBrlBalance}
                hasMultipleCurrencies={group.hasMultipleCurrencies}
                handleAccountClick={handleAccountClick}
              />
            ))}
            
            {sortedGroups.length === 0 && !showSkeleton && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-12"
              >
                <CreditCard className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Nenhuma conta cadastrada
                </h3>
                <p className="text-gray-600 mb-6">
                  Comece adicionando suas contas bancárias, cartões e investimentos
                </p>
                <Link to={createPageUrl("Accounts")}>
                  <Button className="bg-secondary text-on-secondary hover:opacity-90 shadow-sm">
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar primeira conta
                  </Button>
                </Link>
              </motion.div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
