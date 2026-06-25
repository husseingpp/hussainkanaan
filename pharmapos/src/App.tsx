import { RepositoryProvider } from './data/RepositoryProvider';
import { AppShell } from './screens/AppShell';

export default function App() {
  return (
    <RepositoryProvider>
      <AppShell />
    </RepositoryProvider>
  );
}
