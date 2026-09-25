// Section 4: factual data provenance for the current modular-monolith runtime.

import { Database, MonitorCog } from "lucide-react";
import type { DataProvenance } from "../../types/xray";

interface XRayProvenanceProps {
  provenance: DataProvenance;
}

export function XRayProvenance({ provenance }: XRayProvenanceProps) {
  const {
    sourceProvider,
    sourceKind,
    transport,
    symbol,
    candleTimestamp,
    candleIndex,
    calculationLocation,
    algorithms,
    mode,
    limitations,
  } = provenance;

  return (
    <div className="bg-[#0D0D0D] border border-[#232323] p-4 flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#1E90FF]" />
          <span
            className="text-xs font-semibold uppercase tracking-wider text-[#FAFAFA]"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            4. Data Lineage &amp; Provenance
          </span>
        </div>
        <div className="flex items-center gap-1 text-label font-mono text-[#60A5FA] bg-[#1E90FF]/10 border border-[#1E90FF]/30 px-2 py-0.5 rounded-sm">
          <MonitorCog size={10} />
          <span>{mode === "replay" ? "POINT-IN-TIME" : "LOCAL ANALYSIS"}</span>
        </div>
      </div>

      <div className="bg-[#05070B] border border-[#1A1A1A] p-3 rounded-sm grid grid-cols-2 gap-x-4 gap-y-2 font-mono text-label">
        <ProvenanceValue label="Source" value={sourceProvider} />
        <ProvenanceValue label="Source kind" value={sourceKind.replaceAll("_", " ")} />
        <ProvenanceValue label="Transport" value={transport} />
        <ProvenanceValue label="Calculation" value={calculationLocation} />
        <ProvenanceValue label="Symbol" value={symbol} />
        <ProvenanceValue label="Candle" value={`${candleTimestamp} (#${candleIndex})`} />
        <div className="col-span-2 border-t border-[#161616] pt-2">
          <span className="text-[#6B6B72] block mb-1">Algorithms</span>
          <span className="text-[#A0A0A8]">{algorithms.map((item) => item.replace(/-V\d+(?:\.\d+)*$/i, "").replaceAll("-", " ")).join(" | ")}</span>
        </div>
      </div>

      <div className="space-y-1">
        {limitations.map((item) => (
          <div key={item} className="flex items-start gap-1.5 text-label text-[#6B6B72] font-mono">
            <Database size={11} className="text-[#1E90FF] mt-0.5 shrink-0" />
            <span>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProvenanceValue({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-[#6B6B72] block text-label">{label}</span>
      <span className="text-[#FAFAFA] break-words">{value}</span>
    </div>
  );
}
