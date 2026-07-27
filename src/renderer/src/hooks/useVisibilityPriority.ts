import { useEffect, useRef } from 'react';
import type { FileRow } from '@shared/types';

const NOTIFY_DEBOUNCE_MS = 200;

/**
 * Tracks which file rows/cards are actually scrolled into view and reports that set to the main
 * process (`files:setVisible`), so the hash/thumbnail background sweeps render what the user is
 * looking at first instead of grinding through the whole library in arbitrary order.
 */
export function useVisibilityPriority(): (
  file: FileRow
) => (el: Element | null) => (() => void) | void {
  const visibleIds = useRef<Set<number>>(new Set());
  const observerRef = useRef<IntersectionObserver | null>(null);
  const idByElement = useRef<WeakMap<Element, number>>(new WeakMap());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = idByElement.current.get(entry.target);
          if (id == null) continue;
          if (entry.isIntersecting) visibleIds.current.add(id);
          else visibleIds.current.delete(id);
        }
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          window.api.files.setVisible([...visibleIds.current]);
        }, NOTIFY_DEBOUNCE_MS);
      },
      { rootMargin: '400px' }
    );
    observerRef.current = observer;
    return () => {
      observer.disconnect();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (file: FileRow) => (el: Element | null) => {
    const observer = observerRef.current;
    if (!observer || !el || file.thumbnail_status !== 'pending') return;
    idByElement.current.set(el, file.id);
    observer.observe(el);
    return () => {
      visibleIds.current.delete(file.id);
      observer.unobserve(el);
    };
  };
}
