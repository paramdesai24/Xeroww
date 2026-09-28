import type { CSSProperties } from "react";

export interface SectorTile {
  name: string;
  change: number;
  weight: number;
}

interface PositionedTile extends SectorTile {
  x: number;
  y: number;
  width: number;
  height: number;
}

function layoutTiles(tiles: SectorTile[], x = 0, y = 0, width = 100, height = 100): PositionedTile[] {
  if (tiles.length === 0) return [];
  if (tiles.length === 1) return [{ ...tiles[0], x, y, width, height }];

  const total = tiles.reduce((sum, tile) => sum + tile.weight, 0);
  let firstWeight = 0;
  let split = 0;
  while (split < tiles.length - 1 && firstWeight < total / 2) {
    firstWeight += tiles[split].weight;
    split += 1;
  }
  const ratio = total > 0 ? firstWeight / total : split / tiles.length;
  if (width >= height) {
    const firstWidth = width * ratio;
    return [
      ...layoutTiles(tiles.slice(0, split), x, y, firstWidth, height),
      ...layoutTiles(tiles.slice(split), x + firstWidth, y, width - firstWidth, height),
    ];
  }
  const firstHeight = height * ratio;
  return [
    ...layoutTiles(tiles.slice(0, split), x, y, width, firstHeight),
    ...layoutTiles(tiles.slice(split), x, y + firstHeight, width, height - firstHeight),
  ];
}

export default function SectorTreemap({ tiles, onSelect }: { tiles: SectorTile[]; onSelect: (name: string) => void }) {
  const positioned = layoutTiles(tiles.slice().sort((a, b) => b.weight - a.weight));
  const totalWeight = tiles.reduce((sum, tile) => sum + tile.weight, 0);
  if (!positioned.length) return <div className="sector-treemap__empty">Sector data is loading.</div>;

  return <div className="sector-treemap" aria-label="Sector performance heatmap">
    {positioned.map((tile) => {
      const style = {
        left: `calc(${tile.x}% + 3px)`, top: `calc(${tile.y}% + 3px)`, width: `calc(${tile.width}% - 6px)`, height: `calc(${tile.height}% - 6px)`,
        "--tile-opacity": `${Math.min(55, 20 + Math.abs(tile.change) * 12)}%`,
      } as CSSProperties;
      return <button
        key={tile.name}
        type="button"
        className={`sector-treemap__tile ${tile.change >= 0 ? "is-positive" : "is-negative"} ${tile.height < 18 && tile.width >= 25 ? "is-compact" : ""}`}
        style={style}
        title={`${tile.name}: ${tile.change >= 0 ? "+" : ""}${tile.change.toFixed(2)}%, ${totalWeight > 0 ? (tile.weight / totalWeight * 100).toFixed(1) : "0.0"}% of displayed market cap`}
        aria-label={`${tile.name}, ${tile.change >= 0 ? "+" : ""}${tile.change.toFixed(2)}%, ${totalWeight > 0 ? (tile.weight / totalWeight * 100).toFixed(1) : "0.0"}% weight`}
        onClick={() => onSelect(tile.name)}
      ><span className="sector-treemap__name">{tile.name}</span><span className="sector-treemap__metrics"><strong>{tile.change >= 0 ? "+" : ""}{tile.change.toFixed(2)}%</strong><small>{totalWeight > 0 ? (tile.weight / totalWeight * 100).toFixed(1) : "0.0"}% weight</small></span></button>;
    })}
  </div>;
}
