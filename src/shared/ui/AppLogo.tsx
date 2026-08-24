export interface AppLogoProps {
  readonly accentClassName?: string | undefined;
  readonly className?: string | undefined;
}

export function AppLogo({ accentClassName, className }: AppLogoProps) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 120 120">
      <rect height="104" rx="30" width="104" x="8" y="8" />
      <path d="M35 46h50M43 31v20m34-20v20M35 46v39h50V46" />
      <path
        className={accentClassName}
        d="M48 66c0-8 6-14 12-20 6 6 12 12 12 20a12 12 0 0 1-24 0Z"
      />
    </svg>
  );
}
