import { useEffect } from 'react';

const SITE_ORIGIN = 'https://mandalacodes.com';
const DEFAULT_SEO_IMAGE = `${SITE_ORIGIN}/media/image/48_ttflpq?w=1200&h=630`;

const ROUTE_META: Record<string, { title: string; description: string }> = {
  '/': {
    title: 'Mandala Codes · Universal Language Oracle',
    description: 'A reading deck of 64 mandalas. Each card connects to a hexagram from the I Ching, a Gene Key, and a Human Design gate.',
  },
  '/universal-language': {
    title: 'The Deck · Universal Language · Mandala Codes',
    description: 'Sixty-four mandalas. Open one and receive what it holds.',
  },
  '/the-systems': {
    title: 'The Systems · I Ching, Gene Keys, Human Design · Mandala Codes',
    description: 'The three traditions woven into the Universal Language deck.',
  },
};

function resolveSeoConfig(pathname: string) {
  if (ROUTE_META[pathname]) return { ...ROUTE_META[pathname], image: DEFAULT_SEO_IMAGE };
  return { ...ROUTE_META['/'], image: DEFAULT_SEO_IMAGE };
}

function resolveCanonicalUrl(pathname: string) {
  return `${SITE_ORIGIN}${pathname === '/' ? '' : pathname}`;
}

function setMeta(selector: string, content: string) {
  const el = document.querySelector<HTMLMetaElement>(selector);
  if (el) {
    el.content = content;
  }
}

function setCanonical(url: string) {
  let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'canonical';
    document.head.appendChild(link);
  }
  link.href = url;
}

function setOgUrl(url: string) {
  let meta = document.querySelector<HTMLMetaElement>('meta[property="og:url"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('property', 'og:url');
    document.head.appendChild(meta);
  }
  meta.content = url;
}

export function useSeoMeta(pathname: string) {
  useEffect(() => {
    const config = resolveSeoConfig(pathname);
    const canonicalUrl = resolveCanonicalUrl(pathname);
    const image = config.image || DEFAULT_SEO_IMAGE;

    document.title = config.title;
    setMeta('meta[name="description"]', config.description);
    setMeta('meta[property="og:title"]', config.title);
    setMeta('meta[property="og:description"]', config.description);
    setMeta('meta[property="og:image"]', image);
    setMeta('meta[name="twitter:title"]', config.title);
    setMeta('meta[name="twitter:description"]', config.description);
    setMeta('meta[name="twitter:image"]', image);
    setCanonical(canonicalUrl);
    setOgUrl(canonicalUrl);
  }, [pathname]);
}
