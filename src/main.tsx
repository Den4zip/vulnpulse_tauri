import React from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

function App() {
  return <main><div className="brand">Vuln<span>Pulse</span></div><section><p className="eyebrow">ЛОКАЛЬНОЕ ПРИЛОЖЕНИЕ</p><h1>Управление уязвимостями</h1><p>Рабочая основа приложения создаётся. Каталог, проекты и анализ будут доступны на следующих этапах.</p><div className="notice"><strong>Начало разработки</strong><br />Сейчас приложение не хранит и не обрабатывает данные проектов.</div></section><footer>Дизайн вдохновлён Mint от Ali · CC BY 4.0 · figma.com/community/file/1244293267600418871</footer></main>;
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
