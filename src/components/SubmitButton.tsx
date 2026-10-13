"use client";
import { useFormStatus } from "react-dom";
import { Spinner } from "./ApiButton";

/** Botón de formulario con feedback: se desactiva y muestra un circulito mientras guarda. */
export function SubmitButton({ children, className }: { children: React.ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending} className={`${className ?? ""} inline-flex items-center justify-center gap-2`}>
      {pending ? <Spinner /> : null}
      {children}
    </button>
  );
}
