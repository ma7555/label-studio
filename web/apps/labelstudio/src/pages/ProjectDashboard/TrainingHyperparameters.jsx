import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Select, SimpleCard, Spinner, Typography } from "@humansignal/ui";
import { useAPI } from "../../providers/ApiProvider";
import { useProject } from "../../providers/ProjectProvider";

const DEFAULT_EPOCHS = 50;
const DEFAULT_BATCH_SIZE = 2;
const DEFAULT_LEARNING_RATE = 0.001;
const DEFAULT_IMGSZ = 640;
const DEFAULT_OPTIMIZER = "auto";
const DEFAULT_FRACTION = 1;

// Optimizers supported by Ultralytics. "auto" lets Ultralytics pick the
// optimizer, which also means it derives its own learning rate.
const OPTIMIZER_OPTIONS = [
  { value: "auto", label: "Auto (Ultralytics picks)" },
  { value: "Adam", label: "Adam" },
  { value: "Adamax", label: "Adamax" },
  { value: "AdamW", label: "AdamW" },
  { value: "NAdam", label: "NAdam" },
  { value: "RAdam", label: "RAdam" },
  { value: "RMSProp", label: "RMSProp" },
  { value: "SGD", label: "SGD" },
  { value: "MuSGD", label: "MuSGD" },
];

export const TrainingHyperparameters = () => {
  const api = useAPI();
  const { project, fetchProject } = useProject();

  const [epochs, setEpochs] = useState(DEFAULT_EPOCHS);
  const [batchSize, setBatchSize] = useState(DEFAULT_BATCH_SIZE);
  const [learningRate, setLearningRate] = useState(DEFAULT_LEARNING_RATE);
  const [imgsz, setImgsz] = useState(DEFAULT_IMGSZ);
  const [optimizer, setOptimizer] = useState(DEFAULT_OPTIMIZER);
  const [fraction, setFraction] = useState(DEFAULT_FRACTION);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  // Keep a stable reference to api so the load effect below only reruns when
  // the project changes, and never clobbers edits when the api context updates
  const apiRef = useRef(api);
  apiRef.current = api;

  useEffect(() => {
    if (!project?.id) return;

    setLoading(true);
    apiRef.current
      .callApi("project", { params: { pk: project.id } })
      .then((response) => {
        if (!response) return;
        setEpochs(response.training_epochs ?? DEFAULT_EPOCHS);
        setBatchSize(response.training_batch_size ?? DEFAULT_BATCH_SIZE);
        setLearningRate(response.training_learning_rate ?? DEFAULT_LEARNING_RATE);
        setImgsz(response.training_imgsz ?? DEFAULT_IMGSZ);
        setOptimizer(response.training_optimizer ?? DEFAULT_OPTIMIZER);
        setFraction(response.training_fraction ?? DEFAULT_FRACTION);
      })
      .finally(() => setLoading(false));
  }, [project?.id]);

  const save = useCallback(async () => {
    setSaving(true);
    setError(null);
    setSaved(false);

    const body = {
      training_epochs: Number(epochs) || DEFAULT_EPOCHS,
      training_batch_size: batchSize === "" ? DEFAULT_BATCH_SIZE : Number(batchSize),
      training_learning_rate: learningRate === "" ? DEFAULT_LEARNING_RATE : Number(learningRate),
      training_imgsz: imgsz === "" ? DEFAULT_IMGSZ : Number(imgsz),
      training_optimizer: optimizer || DEFAULT_OPTIMIZER,
      training_fraction: fraction === "" ? DEFAULT_FRACTION : Number(fraction),
    };

    try {
      const response = await api.callApi("updateProject", {
        params: { pk: project.id },
        body,
      });

      if (response?.$meta?.ok) {
        setSaved(true);
        fetchProject(project.id, true);
      }
    } catch (err) {
      setError(err?.response?.detail ?? err?.message ?? "Failed to save hyperparameters");
    } finally {
      setSaving(false);
    }
  }, [api, batchSize, epochs, fetchProject, fraction, imgsz, learningRate, optimizer, project?.id]);

  if (loading) {
    return (
      <SimpleCard title="Hyperparameters">
        <Spinner size={32} />
      </SimpleCard>
    );
  }

  return (
    <SimpleCard
      title="Hyperparameters"
      description={`These values are used the next time the auto learner trains a model. Defaults: ${DEFAULT_EPOCHS} epochs, batch size ${DEFAULT_BATCH_SIZE}, learning rate ${DEFAULT_LEARNING_RATE}, image size ${DEFAULT_IMGSZ}px, optimizer ${DEFAULT_OPTIMIZER}, full dataset.`}
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-4 max-[1100px]:grid-cols-2 max-[700px]:grid-cols-1">
          <HyperparameterField
            id="training-epochs"
            label="Epochs"
            type="number"
            min={1}
            value={epochs}
            onChange={setEpochs}
            placeholder={String(DEFAULT_EPOCHS)}
          />
          <HyperparameterField
            id="training-batch-size"
            label="Batch size"
            type="number"
            min={1}
            value={batchSize}
            onChange={setBatchSize}
            placeholder={String(DEFAULT_BATCH_SIZE)}
          />
          <HyperparameterField
            id="training-learning-rate"
            label="Learning rate"
            type="number"
            min={0}
            step="any"
            value={learningRate}
            onChange={setLearningRate}
            placeholder={String(DEFAULT_LEARNING_RATE)}
          />
          <HyperparameterField
            id="training-imgsz"
            label="Image size (px)"
            type="number"
            min={32}
            step={32}
            value={imgsz}
            onChange={setImgsz}
            placeholder={String(DEFAULT_IMGSZ)}
          />
          <div className="flex flex-col gap-1">
            <label htmlFor="training-optimizer" className="text-sm text-neutral-content-subtler">
              Optimizer
            </label>
            <Select
              id="training-optimizer"
              options={OPTIMIZER_OPTIONS}
              value={optimizer}
              onChange={(value) => setOptimizer(value)}
              aria-label="Optimizer"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="training-fraction" className="text-sm text-neutral-content-subtler">
              Training fraction ({(Number(fraction) * 100).toFixed(0)}% of dataset)
            </label>
            <input
              id="training-fraction"
              type="range"
              min={0.05}
              max={1}
              step={0.05}
              value={fraction}
              onChange={(event) => setFraction(event.target.value)}
              className="w-full accent-primary-content"
              aria-label="Training fraction"
            />
          </div>
        </div>

        {error && (
          <Typography size="small" className="text-negative-content">
            {error}
          </Typography>
        )}

        <div className="flex items-center gap-3">
          <Button look="primary" disabled={saving} onClick={save} aria-label="Save hyperparameters">
            {saving ? "Saving..." : "Save hyperparameters"}
          </Button>
          {saved && (
            <Typography size="small" className="text-positive-content">
              Saved
            </Typography>
          )}
        </div>
      </div>
    </SimpleCard>
  );
};

const HyperparameterField = ({ id, label, type, min, step, value, onChange, placeholder }) => (
  <div className="flex flex-col gap-1">
    <label htmlFor={id} className="text-sm text-neutral-content-subtler">
      {label}
    </label>
    <input
      id={id}
      type={type}
      min={min}
      step={step}
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      className="w-full rounded border border-neutral-border bg-neutral-background px-3 py-2 text-sm text-neutral-content focus:outline-none focus:border-primary-border"
    />
  </div>
);
