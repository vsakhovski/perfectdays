export function PrivacyActionIcon({
  kind,
}: {
  readonly kind: 'download' | 'restore' | 'file' | 'lock' | 'delete' | 'cancel';
}) {
  const paths = {
    download: 'M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5',
    restore: 'M12 16V4m-4 4 4-4 4 4M4 16v5h16v-5',
    file: 'M14 3H5v18h14V8l-5-5v5h5M8 12h8M8 16h6',
    lock: 'M7 10V7a5 5 0 0 1 10 0v3M5 10h14v11H5zM12 14v3',
    delete: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7',
    cancel: 'm6 6 12 12M18 6 6 18',
  };
  return (
    <svg
      aria-hidden="true"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
    >
      <path d={paths[kind]} />
    </svg>
  );
}
