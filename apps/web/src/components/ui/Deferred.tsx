import { useEffect, useRef, useState, type ReactNode } from 'react';
export function Deferred({
  children,
  fallback,
  minHeight = 320,
  id,
}: {
  children: ReactNode;
  fallback?: ReactNode;
  minHeight?: number;
  id?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    if (!('IntersectionObserver' in window)) {
      setReady(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setReady(true);
          observer.disconnect();
        }
      },
      { rootMargin: '300px' },
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={ref} id={id} style={ready ? undefined : { minHeight }}>
      {ready ? children : fallback}
    </div>
  );
}
