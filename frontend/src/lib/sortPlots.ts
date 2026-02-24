type PlotIdSource = {
  id?: string | number | null;
  plot_id?: string | number | null;
};

function getPlotId(plot: PlotIdSource): string | null {
  const rawId = plot.plot_id ?? plot.id;
  if (rawId == null) return null;
  const normalized = String(rawId).trim();
  return normalized.length > 0 ? normalized : null;
}

export function sortPlotsById<T extends PlotIdSource>(plots: T[]): T[] {
  return plots
    .map((plot, index) => ({ plot, index, plotId: getPlotId(plot) }))
    .sort((a, b) => {
      const aId = a.plotId;
      const bId = b.plotId;

      if (aId == null && bId == null) return a.index - b.index;
      if (aId == null) return 1;
      if (bId == null) return -1;

      const cmp = aId.localeCompare(bId, undefined, { numeric: true, sensitivity: "base" });
      return cmp !== 0 ? cmp : a.index - b.index;
    })
    .map((entry) => entry.plot);
}
