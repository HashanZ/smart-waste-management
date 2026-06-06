import React from 'react';
import { motion } from 'framer-motion';
import { pageTransition } from '../utils/animations';

interface PageTransitionProps {
  children: React.ReactNode;
}

/**
 * Page Transition Wrapper
 * Provides smooth page transitions for route changes
 */
export const PageTransition: React.FC<PageTransitionProps> = ({ children }) => {
  return (
    <motion.div
      initial={pageTransition.initial}
      animate={pageTransition.animate}
      exit={pageTransition.exit}
      transition={pageTransition.transition}
    >
      {children}
    </motion.div>
  );
};











