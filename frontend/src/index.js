import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './styles/modern-chat.css';
import App from './App';

// Apply saved theme early so there's no flash
const savedTheme = localStorage.getItem('theme') || 'light';
if (savedTheme === 'dark') {
	document.documentElement.classList.add('dark-theme');
}

const container = document.getElementById('root');
const root = createRoot(container);
root.render(<App/>);
