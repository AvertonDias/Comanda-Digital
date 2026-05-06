'use client';

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';

// Dados vazios para o estado inicial "limpo"
const data = [
  { name: 'Jan', total: 0 },
  { name: 'Fev', total: 0 },
  { name: 'Mar', total: 0 },
  { name: 'Abr', total: 0 },
  { name: 'Mai', total: 0 },
  { name: 'Jun', total: 0 },
  { name: 'Jul', total: 0 },
  { name: 'Ago', total: 0 },
  { name: 'Set', total: 0 },
  { name: 'Out', total: 0 },
  { name: 'Nov', total: 0 },
  { name: 'Dez', total: 0 },
];

const chartConfig = {
  total: {
    label: 'Total',
    color: 'hsl(var(--primary))',
  },
};

export function RevenueChart() {
  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle>Visão Geral do Faturamento</CardTitle>
        <CardDescription>Acompanhamento mensal das vendas.</CardDescription>
      </CardHeader>
      <CardContent className="pl-2">
        <ChartContainer config={chartConfig} className="h-[350px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <XAxis
                dataKey="name"
                stroke="hsl(var(--foreground))"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="hsl(var(--foreground))"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `R$${value}`}
              />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent indicator="dot" />}
              />
              <Bar
                dataKey="total"
                fill="hsl(var(--primary))"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
