import { useEffect } from 'react';

/**
 * Sets the browser tab title for a single page. Restores nothing on unmount —
 * the next page is expected to set its own title in its own useEffect.
 */
export function useDocumentTitle(title: string) {
  useEffect(() => {
    const original = document.title;
    document.title = `${title} · Lazy Finance`;
    return () => {
      document.title = original;
    };
  }, [title]);
}
