const paths = {
  lock: "M5 10h14v11H5z M8 10V6a4 4 0 0 1 8 0v4 M12 14v3",
  gear: "M10 2h4l.7 3 2 1.2 3-.9 2 3.4-2.3 2v2.6l2.3 2-2 3.4-3-.9-2 1.2L14 22h-4l-.7-3-2-1.2-3 .9-2-3.4 2.3-2v-2.6l-2.3-2 2-3.4 3 .9 2-1.2L10 2Z M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  upload: "M12 16V3 m-5 5 5-5 5 5 M4 15v6h16v-6",
  file: "M14 2H5v20h14V7l-5-5Z M14 2v6h5 M8 12h8 M8 16h6",
  shield: "M12 3 3 7v5c0 5 9 9 9 9s9-4 9-9V7l-9-4Z m-4 9 3 3 5-6",
  compare: "M4 4h6v16H4z M14 4h6v16h-6z M7 8v4 M17 8v8",
  chart: "M4 3v17h17 M8 16v-5 M13 16V7 M18 16V4",
  settings: "M4 7h16 M4 17h16 M9 4v6 M15 14v6",
  book: "M4 4h6a3 3 0 0 1 3 3v14a4 4 0 0 0-4-2H4z M13 7a3 3 0 0 1 3-3h5v15h-4a4 4 0 0 0-4 2",
  clock: "M12 8v5l3 2 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
  download: "M12 3v12 m-5-5 5 5 5-5 M4 16v5h16v-5",
  check: "m5 12 4 4L19 6",
  grid: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  chat: "M21 11a8 8 0 0 1-8 8H7l-5 3 2-6a8 8 0 1 1 17-5Z M8 10h8 M8 14h5",
  plus: "M12 5v14 M5 12h14",
  chevron: "m6 9 6 6 6-6",
  arrow: "M5 12h14 M13 6l6 6-6 6",
  copy: "M9 9h11v12H9z M15 9V3H3v12h6",
  menu: "M4 6h16 M4 12h16 M4 18h16",
  close: "m6 6 12 12 M6 18 18 6",
  send: "m3 3 18 9-18 9 4-9-4-9 M7 12h14",
  spark: "m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z",
} as const;

export function Icon({ name }: { name: keyof typeof paths }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  );
}
