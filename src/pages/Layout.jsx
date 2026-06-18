
import React, { createContext, useContext, useMemo, useRef, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Home,
  CreditCard,
  Tag,
  Target,
  BarChart,
  LogOut,
  Upload,
  Receipt,
  Plus,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { auth } from "@/lib/api";

const UserContext = createContext(null);
const SidebarActionsContext = createContext(null);

export const useUser = () => useContext(UserContext);

export const useSidebarActions = () => useContext(SidebarActionsContext);

const TRANSACTIONS_URL = createPageUrl("TransactionsV2");
const BUDGETS_URL = createPageUrl("Budgets");
const ACCOUNTS_URL = createPageUrl("Accounts");
const TAGS_URL = createPageUrl("Tags");

const navigationItems = [
  { title: "Dashboard", url: createPageUrl("Dashboard"), icon: Home },
  { title: "Contas", url: createPageUrl("Accounts"), icon: CreditCard },
  { title: "Categorias", url: createPageUrl("Tags"), icon: Tag },
  { title: "Orçamentos", url: createPageUrl("Budgets"), icon: Target },
  { title: "Transações", url: TRANSACTIONS_URL, icon: Receipt },
  { title: "Importar", url: createPageUrl("Import"), icon: Upload },
  { title: "Relatórios", url: createPageUrl("Reports"), icon: BarChart },
];

function normalizePath(path) {
  return path.toLowerCase().replace(/\/$/, "");
}

export default function Layout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = React.useState(null);
  const newTransactionHandlerRef = useRef(null);
  const newBudgetHandlerRef = useRef(null);
  const newAccountHandlerRef = useRef(null);
  const newTagHandlerRef = useRef(null);

  const sidebarActions = useMemo(
    () => ({
      registerNewTransactionHandler: (handler) => {
        newTransactionHandlerRef.current = handler;
      },
      unregisterNewTransactionHandler: () => {
        newTransactionHandlerRef.current = null;
      },
      triggerNewTransaction: () => {
        newTransactionHandlerRef.current?.();
      },
      registerNewBudgetHandler: (handler) => {
        newBudgetHandlerRef.current = handler;
      },
      unregisterNewBudgetHandler: () => {
        newBudgetHandlerRef.current = null;
      },
      triggerNewBudget: () => {
        newBudgetHandlerRef.current?.();
      },
      registerNewAccountHandler: (handler) => {
        newAccountHandlerRef.current = handler;
      },
      unregisterNewAccountHandler: () => {
        newAccountHandlerRef.current = null;
      },
      triggerNewAccount: () => {
        newAccountHandlerRef.current?.();
      },
      registerNewTagHandler: (handler) => {
        newTagHandlerRef.current = handler;
      },
      unregisterNewTagHandler: () => {
        newTagHandlerRef.current = null;
      },
      triggerNewTag: () => {
        newTagHandlerRef.current?.();
      },
    }),
    []
  );

  React.useEffect(() => {
    const fetchUserAndListen = async () => {
      const { data: { user: initialUser } } = await auth.getUser();
      setUser(initialUser);
    };

    fetchUserAndListen();
  }, [navigate, location.pathname]);

  const handleLogout = async () => {
    const { error } = await auth.signOut();
    if (error) {
      console.error("Error logging out:", error);
    }
    setUser(null);
    navigate("/login");
  };

  const isTransactionsPage =
    normalizePath(location.pathname) === normalizePath(TRANSACTIONS_URL);
  const isBudgetsPage =
    normalizePath(location.pathname) === normalizePath(BUDGETS_URL);
  const isAccountsPage =
    normalizePath(location.pathname) === normalizePath(ACCOUNTS_URL);
  const isTagsPage =
    normalizePath(location.pathname) === normalizePath(TAGS_URL);

  const isNavItemActive = useCallback(
    (itemUrl) => normalizePath(location.pathname) === normalizePath(itemUrl),
    [location.pathname]
  );

  return (
    <SidebarActionsContext.Provider value={sidebarActions}>
      <SidebarProvider>
        <div className="v2-theme min-h-screen flex w-full bg-background font-body-md text-body-md text-on-background">
          <Sidebar className="border-r border-outline-variant bg-surface-container-low shadow-sm">
            <SidebarHeader className="border-b border-outline-variant p-5">
              <div className="flex flex-col items-center text-center">
                <img
                  src="/src/assets/ico-orc-fam.png"
                  alt="Orçamento Familiar"
                  className="w-24 h-24"
                />
                <div className="-mt-2">
                  <h2 className="font-headline-sm text-headline-sm text-secondary">
                    Orçamento Familiar
                  </h2>
                  <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                    Controle Financeiro
                  </p>
                </div>
              </div>
            </SidebarHeader>

            <SidebarContent className="px-3 py-4">
              <SidebarGroup className="p-0">
                <SidebarGroupContent>
                  <SidebarMenu className="space-y-1">
                    {navigationItems.map((item) => {
                      const isActive = isNavItemActive(item.url);
                      const isBudgets = item.title === "Orçamentos";
                      const isDashboard = item.title === "Dashboard";
                      const activeBg = isBudgets
                        ? "bg-[#F97316] text-white hover:bg-[#e2620b] hover:text-white"
                        : isDashboard
                        ? "bg-emerald-500 text-white hover:bg-emerald-600 hover:text-white"
                        : "bg-secondary text-on-secondary hover:bg-secondary hover:text-on-secondary";
                      return (
                        <SidebarMenuItem key={item.title}>
                          <SidebarMenuButton
                            asChild
                            className={`
                              h-11 rounded-lg transition-colors duration-200 shadow-sm
                              ${isActive
                                ? activeBg
                                : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-background"
                              }
                            `}
                          >
                            <Link
                              to={item.url}
                              className="flex items-center gap-3 px-3 py-2.5 font-body-sm text-body-sm"
                            >
                              <item.icon className={`w-[18px] h-[18px] shrink-0 ${isActive ? "text-current" : ""}`} />
                              <span className={isActive ? "font-semibold" : "font-medium"}>
                                {item.title}
                              </span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>

            {isAccountsPage && (
              <div className="px-3 pb-2">
                <button
                  type="button"
                  onClick={() => sidebarActions.triggerNewAccount()}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 font-label-md text-label-md text-white bg-secondary rounded-xl shadow-md hover:opacity-90 active:scale-[0.98] transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Nova Conta
                </button>
              </div>
            )}

            {isTagsPage && (
              <div className="px-3 pb-2">
                <button
                  type="button"
                  onClick={() => sidebarActions.triggerNewTag()}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 font-label-md text-label-md text-white bg-secondary rounded-xl shadow-md hover:opacity-90 active:scale-[0.98] transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Nova Categoria
                </button>
              </div>
            )}

            {isTransactionsPage && (
              <div className="px-3 pb-2">
                <button
                  type="button"
                  onClick={() => sidebarActions.triggerNewTransaction()}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 font-label-md text-label-md text-white bg-secondary rounded-xl shadow-md hover:opacity-90 active:scale-[0.98] transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Nova Transação
                </button>
              </div>
            )}

            {isBudgetsPage && (
              <div className="px-3 pb-2">
                <button
                  type="button"
                  onClick={() => sidebarActions.triggerNewBudget()}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 font-label-md text-label-md text-white bg-[#F97316] rounded-xl shadow-md hover:bg-[#e2620b] active:scale-[0.98] transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Novo Orçamento
                </button>
              </div>
            )}

            <SidebarFooter className="border-t border-outline-variant p-4 mt-auto">
              {user && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarFallback className="bg-primary-v2/10 text-primary-v2 font-semibold font-body-sm">
                        {user.user_metadata?.full_name?.charAt(0) ||
                          user.email?.charAt(0).toUpperCase() ||
                          "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold font-body-sm text-body-sm text-on-background truncate">
                        {user.user_metadata?.full_name || user.email || "Usuário"}
                      </p>
                      <p className="font-body-sm text-body-sm text-on-surface-variant truncate">
                        {user.email}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleLogout}
                    className="shrink-0 text-on-surface-variant hover:text-error hover:bg-error/10"
                    aria-label="Sair"
                  >
                    <LogOut className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </SidebarFooter>
          </Sidebar>

          <main className="flex-1 flex flex-col overflow-hidden">
            <header className="bg-surface-container-lowest border-b border-outline-variant px-6 py-4 md:hidden shadow-sm">
              <div className="flex items-center gap-4">
                <SidebarTrigger className="hover:bg-surface-container-high p-2 rounded-lg transition-colors duration-200" />
                <h1 className="font-headline-sm text-headline-sm text-secondary">
                  Orçamento Familiar
                </h1>
              </div>
            </header>

            <div className="flex-1 overflow-auto bg-background">
              <div className="min-h-full">
                <UserContext.Provider value={user}>{children}</UserContext.Provider>
              </div>
            </div>
          </main>
        </div>
      </SidebarProvider>
    </SidebarActionsContext.Provider>
  );
}
