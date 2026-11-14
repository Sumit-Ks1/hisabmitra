"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { inr } from "@/lib/format";

export type MonthPoint = { label: string; collected: number; pending: number };

/** Billed amount per month, split into collected and still pending. */
export function CollectionChart({ data, labels }: { data: MonthPoint[]; labels: { collected: string; pending: string } }) {
  return (
    <div className="h-56 w-full" role="img" aria-label={`${labels.collected} / ${labels.pending}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke="#e2e8f0" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#64748b" }} />
          <YAxis
            width={44}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "#64748b" }}
            tickFormatter={(v: number) => (v >= 100000 ? `${(v / 100000).toFixed(1)}L` : v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
          />
          <Tooltip
            cursor={{ fill: "rgb(15 23 42 / 0.04)" }}
            formatter={(value, name) => [inr(Number(value)), name === "collected" ? labels.collected : labels.pending]}
            contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13 }}
          />
          <Bar dataKey="collected" stackId="a" fill="#16a36a" isAnimationActive={false} />
          <Bar dataKey="pending" stackId="a" fill="#f5c451" radius={[6, 6, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
