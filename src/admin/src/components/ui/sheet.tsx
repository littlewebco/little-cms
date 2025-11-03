import * as React from 'react';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import { Button } from './button';

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  side?: 'left' | 'right' | 'top' | 'bottom';
}

export function Sheet({ open, onOpenChange, children, side = 'left' }: SheetProps) {
  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  const sideClasses = {
    left: 'inset-y-0 left-0',
    right: 'inset-y-0 right-0',
    top: 'inset-x-0 top-0',
    bottom: 'inset-x-0 bottom-0',
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
        onClick={() => onOpenChange(false)}
      />
      
      {/* Sheet */}
      <div
        className={cn(
          'fixed z-50 bg-background border-r shadow-lg',
          sideClasses[side],
          side === 'left' || side === 'right' ? 'w-80 max-w-[85vw]' : 'h-auto max-h-[85vh]'
        )}
      >
        {children}
      </div>
    </>
  );
}

interface SheetContentProps {
  children: React.ReactNode;
  onClose?: () => void;
}

export function SheetContent({ children, onClose }: SheetContentProps) {
  return (
    <div className="flex flex-col h-full">
      {onClose && (
        <div className="flex items-center justify-between p-4 border-b">
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}

