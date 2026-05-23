import { useEffect } from 'react';

const DEFAULT_TITLE = 'Mandala Codes · Universal Language Oracle';
const DEFAULT_DESCRIPTION =
  'A reading deck of 64 mandalas. Each card connects to a hexagram from the I Ching, a Gene Key, and a Human Design gate.';
const DEFAULT_IMAGE =
  'https://res.cloudinary.com/dobbosnda/image/upload/f_auto,q_auto,w_1200,h_630,c_fill,g_auto/48_ttflpq';

interface MetaTagOptions {
  title?: string;
  description?: string;
  image?: string;
}

function setMeta(property: string, content: string) {
  let el = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.querySelector(`meta[name="${property}"]`) as HTMLMetaElement | null;
  }
  if (el) {
    el.setAttribute('content', content);
  }
}

/**
 * Updates document title and Open Graph / Twitter meta tags.
 * Restores defaults on unmount.
 */
export function useMetaTags({ title, description, image }: MetaTagOptions) {
  useEffect(() => {
    const pageTitle = title ? `${title} | Adrian Rasmussen` : DEFAULT_TITLE;
    const pageDesc = description || DEFAULT_DESCRIPTION;
    const pageImage = image || DEFAULT_IMAGE;

    document.title = pageTitle;
    setMeta('description', pageDesc);
    setMeta('og:title', pageTitle);
    setMeta('og:description', pageDesc);
    setMeta('og:image', pageImage);
    setMeta('twitter:title', pageTitle);
    setMeta('twitter:description', pageDesc);
    setMeta('twitter:image', pageImage);

    return () => {
      document.title = DEFAULT_TITLE;
      setMeta('description', DEFAULT_DESCRIPTION);
      setMeta('og:title', DEFAULT_TITLE);
      setMeta('og:description', DEFAULT_DESCRIPTION);
      setMeta('og:image', DEFAULT_IMAGE);
      setMeta('twitter:title', DEFAULT_TITLE);
      setMeta('twitter:description', DEFAULT_DESCRIPTION);
      setMeta('twitter:image', DEFAULT_IMAGE);
    };
  }, [title, description, image]);
}
