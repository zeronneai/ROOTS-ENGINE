"use client";
export function PrintButton({ label = "Descargar PDF" }: { label?: string }) {
  return (
    <button className="btn btn-ghost print:hidden" onClick={() => window.print()}>
      {label}
    </button>
  );
}
