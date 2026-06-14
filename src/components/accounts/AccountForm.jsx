import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { X, Save, CreditCard } from "lucide-react";

const accountTypes = [
  { value: "checking", label: "Conta Corrente" },
  { value: "savings", label: "Poupança" },
  { value: "credit_card", label: "Cartão de Crédito" },
  { value: "investment", label: "Investimentos" },
  { value: "cash", label: "Dinheiro" }
];

export default function AccountForm({ account, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    name: account?.name || "",
    bank: account?.bank || "",
    account_number: account?.account_number || "",
    account_type: account?.account_type || "checking",
    initial_balance: account?.initial_balance || 0,
    currency: account?.currency || "BRL",
    is_active: account?.is_active !== false
  });

  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await onSave(formData);
    } catch (error) {
      console.error("Erro ao salvar conta:", error);
    }
    setIsLoading(false);
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-outline-variant flex items-center justify-between bg-surface-container-low">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-secondary/10 rounded-lg">
            <CreditCard className="w-5 h-5 text-secondary" />
          </div>
          <h3 className="font-headline-sm text-headline-sm text-on-background">
            {account ? "Editar Conta" : "Nova Conta"}
          </h3>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium text-on-background">
                Nome da Conta *
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                placeholder="Ex: Conta Corrente Banco do Brasil"
                required
                className="h-12 bg-surface-container-low border-outline-variant rounded-xl text-on-background focus:ring-2 focus:ring-secondary"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="account_type" className="text-sm font-medium text-on-background">
                Tipo de Conta *
              </Label>
              <Select
                value={formData.account_type}
                onValueChange={(value) => handleInputChange("account_type", value)}
              >
                <SelectTrigger className="h-12 bg-surface-container-low border-outline-variant rounded-xl text-on-background focus:ring-2 focus:ring-secondary">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  {accountTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bank" className="text-sm font-medium text-on-background">
                Banco / Instituição
              </Label>
              <Input
                id="bank"
                value={formData.bank}
                onChange={(e) => handleInputChange("bank", e.target.value)}
                placeholder="Ex: Banco do Brasil, Nubank"
                className="h-12 bg-surface-container-low border-outline-variant rounded-xl text-on-background focus:ring-2 focus:ring-secondary"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="account_number" className="text-sm font-medium text-on-background">
                Número da Conta
              </Label>
              <Input
                id="account_number"
                value={formData.account_number}
                onChange={(e) => handleInputChange("account_number", e.target.value)}
                placeholder="Ex: 12345-6"
                className="h-12 bg-surface-container-low border-outline-variant rounded-xl text-on-background focus:ring-2 focus:ring-secondary"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="initial_balance" className="text-sm font-medium text-on-background">
                Saldo Inicial *
              </Label>
              <Input
                id="initial_balance"
                type="number"
                step="0.01"
                value={formData.initial_balance}
                onChange={(e) => handleInputChange("initial_balance", parseFloat(e.target.value) || 0)}
                placeholder="0,00"
                required
                className="h-12 bg-surface-container-low border-outline-variant rounded-xl text-on-background focus:ring-2 focus:ring-secondary"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="currency" className="text-sm font-medium text-on-background">
                Moeda
              </Label>
              <Select
                value={formData.currency}
                onValueChange={(value) => handleInputChange("currency", value)}
              >
                <SelectTrigger className="h-12 bg-surface-container-low border-outline-variant rounded-xl text-on-background focus:ring-2 focus:ring-secondary">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BRL">Real (BRL)</SelectItem>
                  <SelectItem value="USD">Dólar (USD)</SelectItem>
                  <SelectItem value="EUR">Euro (EUR)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-surface-container-low rounded-xl border border-outline-variant/50">
            <div>
              <Label htmlFor="is_active" className="text-sm font-medium text-on-background">
                Conta Ativa
              </Label>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Contas inativas não aparecem nos cálculos principais
              </p>
            </div>
            <Switch
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) => handleInputChange("is_active", checked)}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-outline-variant">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isLoading}
              className="h-11 px-6 border-outline-variant text-on-surface-variant hover:bg-surface-container-high"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="h-11 px-6 bg-secondary hover:bg-secondary/90 text-on-secondary"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  {account ? "Atualizar" : "Criar"} Conta
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
