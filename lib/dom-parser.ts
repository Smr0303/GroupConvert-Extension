/**
 * Facebook DOM parser for member request cards.
 * Extracts structured lead data from the member requests page.
 */

import {
  findAllCards,
  extractName,
  extractProfileUrl,
  extractAnswers
} from "./selectors"

export interface ScreeningAnswer {
  question: string
  answer: string
}

export interface ParsedMember {
  id: string
  name: string
  profileUrl: string
  answers: ScreeningAnswer[]
  cardElement: Element
  parsedAt: number
  selectorTier: number
}

export interface ParseResult {
  members: ParsedMember[]
  errors: string[]
}

/**
 * Generate a stable ID from name + profile URL.
 */
function generateMemberId(name: string, profileUrl: string): string {
  const raw = `${name}::${profileUrl}`
  let hash = 0
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i)
    hash = ((hash << 5) - hash + char) | 0
  }
  return `member_${Math.abs(hash).toString(36)}`
}

/**
 * Parse all member request cards currently visible on the page.
 */
export function parseAllMemberCards(): ParseResult {
  const errors: string[] = []
  const members: ParsedMember[] = []

  const cards = findAllCards()

  if (cards.length === 0) {
    errors.push("No member request cards found on page")
    console.log("[GroupConvert] No cards found. Approve buttons on page:",
      document.querySelectorAll('[role="button"][aria-label^="Approve"]').length)
    return { members, errors }
  }

  console.log(`[GroupConvert] Found ${cards.length} member request cards`)

  for (const card of cards) {
    try {
      const name = extractName(card)
      if (!name) {
        errors.push("Card found but could not extract name")
        continue
      }

      const profileUrl = extractProfileUrl(card)
      const answers = extractAnswers(card)

      const member: ParsedMember = {
        id: generateMemberId(name, profileUrl),
        name,
        profileUrl,
        answers,
        cardElement: card,
        parsedAt: Date.now(),
        selectorTier: 2 // aria-label based
      }

      members.push(member)
      console.log(`[GroupConvert] Parsed: ${name}`, { profileUrl, answers })
    } catch (err) {
      errors.push(
        `Failed to parse card: ${err instanceof Error ? err.message : String(err)}`
      )
    }
  }

  return { members, errors }
}

/**
 * MutationObserver to detect new cards loaded by infinite scroll.
 * Calls the callback with newly parsed members whenever DOM changes.
 */
export function observeNewCards(
  callback: (newMembers: ParsedMember[]) => void
): MutationObserver {
  const seenIds = new Set<string>()

  // Initial parse
  const initial = parseAllMemberCards()
  for (const m of initial.members) {
    seenIds.add(m.id)
  }
  if (initial.members.length > 0) {
    callback(initial.members)
  }

  // Debounce observer to avoid excessive parsing
  let timeout: ReturnType<typeof setTimeout> | null = null

  const observer = new MutationObserver(() => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => {
      const result = parseAllMemberCards()
      const newMembers = result.members.filter((m) => !seenIds.has(m.id))
      for (const m of newMembers) {
        seenIds.add(m.id)
      }
      if (newMembers.length > 0) {
        callback(newMembers)
      }
    }, 500)
  })

  observer.observe(document.body, {
    childList: true,
    subtree: true
  })

  return observer
}
