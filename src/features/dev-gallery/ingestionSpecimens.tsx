import { useState } from "react";
import type { WeekKey } from "@shared/domain";
import { CaptureFields, type CaptureFieldsValue } from "@/components/forms/CaptureFields";
import { ModelPicker } from "@/components/forms/ModelPicker";
import { StatComparison } from "@/components/data/StatComparison";
import { ImageViewer } from "@/components/media/ImageViewer";
import { Select } from "@/components/ui/select";
import { BUF, NE } from "./fixtures";
import type { Specimen } from "./specimens";

/** A stand-in screenshot, drawn as SVG so the gallery needs no binary fixtures. */
function screen(title: string, rows: [string, string][]): string {
  const lines = rows
    .map(
      ([name, line], i) =>
        `<text x="40" y="${150 + i * 48}" fill="#e2e8f0" font-size="26" font-family="sans-serif">${name}</text><text x="560" y="${150 + i * 48}" fill="#e2e8f0" font-size="26" font-family="monospace">${line}</text>`,
    )
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900"><rect width="1200" height="900" fill="#0f172a"/><text x="40" y="80" fill="#f8fafc" font-size="40" font-weight="bold" font-family="sans-serif">${title}</text>${lines}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const SCREENS = [
  {
    id: "passing",
    src: screen("PASSING", [
      ["D. Maye", "22/30  284  3  0"],
      ["J. Allen", "19/33  215  1  2"],
    ]),
    alt: "Passing",
  },
  {
    id: "rushing",
    src: screen("RUSHING", [
      ["T. Henderson", "18  104  1"],
      ["J. Cook", "16  86  1"],
    ]),
    alt: "Rushing",
  },
];

const SEASONS = [
  { _id: "s2026", year: 2026 },
  { _id: "s2027", year: 2027 },
];

function CaptureFieldsDemo() {
  const [value, setValue] = useState<CaptureFieldsValue<string>>({
    targetKey: "game_box_score",
    seasonId: "s2026",
    weekKey: "w3" as WeekKey,
  });
  return <CaptureFields seasons={SEASONS} value={value} onChange={setValue} allowUntagged />;
}

function ModelPickerDemo() {
  const [value, setValue] = useState("google/gemini-4-argon");
  return (
    <ModelPicker
      presets={["google/gemini-4-argon", "anthropic/claude-sonnet-5.5"]}
      value={value}
      onChange={setValue}
      aria-label="Primary model"
    />
  );
}

function SelectDemo() {
  const [value, setValue] = useState("");
  return (
    <Select
      value={value}
      onValueChange={setValue}
      placeholder="Pick a position"
      options={["QB", "HB", "WR", "TE"].map((p) => ({ value: p, label: p }))}
    />
  );
}

export const INGESTION_SPECIMENS: Specimen[] = [
  {
    id: "imageviewer",
    name: "ImageViewer",
    note: "Pinch or ctrl-scroll to zoom, drag to pan, double-tap to jump in. Thumbnails switch screens.",
    render: () => <ImageViewer images={SCREENS} />,
  },
  {
    id: "statcomparison",
    name: "StatComparison",
    note: "Two teams side by side with a split bar per row; the better side is bold.",
    render: () => (
      <StatComparison
        left={{ label: NE.abbr, color: NE.secondaryColor }}
        right={{ label: BUF.abbr, color: BUF.primaryColor }}
        rows={[
          {
            id: "yds",
            label: "Total yards",
            left: { text: "412", value: 412 },
            right: { text: "301", value: 301 },
            better: "higher",
          },
          {
            id: "3rd",
            label: "Third down",
            left: { text: "7/12", value: 7 },
            right: { text: "4/13", value: 4 },
            better: "higher",
          },
          {
            id: "to",
            label: "Turnovers",
            left: { text: "0", value: 0 },
            right: { text: "2", value: 2 },
            better: "lower",
          },
          {
            id: "top",
            label: "Possession",
            left: { text: "32:14", value: 1934 },
            right: { text: "27:46", value: 1666 },
            better: "higher",
          },
        ]}
      />
    ),
  },
  {
    id: "capturefields",
    name: "CaptureFields",
    note: "What a set of screenshots is and where it goes. Native selects open the phone's own picker.",
    render: () => <CaptureFieldsDemo />,
  },
  {
    id: "modelpicker",
    name: "ModelPicker",
    note: "Saved OpenRouter models in a native select; Other model… opens a field for any id.",
    render: () => <ModelPickerDemo />,
  },
  {
    id: "select",
    name: "Select",
    note: "Native select styled like Input; 44 px on touch.",
    render: () => <SelectDemo />,
  },
];
