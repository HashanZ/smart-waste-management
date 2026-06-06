import React from 'react';
import { XCircle, RefreshCw } from 'lucide-react';
import { Card, CardContent } from './Card';
import { Button } from './Button';

interface ErrorStateProps {
  title?: string;
  message: string | Error | unknown;
  onRetry?: () => void;
  retryLabel?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Failed to Load',
  message,
  onRetry,
  retryLabel = 'Try Again',
}) => {
  const errorMessage =
    message instanceof Error
      ? message.message
      : typeof message === 'string'
        ? message
        : 'Unknown error';

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <Card className="max-w-md w-full text-center">
        <CardContent className="p-8">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-red-100 rounded-full">
              <XCircle className="h-8 w-8 text-red-600" />
            </div>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
          <p className="text-gray-600 mb-4">{errorMessage}</p>
          {onRetry && (
            <Button onClick={onRetry} variant="primary">
              <RefreshCw className="h-4 w-4 mr-2" />
              {retryLabel}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
};


