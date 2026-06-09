
import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, CalendarDays, TrendingDown } from 'lucide-react';
import { format, subMonths, parseISO, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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
    return (
      <div className="bg-background/90 backdrop-blur-sm p-3 border border-border rounded-lg shadow-lg">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {payload.map((entry, idx) => {
          if (entry.value == null) return null;
          const isProjection = entry.dataKey === 'projecao';
          return (
            <p key={idx} className="text-lg font-bold" style={{ color: entry.color }}>
              {isProjection && <span className="text-xs font-normal mr-1">Proj.</span>}
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(entry.value)}
            </p>
          );
        })}
      </div>
    );
  }
  return null;
};

function linearRegression(values) {
  const n = values.length;
  if (n < 2) return null;
  const indices = values.map((_, i) => i);
  const sumX = indices.reduce((a, b) => a + b, 0);
  const sumY = values.reduce((a, b) => a + b, 0);
  const sumXY = indices.reduce((sum, x, i) => sum + x * values[i], 0);
  const sumXX = indices.reduce((sum, x) => sum + x * x, 0);
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

export default function PatrimonyEvolutionChart({ patrimonyData, isLoading }) {
  const [period, setPeriod] = React.useState("12m");

  const timePeriods = [
    { value: "3m", label: "Últimos 3 Meses" },
    { value: "6m", label: "Últimos 6 Meses" },
    { value: "12m", label: "Último Ano" },
  ];

  const chartData = useMemo(() => {
    if (!patrimonyData || patrimonyData.length === 0) return [];

    const numberOfMonths = parseInt(period);
    const cutoff = subMonths(new Date(), numberOfMonths);

    const historical = patrimonyData
      .filter(item => {
        const itemDate = parseISO(item.year_month + '-01');
        return itemDate >= cutoff;
      })
      .map(item => ({
        month: format(parseISO(item.year_month + '-01'), "MMM/yy", { locale: ptBR }),
        patrimonio: parseFloat(item.net_worth_brl) || 0,
        projecao: null,
      }));

    if (period !== "12m") return historical;

    const values = historical.map(d => d.patrimonio);
    const reg = linearRegression(values);
    if (!reg) return historical;

    const lastDate = patrimonyData.reduce((latest, item) => {
      const d = parseISO(item.year_month + '-01');
      return d > latest ? d : latest;
    }, new Date(0));

    const projection = [];

    // Projeção para o mês atual (conecta ao último ponto histórico)
    const currentProjected = reg.intercept + reg.slope * (values.length - 1);
    historical[historical.length - 1] = {
      ...historical[historical.length - 1],
      projecao: Math.round(currentProjected * 100) / 100,
    };

    // Projeção para os próximos 3 meses
    for (let k = 0; k < 3; k++) {
      const projDate = addMonths(lastDate, k + 1);
      const projectedValue = reg.intercept + reg.slope * (values.length + k);
      projection.push({
        month: format(projDate, "MMM/yy", { locale: ptBR }),
        patrimonio: null,
        projecao: Math.round(projectedValue * 100) / 100,
      });
    }

    return [...historical, ...projection];
  }, [patrimonyData, period]);

  const isChartLoading = isLoading;
  const trend = chartData.some(d => d.projecao != null);

  return (
    <Card className="bg-surface-container-lowest border border-outline-variant shadow-sm h-full flex flex-col rounded-2xl">
      <CardHeader className="border-b border-outline-variant bg-surface-container-low flex flex-row items-center justify-between py-3">
        <CardTitle className="font-headline-sm text-headline-sm flex items-center gap-2">
          {trend ? (
            <TrendingDown className="w-5 h-5 text-tertiary" />
          ) : (
            <TrendingUp className="w-5 h-5 text-primary-v2" />
          )}
          Evolução do Patrimônio
          {trend && (
            <span className="font-label-md text-label-md font-normal text-tertiary bg-[#ff7e2d]/10 px-2 py-0.5 rounded-full">
              mês atual +3 projetados
            </span>
          )}
        </CardTitle>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[180px] h-9 text-xs">
            <SelectValue placeholder="Selecione o período" />
          </SelectTrigger>
          <SelectContent>
            {timePeriods.map(tp => (
              <SelectItem key={tp.value} value={tp.value} className="text-xs">
                {tp.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="p-4 flex-grow">
        {isChartLoading ? (
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
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: 15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />
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
                domain={['auto', 'auto']}
              />
              <Tooltip content={<CustomTooltipContent />} cursor={{ stroke: '#4ade80', strokeWidth: 1, strokeDasharray: '3 3' }} />
              <Legend wrapperStyle={{ fontSize: "12px" }} />
              <Line
                type="monotone"
                dataKey="patrimonio"
                stroke="#16a34a"
                strokeWidth={2}
                dot={{ r: 4, fill: "#16a34a", strokeWidth: 0 }}
                activeDot={{ r: 6, fill: "#16a34a", stroke: '#dcfce7', strokeWidth: 2 }}
                name="Patrimônio (BRL)"
                connectNulls={false}
              />
              {trend && (
                <Line
                  type="monotone"
                  dataKey="projecao"
                  stroke="#f97316"
                  strokeWidth={2}
                  strokeDasharray="6 3"
                  dot={{ r: 4, fill: "#f97316", strokeWidth: 0 }}
                  activeDot={{ r: 6, fill: "#f97316", stroke: '#fff7ed', strokeWidth: 2 }}
                  name="Projeção"
                  connectNulls={false}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <CalendarDays className="w-12 h-12 text-gray-300 mb-3" />
            <h3 className="text-md font-medium text-gray-700">Dados insuficientes</h3>
            <p className="text-xs text-gray-500">
              Adicione transações para ver a evolução do patrimônio.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
