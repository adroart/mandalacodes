import { lightCodeCount } from '../_generated/editorial-routes.js';
import { serveEditorialPage, serveEditorialNotFound } from '../_lib/editorialHtml.js';

export async function onRequest(context) {
  const segments = context.params.path;
  if (!segments || (Array.isArray(segments) && segments.length === 0)) {
    return serveEditorialPage(context, '/light-codes');
  }
  if (!Array.isArray(segments) || segments.length !== 1 || !/^[1-9]\d*$/.test(segments[0])) {
    return serveEditorialNotFound(context);
  }
  const number = Number(segments[0]);
  if (!Number.isInteger(number) || number < 1 || number > lightCodeCount) {
    return serveEditorialNotFound(context);
  }
  return serveEditorialPage(context, `/light-codes/${number}`);
}
