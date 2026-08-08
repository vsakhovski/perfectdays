import { useContext } from 'react';

import { VaultContext, type VaultContextValue } from './vault-context';

export function useVault(): VaultContextValue {
  const context = useContext(VaultContext);

  if (!context) {
    throw new Error('useVault must be used inside VaultProvider.');
  }

  return context;
}
