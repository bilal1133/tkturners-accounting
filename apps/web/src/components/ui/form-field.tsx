import { ReactNode } from 'react';

type FieldProps = {
  label: string;
  children: ReactNode;
  hint?: string;
  error?: string;
};

export function FormField({ label, children, hint, error }: FieldProps) {
  return (
    <label className="form-field">
      <span className="form-field-label">{label}</span>
      {children}
      {hint ? <small className="form-field-hint">{hint}</small> : null}
      {error ? <small className="form-field-error">{error}</small> : null}
    </label>
  );
}

type FormActionsProps = {
  children: ReactNode;
};

export function FormActions({ children }: FormActionsProps) {
  return <div className="form-actions">{children}</div>;
}
