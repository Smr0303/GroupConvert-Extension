/**
 * Auto-approve module for Facebook Group member requests.
 * Sequentially clicks "Approve" buttons with randomized delays.
 */

import { findAllCards, findApproveButton } from "./selectors"

const MAX_PER_SESSION = 50
const MIN_DELAY_MS = 1000
const MAX_DELAY_MS = 3000

export interface ApproveResult {
  approved: number
  failed: number
  stopped: boolean
  errors: string[]
}

function randomDelay(min: number = MIN_DELAY_MS, max: number = MAX_DELAY_MS): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Click a Facebook button element. Simple .click() works from console,
 * so we just need to ensure the element is visible first.
 */
async function simulateClick(element: HTMLElement): Promise<void> {
  element.scrollIntoView({ behavior: 'smooth', block: 'center' })
  await sleep(300) // Wait for scroll to settle
  element.click()
}

/**
 * Auto-approve member requests sequentially with random delays.
 */
export async function autoApprove(
  delayMin: number = MIN_DELAY_MS,
  delayMax: number = MAX_DELAY_MS,
  maxCount: number = MAX_PER_SESSION,
  shouldStop?: () => boolean
): Promise<ApproveResult> {
  const result: ApproveResult = {
    approved: 0,
    failed: 0,
    stopped: false,
    errors: []
  }

  const cap = Math.min(maxCount, MAX_PER_SESSION)
  const cards = findAllCards()

  console.log(`[GroupConvert] Auto-approve: found ${cards.length} cards`)

  for (let i = 0; i < Math.min(cards.length, cap); i++) {
    if (shouldStop?.()) {
      result.stopped = true
      break
    }

    const card = cards[i]
    const approveBtn = findApproveButton(card)

    if (!approveBtn) {
      result.failed++
      result.errors.push(`Card ${i}: Approve button not found`)
      continue
    }

    try {
      await simulateClick(approveBtn)
      result.approved++
      console.log(`[GroupConvert] Approved card ${i + 1}/${cards.length}`)

      if (i < cards.length - 1) {
        const delay = randomDelay(delayMin, delayMax)
        await sleep(delay)
      }
    } catch (err) {
      result.failed++
      result.errors.push(
        `Card ${i}: ${err instanceof Error ? err.message : String(err)}`
      )
    }
  }

  console.log(`[GroupConvert] Auto-approve done: ${result.approved} approved, ${result.failed} failed`)
  return result
}
