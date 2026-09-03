import { useContext } from 'react';

import { AppNavigationContext } from './app-navigation-context';
import type { AppNavigationValue } from './app-navigation-types';

export function useAppNavigation(): AppNavigationValue {
  const context = useContext(AppNavigationContext);

  if (context === null) {
    throw new Error('useAppNavigation must be used within AppNavigationProvider.');
  }

  return context;
}
