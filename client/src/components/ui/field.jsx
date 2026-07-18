import * as React from 'react';

import { cn } from '@/lib/utils';
import { Label } from './label';

/**
 * Wraps a labelled control with its error message and wires up accessibility:
 * the label points at the control, and the error is linked via aria-describedby
 * so screen readers announce it (spec section 22: accessible form labels).
 */
export function Field({ id, label, error, hint, required, children, className }) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  const control = React.isValidElement(children)
    ? React.cloneElement(children, {
        id,
        'aria-invalid': error ? 'true' : undefined,
        'aria-describedby': describedBy,
      })
    : children;

  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <Label htmlFor={id}>
          {label}
          {required && <span className="ml-0.5 text-destructive">*</span>}
        </Label>
      )}
      {control}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
