export interface AppLogoProps {
  readonly animated?: boolean;
  readonly className?: string | undefined;
}

export function AppLogo({ className, animated = false }: AppLogoProps) {
  return (
    <img
      alt=""
      aria-hidden="true"
      className={className}
      src={animated ? '/icons/app-icon-animated.svg' : '/icons/app-icon.svg'}
    />
  );
}
