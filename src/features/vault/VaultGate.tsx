import { useVault } from '../../app/vault/use-vault';
import { HomePage } from '../home/HomePage';
import { LockScreen } from './LockScreen';
import { VaultStatusScreen } from './VaultStatusScreen';

export function VaultGate() {
  const { resetNotice, snapshot, synchronizing, unavailable } = useVault();

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
