/** Se muestra al cambiar de pestaña mientras carga la página. */
export default function Loading() {
  return (
    <div className="flex items-center gap-3 py-10 text-sm text-muted">
      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-lavender" />
      Cargando...
    </div>
  );
}
