import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { useLanguage, languages } from '../hooks/useLanguage';

export const LanguageSelector: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { currentLanguage, changeLanguage } = useLanguage();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentLang = languages.find(l => l.code === currentLanguage);

  const handleLanguageChange = (langCode: string) => {
    changeLanguage(langCode as any);
    setIsOpen(false);
  };

  // Dışarı tıklama (mousedown yerine pointerdown + composedPath ile daha sağlam)
  useEffect(() => {
    if (!isOpen) return;

    const onPointerDown = (ev: PointerEvent) => {
      const path = (ev.composedPath && ev.composedPath()) || [];
      if (
        dropdownRef.current &&
        (path as EventTarget[]).includes(dropdownRef.current)
      ) {
        // dropdown içi tıklama => kapatma yok
        return;
      }
      setIsOpen(false);
    };

    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [isOpen]);

  // ESC ile kapat
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen]);

  return (
    <div className="relative z-50" ref={dropdownRef}>
      <motion.button
        type="button"
        onClick={() => setIsOpen((s) => !s)}
        className="flex items-center gap-2 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg hover:border-cyan-400 transition-colors min-w-[120px] relative"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="text-white text-sm font-medium">
          {currentLang?.name || 'English'}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-gray-400 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full right-0 mt-2 bg-gray-800 border border-gray-700 rounded-lg shadow-xl min-w-[160px] overflow-hidden"
            role="listbox"
          >
            {languages.map((lang) => (
              <motion.button
                type="button"
                key={lang.code}
                // onClick yerine onMouseDown: dışarı tıklama dinleyicisinden önce çalışır
                onMouseDown={(e) => {
                  e.preventDefault(); // focus/blur karmaşasını engelle
                  handleLanguageChange(lang.code);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-700 transition-colors ${
                  currentLanguage === lang.code ? 'bg-cyan-900/30 text-cyan-400' : 'text-white'
                }`}
                whileHover={{ x: 4 }}
                transition={{ duration: 0.1 }}
                role="option"
                aria-selected={currentLanguage === lang.code}
              >
                <span className="text-sm font-medium">{lang.name}</span>
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
