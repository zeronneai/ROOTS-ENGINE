"use client";
import { useState, useSyncExternalStore } from "react";

const noop = () => () => {};

export function CopyLink({ path }: { path: string }) {
  const origin = useSyncExternalStore(noop, () => window.location.origin, () => "");
  const url = `${origin}${path}`;
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-3 flex gap-2">
      <input readOnly value={url} className="input font-mono text-xs" onFocus={(e) => e.target.select()} />
      <button
        className="btn btn-ghost"
        onClick={() => {
          navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? "Copiado" : "Copiar"}
      </button>
    </div>
  );
}
