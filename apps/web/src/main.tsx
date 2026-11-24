import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'antd/dist/reset.css';
// Tipografia da marca auto-hospedada (change `identidade-visual-isetes`,
// design.md D5): servida pela mesma origem da aplicação, nunca pelo CDN de
// terceiro — a API serve a SPA sem CDN separado, e um domínio externo no
// caminho crítico seria a única dependência de terceiro em runtime desta
// aplicação. Importados apenas o subconjunto **latino** e os pesos 400/600
// efetivamente usados (`fontWeightStrong` do design system é 600).
import '@fontsource/lexend/latin-400.css';
import '@fontsource/lexend/latin-600.css';
import '@fontsource/source-sans-3/latin-400.css';
import '@fontsource/source-sans-3/latin-600.css';
import { App } from './app/App';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('#root element not found');

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
