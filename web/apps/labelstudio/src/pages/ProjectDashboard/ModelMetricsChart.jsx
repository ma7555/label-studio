import { Typography } from "@humansignal/ui";

const METRICS = [
  { key: "map50_95", label: "mAP50-95", color: "#FF7557" },
  { key: "map50", label: "mAP50", color: "#4A90E2" },
  { key: "precision", label: "Precision", color: "#34C759" },
  { key: "recall", label: "Recall", color: "#FFB020" },
];

const pct = (value) => `${Math.round((value ?? 0) * 1000) / 10}%`;

export const ModelMetricsChart = ({ models }) => {
  const charted = models.filter((item) => item.map50_95 != null);

  if (charted.length === 0) {
    return (
      <div className="h-32 flex justify-center items-center border border-primary-border-subtle bg-primary-emphasis-subtle rounded-lg">
        <Typography size="small" className="text-neutral-content-subtler">
          No evaluated metrics yet. Metrics appear after a training run completes evaluation.
        </Typography>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-4">
        {METRICS.map((metric) => (
          <span key={metric.key} className="inline-flex items-center gap-1.5 text-xs text-neutral-content-subtler">
            <span
              className="inline-block w-3 h-3 rounded-sm"
              style={{ backgroundColor: metric.color }}
              aria-hidden="true"
            />
            {metric.label}
          </span>
        ))}
        <span className="text-xs text-neutral-content-subtler ml-auto">scale 0 – 100%</span>
      </div>

      <div className="relative">
        <div className="absolute inset-x-0 top-0 border-t border-dashed border-neutral-border-subtle" />
        <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-neutral-border-subtle" />
        <div className="absolute inset-x-0 bottom-6 border-t border-neutral-border-subtle" />
        <div className="flex items-end gap-4 h-56 pt-1 pb-6 overflow-x-auto">
          {charted.map((item) => (
            <div key={item.version} className="flex flex-col items-center justify-end gap-2 h-full flex-1 min-w-[64px]">
              <div className="flex items-end justify-center gap-1 h-full w-full">
                {METRICS.map((metric) => {
                  const value = item[metric.key] ?? 0;
                  return (
                    <div
                      key={metric.key}
                      className="flex flex-col justify-end h-full flex-1 max-w-[16px]"
                      title={`${item.shortLabel} · ${metric.label}: ${pct(item[metric.key])}`}
                    >
                      <div
                        className="w-full rounded-t-sm"
                        style={{
                          height: `${Math.max(value * 100, 1)}%`,
                          backgroundColor: metric.color,
                        }}
                      />
                    </div>
                  );
                })}
              </div>
              <span
                className="text-[11px] w-full text-center truncate text-neutral-content-subtler"
                title={item.version}
              >
                {item.shortLabel}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
