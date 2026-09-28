import React, { useEffect, useState } from 'react';
import './related-articles.css';

interface LibraryArticle {
  id: string;
  title: string;
  description: string;
  relatedCard: number;
  cover: string;
}

let articleIndex: Promise<LibraryArticle[]> | undefined;

function loadArticleIndex(): Promise<LibraryArticle[]> {
  if (!articleIndex) {
    articleIndex = fetch('/learn/articles.json')
      .then(async response => {
        if (!response.ok) return [];
        const data: unknown = await response.json();
        if (!Array.isArray(data)) return [];
        return data.filter((article): article is LibraryArticle =>
          article !== null && typeof article === 'object' &&
          typeof article.id === 'string' && typeof article.title === 'string' &&
          typeof article.description === 'string' && typeof article.cover === 'string' &&
          Number.isInteger(article.relatedCard) && article.relatedCard >= 1 && article.relatedCard <= 64,
        );
      })
      .catch(() => []);
  }
  return articleIndex;
}

interface Props {
  cardNum: number;
  palette: 'daybook' | 'nightfall';
}

export default function RelatedArticles({ cardNum, palette }: Props) {
  const [articles, setArticles] = useState<LibraryArticle[]>([]);

  useEffect(() => {
    let active = true;
    loadArticleIndex().then(index => { if (active) setArticles(index); });
    return () => { active = false; };
  }, []);

  // Keep the complete index in state. Deriving matches from the current prop
  // prevents a previous card's links flashing during client-side navigation.
  const related = articles.filter(article => article.relatedCard === cardNum).slice(0, 3);
  if (!related.length) return null;

  return (
    <section className="eb-reading oracle-library" data-palette={palette} aria-labelledby="oracle-library-heading">
      <div className="oracle-library__inner">
        <div className="oracle-library__header">
          <h2 id="oracle-library-heading">From the library</h2>
          <a className="oracle-library__all" href="/learn/">Explore the library <span aria-hidden="true">↗</span></a>
        </div>
        <ul className="oracle-library__list">
          {related.map(article => (
            <li key={article.id}>
              <a className="oracle-library__article" href={`/learn/${article.id.split('/').map(encodeURIComponent).join('/')}/`}>
                <img className="oracle-library__image" src={article.cover} alt="" width="80" height="80" loading="lazy" decoding="async" />
                <span className="oracle-library__copy">
                  <span className="oracle-library__title">{article.title}</span>
                  <span className="oracle-library__description">{article.description}</span>
                </span>
                <span className="oracle-library__arrow" aria-hidden="true">↗</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
