import { RepositoryProvider } from './data/RepositoryProvider';
import Checkout from './screens/Checkout/Checkout';

export default function App() {
  return (
    <RepositoryProvider>
      <Checkout />
    </RepositoryProvider>
  );
}
