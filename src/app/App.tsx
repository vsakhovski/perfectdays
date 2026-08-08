import { HomePage } from '../features/home/HomePage';
import styles from './App.module.css';

export function App() {
  return (
    <div className={styles['app']}>
      <HomePage />
    </div>
  );
}
