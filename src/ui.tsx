import { cva, type VariantProps } from 'class-variance-authority';
import { X } from 'lucide-react';
import { useLayoutEffect, useRef, type ComponentProps } from 'react';
import type { Severity } from './generated/contracts';

const buttonVariants = cva('button', {
  variants: { variant: { primary: 'button-primary', secondary: 'button-secondary', ghost: 'button-ghost' } },
  defaultVariants: { variant: 'secondary' },
});

type ButtonProps = ComponentProps<'button'> & VariantProps<typeof buttonVariants>;

export function Button({ className, variant, type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={buttonVariants({ variant, className })} {...props} />;
}

export function Input({ className = '', ...props }: ComponentProps<'input'>) {
  return <input className={`input ${className}`} {...props} />;
}

export function Select({ className = '', ...props }: ComponentProps<'select'>) {
  return <select className={`input select ${className}`} {...props} />;
}

export function Table(props: ComponentProps<'table'>) {
  return <table className="data-table" {...props} />;
}

const badgeVariants = cva('badge', {
  variants: {
    tone: {
      critical: 'severity-critical', high: 'severity-high', medium: 'severity-medium',
      low: 'severity-low', none: 'severity-none', unknown: 'severity-unknown', accent: 'badge-accent',
    },
  },
  defaultVariants: { tone: 'unknown' },
});

export function Badge({ tone, children }: VariantProps<typeof badgeVariants> & Pick<ComponentProps<'span'>, 'children'>) {
  return <span className={badgeVariants({ tone })}>{children}</span>;
}

export const severityLabels: Record<Severity, string> = {
  critical: 'Критическая',
  high: 'Высокая',
  medium: 'Средняя',
  low: 'Низкая',
  none: 'Нулевая',
  unknown: 'Неизвестна',
};

type DialogProps = {
  labelId: string;
  onDismiss: () => void;
  children: React.ReactNode;
  drawer?: boolean;
};

export function Dialog({ labelId, onDismiss, children, drawer = false }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const close = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    close.current?.focus();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelId}
      className={drawer ? 'dialog drawer' : 'dialog'}
      onCancel={(event) => { event.preventDefault(); onDismiss(); }}
    >
      <Button className="dialog-close icon-button" variant="ghost" ref={close} onClick={onDismiss} aria-label="Закрыть">
        <X />
      </Button>
      {children}
    </dialog>
  );
}

export function Toast({ message }: { message: string | null }) {
  return <div role="status" className={message ? 'toast' : 'sr-only'}>{message}</div>;
}
