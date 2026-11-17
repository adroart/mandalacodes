import { serveEditorialPage } from '../_lib/editorialHtml.js';

export const onRequest = (context) => serveEditorialPage(context, '/light-codes');
