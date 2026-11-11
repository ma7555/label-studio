import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { Badge, Button, SimpleCard, Typography } from "@humansignal/ui";
import { IconFileDownload } from "@humansignal/icons";
import { useAPI } from "../../providers/ApiProvider";
import { ModelMetricsChart } from "./ModelMetricsChart";

const formatMetric = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";
  return Number(value).toFixed(4);
};

const decisionBadge = (decision) => {
  if (!decision) return "-";
  const look = {
    promote: "positive",
    rejected: "negative",
    reject: "negative",
  }[decision];
  return <Badge look={look}>{decision}</Badge>;
};

export const ModelsTab = ({ registry, projectId, onRefresh }) => {
  const api = useAPI();
  const versions = registry?.versions ?? [];
  const baseline = registry?.active_metadata ?? null;
  const activeMetrics = registry?.active_metrics ?? {};
  const canDownload = Boolean(registry?.can_download_models);

  const [reEvaluating, setReEvaluating] = useState(null);
  const [reEvalError, setReEvalError] = useState(null);

  const reEvaluate = useCallback(
    async (item) => {
      const key = item.isBaseline ? "__baseline__" : item.version;
      const version = item.isBaseline ? "current" : item.version;
      setReEvaluating(key);
      setReEvalError(null);
      try {
        const result = await api.callApi("customDashboardModelReEvaluate", {
          params: item.isBaseline ? { version, project: projectId } : { version },
          suppressError: true,
        });
        if (!result || result.error) {
          setReEvalError(result?.response?.detail || result?.error || "Re-evaluation failed");
          return;
        }
        await onRefresh?.({ silent: true });
      } catch (err) {
        setReEvalError(err?.detail || err?.message || "Re-evaluation failed");
      } finally {
        setReEvaluating(null);
      }
    },
    [api, projectId, onRefresh],
  );

  const chronological = [...versions].sort((a, b) =>
    String(a.updated_at ?? "").localeCompare(String(b.updated_at ?? "")),
  );

  const labelled = chronological.map((item, index) => ({
    ...item,
    shortLabel: `v${index + 1}`,
  }));

  // The active model is evaluated on the same private dataset each run, so its
  // freshly measured metrics can be charted alongside the training runs.
  const chartModels =
    activeMetrics.map50_95 != null
      ? [{ ...activeMetrics, version: "baseline", shortLabel: "baseline" }, ...labelled]
      : labelled;

  const bestVersion = labelled.reduce((best, item) => {
    if (item.map50_95 == null) return best;
    if (!best || item.map50_95 > best.map50_95) return item;
    return best;
  }, null);

  const rows = [
    {
      version: baseline?.version ?? "initial",
      source: baseline?.source_model,
      status: "baseline",
      decision: "baseline",
      map50_95: activeMetrics.map50_95 ?? null,
      map50: activeMetrics.map50 ?? null,
      precision: activeMetrics.precision ?? null,
      recall: activeMetrics.recall ?? null,
      updated_at: activeMetrics.evaluated_at ?? null,
      isBaseline: true,
    },
    ...labelled.map((item) => ({ ...item, source: null, isBaseline: false })),
  ].reverse();

  const anyTraining = rows.some(
    (item) => item.status === "training" || item.progress?.status === "training",
  );

  return (
    <div className="flex flex-col gap-6">
      <SimpleCard title="Active Model">
        {baseline ? (
          <div className="flex flex-col gap-1">
            <Typography size="small">
              Active version: <code>{registry?.current_version ?? baseline.version}</code>
            </Typography>
            {baseline.source_model && (
              <Typography size="small" className="text-neutral-content-subtler">
                Baseline checkpoint: <code>{baseline.source_model}</code>
              </Typography>
            )}
            <Typography size="small" className="text-neutral-content-subtler">
              Promotion metric: <code>{registry?.promotion_metric ?? "fitness"}</code> · minimum delta{" "}
              <code>{registry?.promotion_min_delta ?? 0}</code>
            </Typography>
          </div>
        ) : (
          <Typography size="small" className="text-neutral-content-subtler">
            No active model recorded yet.
          </Typography>
        )}
      </SimpleCard>

      <SimpleCard
        title="Metric Comparison"
        description="Evaluation metrics per model, oldest to newest. The baseline is re-scored on the same private dataset each run."
      >
        <ModelMetricsChart models={chartModels} />
      </SimpleCard>

      <SimpleCard
        title="Model History"
        description={`${versions.length} training run${versions.length === 1 ? "" : "s"} plus the baseline model.`}
      >
        {rows.length === 0 ? (
          <Typography size="small" className="text-neutral-content-subtler">
            No models yet.
          </Typography>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-neutral-content-subtler border-b border-neutral-border-subtle">
                  {[
                    "Model",
                    "Decision",
                    "mAP50-95",
                    "mAP50",
                    "Precision",
                    "Recall",
                    "Updated",
                    "Download",
                    "Actions",
                  ].map((heading) => (
                    <th key={heading} className="py-2 px-3 font-medium whitespace-nowrap">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => {
                  const isActive = !item.isBaseline && item.version === registry?.current_version;
                  const isBest = !item.isBaseline && bestVersion && item.version === bestVersion.version;
                  const rowKey = item.isBaseline ? "__baseline__" : item.version;
                  const isReEvaluating = reEvaluating === rowKey;
                  const canReEvaluate = item.isBaseline || Boolean(item.has_model_file);
                  return (
                    <tr key={rowKey} className="border-b border-neutral-border-subtle last:border-b-0 align-top">
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2">
                          {item.isBaseline ? (
                            <span className="font-mono">{item.version}</span>
                          ) : (
                            <Link
                              to={`/projects/${projectId}/dashboard/${item.version}`}
                              className="text-primary-link hover:underline font-mono"
                            >
                              {item.version}
                            </Link>
                          )}
                          {isActive && <Badge look="positive">active</Badge>}
                          {isBest && !isActive && <Badge look="neutral">best</Badge>}
                        </div>
                        {item.source && <span className="text-[11px] text-neutral-content-subtler">{item.source}</span>}
                      </td>
                      <td className="py-2 px-3">{decisionBadge(item.decision)}</td>
                      <td className="py-2 px-3 font-mono">{formatMetric(item.map50_95)}</td>
                      <td className="py-2 px-3 font-mono">{formatMetric(item.map50)}</td>
                      <td className="py-2 px-3 font-mono">{formatMetric(item.precision)}</td>
                      <td className="py-2 px-3 font-mono">{formatMetric(item.recall)}</td>
                      <td className="py-2 px-3 whitespace-nowrap">{item.updated_at ?? "-"}</td>
                      <td className="py-2 px-3">
                        {item.has_model_file && canDownload ? (
                          <a
                            href={item.download_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Download model ${item.version}`}
                            className="inline-flex items-center gap-1 text-primary-link hover:underline"
                          >
                            <IconFileDownload width={16} height={16} />
                            .pt
                          </a>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="py-2 px-3">
                        <Button
                          look="outlined"
                          size="small"
                          disabled={!canReEvaluate || reEvaluating !== null || anyTraining}
                          onClick={() => reEvaluate(item)}
                          title={canReEvaluate ? undefined : "Model weights are not available for this version"}
                          aria-label={`Re-evaluate ${item.isBaseline ? "baseline" : item.version}`}
                        >
                          {isReEvaluating ? "Re-evaluating…" : "Re-evaluate"}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {reEvalError && (
          <Typography size="small" className="text-negative-content">
            {reEvalError}
          </Typography>
        )}
      </SimpleCard>
    </div>
  );
};
