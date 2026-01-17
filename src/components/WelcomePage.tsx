// src/components/WelcomePage.tsx
import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Sparkles, Zap, Target } from 'lucide-react';
import { Logo } from './Logo';
import { LanguageSelector } from './LanguageSelector';
import { useLanguage } from '../hooks/useLanguage';
import { NeuralNetwork } from './NeuralNetwork';

interface WelcomePageProps {
  onGetStarted: () => void;
}

export const WelcomePage: React.FC<WelcomePageProps> = ({ onGetStarted }) => {
  const { t, isLoaded } = useLanguage();

  // Dil yüklenene kadar flash'ı engelle
  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-gray-950 to-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-400"></div>
      </div>
    );
  }

  const features = [
    {
      icon: Sparkles,
      title: t('noCodeRequired'),
      description: t('noCodeDescription'),
    },
    {
      icon: Zap,
      title: t('lightningFast'),
      description: t('lightningFastDescription'),
    },
    {
      icon: Target,
      title: t('productionReady'),
      description: t('productionReadyDescription'),
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-950 to-black relative overflow-hidden">
      {/* Neural Network Background (tıklamayı engellemesin) */}
      <div className="pointer-events-none">
        <NeuralNetwork className="opacity-60" />
      </div>

      {/* Animated background (tıklamayı engellemesin) */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-orange-500/8 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-amber-500/6 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-orange-400/5 rounded-full blur-2xl animate-pulse delay-500"></div>
      </div>

      {/* Header */}
      <header className="relative z-30 flex justify-between items-center p-6">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-3"
          whileHover={{ scale: 1.05 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
          <Logo className="w-10 h-10 drop-shadow-lg" />
          <span className="text-2xl font-bold text-white drop-shadow-lg">GroveML</span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          whileHover={{ scale: 1.05 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
          <LanguageSelector />
        </motion.div>
      </header>

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-[calc(100vh-120px)] px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center max-w-4xl mx-auto"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mb-8"
            whileHover={{
              scale: 1.1,
              rotate: [0, -5, 5, 0],
              transition: { duration: 0.6, type: 'spring', stiffness: 300 },
            }}
          >
            <Logo className="w-24 h-24 mx-auto mb-6 drop-shadow-2xl filter drop-shadow-[0_0_15px_rgba(251,146,60,0.3)]" />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="text-5xl md:text-7xl font-bold text-white mb-6 drop-shadow-lg"
            whileHover={{
              scale: 1.02,
              textShadow: '0 0 20px rgba(251,146,60,0.5)',
              transition: { duration: 0.3 },
            }}
          >
            {t('welcome')}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="text-xl md:text-2xl text-gray-300 mb-12 leading-relaxed drop-shadow-sm"
          >
            {t('subtitle')}
          </motion.p>

          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            onClick={onGetStarted}
            className="group relative px-8 py-4 bg-gradient-to-r from-orange-500 to-amber-600 text-white font-semibold text-lg shadow-2xl overflow-hidden"
            style={{
              borderRadius: '12px',
              boxShadow:
                '0 0 30px rgba(251,146,60,0.3), inset 0 1px 0 rgba(255,255,255,0.2)',
            }}
            whileHover={{
              scale: 1.08,
              y: -3,
              boxShadow:
                '0 0 50px rgba(251,146,60,0.6), 0 20px 40px rgba(0,0,0,0.3)',
              transition: { duration: 0.3, type: 'spring', stiffness: 300 },
            }}
            whileTap={{ scale: 0.95 }}
          >
            <motion.span
              className="flex items-center gap-3 relative z-10"
              whileHover={{ x: 2 }}
              transition={{ duration: 0.2 }}
            >
              {t('getStarted')}
              <ArrowRight className="w-5 h-5 group-hover:translate-x-2 group-hover:scale-110 transition-all duration-300" />
            </motion.span>

            {/* Neon border effect */}
            <div
              className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
              style={{
                background:
                  'linear-gradient(45deg, transparent, rgba(251,146,60,0.3), transparent)',
                filter: 'blur(1px)',
              }}
            />

            {/* Animated glow */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-orange-400 to-amber-500 rounded-xl blur-lg opacity-0 group-hover:opacity-40 transition-opacity duration-500 -z-10 pointer-events-none"
              animate={{
                scale: [1, 1.1, 1],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
          </motion.button>
        </motion.div>

        {/* Features */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="grid md:grid-cols-3 gap-8 mt-20 max-w-4xl mx-auto"
        >
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.7 + index * 0.1 }}
              className="text-center p-6 bg-gray-900/70 backdrop-blur-sm border border-gray-800 relative overflow-hidden group cursor-pointer"
              style={{
                borderRadius: '16px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
              }}
              whileHover={{
                y: -8,
                scale: 1.03,
                boxShadow:
                  '0 0 40px rgba(251,146,60,0.2), 0 20px 40px rgba(0,0,0,0.3)',
                transition: { duration: 0.4, type: 'spring', stiffness: 300 },
              }}
            >
              {/* Neon border effect */}
              <div
                className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                style={{
                  background:
                    'linear-gradient(45deg, transparent, rgba(251,146,60,0.2), transparent)',
                  padding: '1px',
                }}
              >
                <div className="w-full h-full bg-gray-900/90 rounded-2xl"></div>
              </div>

              <div className="relative z-10">
                <motion.div
                  className="inline-flex p-3 bg-gradient-to-br from-orange-500/20 to-amber-600/20 rounded-lg mb-4"
                  whileHover={{
                    scale: 1.2,
                    rotate: [0, -10, 10, 0],
                    boxShadow: '0 0 20px rgba(251,146,60,0.4)',
                    transition: { duration: 0.5 },
                  }}
                >
                  <feature.icon className="w-6 h-6 text-orange-400" />
                </motion.div>

                <motion.h3
                  className="text-xl font-semibold text-white mb-2"
                  whileHover={{
                    color: '#fb923c',
                    transition: { duration: 0.2 },
                  }}
                >
                  {feature.title}
                </motion.h3>

                <p className="text-gray-400 group-hover:text-gray-300 transition-colors duration-300">
                  {feature.description}
                </p>
              </div>

              {/* Animated background glow */}
              <motion.div
                className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-amber-600/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                animate={{
                  background: [
                    'radial-gradient(circle at 0% 0%, rgba(251,146,60,0.05), transparent)',
                    'radial-gradient(circle at 100% 100%, rgba(251,146,60,0.05), transparent)',
                    'radial-gradient(circle at 0% 0%, rgba(251,146,60,0.05), transparent)',
                  ],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  );
};
