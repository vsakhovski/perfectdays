export type AppOnboardingStep =
  'splash' | 'introduction' | 'history' | 'fallbacks' | 'orange' | 'pin';

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

export interface LeaveAppCopy {
  readonly title: string;
  readonly description: string;
  readonly stay: string;
  readonly leave: string;
}
