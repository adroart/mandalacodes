import { describe, expect, it, vi } from 'vitest';

const fixtures = vi.hoisted(() => ({ articles: [] as any[] }));
vi.mock('../../src/lib/articles', () => ({
  getPublishedArticles: async () => fixtures.articles,
  toView: (article: any) => ({ cover: article.data.coverImage || '/media/image/artwork?w=460' }),
}));

import { GET } from '../../src/pages/articles.json';

describe('the deck-to-library article index', () => {
  it('includes only published articles with an explicit valid card and no article body', async () => {
    const article = (id: string, data: Record<string, unknown>) => ({
      id, body: 'Private body material is not part of this index.',
      data: { title: `Title ${id}`, description: `Description ${id}`, draft: false, ...data },
    });
    fixtures.articles = [
      article('published', { relatedCard: 1, coverImage: '/learn/images/articles/work.jpg' }),
      article('draft', { relatedCard: 1, draft: true }),
      article('unrelated', {}),
      article('out-of-range', { relatedCard: 65 }),
      article('fraction', { relatedCard: 1.5 }),
      article('other-card', { relatedCard: 48 }),
    ];
    const response = await GET();
    expect(response.headers.get('Content-Type')).toContain('application/json');
    expect(await response.json()).toEqual([
      { id: 'published', title: 'Title published', description: 'Description published', relatedCard: 1, cover: '/learn/images/articles/work.jpg' },
      { id: 'other-card', title: 'Title other-card', description: 'Description other-card', relatedCard: 48, cover: '/media/image/artwork?w=460' },
    ]);
  });
});
