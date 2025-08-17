import React, { useEffect, useState } from 'react';

export default function ThemeToggle() {
  const [theme, setTheme] = useState('calm');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('theme');
      if (saved === 'warm') {
        setTheme('warm');
      } else {
        setTheme('calm');
      }
    } catch (e) {
      // ignore
    }
  }, []);

  const toggle = () => {
    try {
      if (theme === 'calm') {
        localStorage.setItem('theme', 'warm');
        document.documentElement.classList.add('theme-warm');
        setTheme('warm');
      } else {
        localStorage.setItem('theme', 'calm');
        document.documentElement.classList.remove('theme-warm');
        setTheme('calm');
      }
    } catch (e) {
      // ignore
    }
  };

  return (
    <button
      onClick={toggle}
      title="Toggle theme"
      className="bg-white/20 hover:bg-white/30 backdrop-blur-sm px-3 py-2 rounded-xl transition-all duration-300 font-medium shadow-lg border border-white/30"
    >
      {theme === 'calm' ? 'Calm' : 'Warm'}
    </button>
  );
}
