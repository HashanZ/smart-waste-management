import React from 'react';
import { motion } from 'framer-motion';
import { RefreshCw } from 'lucide-react';
import { Button } from './Button';

interface PageHeaderProps {
  title: string;
  description: string;
  isConnected?: boolean;
  onRefresh?: () => void;
  stats?: Array<{
    label: string;
    value: string | number;
  }>;
  actions?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  isConnected,
  onRefresh,
  stats,
  actions,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="bg-gradient-eco rounded-2xl p-8 shadow-xl relative overflow-hidden"
    >
      <div className="absolute inset-0 opacity-10">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white blur-3xl" />
        <div className="absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-white blur-3xl" />
      </div>

      <div className="relative z-10">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-4xl font-heading font-bold text-white mb-2">
              {title}
            </h1>
            <p className="text-primary-100 text-lg">
              {description}
            </p>
          </div>

          <div className="flex items-center space-x-4">
            {isConnected !== undefined && (
              <div className="flex items-center space-x-2 bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2">
                <div
                  className={`h-2.5 w-2.5 rounded-full ${
                    isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'
                  }`}
                />
                <span className="text-white text-sm font-medium">
                  {isConnected ? 'Live' : 'Offline'}
                </span>
              </div>
            )}

            {onRefresh && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onRefresh}
                className="bg-white/10 hover:bg-white/20 text-white border-0"
              >
                <RefreshCw className="h-5 w-5" />
              </Button>
            )}

            {actions}
          </div>
        </div>

        {/* Stats Row */}
        {stats && stats.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            {stats.map((stat, index) => (
              <div key={index} className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                <p className="text-primary-100 text-sm mb-1">{stat.label}</p>
                <p className="text-2xl font-bold text-white">{stat.value}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
};


