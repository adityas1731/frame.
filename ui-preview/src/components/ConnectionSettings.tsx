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
          <strong>{session ? `Connected as ${session.user.Name}` : 'Not Connected'}</strong>
          <p className="studio-footnote">
            {session
              ? 'Library access follows your Jellyfin account permissions.'
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
            <p className="studio-footnote">Stay signed in after closing the browser. This saves a token that site scripts can read, not your password. Turn it off on shared devices.</p>
          </div>
          <Toggle label="Remember me on this device" checked={remembered} onChange={rememberCurrent}/>
        </div>
      )}
    </SettingsSection>
  );
}
