import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { config } from './config';
import { rootErrorHandler, startErrorTracking } from './errors/tracking';
import './index.css';

// трекер — до рендера: ошибки запуска (пустая карта, WebGL) самые важные (design add-error-tracking)
startErrorTracking(config.sentryDsn);
const onError = rootErrorHandler();

createRoot(document.getElementById('root') as HTMLElement, {
    onUncaughtError: onError,
    onRecoverableError: onError,
}).render(
    <StrictMode>
        <App />
    </StrictMode>,
);
