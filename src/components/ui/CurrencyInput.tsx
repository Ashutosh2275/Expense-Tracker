import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface CurrencyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label?: string;
  error?: string;
  currencySymbol?: string;
  value: number | string;
  onChange: (value: number) => void;
}

export const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  (
    {
      className,
      label,
      error,
      currencySymbol = '₹',
      value,
      onChange,
      id,
      ...props
    },
    ref
  ) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const rawVal = e.target.value.replace(/[^0-9.]/g, '');
      // Prevent multiple decimal points
      const parts = rawVal.split('.');
      const sanitized = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : rawVal;
      const num = parseFloat(sanitized);
      onChange(isNaN(num) ? 0 : num);
    };

    const displayValue = value === 0 || value === '0' ? '' : value;

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
            {label}
          </label>
        )}
        <div className="relative rounded-xl shadow-sm">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
            <span className="text-slate-500 font-semibold text-base">{currencySymbol}</span>
          </div>
          <input
            ref={ref}
            id={inputId}
            type="text"
            inputMode="decimal"
            pattern="[0-9]*"
            value={displayValue}
            onChange={handleChange}
            placeholder="0"
            className={twMerge(
              clsx(
                'w-full pl-8 pr-3.5 py-2.5 text-slate-900 bg-white border border-slate-300 rounded-xl text-lg font-semibold placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all min-h-[48px]',
                error && 'border-rose-500 focus:ring-rose-500 bg-rose-50/20',
                className
              )
            )}
            {...props}
          />
        </div>
        {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}
      </div>
    );
  }
);

CurrencyInput.displayName = 'CurrencyInput';
