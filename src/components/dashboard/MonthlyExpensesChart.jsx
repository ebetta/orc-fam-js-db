
import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Skeleton } from "@/components/ui/skeleton";
import { ShoppingCart, CalendarDays, Filter, ChevronsUpDown } from 'lucide-react';
import { format, subMonths, startOfMonth, endOfMonth, parseISO, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { convertCurrency } from "@/components/utils/CurrencyConverter";

const LOCAL_STORAGE_KEY = 'financeApp_selectedParentTags';

const formatCurrencyForAxis = (value) => {
  if (value === 0) return 'R$0';
  if (Math.abs(value) >= 1000000) {
    return `R$${(value / 1000000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1000) {
    return `R$${(value / 1000).toFixed(0)}K`;
  }
  return `R$${value.toFixed(0)}`;
};

const CustomTooltipContent = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const value = payload[0].value;
    return (
      <div className="bg-background/90 backdrop-blur-sm p-3 border border-border rounded-lg shadow-lg">
        <p className="text-sm font-medium text-foreground mb-1">{label}</p>
        <p className="text-lg font-bold text-red-600">
          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)}
        </p>
        <p className="text-xs text-muted-foreground">Total de despesas</p>
      </div>
    );
  }
  return null;
};

function shouldIncludeTransaction(transaction, tagMap, selectedParentTags) {
  const tagId = transaction.tag_id;
  if (!tagId || !tagMap[tagId]) return true;
  const tag = tagMap[tagId];
  const parentTagId = tag.parent_tag_id || tag.id;
  return !!selectedParentTags[parentTagId];
}

export default function MonthlyExpensesChart({ transactions, tags, isLoading, accounts }) {
  const [period, setPeriod] = useState('12');
  const [selectedParentTags, setSelectedParentTags] = useState({});
  const [parentTagsFilterOpen, setParentTagsFilterOpen] = useState(false);
  const [chartData, setChartData] = useState([]);

  const accountCurrencyMap = useMemo(
    () => new Map((accounts || []).map(a => [a.id, a.currency || 'BRL'])),
    [accounts]
  );

  const timePeriods = [
    { value: '6', label: 'Últimos 6 Meses' },
    { value: '12', label: 'Últimos 12 Meses' },
  ];

  useEffect(() => {
    if (tags && tags.length > 0) {
      const savedSelectionJSON = localStorage.getItem(LOCAL_STORAGE_KEY);
      let initialSelection;

      if (savedSelectionJSON) {
        try {
          initialSelection = JSON.parse(savedSelectionJSON);
        } catch (e) {
          console.error("Erro ao ler seleção de tags do localStorage, redefinindo para o padrão.", e);
        }
      }

      if (!initialSelection) {
        const parentTags = tags.filter(tag => !tag.parent_tag_id);
        initialSelection = {};
        parentTags.forEach(tag => {
          initialSelection[tag.id] = true;
        });
      }

      setSelectedParentTags(initialSelection);
    }
  }, [tags]);

  useEffect(() => {
    if (Object.keys(selectedParentTags).length > 0) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(selectedParentTags));
    }
  }, [selectedParentTags]);

  const parentTags = tags ? tags.filter(tag => !tag.parent_tag_id).sort((a, b) => a.name.localeCompare(b.name)) : [];
  const selectedCount = Object.values(selectedParentTags).filter(Boolean).length;

  const handleParentTagToggle = (tagId, checked) => {
    setSelectedParentTags(prev => ({
      ...prev,
      [tagId]: checked
    }));
  };

  const handleSelectAllParentTags = (selectAll) => {
    const newSelection = {};
    parentTags.forEach(tag => {
      newSelection[tag.id] = selectAll;
    });
    setSelectedParentTags(newSelection);
  };

  useEffect(() => {
    let cancelled = false;
    const computeChartData = async () => {
      if (isLoading || !transactions?.length) {
        if (!cancelled) setChartData([]);
        return;
      }

      const tagMap = tags?.length ? Object.fromEntries(tags.map(tag => [tag.id, tag])) : {};
      const numberOfMonths = parseInt(period);
      const today = new Date();
      const data = [];

      for (let i = numberOfMonths - 1; i >= 0; i--) {
        if (cancelled) return;
        const targetDate = subMonths(today, i);
        const monthStart = startOfMonth(targetDate);
        const monthEnd = endOfMonth(targetDate);

        let monthlyTotal = 0;

        for (const t of transactions) {
          if (cancelled) return;
          if (t.transaction_type !== 'expense') continue;
          if (Object.keys(selectedParentTags).length > 0 && !shouldIncludeTransaction(t, tagMap, selectedParentTags)) continue;
          try {
            const txDate = parseISO(t.transaction_date);
            if (!isWithinInterval(txDate, { start: monthStart, end: monthEnd })) continue;
          } catch {
            continue;
          }

          const rawAmount = parseFloat(t.amount || 0);
          if (rawAmount === 0) continue;

          const currency = accountCurrencyMap.get(t.account_id) || 'BRL';
          const amountInBRL = currency === 'BRL'
            ? rawAmount
            : await convertCurrency(rawAmount, currency, 'BRL', t.transaction_date);

          monthlyTotal += amountInBRL;
        }

        data.push({
          month: format(targetDate, 'MMM/yy', { locale: ptBR }),
          despesas: monthlyTotal,
        });
      }

      if (!cancelled) setChartData(data);
    };

    computeChartData();
    return () => { cancelled = true; };
  }, [transactions, tags, period, isLoading, accountCurrencyMap, selectedParentTags]);

  const maxValue = Math.max(...chartData.map((d) => d.despesas), 0);

  return (
    <Card className="bg-surface-container-lowest border border-outline-variant shadow-sm h-full flex flex-col rounded-2xl overflow-hidden">
      <CardHeader className="border-b border-outline-variant bg-surface-container-low flex flex-row items-center justify-between py-3">
        <CardTitle className="font-headline-sm text-headline-sm flex items-center gap-2">
          <ShoppingCart className="w-5 h-5 text-error" />
          Despesas Mensais
        </CardTitle>
        <div className="flex gap-2">
          <Popover open={parentTagsFilterOpen} onOpenChange={setParentTagsFilterOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-9 text-xs gap-2"
              >
                <Filter className="w-4 h-4" />
                Tags ({selectedCount})
                <ChevronsUpDown className="w-3 h-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-0">
              <div className="p-3 border-b">
                <div className="flex justify-between">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSelectAllParentTags(true)}
                    className="h-8 px-2 text-xs"
                  >
                    Todas
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSelectAllParentTags(false)}
                    className="h-8 px-2 text-xs"
                  >
                    Nenhuma
                  </Button>
                </div>
              </div>
              <ScrollArea className="h-48">
                <div className="p-3 space-y-2">
                  {parentTags.map(tag => (
                    <div key={tag.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`monthly-parent-tag-${tag.id}`}
                        checked={!!selectedParentTags[tag.id]}
                        onCheckedChange={(checked) => handleParentTagToggle(tag.id, checked)}
                      />
                      <label
                        htmlFor={`monthly-parent-tag-${tag.id}`}
                        className="flex items-center gap-2 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                      >
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: tag.color || '#ccc' }}
                        />
                        {tag.name}
                      </label>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[180px] h-9 text-xs">
              <SelectValue placeholder="Selecione o período" />
            </SelectTrigger>
            <SelectContent>
              {timePeriods.map((tp) => (
                <SelectItem key={tp.value} value={tp.value} className="text-xs">
                  {tp.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent className="p-4 flex-grow">
        {isLoading ? (
          <div className="space-y-3 h-full flex flex-col justify-center">
            <Skeleton className="h-6 w-1/2 mx-auto" />
            <Skeleton className="h-[200px] w-full" />
            <div className="flex justify-around">
              <Skeleton className="h-4 w-10" />
              <Skeleton className="h-4 w-10" />
              <Skeleton className="h-4 w-10" />
            </div>
          </div>
        ) : chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: 15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={formatCurrencyForAxis}
                tick={{ fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={70}
              />
              <Tooltip content={<CustomTooltipContent />} cursor={{ fill: 'rgba(239,68,68,0.08)' }} />
              <Bar dataKey="despesas" name="Despesas" radius={[4, 4, 0, 0]} maxBarSize={40}>
                {chartData.map((entry, index) => {
                  const isLastMonth = index === chartData.length - 1;
                  const isHighest = entry.despesas === maxValue && maxValue > 0;
                  let color = '#fca5a5';
                  if (isLastMonth) color = '#ef4444';
                  else if (isHighest) color = '#dc2626';
                  return <Cell key={`cell-${index}`} fill={color} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <CalendarDays className="w-12 h-12 text-gray-300 mb-3" />
            <h3 className="text-md font-medium text-gray-700">Sem despesas no período</h3>
            <p className="text-xs text-gray-500">
              Adicione transações de despesa ou selecione categorias no filtro de tags.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
