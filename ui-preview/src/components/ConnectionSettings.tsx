import {Link} from 'react-router';
import {SettingsSection} from './SettingsSection';
import {Toggle} from './Primitives';
import {useConnection} from '../jellyfin/useConnection';

export function ConnectionSettings() {
  const {session, remembered, rememberCurrent} = useConnection();

  return (
    <SettingsSection id="connection-heading" title="Server Connection">
      <div className="studio-panel studio-toggle-row">
        <div>
          <strong>{session ? `Connected as ${session.user.Name}` : 'Explore Your Own Collection'}</strong>
          <p className="studio-footnote">
            {session
              ? 'Browse your library and manage watched history. Your server controls access.'
              : 'Mock mode · fictional media and original artwork.'}
          </p>
        </div>
        <Link className="button secondary" to="/connect">
          {session ? 'Manage Connection' : 'Connect To Jellyfin'}
        </Link>
      </div>
      {session && (
        <div className="studio-panel studio-toggle-row">
          <div>
            <strong>Remember Me On This Device</strong>
            <p className="studio-footnote">Restore this Jellyfin session after reloads and browser restarts. Stores a script-readable token locally, never your password.</p>
          </div>
          <Toggle label="Remember me on this device" checked={remembered} onChange={rememberCurrent}/>
        </div>
      )}
    </SettingsSection>
  );
}
