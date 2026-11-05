import {SettingsSection, Field} from './SettingsSection';
import {SettingsSelect as Select} from './Select';
import {Toggle} from './Primitives';
import {headingCase} from './headingCase';
import {useStudio} from '../studio/context';
import {usePreview, type Preferences} from '../state/PreviewContext';

export function LayoutSettings() {
  const {config, update} = useStudio();
  const {preferences: p, setPreference: set} = usePreview();

  return (
    <SettingsSection id="layout-heading" title="Layout & Navigation">
      <div className="studio-panel">
        <div className="studio-fields">
          <Field label="Layout density">
            <Select value={p.density} onValueChange={value => {
              set('density', value as Preferences['density']);
              update({...config, appearance: {...config.appearance, spacing: value === 'compact' ? 13 : 20}});
            }}>
              <option value="comfortable">Comfortable</option>
              <option value="compact">Compact</option>
            </Select>
          </Field>
          <Field label="Poster size">
            <Select value={p.posterSize} onValueChange={value => {
              set('posterSize', value as Preferences['posterSize']);
              update({...config, appearance: {...config.appearance, poster: ({small: 144, medium: 206, large: 246})[value as Preferences['posterSize']]}});
            }}>
              {['small', 'medium', 'large'].map(value => <option key={value}>{value}</option>)}
            </Select>
          </Field>
          <Field label="Sidebar">
            <Select value={p.navigation} onValueChange={value => set('navigation', value as Preferences['navigation'])}>
              <option value="compact">Compact</option>
              <option value="expanded">Expanded</option>
            </Select>
          </Field>
        </div>
        {([
          {key: 'showTitles', label: 'Show title labels'},
          {key: 'showRatings', label: 'Show ratings'},
          {key: 'heroAutoAdvance', label: 'Rotate featured stories every six seconds'},
          {key: 'reducedMotion', label: 'Gentler motion'},
        ] as const).map(({key, label}) => (
          <div className="studio-toggle-row" key={key}>
            <div>
              <strong>{headingCase(label)}</strong>
              {key === 'heroAutoAdvance' && <p>Pauses for keyboard navigation and hidden tabs. Hovering keeps the banner moving.</p>}
              {key === 'reducedMotion' && <p>Stops automatic slides and reduces transitions.</p>}
            </div>
            <Toggle label={label} checked={p[key]} onChange={value => set(key, value)}/>
          </div>
        ))}
      </div>
    </SettingsSection>
  );
}
