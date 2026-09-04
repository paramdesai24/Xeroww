// src/components/Footer.tsx
// Signature Xeroww Pipeline Status Footer — minimal institutional metadata rail.

export default function Footer() {
  return (
    <footer className="h-6 bg-[#0A0A0A] border-t border-[#262626] flex items-center px-4 justify-between shrink-0 select-none font-mono text-[11px] text-[#737373]">
      <div className="flex items-center gap-2">
        <span className="text-[#A1A1AA]">SOURCE: Yahoo Finance</span>
        <span className="text-[#333333]">|</span>
        <span>PROVIDER: YahooProvider</span>
        <span className="text-[#333333]">|</span>
        <span className="text-[#22C55E]">STATUS: Healthy</span>
        <span className="text-[#333333]">|</span>
        <span>ARCH: V0.5</span>
      </div>

      <div className="hidden md:flex items-center gap-2 text-[10px] text-[#555555]">
        <span>XEROWW TERMINAL ENGINE</span>
        <span className="text-[#333333]">·</span>
        <span>READY FOR KAFKA / SPARK PIPELINE</span>
      </div>
    </footer>
  );
}
