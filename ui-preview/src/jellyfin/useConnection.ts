import { useContext } from 'react';
import { ConnectionContext } from './context';
export {errorMessage} from './errors';
export function useConnection() {
  const value = useContext(ConnectionContext);
  if (!value) throw new Error('ConnectionProvider is required');
  return value;
}
