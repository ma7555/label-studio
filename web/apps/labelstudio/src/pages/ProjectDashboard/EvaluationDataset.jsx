import { useCallback, useEffect, useState } from "react";
import { Button, SimpleCard, Spinner, Typography } from "@humansignal/ui";
import { useProject } from "../../providers/ProjectProvider";

const baseUrl = (projectId) => `/api/custom-dashboard/projects/${projectId}/eval-dataset`;

const csrfToken = () => {
  const match = document.cookie.match(/(^|;\s*)csrftoken=([^;]+)/);
  return match ? decodeURIComponent(match[2]) : null;
};

const fileUrl = (projectId, name) => `${baseUrl(projectId)}/files/${encodeURIComponent(name)}`;

export const EvaluationDataset = () => {
  const { project } = useProject();
  const [dataset, setDataset] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notConfigured, setNotConfigured] = useState(false);

  const load = useCallback(async () => {
    if (!project?.id) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${baseUrl(project.id)}/`, { credentials: "same-origin" });
      if (response.status === 404) {
        setNotConfigured(true);
        setDataset(null);
        return;
      }
      if (!response.ok) throw new Error(`Failed to load dataset (${response.status})`);
      setNotConfigured(false);
      setDataset(await response.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [project?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const upload = useCallback(
    async (event) => {
      const files = Array.from(event.target.files ?? []);
      if (!files.length) return;

      setBusy(true);
      setError(null);
      try {
        const form = new FormData();
        files.forEach((file) => form.append("files", file, file.name));
        const token = csrfToken();
        const response = await fetch(`${baseUrl(project.id)}/`, {
          method: "POST",
          body: form,
          credentials: "same-origin",
          headers: token ? { "X-CSRFToken": token } : undefined,
        });
        if (!response.ok) throw new Error(`Upload failed (${response.status})`);
        await load();
      } catch (err) {
        setError(err.message);
      } finally {
        setBusy(false);
        event.target.value = "";
      }
    },
    [load, project?.id],
  );

  const remove = useCallback(
    async (name) => {
      setBusy(true);
      setError(null);
      try {
        const token = csrfToken();
        const response = await fetch(fileUrl(project.id, name), {
          method: "DELETE",
          credentials: "same-origin",
          headers: token ? { "X-CSRFToken": token } : undefined,
        });
        if (!response.ok) throw new Error(`Delete failed (${response.status})`);
        await load();
      } catch (err) {
        setError(err.message);
      } finally {
        setBusy(false);
      }
    },
    [load, project?.id],
  );

  if (loading) {
    return (
      <SimpleCard title="Private Evaluation Dataset">
        <Spinner size={32} />
      </SimpleCard>
    );
  }

  if (notConfigured) {
    return null;
  }

  const images = dataset?.images ?? [];

  return (
    <SimpleCard
      title="Private Evaluation Dataset"
      description={
        dataset ? (
          <span>
            {dataset.count} image{dataset.count === 1 ? "" : "s"} scored separately from the training set ·{" "}
            <code>{dataset.images_dir}</code>
          </span>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex">
            <input
              type="file"
              multiple
              accept="image/*,.txt"
              onChange={upload}
              disabled={busy}
              className="block text-sm text-neutral-content-subtler file:mr-3 file:rounded file:border file:border-neutral-border file:bg-neutral-background file:px-3 file:py-1.5 file:text-sm"
              aria-label="Add images to the private evaluation dataset"
            />
          </label>
          {busy && <Typography size="small">Working…</Typography>}
        </div>

        <Typography size="small" className="text-neutral-content-subtler">
          Upload images, and optionally a matching <code>.txt</code> YOLO label with the same base name. An image
          without a label is used as a background sample.
        </Typography>

        {error && (
          <Typography size="small" className="text-negative-content">
            {error}
          </Typography>
        )}

        {images.length === 0 ? (
          <div className="h-24 flex justify-center items-center border border-primary-border-subtle bg-primary-emphasis-subtle rounded-lg">
            <Typography size="small" className="text-neutral-content-subtler">
              No images in the private evaluation dataset.
            </Typography>
          </div>
        ) : (
          <div className="grid grid-cols-6 gap-3 max-[1100px]:grid-cols-4 max-[700px]:grid-cols-2">
            {images.map((image) => (
              <div
                key={image.name}
                className="flex flex-col gap-1 border border-neutral-border-subtle rounded overflow-hidden"
              >
                <img
                  src={fileUrl(project.id, image.name)}
                  alt={image.name}
                  className="h-24 w-full object-cover bg-neutral-surface"
                  loading="lazy"
                />
                <div className="flex items-center justify-between gap-1 px-2 py-1">
                  <span className="text-[11px] truncate font-mono text-neutral-content-subtler" title={image.name}>
                    {image.name}
                  </span>
                  <Button
                    look="destructive"
                    size="small"
                    disabled={busy}
                    onClick={() => remove(image.name)}
                    aria-label={`Remove ${image.name}`}
                  >
                    ×
                  </Button>
                </div>
                {!image.has_label && (
                  <span className="px-2 pb-1 text-[11px] text-neutral-content-subtler">background</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </SimpleCard>
  );
};
