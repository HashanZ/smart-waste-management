import React from 'react';

interface NotificationToggleProps {
  title: string;
  description: string;
  checked: boolean;
  onChange: () => void;
}

export const NotificationToggle: React.FC<NotificationToggleProps> = ({
  title,
  description,
  checked,
  onChange,
}) => {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h4 className="text-sm font-medium text-gray-900">{title}</h4>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
      />
    </div>
  );
};


