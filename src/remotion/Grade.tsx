import React from "react";
import type { ClipGrade } from "../lib/grade-types";

/** Filtro SVG con las ganancias de rojo, verde y azul (balance de blancos). */
export const GradeDefs: React.FC<{ id: string; grade: ClipGrade }> = ({ id, grade }) => (
  <svg width={0} height={0} style={{ position: "absolute" }} aria-hidden>
    <filter id={id} colorInterpolationFilters="sRGB">
      <feColorMatrix type="matrix" values={`${grade.r} 0 0 0 0  0 ${grade.g} 0 0 0  0 0 ${grade.b} 0 0  0 0 0 1 0`} />
    </filter>
  </svg>
);

/** CSS filter con la corrección completa (balance + exposición + contraste + saturación). */
export const gradeFilter = (id: string, g: ClipGrade | undefined) =>
  g ? `url(#${id}) brightness(${g.brightness}) contrast(${g.contrast}) saturate(${g.saturate})` : undefined;
