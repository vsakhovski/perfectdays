export interface AppLogoProps {
  readonly className?: string | undefined;
}

export function AppLogo({ className }: AppLogoProps) {
  return <img alt="" aria-hidden="true" className={className} src="/icons/app-icon.svg" />;
}
