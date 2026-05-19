import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Badge, Button, buttonVariant, SimpleCard, Spinner, Typography } from "@humansignal/ui";
import { useUpdatePageTitle } from "@humansignal/core";
import { useProject } from "../../providers/ProjectProvider";
import { useAPI } from "../../providers/ApiProvider";
import { Space } from "../../components/Space/Space";

export const ProjectDashboardPage = () => {
  const { project } = useProject();
  const api = useAPI();
  const [registry, setRegistry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useUpdatePageTitle(project?.title ? `${project.title} Dashboard` : "Project Dashboard");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!project?.id) return;
      setLoading(true);
      setError(null);

      try {
        const response = await api.callApi("customDashboardModels", {
          params: { project: project.id },
        });
        if (!cancelled) setRegistry(response);
      } catch (err) {
        if (!cancelled) setError(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [api, project?.id]);

  if (loading) return <Loading />;

  if (error) {
    return (
      <main className="p-6">
        <SimpleCard title="Dashboard error">
          <Typography size="small" className="text-negative-content">
            Unable to load dashboard data.
          </Typography>
        </SimpleCard>
      </main>
    );
  }

  const versions = registry?.versions ?? [];

  return (
    <main className="p-6 flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <Typography variant="headline" size="medium">
            {project?.title} Dashboard
          </Typography>
          <Typography size="small" className="text-neutral-content-subtler">
            Project-specific YOLO training and evaluation history.
          </Typography>
        </div>
        <Link className={buttonVariant({ look: "outlined" })} to={`/projects/${project?.id}/data`} aria-label="Back to data">
          Back to Data
        </Link>
      </div>

      <div className="grid grid-cols-4 gap-4 max-[1100px]:grid-cols-2 max-[700px]:grid-cols-1">
        <MetricCard title="Current Version" value={registry?.current_version ?? "None promoted yet"} />
        <MetricCard title="Promotion Metric" value={registry?.promotion_metric ?? "fitness"} note={`minimum delta ${registry?.promotion_min_delta ?? 0}`} />
        <MetricCard title="Versions" value={versions.length} />
        <MetricCard title="Updated" value={registry?.updated_at ?? "Not available"} />
      </div>

      <SimpleCard
        title="Version History"
        description={
          registry?.active_model ? (
            <span>
              Active model: <code>{registry.active_model}</code>
            </span>
          ) : undefined
        }
      >
        {versions.length === 0 ? (
          <div className="h-40 flex justify-center items-center border border-primary-border-subtle bg-primary-emphasis-subtle rounded-lg">
            <Typography size="small" className="text-neutral-content-subtler">
              No model versions found for this project yet.
            </Typography>
          </div>
        ) : (
          <DataManagerLikeTable
            columns={[
              "Version",
              "Status",
              "Decision",
              "mAP50-95",
              "mAP50",
              "Precision",
              "Recall",
              "Updated",
            ]}
            rows={versions.map((item) => [
              <Link to={`/projects/${project?.id}/dashboard/${item.version}`} className="text-primary-link hover:underline font-mono">
                {item.version}
              </Link>,
              <StatusBadge status={item.status} />,
              item.decision ?? "-",
              formatMetric(item.map50_95),
              formatMetric(item.map50),
              formatMetric(item.precision),
              formatMetric(item.recall),
              item.updated_at ?? "-",
            ])}
          />
        )}
      </SimpleCard>
    </main>
  );
};

export const ProjectModelVersionPage = ({ version }) => {
  const { project } = useProject();
  const api = useAPI();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useUpdatePageTitle(version ? `${version} Metrics` : "Model Version");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!version) return;
      setLoading(true);
      setError(null);

      try {
        const response = await api.callApi("customDashboardModel", {
          params: { version },
        });
        if (!cancelled) setDetail(response);
      } catch (err) {
        if (!cancelled) setError(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [api, version]);

  if (loading) return <Loading />;

  if (error || !detail) {
    return (
      <main className="p-6">
        <SimpleCard title="Model version error">
          <Typography size="small" className="text-negative-content">
            Unable to load model version details.
          </Typography>
        </SimpleCard>
      </main>
    );
  }

  const results = detail.results ?? [];
  const resultRows = results.slice(-10);

  return (
    <main className="p-6 flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <Typography variant="headline" size="medium">
            {detail.version}
          </Typography>
          <Typography size="small" className="text-neutral-content-subtler">
            {detail.comparison?.reason ?? detail.status?.status ?? "Model version details"}
          </Typography>
        </div>
        <Link className={buttonVariant({ look: "outlined" })} to={`/projects/${project?.id}/dashboard`} aria-label="Back to dashboard">
          Back to Dashboard
        </Link>
      </div>

      <div className="grid grid-cols-4 gap-4 max-[1100px]:grid-cols-2 max-[700px]:grid-cols-1">
        <MetricCard title="mAP50-95" value={formatMetric(detail.metrics?.map50_95)} />
        <MetricCard title="mAP50" value={formatMetric(detail.metrics?.map50)} />
        <MetricCard title="Precision" value={formatMetric(detail.metrics?.precision)} />
        <MetricCard title="Recall" value={formatMetric(detail.metrics?.recall)} />
      </div>

      <SimpleCard title="Version Details">
        <div className="grid grid-cols-3 gap-4 max-[1100px]:grid-cols-1">
          <DetailGroup
            title="Candidate Metrics"
            rows={[
              ["mAP50-95", formatMetric(detail.metrics?.map50_95)],
              ["mAP50", formatMetric(detail.metrics?.map50)],
              ["Precision", formatMetric(detail.metrics?.precision)],
              ["Recall", formatMetric(detail.metrics?.recall)],
              ["Fitness", formatMetric(detail.metrics?.fitness)],
            ]}
          />
          <DetailGroup
            title="Promotion Comparison"
            rows={[
              ["Decision", detail.comparison?.decision ?? "-"],
              ["Metric", detail.comparison?.metric ?? "-"],
              ["Old version", detail.comparison?.old_version ?? "-"],
              ["Old score", formatMetric(detail.comparison?.old_score)],
              ["New score", formatMetric(detail.comparison?.new_score)],
              ["Delta", formatMetric(detail.comparison?.delta)],
            ]}
          />
          <DetailGroup
            title="Training Config"
            rows={[
              ["Project", detail.training_config?.project_id ?? detail.status?.project_id ?? "-"],
              ["Epochs", detail.training_config?.epochs ?? "-"],
              ["Annotated images", detail.training_config?.annotated_images ?? "-"],
              ["Private eval", detail.training_config?.private_eval_dataset ?? detail.metrics?.dataset ?? "-"],
              ["Validation images", detail.training_config?.validation_images ?? "-"],
            ]}
          />
        </div>
      </SimpleCard>

      {detail.artifacts?.length > 0 && (
        <SimpleCard title="Artifacts">
          <div className="grid grid-cols-3 gap-4 max-[1100px]:grid-cols-2 max-[700px]:grid-cols-1">
            {detail.artifacts.map((artifact) => (
              <a key={artifact.name} href={artifact.url} target="_blank" rel="noreferrer" className="block border border-neutral-border-subtle rounded p-3 hover:bg-neutral-surface-hover">
                <img src={artifact.url} alt={artifact.name} className="w-full h-64 object-contain bg-neutral-surface rounded" />
                <Typography size="small" className="mt-2 font-mono text-primary-link">
                  {artifact.name}
                </Typography>
              </a>
            ))}
          </div>
        </SimpleCard>
      )}

      <SimpleCard title="Training Results CSV">
        {resultRows.length === 0 ? (
          <Typography size="small" className="text-neutral-content-subtler">
            No training results CSV found.
          </Typography>
        ) : (
          <DataManagerLikeTable
            columns={Object.keys(resultRows[0])}
            rows={resultRows.map((row) => Object.values(row))}
          />
        )}
      </SimpleCard>
    </main>
  );
};

export const ProjectModelVersionRoute = () => {
  const version = window.location.pathname.split("/dashboard/")[1]?.replace(/\/$/, "");
  return <ProjectModelVersionPage version={version} />;
};

ProjectDashboardPage.title = "Dashboard";
ProjectDashboardPage.path = "/dashboard";
ProjectDashboardPage.exact = true;

ProjectModelVersionRoute.title = "Model Version";
ProjectModelVersionRoute.path = "/dashboard/:version";
ProjectModelVersionRoute.exact = true;

ProjectDashboardPage.context = ({ project }) => {
  const projectId = project?.id ?? getProjectIdFromPath();
  return (
    <Space size="small">
      <Link className={buttonVariant({ size: "small", look: "outlined" })} to={`/projects/${projectId}/data`} aria-label="Back to data">
        Data
      </Link>
    </Space>
  );
};

ProjectModelVersionRoute.context = ({ project }) => {
  const projectId = project?.id ?? getProjectIdFromPath();
  return (
    <Space size="small">
      <Link className={buttonVariant({ size: "small", look: "outlined" })} to={`/projects/${projectId}/dashboard`} aria-label="Back to dashboard">
        Dashboard
      </Link>
    </Space>
  );
};

const Loading = () => (
  <main className="p-6">
    <div className="h-64 flex justify-center items-center">
      <Spinner />
    </div>
  </main>
);

const MetricCard = ({ title, value, note }) => (
  <SimpleCard title={title}>
    <Typography variant="headline" size="small">
      {value}
    </Typography>
    {note && (
      <Typography size="small" className="text-neutral-content-subtler">
        {note}
      </Typography>
    )}
  </SimpleCard>
);

const formatMetric = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";
  return Number(value).toFixed(4);
};

const StatusBadge = ({ status }) => {
  const normalized = status ?? "unknown";
  const variant = normalized === "approved" ? "positive" : normalized === "rejected" || normalized === "failed" ? "negative" : "neutral";

  return (
    <Badge variant={variant} size="small">
      {normalized}
    </Badge>
  );
};

const DetailGroup = ({ title, rows }) => {
  return (
    <section className="rounded border border-neutral-border-subtle bg-neutral-background p-base">
      <Typography variant="headline" size="small" className="mb-base">
        {title}
      </Typography>
      <dl className="grid grid-cols-[140px_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-neutral-content-subtler">{label}</dt>
            <dd className="min-w-0 break-words">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
};

const DataManagerLikeTable = ({ columns, rows }) => {
  return (
    <div className="overflow-x-auto border border-neutral-border-subtle rounded bg-neutral-background">
      <table className="w-full min-w-[1040px] border-collapse text-sm">
        <thead className="bg-neutral-surface sticky top-0 z-10">
          <tr className="border-b border-neutral-border-subtle text-left">
            {columns.map((column) => (
              <th key={column} className="px-tight py-tight h-[50px] font-medium text-neutral-content-subtler whitespace-nowrap">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              className={`${rowIndex % 2 ? "bg-neutral-emphasis-subtle" : "bg-neutral-background"} hover:bg-primary-emphasis-subtle transition-colors`}
            >
              {row.map((value, valueIndex) => (
                <td key={valueIndex} className="px-tight py-tight h-[48px] text-neutral-content whitespace-nowrap align-middle">
                  {value}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const getProjectIdFromPath = () => {
  return window.location.pathname.match(/\/projects\/(\d+)/)?.[1];
};
