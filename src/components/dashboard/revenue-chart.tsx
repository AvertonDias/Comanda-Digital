'use client';

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';

const data = [
  { name: 'Jan', total: Math.floor(Math.random() * 5000) + 1000 },
  { name: 'Fev', total: Math.floor(Math.random() * 5000) + 1000 },
  { name: 'Mar', total: Math.floor(Math.random() * 5000) + 1000 },
  { name: 'Abr', total: Math.floor(Math.random() * 5000) + 1000 },
  { name: 'Mai', total: Math.floor(Math.random() * 5000) + 1000 },
  { name: 'Jun', total: Math.floor(Math.random() * 5000) + 1000 },
  { name: 'Jul', total: Math.floor(Math.random() * 5000) + 1000 },
  { name: 'Ago', total: Math.floor(Math.random() * 5000) + 1000 },
  { name: 'Set', total: Math.floor(Math.random() * 5000) + 1000 },
  { name: 'Out', total: Math.floor(Math.random() * 5000) + 1000 },
  { name: 'Nov', total: Math.floor(Math.random() * 5000) + 1000 },
  { name: 'Dez', total: Math.floor(Math.random() * 5000) + 1000 },
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
                tickFormatter={(value) => `R$${value / 1000}k`}
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
