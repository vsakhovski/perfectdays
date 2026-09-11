export type AppOnboardingStep =
  'splash' | 'introduction' | 'history' | 'bleeding' | 'fallbacks' | 'orange' | 'pin';

export type AppRootDestination = 'calendar' | 'history' | 'privacy' | 'settings';

export type AppNavigationRoute =
  | { readonly kind: 'start' }
  | { readonly kind: 'onboarding'; readonly step: AppOnboardingStep }
  | { readonly kind: 'root'; readonly destination: AppRootDestination };

export interface AppNavigationValue {
  readonly navigate: (route: AppNavigationRoute) => void;
  readonly reset: (route: AppNavigationRoute) => void;
  readonly route: AppNavigationRoute;
}
