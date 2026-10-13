"use client";
import { useState } from "react";
import { ApiButton } from "./ApiButton";

export function PlanGenerator({ clientId, defaultCount }: { clientId: string; defaultCount: number }) {
  const [count, setCount] = useState(defaultCount);
  const [extra, setExtra] = useState("");
  return (
    <div className="card space-y-3 p-5">
      <div className="font-semibold">Nuevo plan</div>
      <label className="block space-y-1">
        <span className="label">Videos en la semana</span>
        <input type="number" min={1} max={14} value={count} onChange={(e) => setCount(Number(e.target.value))} className="input" />
      </label>
      <label className="block space-y-1">
        <span className="label">Indicaciones extra (opcional)</span>
        <textarea rows={3} value={extra} onChange={(e) => setExtra(e.target.value)} className="input" placeholder="Ej: esta semana hay promo 2x1 el jueves" />
      </label>
      <ApiButton url={`/api/clients/${clientId}/plan`} body={{ count, extra }} label="Generar plan" busyLabel="Planeando (≈1 min)..." />
    </div>
  );
}
