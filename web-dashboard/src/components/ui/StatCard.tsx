import React from "react";
import { Card, CardHeader, CardContent } from "./Card";
import CountUp from "react-countup";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "../../utils/cn";

interface StatCardProps {
  title: string;
  value: number;
  change?: number;
  changeLabel?: string;
  icon?: React.ReactNode;
  variant?: "default" | "primary" | "success" | "warning" | "danger";
  isPercentage?: boolean;
  isAnimated?: boolean;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  change,
  changeLabel = "vs last period",
  icon,
  variant = "default",
  isPercentage = false,
  isAnimated = true,
  prefix = "",
  suffix = "",
  decimals = 0,
}) => {
  const variantClasses = {
    default: "bg-white border border-gray-200",
    primary:
      "bg-gradient-eco text-white shadow-xl border border-emerald-600/20",
    success:
      "bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-lg shadow-emerald-500/30",
    warning:
      "bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-lg shadow-amber-500/20",
    danger:
      "bg-gradient-to-br from-red-500 via-red-600 to-rose-700 text-white shadow-lg shadow-red-500/20",
  };

  const iconBgClasses = {
    default: "bg-gray-100 text-gray-600",
    primary: "bg-white/20 text-white",
    success: "bg-white/20 text-white",
    warning: "bg-white/20 text-white",
    danger: "bg-white/20 text-white",
  };

  const isPositiveChange = change !== undefined && change > 0;
  const isNegativeChange = change !== undefined && change < 0;
  const isNeutralChange = change !== undefined && change === 0;

  return (
    <Card
      className={cn(
        "overflow-hidden transition-all duration-300 h-full",
        variantClasses[variant],
        variant === "default"
          ? "bg-white border-2 border-gray-100 hover:border-emerald-300 hover:shadow-xl shadow-md"
          : "shadow-xl",
        "hover:scale-[1.02]",
      )}
      hoverable
    >
      <CardContent className="p-4 sm:p-5 h-full flex flex-col">
        <div className="flex items-center justify-between flex-1">
          <div className="flex-1 min-w-0">
            <p
              className={cn(
                "text-xs font-semibold mb-2 uppercase tracking-wider",
                variant === "default"
                  ? "text-gray-500"
                  : "text-white/90",
              )}
            >
              {title}
            </p>
            <div className="flex items-baseline space-x-2">
              <h3
                className={cn(
                  "text-2xl sm:text-3xl font-extrabold font-mono tabular-nums",
                  variant === "default"
                    ? "text-gray-900"
                    : "text-white",
                )}
              >
                {prefix}
                {isAnimated ? (
                  <CountUp
                    end={value}
                    decimals={decimals}
                    duration={1.5}
                    separator=","
                  />
                ) : (
                  value.toLocaleString()
                )}
                {suffix}
                {isPercentage && "%"}
              </h3>
            </div>

            {change !== undefined && (
              <div className="flex items-center mt-2 space-x-1.5">
                {isPositiveChange && (
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                )}
                {isNegativeChange && (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                )}
                {isNeutralChange && <Minus className="h-4 w-4 text-gray-400" />}
                <span
                  className={cn(
                    "text-sm font-semibold",
                    isPositiveChange && "text-emerald-600",
                    isNegativeChange && "text-red-600",
                    isNeutralChange && "text-gray-500",
                  )}
                >
                  {change > 0 && "+"}
                  {change.toFixed(1)}%
                </span>
                <span
                  className={cn(
                    "text-xs",
                    variant === "default"
                      ? "text-gray-500"
                      : "text-white/60",
                  )}
                >
                  {changeLabel}
                </span>
              </div>
            )}
          </div>

          {icon && (
            <div
              className={cn(
                "p-2.5 sm:p-3 rounded-xl transition-all duration-300",
                iconBgClasses[variant],
                variant === "default"
                  ? "bg-gradient-to-br from-emerald-50 to-green-50 text-emerald-600 shadow-sm"
                  : "",
                "group-hover:scale-110",
              )}
            >
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
