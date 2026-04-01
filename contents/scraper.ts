import type { PlasmoCSConfig } from "plasmo"
import { observeNewCards, type ParsedMember } from "~lib/dom-parser"

export const config: PlasmoCSConfig = {
  matches: ["https://www.facebook.com/groups/*/member-requests*"],
  run_at: "document_end"
}

/**
 * Content script that runs on Facebook Group member-requests pages.
 * Uses MutationObserver to watch for new member request cards,
 * parses each card, and stores data in chrome.storage.local
 * for the capture-ui overlay and popup to consume.
 */

interface StoredLead {
  id: string
  name: string
  profileUrl: string
  answers: Array<{ question: string; answer: string }>
  capturedAt: number
  groupUrl: string
  selectorTier: number
}

function memberToStoredLead(member: ParsedMember): StoredLead {
  return {
    id: member.id,
    name: member.name,
    profileUrl: member.profileUrl,
    answers: member.answers,
    capturedAt: member.parsedAt,
    groupUrl: window.location.href,
    selectorTier: member.selectorTier
  }
}

async function loadExistingLeads(): Promise<StoredLead[]> {
  const result = await chrome.storage.local.get("pendingLeads")
  return result.pendingLeads || []
}

async function saveLeads(leads: StoredLead[]): Promise<void> {
  await chrome.storage.local.set({
    pendingLeads: leads,
    pendingLeadsCount: leads.length,
    lastScrapeAt: Date.now(),
    onMemberRequestsPage: true
  })
}

async function handleNewMembers(newMembers: ParsedMember[]): Promise<void> {
  const existing = await loadExistingLeads()
  const existingIds = new Set(existing.map((l) => l.id))

  const newLeads = newMembers
    .filter((m) => !existingIds.has(m.id))
    .map(memberToStoredLead)

  if (newLeads.length === 0) return

  const allLeads = [...existing, ...newLeads]
  await saveLeads(allLeads)

  console.log(
    `[GroupMailBox] Found ${newLeads.length} new leads (${allLeads.length} total pending)`
  )
}

// Mark that we're on the member requests page
chrome.storage.local.set({ onMemberRequestsPage: true, scrapingStatus: "scanning" })

// Start observing the DOM for member request cards
const observer = observeNewCards((members) => {
  if (members.length > 0) {
    chrome.storage.local.set({ scrapingStatus: "found" })
  }
  handleNewMembers(members)
})

// If no cards found after initial scan, update status
setTimeout(async () => {
  const result = await chrome.storage.local.get("pendingLeadsCount")
  if (!result.pendingLeadsCount || result.pendingLeadsCount === 0) {
    chrome.storage.local.set({ scrapingStatus: "no_cards_found" })
  }
}, 3000)

// Clean up when navigating away
window.addEventListener("beforeunload", () => {
  observer.disconnect()
  chrome.storage.local.set({ onMemberRequestsPage: false })
})

// Listen for messages from popup/background
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "GET_LEADS_COUNT") {
    loadExistingLeads().then((leads) => {
      sendResponse({ count: leads.length })
    })
    return true // async response
  }

  if (message.type === "CLEAR_LEADS") {
    chrome.storage.local.set({
      pendingLeads: [],
      pendingLeadsCount: 0
    })
    sendResponse({ success: true })
    return true
  }

  if (message.type === "TRIGGER_RESCAN") {
    const { parseAllMemberCards } = require("~lib/dom-parser")
    const result = parseAllMemberCards()
    handleNewMembers(result.members)
    sendResponse({ count: result.members.length })
    return true
  }
})

console.log("[GroupMailBox] Scraper content script loaded on member-requests page")
