import { useState } from "react";
import { User } from "lucide-react";

// Avatar do candidato no ranking (foto ou bolinha de cor como fallback).
export default function CandAvatar({ photo, color, size = 22 }) {
  const [err, setErr] = useState(false);
  const s = { width: size, height: size };
  if (photo && !err) {
    return <img src={photo} alt="" onError={() => setErr(true)} style={s} className="rounded-full object-cover shrink-0 border border-slate-700" />;
  }
  return (
    <span style={{ ...s, background: (color || "#334155") + "33" }} className="rounded-full shrink-0 inline-flex items-center justify-center border border-slate-700">
      <User size={Math.round(size * 0.55)} style={{ color: color || "#64748b" }} />
    </span>
  );
}
