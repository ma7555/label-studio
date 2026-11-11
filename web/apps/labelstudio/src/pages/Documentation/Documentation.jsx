import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { SimpleCard, Typography } from "@humansignal/ui";

const H2 = ({ children }) => (
  <Typography variant="headline" size="small" className="mt-6 first:mt-0">
    {children}
  </Typography>
);

const P = ({ children }) => <Typography size="small">{children}</Typography>;

const Muted = ({ children }) => (
  <Typography size="small" className="text-neutral-content-subtler">
    {children}
  </Typography>
);

const Steps = ({ items }) => (
  <ol className="list-decimal pl-5 flex flex-col gap-1 text-sm">
    {items.map((item) => (
      <li key={typeof item === "string" ? item : JSON.stringify(item)}>{item}</li>
    ))}
  </ol>
);

const Bullets = ({ items }) => (
  <ul className="list-disc pl-5 flex flex-col gap-1 text-sm">
    {items.map((item) => (
      <li key={typeof item === "string" ? item : JSON.stringify(item)}>{item}</li>
    ))}
  </ul>
);

const Code = ({ children }) => (
  <pre className="overflow-x-auto rounded border border-neutral-border-subtle bg-neutral-surface p-3 text-xs font-mono">
    {children}
  </pre>
);

const Inline = ({ children }) => <code className="font-mono text-[0.9em]">{children}</code>;

const Table = ({ headers, rows }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-sm border border-neutral-border-subtle">
      <thead>
        <tr className="text-left text-neutral-content-subtler border-b border-neutral-border-subtle">
          {headers.map((heading) => (
            <th key={heading} className="py-2 px-3 font-medium whitespace-nowrap">
              {heading}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.join("|")} className="border-b border-neutral-border-subtle last:border-b-0 align-top">
            {row.map((cell, index) => (
              <td key={`${cell}-${index}`} className="py-2 px-3">
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const Note = ({ title = "Note", children }) => (
  <div className="rounded border border-primary-border-subtle bg-primary-emphasis-subtle p-3 flex flex-col gap-1">
    <Typography size="small" className="font-medium">
      {title}
    </Typography>
    <Typography size="small" className="text-neutral-content-subtler">
      {children}
    </Typography>
  </div>
);

const SECTIONS = [
  {
    slug: "overview",
    title: "Overview",
    body: (
      <>
        <P>
          AutoLearner turns annotation work into a continuously improving object-detection model. You label images, the
          platform trains a model on those labels, scores it against a private evaluation set, and promotes it only if
          it beats the model currently in production.
        </P>

        <H2>The loop</H2>
        <Code>{`label images -> train on annotations -> evaluate new model
      ^                                          |
      |                                          v
   promote <---- compare with current champion ---- reject`}</Code>

        <H2>Components</H2>
        <Table
          headers={["Component", "Responsibility"]}
          rows={[
            ["Labeling UI", "Where annotators draw regions, review pre-annotations and submit annotations."],
            ["ML backend", "Runs training and evaluation with Ultralytics YOLO and decides promotion."],
            ["Model registry", "On-disk history of training runs, metrics, comparisons and weights per project."],
            ["Project dashboard", "Overview, Models and Evaluation Dataset tabs for each project."],
          ]}
        />

        <H2>Key concepts</H2>
        <Bullets
          items={[
            <>
              <strong>Annotation</strong> — ground truth submitted by a human. Only annotations are used for training.
            </>,
            <>
              <strong>Pre-annotation</strong> — a machine prediction shown as a starting point. Never used for training.
            </>,
            <>
              <strong>Private evaluation dataset</strong> — a held-out set, separate from training data, used to score
              every model identically.
            </>,
            <>
              <strong>Champion</strong> — the currently active model for a project, served for predictions.
            </>,
            <>
              <strong>Version</strong> — one training run, stored under the registry with its metrics and weights.
            </>,
          ]}
        />
      </>
    ),
  },
  {
    slug: "getting-started",
    title: "Getting started",
    body: (
      <>
        <P>End-to-end first run:</P>
        <Steps
          items={[
            "Create a project and choose a labeling template (object detection with RectangleLabels).",
            "Import images, or connect local files/storage so tasks point at your images.",
            "Annotate a batch of images in the labeling view.",
            "Open the project dashboard and set your training hyperparameters.",
            "Start training and watch progress on the Overview tab.",
            "Review the new version on the Models tab; it is promoted automatically if it wins.",
            "Use the model: new tasks get pre-annotations from the active champion.",
          ]}
        />
        <Note title="One training run at a time">
          A project-level lock allows only one active run. A second request is rejected with "Another training session
          is already running".
        </Note>
      </>
    ),
  },
  {
    slug: "labeling",
    title: "Annotation vs pre-annotation",
    body: (
      <>
        <P>
          The labeling view can show several <em>result sets</em> for the same task. Understanding the difference
          matters, because only one of them trains the model.
        </P>

        <H2>Annotation (ground truth)</H2>
        <Bullets
          items={[
            "Created by a human in the labeling UI and submitted.",
            "Represents the accepted truth for that image.",
            "This is the only data the trainer reads.",
            "Shown in a tab named after the annotator, e.g. admin@localhost.",
          ]}
        />

        <H2>Pre-annotation (prediction)</H2>
        <Bullets
          items={[
            "Produced by the ML backend from the current champion model.",
            "A convenience to speed up labeling: accept, adjust or discard it.",
            "Never used as training data.",
            "Shown in a tab named after the model, i.e. AutoLearner, with a sparkles icon.",
          ]}
        />

        <H2>Comparing them</H2>
        <P>
          With more than one result set, the <Inline>Compare all</Inline> toggle renders them side by side so you can
          spot differences. It only appears when a task has more than one annotation or prediction.
        </P>

        <H2>What gets trained on</H2>
        <Table
          headers={["Task state", "Used for training?"]}
          rows={[
            ["Unannotated image", "No — excluded entirely."],
            ["Annotated, has rectangle regions", "Yes — regions become YOLO labels."],
            ["Annotated, no matching regions", "Yes — as a background/negative sample (no label file)."],
            ["Prediction only", "No — predictions are ignored by the trainer."],
          ]}
        />

        <Note title="Multiple annotators">
          If a task has several annotations, all of their regions are merged into one label file. If two people labelled
          the same image differently, both sets end up in the training data. For multi-annotator workflows prefer one
          final annotation per task.
        </Note>

        <Note title="Beware the feedback loop">
          Pre-annotations come from the model you are training. Accepting them with little correction means the model
          increasingly trains on its own output. Correct the boxes meaningfully, or periodically label a subset without
          using the predictions.
        </Note>
      </>
    ),
  },
  {
    slug: "task-assignment",
    title: "Assigning tasks",
    body: (
      <>
        <P>Assignment records who should label a task. It is metadata only; it does not lock the task.</P>
        <Steps
          items={[
            "Open the project and go to Data.",
            "Tick the checkboxes next to the tasks. The Actions button stays disabled until something is selected.",
            "Click Actions in the toolbar, then choose Assign Tasks.",
            "Pick a person from the Assign to dropdown and confirm.",
          ]}
        />
        <P>
          To reassign, select the already-assigned tasks and run Assign Tasks again; the previous assignment is
          overwritten. The Assigned To and Assignment Status columns show the current state.
        </P>
        <Muted>
          Only members of the project's organization appear in the dropdown. Assignment Status reads completed when the
          task has annotations.
        </Muted>
      </>
    ),
  },
  {
    slug: "hyperparameters",
    title: "Training hyperparameters",
    body: (
      <>
        <P>Set these on the project dashboard and click Save hyperparameters. They apply to the next run.</P>
        <Table
          headers={["Parameter", "Default", "Notes"]}
          rows={[
            ["Epochs", "50", "Passes over the training split."],
            [
              "Batch size",
              "2",
              "Images per step. Low default keeps CPU-only hosts inside memory limits; raise it on a GPU.",
            ],
            [
              "Learning rate",
              "0.001",
              "Initial rate. Ignored when the optimizer is Auto, because Ultralytics then derives its own rate.",
            ],
            [
              "Image size",
              "640",
              "Square input resolution. Passed explicitly so it overrides the value inherited from the base checkpoint.",
            ],
            [
              "Optimizer",
              "auto",
              "auto, Adam, Adamax, AdamW, NAdam, RAdam, RMSProp, SGD, MuSGD. Pick a named optimizer for the learning rate to take effect.",
            ],
            [
              "Training fraction",
              "1.0 (100%)",
              "Share of the training split to use. Applies to the alphabetically-sorted file list, so it is a prefix, not a random sample. Validation always uses the full private dataset.",
            ],
          ]}
        />
        <Note title="Fraction is a prefix">
          A fraction of 0.1 always selects the same first 10% of the sorted training files. That is reproducible but not
          representative; if accuracy drops unexpectedly at low fractions, examine your file naming and class balance.
        </Note>
      </>
    ),
  },
  {
    slug: "training-runs",
    title: "Training runs",
    body: (
      <>
        <P>A run is a single unit of work: build a dataset, train, evaluate, compare, then promote or reject.</P>

        <H2>What a run does</H2>
        <Steps
          items={[
            "Creates a new version directory under the project registry.",
            "Exports annotated tasks from the platform and copies their images into the run's dataset.",
            "Converts rectangle regions into YOLO label files; annotated images with no regions become backgrounds.",
            "Writes dataset.yaml, using the private evaluation set for validation.",
            "Trains the model from the current champion checkpoint.",
            "Scores the newly trained model on the private evaluation set.",
            "Scores the current champion on the same set, so both are measured on identical data.",
            "Compares the promotion metric and promotes or rejects the new version.",
          ]}
        />

        <H2>Progress</H2>
        <P>
          The dashboard shows a progress card while a run is active, refreshing every few seconds: percentage, epoch
          counter, phase, and the latest epoch metrics.
        </P>
        <Note title="Progress moves once per epoch">
          Epoch metrics are written after each epoch completes, so the percentage can sit at 0% for a long time at the
          start of the first epoch. On CPU-only hardware an epoch can take tens of minutes.
        </Note>

        <H2>Class alignment</H2>
        <P>
          Class IDs come from the private evaluation dataset, not the labeling config. If the labeling config contains a
          class that the evaluation dataset does not, the run aborts rather than silently mislabelling data.
        </P>
      </>
    ),
  },
  {
    slug: "model-versions",
    title: "Model versions and promotion",
    body: (
      <>
        <P>Every run produces a version. The registry keeps them with their metrics, comparison and weights.</P>

        <H2>Promotion rule</H2>
        <Code>{`promote if new_metric >= champion_metric + PROMOTION_MIN_DELTA
otherwise reject and keep the champion`}</Code>
        <P>
          The promotion metric defaults to fitness (a weighted combination of precision and recall across IoU
          thresholds), and the required delta defaults to 0. Both are configurable per deployment.
        </P>

        <H2>The baseline</H2>
        <P>
          Each project has a baseline checkpoint configured at <Inline>/eval/p&lt;id&gt;/source_model.txt</Inline>. The
          platform restores <Inline>models/projects/p&lt;id&gt;/current/best.pt</Inline> from{" "}
          <Inline>models/base/</Inline> automatically when it is missing.
        </P>
        <Muted>
          The first run compares against this baseline. After a promotion, the champion becomes the newly promoted
          model, so later runs compare against the latest winner.
        </Muted>

        <H2>Viewing versions</H2>
        <P>
          The Models tab lists the baseline plus every run with its decision, metrics and download link. The
          best-scoring run is badged best and the live model is badged active.
        </P>
      </>
    ),
  },
  {
    slug: "dashboard",
    title: "Dashboard tabs",
    body: (
      <>
        <P>The project dashboard is split into three tabs.</P>
        <Table
          headers={["Tab", "Contents"]}
          rows={[
            [
              "Overview",
              "Summary metrics (current version, promotion metric, run count, last update), training hyperparameters, live training progress and the version history table.",
            ],
            [
              "Models",
              "Active model and baseline checkpoint, a metric comparison chart across runs, and the full model history table including downloads.",
            ],
            ["Evaluation Dataset", "Browse, add and remove the images of the private evaluation set."],
          ]}
        />
        <Muted>
          Model downloads are limited to administrators. Visitors without administrator rights do not see download
          controls, and the endpoint returns 403.
        </Muted>
      </>
    ),
  },
  {
    slug: "evaluation-dataset",
    title: "Private evaluation dataset",
    body: (
      <>
        <P>
          Every project is scored against its own private evaluation dataset, configured at{" "}
          <Inline>/eval/p&lt;id&gt;/dataset.yaml</Inline>. It is deliberately separate from the labeled training tasks.
        </P>

        <H2>Why separate</H2>
        <Bullets
          items={[
            "Scoring on training data would reward memorization.",
            "A fixed held-out set makes version-to-version comparisons meaningful.",
            "Both the champion and the challenger are scored on the same images in the same run.",
          ]}
        />

        <H2>Managing images</H2>
        <P>
          Open the Evaluation Dataset tab to see the resolved directory, the image count and thumbnails. You can upload
          images and remove existing ones.
        </P>
        <Steps
          items={[
            "Upload one or more images. Optionally include a .txt YOLO label with the same base name.",
            "An image without a label becomes a background (negative) sample and is marked as such.",
            "Removing an image also removes its matching label file.",
          ]}
        />
        <Note title="Class names must match">
          The class list comes from dataset.yaml. A project's labeling config must not contain classes that are missing
          from this list, or training aborts.
        </Note>
        <Muted>The label cache is invalidated on every change so the next evaluation rescans the directory.</Muted>
      </>
    ),
  },
  {
    slug: "model-backend",
    title: "Model backend and baselines",
    body: (
      <>
        <P>
          Training and prediction run in a separate ML backend container. It stores everything per project under{" "}
          <Inline>/models/projects/p&lt;id&gt;/</Inline>.
        </P>

        <H2>Layout</H2>
        <Code>{`/models/base/<checkpoint>.pt              source checkpoints
/models/projects/p<id>/current/best.pt   active champion
/models/projects/p<id>/current/metrics.json
/models/projects/p<id>/registry/<run>/   one directory per training run`}</Code>

        <H2>Baseline seeding</H2>
        <P>
          A project's baseline is declared in <Inline>/eval/p&lt;id&gt;/source_model.txt</Inline>. If{" "}
          <Inline>current/best.pt</Inline> is missing — for example after a reset — it is copied from{" "}
          <Inline>models/base/</Inline> automatically, both at backend start and lazily on first use.
        </P>
        <Code>{`# seed every configured project manually
docker exec ml-backend-yolo python seed_models.py`}</Code>

        <H2>Prediction naming</H2>
        <P>
          Predictions carry the model version <Inline>AutoLearner</Inline>, which is the tab label shown in the labeling
          view.
        </P>
      </>
    ),
  },
  {
    slug: "downloads",
    title: "Downloading models",
    body: (
      <>
        <P>Weights can be downloaded by administrators only.</P>
        <Bullets
          items={[
            "The dashboard header downloads the active champion.",
            "The Models tab and version history download a specific trained version.",
            "Requests from non-administrators receive 403, and the controls are hidden for them.",
          ]}
        />
        <Muted>
          A version only has weights once its run completed. Interrupted or failed runs have no best.pt to download.
        </Muted>
      </>
    ),
  },
  {
    slug: "troubleshooting",
    title: "Troubleshooting",
    body: (
      <>
        <Table
          headers={["Symptom", "Cause and fix"]}
          rows={[
            ["Progress stuck at 0% / Epoch 0", "The first epoch has not finished. Metrics are written per epoch."],
            [
              "Version stays marked training",
              "The run was interrupted. Start a new run; the stale one is reported as failed.",
            ],
            ["Training request rejected", "Another run is active. Only one training session per project is allowed."],
            [
              "Very slow training",
              "Training runs on CPU. Reduce epochs, image size, batch size or the training fraction.",
            ],
            [
              "Learning rate seems ignored",
              "The optimizer is set to Auto, which lets Ultralytics derive its own rate. Choose a named optimizer.",
            ],
            [
              "Training aborts with 'missing Label Studio labels'",
              "The labeling config has classes absent from the private evaluation dataset, or the project ID maps to a different eval set.",
            ],
            [
              "No active model configured for project",
              "current/best.pt is missing and no baseline is declared. Add a checkpoint name to /eval/p<id>/source_model.txt, then reseed.",
            ],
            ["Model download missing", "Either the run produced no weights, or your account is not an administrator."],
            [
              "Low accuracy at a low training fraction",
              "The fraction selects a sorted prefix, not a random sample. Raise the fraction or rename files.",
            ],
          ]}
        />
      </>
    ),
  },
];

const getSlug = (pathname) => {
  const match = pathname.match(/\/documentation\/?([^/?#]*)/);
  return match?.[1] || SECTIONS[0].slug;
};

export const DocumentationPage = () => {
  const location = useLocation();
  const slug = getSlug(location.pathname);
  const active = SECTIONS.find((section) => section.slug === slug) ?? SECTIONS[0];

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [slug]);

  return (
    <main className="p-6 flex flex-col gap-6 max-w-6xl">
      <div className="flex flex-col gap-1">
        <Typography variant="headline" size="medium">
          Documentation
        </Typography>
        <Typography size="small" className="text-neutral-content-subtler">
          AutoLearner — automated training, evaluation and promotion for object detection.
        </Typography>
      </div>

      <div className="flex gap-6 items-start max-[900px]:flex-col">
        <nav className="w-56 shrink-0 sticky top-4 max-[900px]:static max-[900px]:w-full">
          <SimpleCard title="Contents">
            <ul className="flex flex-col gap-0.5">
              {SECTIONS.map((section) => (
                <li key={section.slug}>
                  <Link
                    to={`/documentation/${section.slug}`}
                    className={[
                      "block rounded px-2 py-1 text-sm",
                      section.slug === active.slug
                        ? "bg-primary-emphasis-subtle text-neutral-content font-medium"
                        : "text-neutral-content-subtler hover:text-neutral-content",
                    ].join(" ")}
                    aria-current={section.slug === active.slug ? "page" : undefined}
                  >
                    {section.title}
                  </Link>
                </li>
              ))}
            </ul>
          </SimpleCard>
        </nav>

        <div className="flex-1 min-w-0">
          <SimpleCard title={active.title}>
            <div className="flex flex-col gap-3">{active.body}</div>
          </SimpleCard>
        </div>
      </div>

      <Typography size="small" className="text-neutral-content-subtler">
        Back to{" "}
        <Link to="/projects" className="text-primary-link hover:underline">
          Projects
        </Link>
      </Typography>
    </main>
  );
};

DocumentationPage.title = "Documentation";
DocumentationPage.path = "/documentation";
DocumentationPage.exact = false;
