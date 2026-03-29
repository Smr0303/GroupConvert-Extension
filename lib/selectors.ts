/**
 * Facebook DOM selectors for member request pages.
 * Based on REAL FB DOM structure (March 2026).
 *
 * FB uses obfuscated class names — we rely on:
 * - aria-label attributes (most stable)
 * - role attributes
 * - href patterns (/user/)
 * - structural patterns (ul > li for answers)
 */

export const SELECTORS = {
  // Approve button: aria-label starts with "Approve " + name, role="button"
  approveButton: '[role="button"][aria-label^="Approve "]',

  // Decline button: aria-label starts with "Decline " + name, role="button"
  declineButton: '[role="button"][aria-label^="Decline "]',

  // Member name: <a> with role="link" whose href contains /user/ and has text content (not just avatar)
  memberNameLink: 'a[role="link"][href*="/user/"]',

  // Screening answers are in <ul> > <li> structure
  // Each <li> has: first child = question span, second child = div with answer span
  answerList: 'ul',
  answerItem: 'ul > li',
}

/**
 * Find card container by walking up from an approve button until we find
 * a parent that contains the name link, approve button, AND the answers list.
 * FB structure: the answers <ul> is in a sibling div[role="list"] section,
 * so we need to walk up far enough to include both sections.
 */
export function findCardFromApproveButton(approveBtn: Element): Element | null {
  let el: Element | null = approveBtn
  let bestCard: Element | null = null

  for (let i = 0; i < 15; i++) {
    el = el.parentElement
    if (!el || el === document.body) break

    const hasName = el.querySelector(SELECTORS.memberNameLink)
    const hasApprove = el.querySelector(SELECTORS.approveButton)

    if (hasName && hasApprove) {
      bestCard = el
      // Keep going up to check if a higher parent also has the answers <ul>
      const hasAnswers = el.querySelector(SELECTORS.answerItem)
      if (hasAnswers) return el // Found the full card including answers
    }
  }

  return bestCard // Return best match even without answers
}

/**
 * Find all member request cards on the page.
 * Strategy: find all approve buttons → walk up to card container.
 */
export function findAllCards(): Element[] {
  const approveButtons = document.querySelectorAll(SELECTORS.approveButton)
  const cards: Element[] = []
  const seen = new Set<Element>()

  approveButtons.forEach((btn) => {
    const card = findCardFromApproveButton(btn)
    if (card && !seen.has(card)) {
      seen.add(card)
      cards.push(card)
    }
  })

  return cards
}

/**
 * Extract member name from a card.
 * The name link appears twice (avatar + text). We want the text one.
 */
export function extractName(card: Element): string {
  const links = card.querySelectorAll(SELECTORS.memberNameLink)
  for (const link of links) {
    // Skip the avatar link (contains <svg>)
    if (link.querySelector('svg')) continue
    const text = link.textContent?.trim()
    if (text && text.length > 0) return text
  }
  return ''
}

/**
 * Extract profile URL from a card.
 */
export function extractProfileUrl(card: Element): string {
  const links = card.querySelectorAll(SELECTORS.memberNameLink)
  for (const link of links) {
    const href = link.getAttribute('href')
    if (href && href.includes('/user/')) {
      // Clean tracking params
      const clean = href.split('?')[0]
      return clean.startsWith('http') ? clean : `https://www.facebook.com${clean}`
    }
  }
  return ''
}

/**
 * Extract screening question/answer pairs from a card.
 *
 * FB structure: answers are in <ul> → <li> elements where:
 * - First child <span> = question text (e.g., "Tell email address")
 * - Second child <div> containing <span> = answer (e.g., "ishaansjpr@gmail.com")
 *
 * The <ul> is nested inside a role="listitem" div within a role="list" container.
 * We also need to filter out non-answer list items like "1 group", "Joined Facebook", etc.
 */
export function extractAnswers(card: Element): Array<{ question: string; answer: string }> {
  const answers: Array<{ question: string; answer: string }> = []

  // Find all <li> inside <ul> — these are the Q&A pairs
  const listItems = card.querySelectorAll('ul > li')

  listItems.forEach((li) => {
    const children = Array.from(li.children)
    if (children.length >= 2) {
      const question = children[0]?.textContent?.trim() || ''
      const answer = children[1]?.textContent?.trim() || ''
      if (question && answer) {
        answers.push({ question, answer })
      }
    }
  })

  // If no <ul> > <li> found, try alternative: look for role="listitem" divs
  // that have a question-like pattern (text followed by answer)
  if (answers.length === 0) {
    const roleListItems = card.querySelectorAll('[role="listitem"]')
    roleListItems.forEach((item) => {
      const spans = item.querySelectorAll('span[dir="auto"]')
      // Filter: skip items like "1 group", "Joined Facebook", "Lives in"
      const texts = Array.from(spans).map(s => s.textContent?.trim() || '').filter(Boolean)
      // Answer items typically have question + answer as separate spans
      if (texts.length >= 2) {
        const q = texts[0]
        const a = texts[1]
        // Heuristic: skip if it looks like profile info rather than Q&A
        if (q && a && !q.match(/^(Joined|Lives in|\d+ group)/i)) {
          answers.push({ question: q, answer: a })
        }
      }
    })
  }

  return answers
}

/**
 * Find the approve button within a card.
 */
export function findApproveButton(card: Element): HTMLElement | null {
  return card.querySelector(SELECTORS.approveButton) as HTMLElement | null
}

/**
 * Find the decline button within a card.
 */
export function findDeclineButton(card: Element): HTMLElement | null {
  return card.querySelector(SELECTORS.declineButton) as HTMLElement | null
}
