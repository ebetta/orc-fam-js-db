import React, { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Ban } from "lucide-react";
import { endOfMonth } from "date-fns";
import { MONTH_NAMES_PT, getYearOptions } from "@/utils";

export default function EndBudgetDialog({ budget, onConfirm, onCancel }) {
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth());
  const [year, setYear] = useState(today.getFullYear());

  useEffect(() => {
    if (budget) {
      const now = new Date();
      setMonth(now.getMonth());
      setYear(now.getFullYear());
    }
  }, [budget]);

  return (
    <Dialog open={!!budget} onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ban className="w-5 h-5 text-orange-600" />
            Encerrar Vigência do Orçamento
          </DialogTitle>
        </DialogHeader>

        {budget && (
          <div className="space-y-4 py-2">
            <p className="text-sm text-gray-600">
              O orçamento de <span className="font-semibold text-gray-900">{budget.tagName}</span> deixará de valer a partir do mês escolhido. Ele continuará visível no histórico de orçamentos.
            </p>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Último mês de vigência</label>
              <div className="flex gap-2">
                <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                  <SelectTrigger className="h-12 flex-[3] border-gray-200 hover:border-orange-500 rounded-xl transition-all shadow-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTH_NAMES_PT.map((name, idx) => (
                      <SelectItem key={idx} value={String(idx)}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                  <SelectTrigger className="h-12 flex-[2] border-gray-200 hover:border-orange-500 rounded-xl transition-all shadow-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {getYearOptions(year).map(y => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onCancel} className="rounded-xl text-gray-600 hover:text-gray-900 hover:bg-gray-100">
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => onConfirm(endOfMonth(new Date(year, month, 1)))}
            className="bg-orange-600 hover:bg-orange-700 text-white rounded-xl shadow-lg shadow-orange-200"
          >
            Confirmar Encerramento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
