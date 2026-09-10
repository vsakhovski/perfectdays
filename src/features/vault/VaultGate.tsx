import { useEffect, useState } from 'react';

import { useAppNavigation } from '../../app/navigation/use-app-navigation';
import { useVault } from '../../app/vault/use-vault';
import { HomePage } from '../home/HomePage';
import { StartupSplash } from '../onboarding/StartupSplash';
import { LockScreen } from './LockScreen';
import { VaultStatusScreen } from './VaultStatusScreen';

export function VaultGate() {
  const { resetNotice, snapshot, synchronizing, unavailable } = useVault();
  const { reset, route } = useAppNavigation();
  const [startup, setStartup] = useState<'pending' | 'showing' | 'done'>('pending');
  const ready =
    !synchronizing &&
    !unavailable &&
    (snapshot.phase === 'locked' || snapshot.phase === 'unlocked');

  if (ready && startup === 'pending') {
    // Decide only once per app mount, not after onboarding, navigation, or auto-lock.
    setStartup('showing');
  }

  useEffect(() => {
    if (startup !== 'showing') return;
    const timer = window.setTimeout(() => {
      setStartup('done');
    }, 3000);
    return () => {
      window.clearTimeout(timer);
    };
  }, [startup]);

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

  if (startup === 'showing' || (startup === 'pending' && ready)) {
    return <StartupSplash />;
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
