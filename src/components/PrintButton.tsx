"use client";
export function PrintButton() {
  return (
    <button className="btn btn-ghost print:hidden" onClick={() => window.print()}>
      Descargar PDF
    </button>
  );
}
