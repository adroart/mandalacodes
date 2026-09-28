/** Enhancements stay local to article pages; links remain usable without JavaScript. */
const reader = document.querySelector<HTMLElement>('[data-reader]')

if (reader) {
  const dialog = reader.querySelector<HTMLDialogElement>('[data-artwork-dialog]')
  const artworkLink = reader.querySelector<HTMLAnchorElement>('[data-artwork-open]')
  const closeButton = reader.querySelector<HTMLButtonElement>('[data-artwork-close]')
  let previousFocus: HTMLElement | null = null
  let previousOverflow = ''

  if (dialog && artworkLink && typeof dialog.showModal === 'function') {
    artworkLink.setAttribute('aria-haspopup', 'dialog')
    artworkLink.addEventListener('click', event => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
      event.preventDefault()
      previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : artworkLink
      previousOverflow = document.body.style.overflow
      dialog.showModal()
      document.body.style.overflow = 'hidden'
    })
    closeButton?.addEventListener('click', () => dialog.close())
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return
      const bounds = dialog.getBoundingClientRect()
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close()
    })
    // Native dialog handles Escape and focus containment. All closing paths restore focus.
    dialog.addEventListener('close', () => {
      document.body.style.overflow = previousOverflow
      previousFocus?.focus({ preventScroll: true })
    })
  }

  const copyButton = reader.querySelector<HTMLButtonElement>('[data-copy-link]')
  const feedback = reader.querySelector<HTMLElement>('[data-share-feedback]')
  const fallback = reader.querySelector<HTMLElement>('[data-share-fallback]')
  let feedbackTimer: ReturnType<typeof setTimeout>
  if (copyButton && feedback && fallback) {
    copyButton.hidden = false
    copyButton.addEventListener('click', async () => {
      const url = copyButton.dataset.shareUrl
      if (!url) return
      clearTimeout(feedbackTimer)
      try {
        if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
        await navigator.clipboard.writeText(url)
        fallback.hidden = true
        feedback.textContent = 'Link copied'
        copyButton.setAttribute('aria-label', 'Copy article link again')
        feedbackTimer = setTimeout(() => { feedback.textContent = '' }, 5000)
      } catch {
        fallback.hidden = false
        feedback.textContent = 'Select and copy the link below.'
        const input = fallback.querySelector<HTMLInputElement>('input')
        input?.focus()
        input?.select()
      }
    })
  }

  const body = reader.querySelector<HTMLElement>('[data-reading-body]')
  const progress = reader.querySelector<HTMLElement>('[data-reading-progress]')
  const links = Array.from(reader.querySelectorAll<HTMLAnchorElement>('[data-section-link]'))
  const sections = links.map(link => ({ link, heading: document.getElementById(decodeURIComponent(link.hash.slice(1))) }))
  const nav = document.querySelector<HTMLElement>('.site-bar-root')
  const mobile = window.matchMedia('(max-width: 1000px)')
  const contents = reader.querySelector<HTMLDetailsElement>('[data-reader-contents] details')
  // Desktop keeps the index visible; mobile offers it as a compact disclosure.
  if (contents) contents.open = !mobile.matches

  let pendingFrame = 0
  let currentSection: HTMLAnchorElement | null = null
  let previousPercent = -1
  const updateReadingPosition = () => {
    pendingFrame = 0
    if (!body || !progress) return
    const navBottom = Math.max(0, nav?.getBoundingClientRect().bottom ?? 64)
    reader.style.setProperty('--reader-nav-height', `${navBottom}px`)
    const bodyBounds = body.getBoundingClientRect()
    const readingLine = navBottom + 36
    const traveled = readingLine - bodyBounds.top
    const readingDistance = Math.max(1, bodyBounds.height - (window.innerHeight - readingLine))
    const percent = Math.round(Math.min(100, Math.max(0, traveled / readingDistance * 100)))
    progress.hidden = bodyBounds.top > readingLine || bodyBounds.bottom < navBottom
    if (percent !== previousPercent) {
      previousPercent = percent
      progress.setAttribute('aria-valuenow', String(percent))
      progress.style.setProperty('--reading-progress', String(percent / 100))
    }
    let active: HTMLAnchorElement | null = null
    for (const section of sections) {
      if (section.heading && section.heading.getBoundingClientRect().top <= readingLine + 64) active = section.link
    }
    if (active !== currentSection) {
      currentSection?.removeAttribute('aria-current')
      active?.setAttribute('aria-current', 'location')
      currentSection = active
    }
  }
  const scheduleUpdate = () => {
    if (!pendingFrame) pendingFrame = requestAnimationFrame(updateReadingPosition)
  }
  window.addEventListener('scroll', scheduleUpdate, { passive: true })
  window.addEventListener('resize', scheduleUpdate, { passive: true })
  window.addEventListener('load', scheduleUpdate, { once: true })
  if (typeof ResizeObserver !== 'undefined') {
    const observer = new ResizeObserver(scheduleUpdate)
    if (body) observer.observe(body)
    if (nav) observer.observe(nav)
  }
  document.fonts?.ready.then(scheduleUpdate)

  // Move keyboard focus along with in-page navigation, preserving normal URL fragments.
  const readingLinks = reader.querySelectorAll<HTMLAnchorElement>('[data-section-link], .article-start')
  readingLinks.forEach(link => {
    link.addEventListener('click', event => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const target = document.getElementById(decodeURIComponent(link.hash.slice(1)))
      if (!target) return
      if (mobile.matches && contents) contents.open = false
      // Let the anchor update the fragment, then focus without a second scroll jump.
      requestAnimationFrame(() => {
        if (!target.hasAttribute('tabindex')) {
          target.setAttribute('tabindex', '-1')
          target.addEventListener('blur', () => target.removeAttribute('tabindex'), { once: true })
        }
        target.focus({ preventScroll: true })
      })
    })
  })
  scheduleUpdate()
}

export {}
