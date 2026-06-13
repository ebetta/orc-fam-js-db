


import React from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, MoreVertical, Tag as TagIconLucide, AlertTriangle, TrendingUp, TrendingDown, Target } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import BudgetGauge from "@/components/ui/BudgetGauge";

import * as LucideIcons from "lucide-react";

// Função para obter o ícone dinamicamente de forma segura (copiada de TagsList)
const getDynamicIcon = (iconNameString) => {
  if (typeof iconNameString !== 'string' || !iconNameString.trim()) {
    return TagIconLucide;
  }

  const name = iconNameString.trim();

  if (!/^[A-Za-z0-9-]+$/.test(name)) {
    return TagIconLucide;
  }

  if (Object.prototype.hasOwnProperty.call(LucideIcons, name)) {
    const IconComponent = LucideIcons[name];
    if (IconComponent && (typeof IconComponent === 'object' || typeof IconComponent === 'function')) {
      return IconComponent;
    }
  }

  const pascalCaseName = name
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');

  if (Object.prototype.hasOwnProperty.call(LucideIcons, pascalCaseName)) {
    const IconComponent = LucideIcons[pascalCaseName];
    if (IconComponent && (typeof IconComponent === 'object' || typeof IconComponent === 'function')) {
      return IconComponent;
    }
  }

  return TagIconLucide;
};

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(amount || 0);
};



export default function BudgetsList({
  groupedBudgets,
  isLoading,
  onEditBudget,
  onDeleteBudget,
  currentPeriodFilter
}) {
  const navigate = useNavigate();

  const handleSpentAmountClick = (tagId) => {
    if (!tagId) return;

    let periodParams = '';

    if (currentPeriodFilter && currentPeriodFilter !== 'all') {
      const today = new Date();
      let periodStart, periodEnd;

      switch (currentPeriodFilter) {
        case "current_month":
          periodStart = new Date(today.getFullYear(), today.getMonth(), 1);
          periodEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
          break;
        case "last_month":
          const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
          periodStart = lastMonth;
          periodEnd = new Date(today.getFullYear(), today.getMonth(), 0);
          break;
        case "two_months_ago":
          const twoMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 2, 1);
          periodStart = twoMonthsAgo;
          periodEnd = new Date(today.getFullYear(), today.getMonth() - 1, 0);
          break;
        case "current_quarter":
          const quarter = Math.floor(today.getMonth() / 3);
          periodStart = new Date(today.getFullYear(), quarter * 3, 1);
          periodEnd = new Date(today.getFullYear(), quarter * 3 + 3, 0);
          break;
        case "this_year":
          periodStart = new Date(today.getFullYear(), 0, 1);
          periodEnd = new Date(today.getFullYear(), 11, 31);
          break;
      }

      if (periodStart && periodEnd) {
        const fromDate = format(periodStart, 'yyyy-MM-dd');
        const toDate = format(periodEnd, 'yyyy-MM-dd');
        periodParams = `&periodFrom=${fromDate}&periodTo=${toDate}`;
      }
    }

    const url = `${createPageUrl('TransactionsV2')}?tagId=${tagId}${periodParams}`;
    navigate(url);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2].map(i => (
          <div key={i} className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant shadow-sm">
            <Skeleton className="h-8 w-3/4 mb-3" />
            <Skeleton className="h-6 w-full mb-1" />
            <Skeleton className="h-6 w-5/6" />
          </div>
        ))}
      </div>
    );
  }

  if (groupedBudgets.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-center py-20 bg-surface-container-lowest shadow-sm rounded-2xl border border-outline-variant"
      >
        <div className="w-16 h-16 rounded-full bg-surface-container-low flex items-center justify-center mx-auto mb-6">
          <Target className="w-8 h-8 text-secondary/60" />
        </div>
        <h3 className="font-headline-sm text-headline-sm text-on-background mb-2">
          Nenhum orçamento para exibir
        </h3>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Crie orçamentos para começar a planejar seus gastos por categoria.
        </p>
      </motion.div>
    );
  }

  return (
    <Accordion type="multiple" className="w-full grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      {groupedBudgets.map((group, groupIndex) => {
        const IconComponent = getDynamicIcon(group.parentTag.icon);

        return (
          <AccordionItem
            value={`group-${group.parentTag.id || groupIndex}`}
            key={group.parentTag.id || groupIndex}
            className="bg-surface-container-lowest shadow-sm rounded-2xl border border-outline-variant overflow-hidden"
          >
            <AccordionTrigger className="p-6 hover:bg-surface-container-low transition-colors">
              <div className="flex-1 mr-4">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between w-full gap-4">
                  <div className="flex items-center gap-3 flex-1">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 p-2 shadow-sm"
                      style={{ backgroundColor: group.parentTag.color || '#A1A1AA' }}
                    >
                      <IconComponent className="w-full h-full text-white" />
                    </div>
                    <h3 className="font-headline-sm text-headline-sm text-on-background text-left">{group.parentTag.name}</h3>
                    <Badge
                      variant="outline"
                      className="border-outline-variant text-on-surface-variant font-label-md text-label-md"
                    >
                      {group.budgets.length} orçamento{group.budgets.length !== 1 ? 's' : ''}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2 w-full md:w-auto mt-3 md:mt-0">
                    <div className="text-left md:text-right">
                      <span className="font-label-md text-label-md text-on-surface-variant uppercase block">Orçado</span>
                      <span className="font-bold font-body-md text-body-md text-on-background">{formatCurrency(group.groupTotalOrcado)}</span>
                    </div>
                    <div className="text-left md:text-right">
                      <span className="font-label-md text-label-md text-on-surface-variant uppercase block">Gasto</span>
                      <span className="font-bold font-body-md text-body-md text-on-background">
                        {formatCurrency(group.groupTotalGasto)}
                      </span>
                    </div>
                    <div className="text-left md:text-right col-span-2 md:col-span-1">
                      <span className="font-label-md text-label-md text-on-surface-variant uppercase block">Disponível</span>
                      <span className={`font-bold font-body-md text-body-md ${group.groupTotalDisponivel < 0 ? 'text-[#ba1a1a]' : 'text-primary-v2'}`}>
                        {formatCurrency(group.groupTotalDisponivel)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="w-full mt-3">
                  <BudgetGauge
                    spent={group.groupTotalGasto}
                    budget={group.groupTotalOrcado}
                  />
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="border-t border-outline-variant bg-surface-container-low/50">
              <div className="overflow-x-auto">
                <Table>
                <TableHeader>
                  <TableRow className="border-b border-outline-variant">
                    <TableHead className="pl-6 font-bold font-label-md text-label-md text-on-surface uppercase tracking-wider">Tag Específica</TableHead>
                    <TableHead className="text-right font-bold font-label-md text-label-md text-on-surface uppercase tracking-wider">Orçado</TableHead>
                    <TableHead className="text-right font-bold font-label-md text-label-md text-on-surface uppercase tracking-wider">Gasto</TableHead>
                    <TableHead className="text-right font-bold font-label-md text-label-md text-on-surface uppercase tracking-wider">Disponível</TableHead>
                    <TableHead className="w-[150px] font-bold font-label-md text-label-md text-on-surface uppercase tracking-wider">Progresso</TableHead>
                    <TableHead className="text-right pr-6 w-[80px] font-bold font-label-md text-label-md text-on-surface uppercase tracking-wider">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group.budgets
                    .slice()
                    .sort((a, b) => (b.total_budgeted_for_period ?? b.amount ?? 0) - (a.total_budgeted_for_period ?? a.amount ?? 0))
                    .map(budget => {
                      const individualSpent = budget.spent_amount || 0;
                      const individualTotal = budget.total_budgeted_for_period ?? budget.amount ?? 0;
                      const individualDisponivel = individualTotal - individualSpent;
                      const ItemIconComponent = getDynamicIcon(budget.tagIcon);

                      return (
                        <TableRow key={budget.id} className="hover:bg-surface-container-low transition-colors border-b border-outline-variant/50">
                          <TableCell className="pl-6">
                            <div className="flex items-center gap-2 font-body-sm text-body-sm text-on-background">
                              <div
                                className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 p-1"
                                style={{ backgroundColor: budget.tagColor }}
                              >
                                <ItemIconComponent className="w-full h-full text-white" />
                              </div>
                              {budget.tagName}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-body-sm text-body-sm text-on-background">{formatCurrency(individualTotal)}</TableCell>
                          <TableCell
                            className="text-right font-bold font-body-sm text-body-sm hover:underline cursor-pointer text-secondary"
                            onClick={() => handleSpentAmountClick(budget.tag_id)}
                            title="Ver transações desta tag no período selecionado"
                          >
                            {formatCurrency(individualSpent)}
                          </TableCell>
                          <TableCell className={`text-right font-bold font-body-sm text-body-sm ${individualDisponivel < 0 ? 'text-[#ba1a1a]' : 'text-primary-v2'}`}>
                            {formatCurrency(individualDisponivel)}
                          </TableCell>
                          <TableCell>
                            <BudgetGauge
                              spent={individualSpent}
                              budget={individualTotal}
                              height="h-1.5"
                            />
                          </TableCell>
                          <TableCell className="text-right pr-6">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-on-surface-variant hover:text-secondary hover:bg-surface-container-high">
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => onEditBudget(budget)}>
                                  <Edit className="w-4 h-4 mr-2" />
                                  Editar
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => onDeleteBudget(budget.id)} className="text-red-600 hover:!text-red-600 hover:!bg-red-50">
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Excluir
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
                </Table>
              </div>
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}
