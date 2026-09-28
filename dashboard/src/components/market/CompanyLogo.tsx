import { useState } from "react";

const COMPANY_DOMAINS: Record<string, string> = {
  ADANIENT: "adani.com",
  ADANIPORTS: "adaniports.com",
  APOLLOHOSP: "apollohospitals.com",
  ASIANPAINT: "asianpaints.com",
  AXISBANK: "axisbank.com",
  "BAJAJ-AUTO": "bajajauto.com",
  BAJFINANCE: "bajajfinserv.in",
  BAJAJFINSV: "bajajfinserv.in",
  BEL: "bel-india.in",
  BHARTIARTL: "airtel.in",
  CIPLA: "cipla.com",
  COALINDIA: "coalindia.in",
  DRREDDY: "drreddys.com",
  EICHERMOT: "eicher.in",
  ETERNAL: "eternal.com",
  GRASIM: "grasim.com",
  HCLTECH: "hcltech.com",
  RELIANCE: "ril.com",
  TCS: "tcs.com",
  INFY: "infosys.com",
  HDFCBANK: "hdfcbank.com",
  ICICIBANK: "icicibank.com",
  HDFCLIFE: "hdfclife.com",
  HINDALCO: "hindalco.com",
  HINDUNILVR: "hul.co.in",
  INDIGO: "goindigo.in",
  ITC: "itcportal.com",
  JIOFIN: "jiofinance.in",
  JSWSTEEL: "jsw.in",
  KOTAKBANK: "kotak.com",
  LT: "larsentoubro.com",
  "M&M": "mahindra.com",
  MARUTI: "marutisuzuki.com",
  MAXHEALTH: "maxhealthcare.in",
  NESTLEIND: "nestle.in",
  NTPC: "ntpc.co.in",
  ONGC: "ongcindia.com",
  POWERGRID: "powergrid.in",
  SBILIFE: "sbilife.co.in",
  SHRIRAMFIN: "shriramfinance.in",
  SBIN: "sbi.co.in",
  SUNPHARMA: "sunpharma.com",
  TATACONSUM: "tataconsumer.com",
  TMPV: "tatamotors.com",
  TATASTEEL: "tatasteel.com",
  TECHM: "techmahindra.com",
  TITAN: "titancompany.in",
  TRENT: "trentlimited.com",
  ULTRACEMCO: "ultratechcement.com",
  WIPRO: "wipro.com",
};

export default function CompanyLogo({ symbol, size = "regular" }: { symbol: string; size?: "regular" | "small" }) {
  const ticker = symbol.replace(/\.NS$/, "").toUpperCase();
  const domain = COMPANY_DOMAINS[ticker];
  const [failed, setFailed] = useState(false);

  return <span className={`company-logo${size === "small" ? " company-logo--small" : ""}`} aria-hidden="true">
    {domain && !failed ? <img src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`} alt="" loading="lazy" onError={() => setFailed(true)} /> : null}
  </span>;
}
