// Eigene Icons (§11.2): 20×20, 1,5 px Strich, currentColor. Nur Pfaddaten, kein innerHTML.

const P: Record<string, string[]> = {
  tree: ["M7.5 2.5h5v4h-5z", "M2 13.5h5v4H2z", "M13 13.5h5v4h-5z", "M10 6.5v3.5M4.5 13.5V10h11v3.5"],
  star: [
    "M10 10m-2.5 0a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0",
    "M10 2.5v5M10 12.5v5M2.5 10h5M12.5 10h5",
    "M4 4l4.2 4.2M16 4l-4.2 4.2M4 16l4.2-4.2M16 16l-4.2-4.2",
  ],
  network: [
    "M5 5m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0",
    "M15 6m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0",
    "M8 15m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0",
    "M7 5.3l6 .5M6 7l1.4 6M13.6 7.6L9.6 13.6",
  ],
  undo: ["M7 4.5L3.5 8 7 11.5", "M3.5 8h8a4.5 4.5 0 0 1 0 9H8"],
  redo: ["M13 4.5L16.5 8 13 11.5", "M16.5 8h-8a4.5 4.5 0 0 0 0 9H12"],
  plus: ["M10 4v12M4 10h12"],
  child: ["M4 3v6.5h6", "M10 7v5M7.5 9.5h5", "M4 9.5v6h8"],
  trash: ["M3.5 5.5h13", "M8 5.5V3.5h4v2", "M5 5.5l1 11h8l1-11", "M8.5 8.5v5.5M11.5 8.5v5.5"],
  chevronRight: ["M8 5l5 5-5 5"],
  chevronDown: ["M5 8l5 5 5-5"],
  indent: ["M3 4h14M9 8h8M9 12h8M3 16h14", "M3 7.5l3 2.5-3 2.5"],
  outdent: ["M3 4h14M9 8h8M9 12h8M3 16h14", "M6 7.5L3 10l3 2.5"],
  up: ["M10 16V4M5 9l5-5 5 5"],
  down: ["M10 4v12M5 11l5 5 5-5"],
  filter: ["M3 4h14l-5.5 6.5V16l-3-1.5v-4z"],
  focus: ["M10 10m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0", "M10 2v3M10 15v3M2 10h3M15 10h3"],
  calendar: ["M3 5h14v12H3z", "M3 8.5h14", "M6.5 3v4M13.5 3v4"],
  print: ["M5.5 7.5V3h9v4.5", "M5.5 14H3V7.5h14V14h-2.5", "M5.5 11.5h9V17h-9z"],
  download: ["M10 3v10M6 9.5l4 4 4-4", "M3.5 16.5h13"],
  upload: ["M10 14V4M6 7.5l4-4 4 4", "M3.5 16.5h13"],
  folder: ["M2.5 5.5h5l1.5 2h8.5v8.5h-15z"],
  save: ["M3.5 3.5h10l3 3v10h-13z", "M6.5 3.5v4h6v-4", "M6.5 16.5v-5h7v5"],
  help: [
    "M10 10m-7 0a7 7 0 1 0 14 0a7 7 0 1 0-14 0",
    "M7.8 7.8a2.3 2.3 0 1 1 3.2 2.1c-.6.3-1 .8-1 1.5v.6",
    "M10 14.3v.2",
  ],
  close: ["M5 5l10 10M15 5L5 15"],
  matrix: ["M3 3h14v14H3z", "M3 7.7h14M3 12.3h14M7.7 3v14M12.3 3v14"],
  fit: ["M3 7V3h4M13 3h4v4M17 13v4h-4M7 17H3v-4"],
  zoomIn: ["M8.5 8.5m-5 0a5 5 0 1 0 10 0a5 5 0 1 0-10 0", "M12.2 12.2l4.3 4.3", "M8.5 6v5M6 8.5h5"],
  zoomOut: ["M8.5 8.5m-5 0a5 5 0 1 0 10 0a5 5 0 1 0-10 0", "M12.2 12.2l4.3 4.3", "M6 8.5h5"],
  info: ["M10 10m-7 0a7 7 0 1 0 14 0a7 7 0 1 0-14 0", "M10 9v5", "M10 6.2v.3"],
  relation: ["M3 14c3-8 9-8 14 0", "M14 11.5l3 2.5-3.3 1.5"],
  topic: ["M10 3l7 3.5-7 3.5-7-3.5z", "M3 10l7 3.5 7-3.5", "M3 13.5L10 17l7-3.5"],
  document: ["M5 2.5h7l3.5 3.5v11.5H5z", "M12 2.5V6h3.5", "M7.5 10h5M7.5 13h5"],
  pin: ["M7 3h6l-1 5 2.5 2.5h-9L8 8z", "M10 10.5V17"],
};

export type IconName = keyof typeof P;

export function Icon({ name, size = 20, label }: { name: IconName; size?: number; label?: string }) {
  const paths = P[name] ?? [];
  return (
    <svg
      class="icon"
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden={label ? undefined : "true"}
      role={label ? "img" : undefined}
      aria-label={label}
      focusable="false"
    >
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
