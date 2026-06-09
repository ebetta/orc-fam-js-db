
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { motion } from "framer-motion";
import { useCurrencyConversion, convertCurrency } from "../components/utils/CurrencyConverter";

import WelcomeCard from "../components/dashboard/WelcomeCard";
import AccountsList from "../components/dashboard/AccountsList";

import ExpensesChart from "../components/dashboard/ExpensesChart";
import PatrimonyEvolutionChart from "../components/dashboard/PatrimonyEvolutionChart";
import MonthlyExpensesChart from "../components/dashboard/MonthlyExpensesChart";

const stagger = { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4 } };

export default function Dashboard() {
  const [accounts, setAccounts] = useState([]);
  const [allTransactions, setAllTransactions] = useState([]);
  const [tags, setTags] = useState([]);
  const [patrimonyData, setPatrimonyData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalNetWorth, setTotalNetWorth] = useState(0);
  const [isCalculatingNetWorth, setIsCalculatingNetWorth] = useState(false);
  const { preloadExchangeRates } = useCurrencyConversion();

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      const { data: accountsData, error: accountsError } = await api.get('accounts', { _sort: 'updated_at', _order: 'desc' });
      if (accountsError) console.error("Erro ao carregar contas:", accountsError);

      const fetchedAccounts = accountsData || [];
      const processedAccounts = fetchedAccounts.map(acc => ({
        ...acc,
        initial_balance: (acc.initial_balance === null || typeof acc.initial_balance === 'undefined' || isNaN(parseFloat(acc.initial_balance)))
                         ? 0
                         : parseFloat(acc.initial_balance)
      }));
      setAccounts(processedAccounts);

      const { data: allTransactionsData, error: allTransactionsError } = await api.get('transactions', { _sort: 'transaction_date', _order: 'desc' });
      if (allTransactionsError) console.error("Erro ao carregar todas as transações:", allTransactionsError);
      setAllTransactions(allTransactionsData || []);

      const { data: tagsData, error: tagsError } = await api.get('tags');
      if (tagsError) console.error("Erro ao carregar tags:", tagsError);
      setTags(tagsData || []);

      const { data: patrimonyRes, error: patrimonyError } = await api.get('patrimony');
      if (patrimonyError) console.error("Erro ao carregar patrimônio:", patrimonyError);
      setPatrimonyData(patrimonyRes || []);

      const currentAccounts = accountsData || [];
      if (currentAccounts.length > 0) {
        const uniqueCurrencies = [...new Set(currentAccounts.map(acc => acc.currency || 'BRL'))];
        const foreignCurrencies = uniqueCurrencies.filter(curr => curr !== 'BRL');
        if (foreignCurrencies.length > 0) {
          await preloadExchangeRates(foreignCurrencies);
        }
      }
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    const calculateNetWorth = async () => {
      if (isLoading || !accounts.length) { setIsCalculatingNetWorth(false); return; }
      setIsCalculatingNetWorth(true);
      try {
        let totalInBRL = 0;
        const conversionPromises = accounts
          .filter(acc => acc.is_active !== false)
          .map(async (account) => {
            const balance = parseFloat(account.current_balance);
            const numericBalance = isNaN(balance) ? (parseFloat(account.initial_balance) || 0) : balance;
            const currency = account.currency || 'BRL';
            return convertCurrency(numericBalance, currency, 'BRL');
          });
        const convertedBalances = await Promise.all(conversionPromises);
        totalInBRL = convertedBalances.reduce((sum, balance) => sum + balance, 0);
        setTotalNetWorth(totalInBRL);
      } catch (error) {
        console.error('Erro ao calcular patrimônio:', error);
        setTotalNetWorth(0);
      }
      setIsCalculatingNetWorth(false);
    };
    calculateNetWorth();
  }, [accounts, isLoading]);

  const getAccountsByType = () => {
    const activeAccounts = accounts.filter(acc => acc.is_active !== false);
    const groupedAccounts = {
      checking: activeAccounts.filter(acc => acc.account_type === 'checking'),
      savings: activeAccounts.filter(acc => acc.account_type === 'savings'),
      credit_card: activeAccounts.filter(acc => acc.account_type === 'credit_card'),
      investment: activeAccounts.filter(acc => acc.account_type === 'investment'),
      cash: activeAccounts.filter(acc => acc.account_type === 'cash')
    };
    return groupedAccounts;
  };

  const groupedAccounts = getAccountsByType();

  return (
    <div className="v2-theme bg-background min-h-screen">
      <div className="p-6 lg:p-10 space-y-8">

        {/* Page Header */}
        <motion.div {...stagger} transition={{ duration: 0.4 }}>
          <h2 className="font-headline-lg text-headline-lg text-green-600">Dashboard</h2>
        </motion.div>

        {/* Welcome Card with Net Worth */}
        <motion.div {...stagger} transition={{ duration: 0.4, delay: 0.05 }}>
          <WelcomeCard netWorth={totalNetWorth} isLoading={isCalculatingNetWorth} />
        </motion.div>

        {/* Main Grid: Charts (left) + Accounts (right) */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          {/* Left Column: Charts */}
          <div className="xl:col-span-8 space-y-6">
            <motion.div {...stagger} transition={{ duration: 0.4, delay: 0.1 }}>
              <PatrimonyEvolutionChart patrimonyData={patrimonyData} isLoading={isLoading} />
            </motion.div>
            <motion.div {...stagger} transition={{ duration: 0.4, delay: 0.15 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-6"
            >
              <ExpensesChart transactions={allTransactions} tags={tags} isLoading={isLoading} accounts={accounts} />
              <MonthlyExpensesChart transactions={allTransactions} isLoading={isLoading} accounts={accounts} />
            </motion.div>
          </div>

          {/* Right Column: Accounts */}
          <motion.div {...stagger} transition={{ duration: 0.4, delay: 0.2 }}
            className="xl:col-span-4"
          >
            <AccountsList groupedAccounts={groupedAccounts} isLoading={isLoading} />
          </motion.div>
        </div>

      </div>
    </div>
  );
}
