import { artistSlugs } from '../_generated/editorial-routes.js';
import { serveEditorialPage, serveEditorialNotFound } from '../_lib/editorialHtml.js';

export async function onRequest(context) {
  const segments = context.params.path;
  if (!segments || (Array.isArray(segments) && segments.length === 0)) {
    return serveEditorialPage(context, '/artists');
  }
  if (!Array.isArray(segments) || segments.length !== 1 || !artistSlugs.includes(segments[0])) {
    return serveEditorialNotFound(context);
  }
  return serveEditorialPage(context, `/artists/${segments[0]}`);
}
