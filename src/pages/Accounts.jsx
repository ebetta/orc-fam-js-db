import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { api, auth } from "@/lib/api";
import { useSidebarActions } from "./Layout";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/components/ui/use-toast";
import { convertCurrency } from "../components/utils/CurrencyConverter";
import AccountForm from "../components/accounts/AccountForm";
import { Switch } from "@/components/ui/switch";

import {
  Pencil,
  Trash2,
  Search,
  Wallet,
  PiggyBank,
  CreditCard,
  BarChart3,
  Banknote,
  ArrowUpRight,
} from "lucide-react";

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

// ─── Sub-components ──────────────────────────────────────────────────────────

function HeroCard({ totalNetWorth, isLoading, activeCount, inactiveCount }) {
  return (
    <div className="relative overflow-hidden p-8 rounded-2xl text-white shadow-lg"
      style={{ background: "linear-gradient(135deg, #4648d4 0%, #6063ee 60%, #8b5cf6 100%)" }}>
      <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-20 -mt-20 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-black/10 rounded-full -ml-10 -mb-10 blur-2xl pointer-events-none" />

      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
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

        <div className="flex gap-6 md:gap-8">
          <div className="flex flex-col items-end">
            <p className="text-xs font-label-md text-white/70 uppercase">Contas Ativas</p>
            <span className="font-bold text-lg text-white">
              {activeCount}
            </span>
          </div>
          <div className="w-px bg-white/20" />
          <div className="flex flex-col items-end">
            <p className="text-xs font-label-md text-white/70 uppercase">Contas Inativas</p>
            <span className="font-bold text-lg text-white/80">
              {inactiveCount}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function FiltersBar({ filterType, onFilterChange, searchTerm, onSearchChange, accountsCount }) {
  return (
    <div className="glass-card p-4 rounded-2xl flex flex-wrap gap-4 items-center shadow-sm">
      <div className="flex-grow min-w-[200px] relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
        <input
          type="text"
          placeholder="Buscar por nome ou banco..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-surface-container-low border-none rounded-xl font-body-sm text-body-sm text-on-background placeholder-gray-400 focus:ring-2 focus:ring-secondary focus:outline-none transition-all"
        />
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <select
          value={filterType}
          onChange={(e) => onFilterChange(e.target.value)}
          className="bg-surface-container-low border-none rounded-xl py-3 px-4 font-label-md text-label-md text-on-surface-variant focus:ring-2 focus:ring-secondary focus:outline-none cursor-pointer"
        >
          <option value="all">Tipo: Todos</option>
          <option value="checking">Conta Corrente</option>
          <option value="savings">Poupança</option>
          <option value="credit_card">Cartão de Crédito</option>
          <option value="investment">Investimentos</option>
          <option value="cash">Dinheiro</option>
        </select>
      </div>

      <span className="text-xs text-gray-400 font-semibold ml-auto">
        {accountsCount} conta{accountsCount !== 1 ? "s" : ""}
      </span>
    </div>
  );
}

function AccountGrid({ accounts, brlBalances, onEdit, onDelete, onToggleActive }) {
  if (accounts.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-full bg-surface-container-low flex items-center justify-center">
            <ArrowUpRight className="w-8 h-8 text-secondary/60" />
          </div>
          <p className="text-on-surface-variant font-semibold text-sm">Nenhuma conta encontrada</p>
          <p className="text-gray-400 text-xs">Ajuste os filtros ou adicione uma nova conta</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {accounts.map((account, index) => {
        const cfg = accountTypeConfig[account.account_type] || accountTypeConfig.checking;
        const Icon = cfg.icon;
        const balance = parseFloat(account.current_balance || 0);
        const currency = account.currency || "BRL";
        const brlBalance = brlBalances[account.id] ?? balance;
        const isNegative = brlBalance < 0;
        const bankCfg = getBankColorConfig(account.bank || account.name);
        const isInactive = account.is_active === false;

        return (
          <motion.div
            key={account.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: index * 0.05 }}
            whileHover={{ scale: 1.02, boxShadow: "0 4px 20px rgba(0,0,0,0.12)" }}
            className={`glass-card rounded-xl flex flex-col p-4 transition-all duration-200 border ${
              isInactive ? "opacity-60 grayscale-[0.3]" : ""
            }`}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`p-2 rounded-lg shrink-0 ${bankCfg ? `${bankCfg.bg} ${bankCfg.text}` : `${cfg.bgClass} ${cfg.colorClass}`}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-on-background text-base truncate" title={account.name}>
                    {account.name}
                  </h3>
                  <span className="text-xs text-on-surface-variant font-medium">
                    {account.bank || cfg.label}
                  </span>
                </div>
              </div>
              <span className="font-label-md text-[10px] font-bold uppercase tracking-wider text-on-surface-variant shrink-0 ml-2">
                {currency}
              </span>
            </div>

            {/* Balance */}
            <div className="mb-3">
              <p className={`text-2xl font-bold tracking-tight ${isNegative ? "text-error" : "text-on-background"}`}>
                {fmtCurrency(brlBalance, "BRL")}
              </p>
              {currency !== "BRL" && (
                <p className="text-xs text-on-surface-variant mt-0.5">
                  ({fmtCurrency(balance, currency)})
                </p>
              )}
            </div>

            {/* Details */}
            {account.account_number && (
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-on-surface-variant">Número:</span>
                <span className="font-mono text-on-background">****{account.account_number.slice(-4)}</span>
              </div>
            )}

            {/* Active toggle + actions */}
            <div className="mt-auto pt-3 border-t border-outline-variant/40 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-label-md text-on-surface-variant uppercase tracking-wider">Ativa</span>
                <Switch
                  checked={account.is_active !== false}
                  onCheckedChange={() => onToggleActive(account)}
                />
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onEdit(account)}
                  className="p-1.5 rounded-lg text-on-surface-variant hover:text-secondary hover:bg-surface-container-high transition-colors"
                  title="Editar"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onDelete(account.id)}
                  className="p-1.5 rounded-lg text-on-surface-variant hover:text-error hover:bg-red-50 transition-colors"
                  title="Excluir"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

// ─── Main Page Component ─────────────────────────────────────────────────────

export default function Accounts() {
  const [accounts, setAccounts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [filterType, setFilterType] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [brlBalances, setBrlBalances] = useState({});
  const [totalNetWorth, setTotalNetWorth] = useState(0);
  const [isCalculating, setIsCalculating] = useState(true);
  const { toast } = useToast();
  const { registerNewAccountHandler, unregisterNewAccountHandler } = useSidebarActions();
  const openNewAccountRef = useRef(null);

  const loadAccounts = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await api.get("accounts", { _sort: "updated_at", _order: "desc" });
      if (error) throw error;
      setAccounts(data || []);
    } catch (error) {
      console.error("Erro ao carregar contas:", error.message);
      toast({ title: "Erro ao carregar contas", description: "Tente novamente.", variant: "destructive" });
    }
    setIsLoading(false);
  }, [toast]);

  useEffect(() => { loadAccounts(); }, [loadAccounts]);

  openNewAccountRef.current = () => {
    setEditingAccount(null);
    setShowForm(true);
  };

  useEffect(() => {
    registerNewAccountHandler(() => openNewAccountRef.current?.());
    return () => unregisterNewAccountHandler();
  }, [registerNewAccountHandler, unregisterNewAccountHandler]);

  // Calculate BRL balances and total net worth
  useEffect(() => {
    const calc = async () => {
      if (!accounts.length) { setIsCalculating(false); setTotalNetWorth(0); setBrlBalances({}); return; }
      setIsCalculating(true);
      let total = 0;
      const map = {};
      for (const acc of accounts) {
        const bal = parseFloat(acc.current_balance || 0);
        const curr = acc.currency || "BRL";
        if (curr === "BRL") {
          map[acc.id] = bal;
          total += bal;
        } else {
          const converted = await convertCurrency(bal, curr, "BRL");
          map[acc.id] = converted;
          total += converted;
        }
      }
      setBrlBalances(map);
      setTotalNetWorth(total);
      setIsCalculating(false);
    };
    calc();
  }, [accounts]);

  const handleCreateAccount = async (accountData) => {
    try {
      const { data: { user } } = await auth.getUser();
      if (!user) throw new Error("Usuário não autenticado.");
      const { error } = await api.post("accounts", accountData);
      if (error) throw error;
      setShowForm(false);
      setEditingAccount(null);
      loadAccounts();
      toast({ title: "Conta criada!", description: `"${accountData.name}" foi criada com sucesso.`, className: "bg-green-100 text-green-800 border-green-300" });
    } catch (error) {
      console.error("Erro ao criar conta:", error.message);
      toast({ title: "Erro ao criar conta", variant: "destructive" });
    }
  };

  const handleDeleteAccount = async (accountId) => {
    try {
      const { error } = await api.delete("accounts", accountId);
      if (error) throw error;
      loadAccounts();
      toast({ title: "Conta excluída!", description: "A conta foi removida." });
    } catch (error) {
      console.error("Erro ao excluir conta:", error.message);
      toast({ title: "Erro ao excluir conta", variant: "destructive" });
    }
  };

  const handleUpdateAccount = async (accountData) => {
    try {
      const { error } = await api.put("accounts", editingAccount.id, accountData);
      if (error) throw error;
      setShowForm(false);
      setEditingAccount(null);
      loadAccounts();
      toast({ title: "Conta atualizada!", description: `"${accountData.name}" foi atualizada.`, className: "bg-green-100 text-green-800 border-green-300" });
    } catch (error) {
      console.error("Erro ao atualizar conta:", error.message);
      toast({ title: "Erro ao atualizar conta", variant: "destructive" });
    }
  };

  const handleEditAccount = (account) => {
    setEditingAccount(account);
    setShowForm(true);
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingAccount(null);
  };

  const handleToggleActive = async (account) => {
    try {
      const nextActive = account.is_active === false ? true : false;
      const { error } = await api.put("accounts", account.id, { is_active: nextActive });
      if (error) throw error;
      loadAccounts();
      toast({ title: `Conta ${nextActive ? "ativada" : "desativada"}.` });
    } catch (error) {
      console.error("Erro ao alterar status:", error.message);
      toast({ title: "Erro ao alterar status", variant: "destructive" });
    }
  };

  const filteredAccounts = useMemo(() => {
    return accounts
      .filter((a) => (filterType === "all" ? true : a.account_type === filterType))
      .filter((a) => (searchTerm ? a.name.toLowerCase().includes(searchTerm.toLowerCase()) || (a.bank || "").toLowerCase().includes(searchTerm.toLowerCase()) : true));
  }, [accounts, filterType, searchTerm]);

  const activeCount = accounts.filter((a) => a.is_active !== false).length;
  const inactiveCount = accounts.length - activeCount;

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
            isLoading={isCalculating || isLoading}
            activeCount={activeCount}
            inactiveCount={inactiveCount}
          />
        </motion.div>

        {/* ── Filters Bar ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <FiltersBar
            filterType={filterType}
            onFilterChange={setFilterType}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            accountsCount={filteredAccounts.length}
          />
        </motion.div>

        {/* ── Accounts Grid ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
        >
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="glass-card rounded-xl p-4 h-48 animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-4" />
                  <div className="h-8 bg-gray-200 rounded w-1/2 mb-4" />
                  <div className="h-4 bg-gray-200 rounded w-2/3" />
                </div>
              ))}
            </div>
          ) : (
            <AccountGrid
              accounts={filteredAccounts}
              brlBalances={brlBalances}
              onEdit={handleEditAccount}
              onDelete={handleDeleteAccount}
              onToggleActive={handleToggleActive}
            />
          )}
        </motion.div>
      </div>

      {/* ── Account Form Modal ── */}
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
              <AccountForm
                account={editingAccount}
                onSave={editingAccount ? handleUpdateAccount : handleCreateAccount}
                onCancel={handleCancelForm}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
