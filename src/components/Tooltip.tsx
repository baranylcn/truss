import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Info } from 'lucide-react';

interface TooltipProps {
  title: string;
  description: string;
  className?: string;
}

export const Tooltip: React.FC<TooltipProps> = ({ title, description, className = "" }) => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className={`relative inline-block ${className}`}>
      <motion.button
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        className="p-1 text-gray-400 hover:text-cyan-400 transition-colors"
        whileHover={{ scale: 1.1 }}
      >
        <Info className="w-4 h-4" />
      </motion.button>

      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-50"
          >
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 shadow-xl max-w-xs">
              <div className="text-cyan-400 font-semibold text-sm mb-1">{title}</div>
              <div className="text-gray-300 text-xs leading-relaxed">{description}</div>
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800"></div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};