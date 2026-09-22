const MEDIA_WORKER_ORIGIN = 'https://mandalacodes-media.lightcodes.workers.dev';

export const onRequest: PagesFunction = async ({ request }) => {
  const incoming = new URL(request.url);
  const upstream = new URL(incoming.pathname + incoming.search, MEDIA_WORKER_ORIGIN);
  return fetch(new Request(upstream, request));
};
