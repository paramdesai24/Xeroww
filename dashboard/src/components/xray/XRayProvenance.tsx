// src/components/xray/XRayProvenance.tsx
// Section 4: Kafka-ready Data Provenance & Lineage Telemetry.
// Event ID, Producer, Partition, Offset, Trace ID, Topic, Schema, and Ingestion Latency.

import { useState } from "react";
import { Database, Copy, Check, Radio, Terminal } from "lucide-react";
import type { KafkaProvenance } from "../../types/xray";

interface XRayProvenanceProps {
  provenance: KafkaProvenance;
}

export function XRayProvenance({ provenance }: XRayProvenanceProps) {
  const { eventId, producer, topic, partition, offset, traceId, schemaVersion, ingestionTimestamp, ingestionLatencyMs, sourceProvider } = provenance;

  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  return (
    <div className="bg-[#0D0D0D] border border-[#232323] p-4 flex flex-col gap-3.5">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#1E90FF]" />
          <span className="text-xs font-semibold uppercase tracking-wider text-[#FAFAFA]" style={{ fontFamily: "var(--font-mono)" }}>
            4. Data Lineage &amp; Provenance
          </span>
        </div>
        <div className="flex items-center gap-1 text-[10px] font-mono text-[#22C55E] bg-[rgba(34,197,94,0.08)] border border-[rgba(34,197,94,0.3)] px-2 py-0.5 rounded-sm">
          <Radio size={10} className="animate-pulse text-[#22C55E]" />
          <span>KAFKA-READY</span>
        </div>
      </div>

      {/* Terminal Telemetry Console Box */}
      <div className="bg-[#05070B] border border-[#1A1A1A] p-3 rounded-sm flex flex-col gap-2 font-mono text-xs">
        <div className="flex items-center justify-between pb-1.5 border-b border-[#161616] text-[10px] text-[#6B6B72]">
          <span className="flex items-center gap-1 text-[#1E90FF]">
            <Terminal size={11} />
            kafka.stream.metadata.v1
          </span>
          <span>{schemaVersion}</span>
        </div>

        {/* Event ID */}
        <div className="flex items-center justify-between group">
          <span className="text-[11px] text-[#6B6B72]">Event ID:</span>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-[#FAFAFA]">{eventId}</span>
            <button
              onClick={() => handleCopy(eventId, "event")}
              className="text-[#6B6B72] hover:text-[#1E90FF] p-0.5 transition-colors"
              title="Copy Event ID"
            >
              {copiedKey === "event" ? <Check size={11} className="text-[#22C55E]" /> : <Copy size={11} />}
            </button>
          </div>
        </div>

        {/* Trace ID */}
        <div className="flex items-center justify-between group">
          <span className="text-[11px] text-[#6B6B72]">Trace ID:</span>
          <div className="flex items-center gap-1.5 max-w-[260px]">
            <span className="text-[10px] font-mono text-[#1E90FF] truncate" title={traceId}>
              {traceId}
            </span>
            <button
              onClick={() => handleCopy(traceId, "trace")}
              className="text-[#6B6B72] hover:text-[#1E90FF] p-0.5 transition-colors shrink-0"
              title="Copy W3C Trace ID"
            >
              {copiedKey === "trace" ? <Check size={11} className="text-[#22C55E]" /> : <Copy size={11} />}
            </button>
          </div>
        </div>

        {/* Partition & Offset */}
        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#161616] text-[11px]">
          <div>
            <span className="text-[#6B6B72] block text-[10px]">PARTITION</span>
            <span className="font-bold text-[#FAFAFA] tabular-nums">p-{String(partition).padStart(2, "0")}</span>
            <span className="text-[9px] text-[#6B6B72] ml-1">(/16)</span>
          </div>

          <div>
            <span className="text-[#6B6B72] block text-[10px]">LOG OFFSET</span>
            <span className="font-bold text-[#FAFAFA] tabular-nums">
              {offset.toLocaleString("en-US")}
            </span>
          </div>
        </div>

        {/* Producer & Topic */}
        <div className="flex flex-col gap-1 pt-1.5 border-t border-[#161616] text-[10px]">
          <div className="flex justify-between">
            <span className="text-[#6B6B72]">Producer:</span>
            <span className="text-[#A0A0A8] truncate max-w-[260px]" title={producer}>
              {producer}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#6B6B72]">Topic:</span>
            <span className="text-[#A0A0A8] truncate max-w-[260px]" title={topic}>
              {topic}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#6B6B72]">Ingestion Timestamp:</span>
            <span className="text-[#A0A0A8] font-mono">{ingestionTimestamp}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#6B6B72]">Ingestion Latency:</span>
            <span className="text-[#22C55E] font-semibold">{ingestionLatencyMs} ms</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#6B6B72]">Source Feed:</span>
            <span className="text-[#A0A0A8]">{sourceProvider}</span>
          </div>
        </div>
      </div>

      {/* Contract Verification Footnote */}
      <div className="flex items-center gap-1.5 text-[10px] text-[#6B6B72] font-mono">
        <Database size={11} className="text-[#1E90FF]" />
        <span>Pre-configured schema contract ready for Apache Kafka topic binding.</span>
      </div>
    </div>
  );
}
