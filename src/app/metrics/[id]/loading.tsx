/** Las métricas tardan unos segundos (leen web, redes y anuncios de cada cliente). */
export default function Loading() {
  return (
    <main className="mx-auto max-w-7xl px-5 py-16">
      <div className="flex items-center gap-3 text-sm text-muted">
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-purple/20 border-t-purple" />
        Juntando las métricas de web, redes y anuncios...
      </div>
    </main>
  );
}
