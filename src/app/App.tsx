import { VaultGate } from '../features/vault/VaultGate';
import styles from './App.module.css';

export function App() {
  return (
    <div className={styles['app']}>
      <VaultGate />
    </div>
  );
}
