/** Cerrar sesión con POST (un link normal se puede precargar y sacar al usuario sin querer). */
export function LogoutButton({ className, children = "Cerrar sesión" }: { className?: string; children?: React.ReactNode }) {
  return (
    <form action="/salir" method="post" className="contents">
      <button type="submit" className={className}>{children}</button>
    </form>
  );
}
