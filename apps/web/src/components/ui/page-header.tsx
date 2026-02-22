import { ReactNode } from 'react';

type PageHeaderProps = {
  badge: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
};

export function PageHeader({ badge, title, subtitle, actions }: PageHeaderProps) {
  return (
    <header className="page-head">
      <div>
        <p className="badge">{badge}</p>
        <h2>{title}</h2>
        {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </header>
  );
}
