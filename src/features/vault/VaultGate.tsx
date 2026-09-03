import { useEffect } from 'react';

import { useAppNavigation } from '../../app/navigation/use-app-navigation';
import { useVault } from '../../app/vault/use-vault';
import { HomePage } from '../home/HomePage';
import { LockScreen } from './LockScreen';
import { VaultStatusScreen } from './VaultStatusScreen';

export function VaultGate() {
  const { resetNotice, snapshot, synchronizing, unavailable } = useVault();
  const { reset, route } = useAppNavigation();

  useEffect(() => {
    if (snapshot.phase !== 'unlocked' && route.kind !== 'start') {
      reset({ kind: 'start' });
    }
  }, [reset, route.kind, snapshot.phase]);

  if (synchronizing) {
    return <VaultStatusScreen />;
  }

  if (unavailable) {
    return (
      <VaultStatusScreen
        dataWasErased={resetNotice.startsWith('data-erased')}
        preferencesMayRemain={resetNotice.endsWith('preferences-retained')}
        unavailable
      />
    );
  }

  switch (snapshot.phase) {
    case 'unloaded':
    case 'empty':
      return <VaultStatusScreen />;
    case 'locked':
      return <LockScreen />;
    case 'unlocked':
      return <HomePage />;
  }
}
