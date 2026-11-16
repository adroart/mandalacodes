/** Match every query word, including accent-insensitive titles and tags. */
export function searchTerms(value: string): string[] {
  return value.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase().trim().split(/\s+/).filter(Boolean)
}

export function initializeLibrary(): void {
  document.querySelectorAll<HTMLElement>('[data-library]').forEach(library => {
    if (library.dataset.initialized) return
    const search = library.querySelector<HTMLInputElement>('[data-library-search]')
    const results = library.querySelector<HTMLElement>('[data-library-results]')
    const count = library.querySelector<HTMLElement>('[data-library-count]')
    const empty = library.querySelector<HTMLElement>('[data-library-empty]')
    if (!search || !results || !count || !empty) return
    library.dataset.initialized = 'true'
    const cards = [...library.querySelectorAll<HTMLElement>('[data-library-card]')].map(element => ({
      element,
      text: searchTerms(element.dataset.search || '').join(' '),
    }))
    const feature = library.querySelector<HTMLElement>('[data-library-feature]')
    const clear = library.querySelector<HTMLButtonElement>('.library-search-clear')
    const update = () => {
      const terms = searchTerms(search.value)
      let matches = 0
      cards.forEach(({ element, text }) => {
        const matchesQuery = terms.every(term => text.includes(term))
        if (matchesQuery) matches++
        element.hidden = !matchesQuery || (!terms.length && element.dataset.featured === 'true')
      })
      count.textContent = terms.length
        ? `${matches} of ${cards.length} ${cards.length === 1 ? 'article' : 'articles'}`
        : `${cards.length} ${cards.length === 1 ? 'article' : 'articles'}`
      empty.hidden = matches !== 0
      results.hidden = matches === 0
      if (feature) feature.hidden = terms.length > 0
      if (clear) clear.hidden = search.value.length === 0
    }
    const reset = () => { search.value = ''; update(); search.focus() }
    search.addEventListener('input', update)
    search.addEventListener('keydown', event => {
      if (event.key === 'Escape' && search.value) { event.preventDefault(); reset() }
    })
    library.querySelector('form')?.addEventListener('submit', event => event.preventDefault())
    library.querySelectorAll<HTMLButtonElement>('[data-library-reset]').forEach(button => button.addEventListener('click', reset))
    library.querySelector<HTMLElement>('[data-library-controls]')?.removeAttribute('hidden')
    update()
    // Browsers may restore search values when returning from an article.
    window.addEventListener('pageshow', update)
  })
}
