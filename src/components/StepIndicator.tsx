import React from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { MLStep } from '../types';

interface StepIndicatorProps {
  steps: MLStep[];
  onStepClick: (stepId: number) => void;
}

export const StepIndicator: React.FC<StepIndicatorProps> = ({ steps, onStepClick }) => {
  return (
    <div className="flex items-center justify-center mb-8 overflow-x-auto pb-4">
      <div className="flex items-center gap-4">
        {steps.map((step, index) => (
          <React.Fragment key={step.id}>
            <motion.div
              className="relative flex flex-col items-center cursor-pointer group"
              onClick={() => onStepClick(step.id)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <motion.div
                className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                  step.completed
                    ? 'bg-green-500 border-green-500 shadow-lg shadow-green-500/30'
                    : step.active
                    ? 'bg-orange-500 border-orange-500 shadow-lg shadow-orange-500/30'
                    : 'bg-gray-700 border-gray-600 hover:border-gray-500'
                }`}
                animate={{
                  boxShadow: step.active
                    ? '0 0 20px rgba(251, 146, 60, 0.5)' // orange glow
                    : step.completed
                    ? '0 0 20px rgba(34, 197, 94, 0.5)' // green glow
                    : '0 0 0px rgba(0, 0, 0, 0)'
                }}
              >
                {step.completed ? (
                  <Check className="w-6 h-6 text-white" />
                ) : (
                  <span
                    className={`text-sm font-bold ${
                      step.active ? 'text-white' : 'text-gray-400'
                    }`}
                  >
                    {step.id}
                  </span>
                )}
              </motion.div>

              <motion.span
                className={`mt-2 text-xs font-medium text-center max-w-20 transition-colors ${
                  step.active ? 'text-orange-400' : step.completed ? 'text-green-400' : 'text-gray-500'
                }`}
                animate={{
                  color: step.active
                    ? '#fb923c' // text-orange-400
                    : step.completed
                    ? '#4ade80' // text-green-400
                    : '#6b7280' // text-gray-500
                }}
              >
                {step.name}
              </motion.span>
            </motion.div>

            {index < steps.length - 1 && (
              <motion.div
                className={`w-8 h-0.5 transition-colors duration-300 ${
                  step.completed ? 'bg-green-500' : 'bg-gray-600'
                }`}
                animate={{
                  backgroundColor: step.completed ? '#22c55e' : '#4b5563'
                }}
              />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};
