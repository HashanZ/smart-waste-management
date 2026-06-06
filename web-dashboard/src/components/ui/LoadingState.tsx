import React from 'react';
import { SkeletonCard } from './LoadingSpinner';

interface LoadingStateProps {
  showHeader?: boolean;
  statCards?: number;
  contentCards?: number;
  contentGridCols?: 1 | 2;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  showHeader = true,
  statCards = 4,
  contentCards = 3,
  contentGridCols = 1,
}) => {
  return (
    <div className="space-y-6">
      {showHeader && (
        <div className="h-32 bg-gradient-eco rounded-2xl p-8 shimmer" />
      )}
      <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-${statCards} gap-6`}>
        {Array.from({ length: statCards }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
      <div className={`grid grid-cols-1 ${contentGridCols === 2 ? 'lg:grid-cols-2' : ''} gap-6`}>
        {Array.from({ length: contentCards }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  );
};


