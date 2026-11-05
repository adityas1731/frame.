import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './styles/tokens.css';
import './styles/app.css';
import './styles/typography.css';
import './styles/connection.css';
import './styles/layouts.css';

createRoot(document.getElementById('root')!).render(<StrictMode>
<App/>
</StrictMode>);
import './styles/studio.css';
import './styles/cinematic.css';
import './styles/cinematic-refinements.css';

import './styles/appearance.css';
import './styles/mobile-media.css';
import './styles/title-details.css';
import './styles/episode-motion.css';
import './styles/home-refinement.css';
import './styles/controls.css';

import './styles/watchlist.css';
import './styles/artwork-interactions.css';
import './styles/title-tags.css';
