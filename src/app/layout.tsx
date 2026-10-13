import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ROOTS ENGINE · Purple Roots Agency",
  description: "El motor de contenido de Purple Roots: investiga a tu competencia, planea qué grabar y edita con tu estilo.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}
