/// <reference types="vite/client" />
import {
  ArrowRight, Database, FileSearch, House, Info, Layers3, LayoutDashboard, Network,
  Plug, Settings, ShieldCheck,
} from 'lucide-react';
import { StrictMode, useLayoutEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CatalogView } from './catalog-view';
import { Badge, Button, Dialog } from './ui';
import uiNotices from '../docs/ui-notices.txt?raw';
import './style.css';

type Screen = 'home' | 'catalog';

const upcoming = [
  { label: 'Обзор', icon: LayoutDashboard },
  { label: 'Активы и ПО', icon: Layers3 },
  { label: 'Архитектура', icon: Network },
  { label: 'Источники', icon: Plug },
  { label: 'Настройки', icon: Settings },
];

function WelcomeHub({ openCatalog }: { openCatalog: () => void }) {
  return (
    <div className="workspace welcome">
      <header className="workspace-heading">
        <div>
          <h1 tabIndex={-1}>Начало работы</h1>
          <p>Выберите рабочее пространство VulnPulse.</p>
        </div>
      </header>
      <section className="panel welcome-panel" aria-labelledby="demo-heading">
        <div className="welcome-description">
          <Badge tone="accent">Демо</Badge>
          <h2 id="demo-heading">Локальный каталог</h2>
          <p>Попробуйте поиск и фильтры, затем откройте карточку, чтобы увидеть оценку и исходные записи. Каталог использует вымышленные данные и работает офлайн.</p>
          <Button variant="primary" onClick={openCatalog}>Открыть демо <ArrowRight aria-hidden="true" /></Button>
        </div>
        <div className="welcome-icon" aria-hidden="true"><Database /></div>
      </section>
    </div>
  );
}

function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [about, setAbout] = useState(false);
  const main = useRef<HTMLElement>(null);
  const aboutTrigger = useRef<HTMLButtonElement>(null);
  const previousScreen = useRef(screen);

  useLayoutEffect(() => {
    if (previousScreen.current === screen) return;
    previousScreen.current = screen;
    main.current?.querySelector('h1')?.focus();
  }, [screen]);

  function closeAbout() {
    setAbout(false);
    requestAnimationFrame(() => aboutTrigger.current?.focus());
  }

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Боковая панель">
        <div className="brand">
          <span className="brand-icon"><ShieldCheck aria-hidden="true" /></span>
          <strong>Vuln<span>Pulse</span></strong>
        </div>

        <nav aria-label="Рабочее пространство" className="main-nav">
          <Button variant="ghost" className="nav-item" aria-label="Начало работы" title="Начало работы"
            aria-current={screen === 'home' ? 'page' : undefined} onClick={() => setScreen('home')}>
            <House aria-hidden="true" /><span>Начало работы</span>
          </Button>
          <Button variant="ghost" className="nav-item" aria-label="Каталог" title="Каталог"
            aria-current={screen === 'catalog' ? 'page' : undefined} onClick={() => setScreen('catalog')}>
            <FileSearch aria-hidden="true" /><span>Каталог</span>
          </Button>
          <div className="nav-upcoming">
            {upcoming.map(({ label, icon: Icon }) => (
              <Button key={label} variant="ghost" className="nav-item" disabled
                aria-label={label + ', в разработке'} title={label + ' · В разработке'}>
                <Icon aria-hidden="true" /><span>{label}</span>
              </Button>
            ))}
          </div>
        </nav>

        <div className="sidebar-footer">
          <div className="storage-indicator" title="Локальная база">
            <Database aria-hidden="true" />
            <div><strong>Локальная база</strong><span>На этом устройстве</span></div>
          </div>
          <Button variant="ghost" className="nav-item about-button" aria-label="О дизайне" aria-haspopup="dialog"
            title="О дизайне" ref={aboutTrigger} onClick={() => setAbout(true)}>
            <Info aria-hidden="true" /><span>О дизайне</span>
          </Button>
        </div>
      </aside>

      <div className="app-content">
        <div className="topbar">
          <div className="breadcrumb" aria-hidden="true"><span>VulnPulse</span><span>/</span><strong>{screen === 'home' ? 'Начало работы' : 'Каталог'}</strong></div>
          <span className="offline"><span aria-hidden="true" />Офлайн</span>
        </div>
        <main ref={main}>
          {screen === 'home' ? <WelcomeHub openCatalog={() => setScreen('catalog')} /> : <CatalogView />}
        </main>
        {screen === 'catalog' && <footer className="workspace-footer">Даты записей показаны в UTC</footer>}
      </div>

      {about && (
        <Dialog labelId="about-heading" onDismiss={closeAbout}>
          <h2 id="about-heading">О дизайне</h2>
          <p>Рабочее пространство VulnPulse адаптирует Mint — Free Admin Dashboard UI Kit от Ali (@malik_ali), CC BY 4.0.</p>
          <p className="attribution-url" aria-label="Адрес исходного набора">figma.com/community/file/1244293267600418871</p>
          <p>Компоненты Button и Badge адаптированы из shadcn/ui. Значки — Lucide.</p>
          <details className="license-details">
            <summary>Лицензии компонентов</summary>
            <pre>{uiNotices}</pre>
          </details>
        </Dialog>
      )}
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
