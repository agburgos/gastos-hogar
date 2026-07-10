"use client";

import { useEffect, useState } from "react";
import { Card, Badge, Empty } from "@/components/ui";
import { fmt, ymdLocal } from "@/lib/format";
import { supabase } from "@/lib/supabase";

interface BalanceData {
  mes: string;
  pagado_gloria: number;
  pagado_alberto: number;
}

export default function BalancePage() {
  const [datos, setDatos] = useState<BalanceData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("balance_mensual")
        .select("mes, pagado_gloria, pagado_alberto")
        .order("mes", { ascending: false })
        .limit(12);

      setDatos(data || []);
      setLoading(false);
    };

    fetch();
  }, []);

  if (loading) {
    return (
      <Card>
        <div className="text-center text-[14px] text-[var(--mid)]">Cargando...</div>
      </Card>
    );
  }

  if (datos.length === 0) {
    return <Empty text="Sin datos de balance" />;
  }

  return (
    <div className="space-y-3">
      {datos.map((d) => {
        const gloriaGastó = d.pagado_gloria || 0;
        const albertoGastó = d.pagado_alberto || 0;
        const total = gloriaGastó + albertoGastó;
        const mitad = total / 2;
        const deuda = gloriaGastó > mitad ? gloriaGastó - mitad : mitad - gloriaGastó;
        const quienDebe = gloriaGastó > mitad ? "Alberto" : "Gloria";

        return (
          <Card key={d.mes}>
            <div className="text-[12px] text-[var(--mid)] mb-3">{d.mes}</div>
            <div className="space-y-2 text-[14px]">
              <div className="flex justify-between">
                <span>Gloria:</span>
                <span className="font-bold">{fmt(gloriaGastó)}</span>
              </div>
              <div className="flex justify-between">
                <span>Alberto:</span>
                <span className="font-bold">{fmt(albertoGastó)}</span>
              </div>
              <div className="h-px bg-[var(--border)] my-2" />
              <div className="flex justify-between">
                <span>Total:</span>
                <span className="font-bold">{fmt(total)}</span>
              </div>
              <div className="text-[12px] text-[var(--mid)]">
                Mitad: {fmt(mitad)}
              </div>
              {deuda > 0 && (
                <div className="mt-2 pt-2 border-t border-[var(--border)]">
                  <Badge color="teal">
                    {quienDebe} debe: {fmt(deuda)}
                  </Badge>
                </div>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
