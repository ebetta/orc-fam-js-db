import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  Landmark,
  Link2,
  Loader2,
  RefreshCw,
  Scale
} from "lucide-react";

const UNMAPPED = "__none__";

const PERIOD_OPTIONS = [
  { value: "auto", label: "Desde a última sincronização" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "90", label: "Últimos 90 dias" },
  { value: "180", label: "Últimos 180 dias" }
];

const formatCurrency = (amount, currency = "BRL") =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(amount || 0);

// No Pluggy, o saldo de um cartão é o valor devido (positivo); aqui um cartão
// carrega saldo negativo, então a sugestão é o oposto.
const expectedBalance = (pluggyAccount) =>
  pluggyAccount.type === 'CREDIT' ? -pluggyAccount.balance : pluggyAccount.balance;

const formatDateTime = (value) =>
  value ? format(new Date(value), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : "nunca";

export default function PluggySyncTab({ accounts, onFinish }) {
  const [status, setStatus] = useState(null);
  const [pluggyAccounts, setPluggyAccounts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [savingAccountId, setSavingAccountId] = useState(null);
  const [period, setPeriod] = useState("auto");
  const [error, setError] = useState("");
  const [balanceInputs, setBalanceInputs] = useState({});
  const [balanceNotice, setBalanceNotice] = useState({});

  useEffect(() => {
    loadConnection();
  }, []);

  // Sugere o saldo do Pluggy só na primeira vez que a conta aparece — não
  // sobrescreve o que o usuário já está digitando quando a tela recarrega.
  useEffect(() => {
    setBalanceInputs(prev => {
      let changed = false;
      const next = { ...prev };
      for (const acc of pluggyAccounts) {
        if (acc.local_account_id && next[acc.id] === undefined) {
          next[acc.id] = expectedBalance(acc).toFixed(2);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [pluggyAccounts]);

  const loadConnection = async () => {
    setIsLoading(true);
    setError("");
    try {
      const { data: statusData } = await api.get('pluggy/status');
      setStatus(statusData);

      if (statusData?.configured && statusData.itemIds.length > 0) {
        const { data: accountsData } = await api.get('pluggy/accounts');
        setPluggyAccounts(accountsData || []);
      } else {
        setPluggyAccounts([]);
      }
    } catch (err) {
      console.error("Erro ao carregar conexão Pluggy:", err);
      setError("Não foi possível falar com o Pluggy. Verifique as credenciais no .env e os logs do servidor.");
    }
    setIsLoading(false);
  };

  const handleMapAccount = async (pluggyAccount, localAccountId) => {
    setSavingAccountId(pluggyAccount.id);
    setError("");
    try {
      // Libera o vínculo anterior: pluggy_account_id é único no banco.
      if (pluggyAccount.local_account_id && pluggyAccount.local_account_id !== localAccountId) {
        await api.put('accounts', pluggyAccount.local_account_id, { pluggy_account_id: null });
      }
      if (localAccountId !== UNMAPPED) {
        // A data de corte nasce como hoje: sem ela, a primeira sincronização puxaria
        // 90 dias e duplicaria tudo que já foi lançado à mão.
        await api.put('accounts', localAccountId, {
          pluggy_account_id: pluggyAccount.id,
          pluggy_cutover_date: new Date().toISOString().split('T')[0]
        });
      }
      await loadConnection();
    } catch (err) {
      console.error("Erro ao mapear conta:", err);
      setError("Não foi possível salvar o vínculo da conta.");
    }
    setSavingAccountId(null);
  };

  const handleCutoverChange = async (pluggyAccount, date) => {
    if (!date) return;
    setSavingAccountId(pluggyAccount.id);
    setError("");
    try {
      await api.put('accounts', pluggyAccount.local_account_id, { pluggy_cutover_date: date });
      await loadConnection();
    } catch (err) {
      console.error("Erro ao salvar data de corte:", err);
      setError("Não foi possível salvar a data de corte.");
    }
    setSavingAccountId(null);
  };

  const handleUseSuggestion = (pluggyAccount) => {
    setBalanceInputs(prev => ({ ...prev, [pluggyAccount.id]: expectedBalance(pluggyAccount).toFixed(2) }));
  };

  const handleSaveRealBalance = async (pluggyAccount) => {
    const raw = (balanceInputs[pluggyAccount.id] ?? "").toString().replace(",", ".");
    const value = parseFloat(raw);
    if (Number.isNaN(value)) {
      setError("Informe um saldo válido.");
      return;
    }

    setSavingAccountId(pluggyAccount.id);
    setError("");
    setBalanceNotice(prev => ({ ...prev, [pluggyAccount.id]: null }));
    try {
      const { data, error: reconcileError } = await api.post('pluggy/reconcile', {
        accountId: pluggyAccount.local_account_id,
        targetBalance: value
      });
      if (reconcileError) throw new Error(reconcileError.message);
      setBalanceNotice(prev => ({
        ...prev,
        [pluggyAccount.id]: data.adjusted ? "Saldo atualizado." : "O saldo já estava correto."
      }));
      await loadConnection();
    } catch (err) {
      console.error("Erro ao salvar o saldo real:", err);
      setError(err.message || "Não foi possível salvar o saldo real.");
    }
    setSavingAccountId(null);
  };

  const handleSync = async () => {
    setIsSyncing(true);
    setError("");
    try {
      const payload = {};
      if (period !== "auto") {
        const start = new Date(Date.now() - Number(period) * 24 * 60 * 60 * 1000);
        payload.from = start.toISOString().split('T')[0];
      }

      const { data: results, error: syncError } = await api.post('pluggy/sync', payload);
      if (syncError) throw new Error(syncError.message);

      await loadConnection();
      onFinish(results);
    } catch (err) {
      console.error("Erro na sincronização:", err);
      setError(err.message || "Erro inesperado durante a sincronização.");
    }
    setIsSyncing(false);
  };

  const mappedCount = pluggyAccounts.filter(a => a.local_account_id).length;

  if (isLoading) {
    return (
      <Card className="shadow-lg border-0">
        <CardContent className="p-12 flex items-center justify-center gap-2 text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          Carregando conexão com o Pluggy...
        </CardContent>
      </Card>
    );
  }

  if (!status?.configured) {
    return (
      <Card className="shadow-lg border-0">
        <CardHeader className="border-b bg-gray-50">
          <CardTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5 text-indigo-600" />
            Conectar ao Open Finance
          </CardTitle>
        </CardHeader>
        <CardContent className="p-8 space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              A integração ainda não está configurada no servidor.
            </AlertDescription>
          </Alert>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800 space-y-2">
            <p className="font-medium text-blue-900">Para ativar:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Crie uma aplicação de desenvolvimento em <strong>dashboard.pluggy.ai</strong> e copie o Client ID e o Client Secret.</li>
              <li>Inclua o <strong>Conector 200 (Meu Pluggy)</strong> na aplicação e vincule sua conta do <strong>meu.pluggy.ai</strong> pela Demo (autorização OAuth), uma vez por banco.</li>
              <li>Copie o <strong>Item ID</strong> de cada banco conectado.</li>
              <li>Preencha <code>PLUGGY_CLIENT_ID</code>, <code>PLUGGY_CLIENT_SECRET</code> e <code>PLUGGY_ITEM_IDS</code> no arquivo <code>.env</code> e reinicie o servidor.</li>
            </ol>
            <p className="pt-1">
              Para uso pessoal (apenas suas próprias contas), o Conector 200 é gratuito por tempo
              indeterminado — o trial de 15 dias do Dashboard vale só para uso comercial.
            </p>
          </div>
          <Button variant="outline" onClick={loadConnection}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Verificar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status das conexões */}
      <Card className="shadow-lg border-0">
        <CardHeader className="border-b bg-gray-50">
          <CardTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5 text-indigo-600" />
            Conexões Open Finance
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-3">
          {status.items.length === 0 && (
            <p className="text-sm text-gray-500">
              Nenhum Item ID configurado. Preencha <code>PLUGGY_ITEM_IDS</code> no <code>.env</code>.
            </p>
          )}
          {status.items.map(item => (
            <div key={item.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
              <div className="min-w-0">
                <p className="font-medium text-slate-900 truncate">
                  {item.connectorName || 'Conexão'}
                </p>
                <p className="text-xs text-gray-500">
                  Dados coletados do banco em {formatDateTime(item.lastUpdatedAt)}
                </p>
                {item.nextAutoSyncAt && (
                  <p className="text-xs text-gray-500">
                    Próxima coleta automática: {formatDateTime(item.nextAutoSyncAt)}
                  </p>
                )}
                {!item.canForceUpdate && item.status !== 'INVALID' && item.status !== 'ERROR' && (
                  <p className="text-xs text-gray-500 mt-1">
                    O MeuPluggy coleta do banco uma vez por dia e não aceita atualização sob
                    demanda — compras posteriores à última coleta só aparecem depois da próxima.
                  </p>
                )}
                {item.error && (
                  <p className="text-xs text-red-600 mt-1">{item.error}</p>
                )}
              </div>
              <Badge className={item.status === 'UPDATED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}>
                {item.status}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Mapeamento de contas */}
      <Card className="shadow-lg border-0">
        <CardHeader className="border-b bg-gray-50">
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-indigo-600" />
            Contas do Pluggy
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          {pluggyAccounts.length === 0 && (
            <p className="text-sm text-gray-500">
              Nenhuma conta encontrada nas conexões configuradas.
            </p>
          )}

          {pluggyAccounts.map(pluggyAccount => (
            <div
              key={pluggyAccount.id}
              className="rounded-lg border border-slate-200 p-4 space-y-3 transition-shadow hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  {pluggyAccount.type === 'CREDIT'
                    ? <CreditCard className="w-5 h-5 text-indigo-600 mt-0.5 shrink-0" />
                    : <Landmark className="w-5 h-5 text-indigo-600 mt-0.5 shrink-0" />}
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900 truncate">{pluggyAccount.name}</p>
                    <p className="text-xs text-gray-500">
                      {pluggyAccount.type === 'CREDIT' ? 'Cartão de crédito' : 'Conta bancária'}
                      {pluggyAccount.number ? ` · ${pluggyAccount.number}` : ''}
                    </p>
                  </div>
                </div>
                <span className="text-sm font-semibold text-slate-900 whitespace-nowrap">
                  {formatCurrency(pluggyAccount.balance, pluggyAccount.currency_code)}
                </span>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium text-gray-600">Conta no sistema</Label>
                <div className="flex items-center gap-2">
                  <Select
                    value={pluggyAccount.local_account_id || UNMAPPED}
                    onValueChange={(value) => handleMapAccount(pluggyAccount, value)}
                    disabled={savingAccountId === pluggyAccount.id}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Não vinculada" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UNMAPPED}>Não vinculada</SelectItem>
                      {accounts.map(account => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.name} ({account.bank})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {savingAccountId === pluggyAccount.id && (
                    <Loader2 className="w-4 h-4 animate-spin text-gray-400 shrink-0" />
                  )}
                  {pluggyAccount.local_account_id && savingAccountId !== pluggyAccount.id && (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  )}
                </div>
                {pluggyAccount.local_account_id && (
                  <div className="space-y-2 pt-2">
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-gray-600">
                        Importar a partir de
                      </Label>
                      <Input
                        type="date"
                        value={pluggyAccount.cutover_date || ''}
                        onChange={(e) => handleCutoverChange(pluggyAccount, e.target.value)}
                        disabled={savingAccountId === pluggyAccount.id}
                        className="max-w-[12rem]"
                      />
                      <p className="text-xs text-gray-500">
                        Nada anterior a esta data é importado — protege o que você lançou à mão.
                      </p>
                    </div>
                    <p className="text-xs text-gray-500">
                      Última sincronização: {formatDateTime(pluggyAccount.last_sync_at)}
                    </p>

                    <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-600">Saldo no app</span>
                        <span className="font-medium text-slate-900">
                          {formatCurrency(pluggyAccount.local_balance, pluggyAccount.currency_code)}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-600">Sugestão do Pluggy</span>
                        <span className="font-medium text-slate-900">
                          {formatCurrency(expectedBalance(pluggyAccount), pluggyAccount.currency_code)}
                        </span>
                      </div>

                      <div className="space-y-1 pt-1">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-medium text-gray-600">
                            Saldo real (o que aparece no app do banco)
                          </Label>
                          <button
                            type="button"
                            onClick={() => handleUseSuggestion(pluggyAccount)}
                            className="text-xs text-indigo-600 hover:underline"
                          >
                            Usar sugestão
                          </button>
                        </div>
                        <p className="text-xs text-amber-700">
                          Confira no app do banco antes de salvar — logo após uma compra recente, a
                          sugestão do Pluggy pode estar adiantada em relação às transações listadas.
                        </p>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            step="0.01"
                            value={balanceInputs[pluggyAccount.id] ?? ''}
                            onChange={(e) => setBalanceInputs(prev => ({ ...prev, [pluggyAccount.id]: e.target.value }))}
                            disabled={savingAccountId === pluggyAccount.id}
                            className="h-8 text-xs max-w-[10rem]"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSaveRealBalance(pluggyAccount)}
                            disabled={savingAccountId === pluggyAccount.id}
                            className="h-8 text-xs"
                          >
                            <Scale className="w-3.5 h-3.5 mr-1.5" />
                            Salvar saldo real
                          </Button>
                        </div>
                        {balanceNotice[pluggyAccount.id] && (
                          <p className="flex items-center gap-1.5 text-xs text-emerald-700 pt-0.5">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {balanceNotice[pluggyAccount.id]}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Sincronização */}
      <Card className="shadow-lg border-0">
        <CardHeader className="border-b bg-gray-50">
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-indigo-600" />
            Sincronizar Transações
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div className="space-y-2 max-w-sm">
            <Label className="text-sm font-medium">Período</Label>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIOD_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• A sincronização traz tudo que o Pluggy já coletou — o que for mais recente que a última coleta ainda não estará lá</li>
              <li>• Transações já importadas são ignoradas automaticamente pelo ID do Pluggy</li>
              <li>• Pode lançar à mão sem medo de duplicar: um lançamento manual com o mesmo valor e data próxima (até 2 dias) é reconhecido como a mesma transação, em vez de importado de novo</li>
              <li>• Compras no cartão entram como despesa; pagamentos de fatura, como receita</li>
              <li>• Compras da fatura aberta contam no saldo e são reescritas a cada sincronização, porque o banco ainda pode alterá-las</li>
              <li>• Tags são atribuídas automaticamente baseadas na descrição</li>
            </ul>
          </div>

          <div className="flex items-center justify-between pt-2">
            <p className="text-sm text-gray-500">
              {mappedCount} {mappedCount === 1 ? 'conta vinculada' : 'contas vinculadas'}
            </p>
            <Button
              onClick={handleSync}
              disabled={mappedCount === 0 || isSyncing}
              size="lg"
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {isSyncing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sincronizando...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Sincronizar agora
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
