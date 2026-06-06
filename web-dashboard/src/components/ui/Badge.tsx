import React, { HTMLAttributes, forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../utils/cn';

const badgeVariants = cva(
  "inline-flex items-center font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "bg-gray-100 text-gray-800 hover:bg-gray-200",
        primary: "bg-primary-100 text-primary-800 hover:bg-primary-200",
        success: "bg-green-100 text-green-800 hover:bg-green-200",
        warning: "bg-amber-100 text-amber-800 hover:bg-amber-200",
        danger: "bg-red-100 text-red-800 hover:bg-red-200",
        info: "bg-blue-100 text-blue-800 hover:bg-blue-200",
        outline: "border border-gray-300 text-gray-700 hover:bg-gray-50",
        // Status-specific
        active: "bg-green-100 text-green-700 border border-green-300",
        inactive: "bg-gray-100 text-gray-700 border border-gray-300",
        pending: "bg-yellow-100 text-yellow-700 border border-yellow-300",
        completed: "bg-blue-100 text-blue-700 border border-blue-300",
      },
      size: {
        sm: "px-2 py-0.5 text-xs rounded-md",
        md: "px-2.5 py-0.5 text-sm rounded-md",
        lg: "px-3 py-1 text-base rounded-lg",
      },
      withDot: {
        true: "",
        false: "",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
      withDot: false,
    },
  }
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dotColor?: string;
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, size, withDot, dotColor, children, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(badgeVariants({ variant, size, className }))}
        {...props}
      >
        {withDot && (
          <span
            className={cn("mr-1.5 h-2 w-2 rounded-full", dotColor || "bg-current")}
            aria-hidden="true"
          />
        )}
        {children}
      </span>
    );
  }
);

Badge.displayName = "Badge";

// Status Badge Helpers
export const StatusBadge: React.FC<{ status: string; size?: "sm" | "md" | "lg" }> = ({ status, size = "md" }) => {
  const variantMap: Record<string, any> = {
    active: "active",
    inactive: "inactive",
    pending: "pending",
    scheduled: "pending",
    completed: "completed",
    in_progress: "info",
    cancelled: "danger",
    overflowing: "danger",
    maintenance: "warning",
    full: "danger",
  };

  return (
    <Badge variant={variantMap[status] || "default"} size={size} withDot>
      {status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
    </Badge>
  );
};











