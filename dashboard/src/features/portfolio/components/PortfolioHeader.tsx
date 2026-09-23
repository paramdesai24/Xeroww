import type { Portfolio } from "../../../types/platform";

export function PortfolioHeader({
  portfolios,
  activeId,
  refreshing,
  onSelect,
  onCreate,
  onRename,
  onTrade,
  onIntelligence,
}: {
  portfolios: Portfolio[];
  activeId?: number;
  refreshing: boolean;
  onSelect: (id: number) => void;
  onCreate: () => void;
  onRename: () => void;
  onTrade: () => void;
  onIntelligence: () => void;
}) {
  return (
    <header className="workspace-header">
      <div>
        <p className="decision-eyebrow">Paper portfolio</p>
        <h1>Portfolio</h1>
        <p>{refreshing ? "Refreshing valuation" : "Observed holdings, activity, and portfolio context."}</p>
      </div>
      <div className="workspace-header__controls">
        {portfolios.length > 0 && (
          <select aria-label="Active portfolio" value={activeId} onChange={(event) => onSelect(Number(event.target.value))}>
            {portfolios.map((portfolio) => <option key={portfolio.id} value={portfolio.id}>{portfolio.name}</option>)}
          </select>
        )}
        <button className="workspace-button" onClick={onCreate}>New</button>
        {activeId && <button className="workspace-button" onClick={onRename}>Rename</button>}
        {activeId && <button className="decision-secondary-action" onClick={onIntelligence}>Intelligence</button>}
        {activeId && <button className="decision-primary-action" onClick={onTrade}>Record Trade</button>}
      </div>
    </header>
  );
}
