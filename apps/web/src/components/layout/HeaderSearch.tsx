import { lazy, Suspense, useEffect, useState } from 'react';
import { Search } from 'lucide-react';
const Panel = lazy(() =>
  import('./HeaderSearchPanel').then((module) => ({
    default: module.HeaderSearch,
  })),
);
export function HeaderSearch({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [requested, setRequested] = useState(false);
  const activate = () => {
    setRequested(true);
    onOpenChange(true);
  };
  useEffect(() => {
    if (requested) return;
    const key = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
      )
        return;
      if (
        ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') ||
        (!event.ctrlKey && !event.metaKey && event.key === '/')
      ) {
        event.preventDefault();
        setRequested(true);
        onOpenChange(true);
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [requested, onOpenChange]);
  const trigger = (
    <div className="relative flex w-11 shrink-0 justify-end md:w-[15.25rem] lg:w-[11.25rem] xl:w-[15.25rem]">
      <button
        type="button"
        aria-label="Tìm kiếm"
        aria-expanded={open}
        onClick={activate}
        className="grid size-11 place-items-center rounded-lg text-ink hover:bg-soft focus-visible:outline-2 focus-visible:outline-primary"
      >
        <Search size={20} aria-hidden="true" />
      </button>
    </div>
  );
  return requested || open ? (
    <Suspense fallback={trigger}>
      <Panel open={open} onOpenChange={onOpenChange} />
    </Suspense>
  ) : (
    trigger
  );
}
