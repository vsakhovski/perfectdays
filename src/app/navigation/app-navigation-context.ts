import { createContext } from 'react';

import type { AppNavigationValue } from './app-navigation-types';

export const AppNavigationContext = createContext<AppNavigationValue | null>(null);
