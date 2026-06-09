import { createRoot } from 'react-dom/client';
import App from '@/App';
import { initRayfinClient } from '@/services/rayfinClient';

import './main.css';

initRayfinClient();

createRoot(document.getElementById('root')!).render(<App />);
