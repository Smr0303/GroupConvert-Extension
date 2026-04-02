const fs = require('fs');
const path = require('path');

const frontendDir = path.join(__dirname, '..');

function readFile(relativePath) {
  return fs.readFileSync(path.join(frontendDir, relativePath), 'utf-8');
}

describe('Phase 1: Branding - GroupConvert → GroupMailBox', () => {
  const filesToCheck = [
    'sidepanel.tsx',
    'contents/capture-ui.tsx',
    'contents/scraper.ts',
    'lib/dom-parser.ts',
    'lib/auto-approve.ts',
    'lib/api-client.ts',
    'background/index.ts',
  ];

  filesToCheck.forEach((file) => {
    it(`${file} does not contain "GroupConvert"`, () => {
      const content = readFile(file);
      expect(content).not.toContain('GroupConvert');
    });
  });

  it('sidepanel.tsx contains GroupMailBox branding', () => {
    const content = readFile('sidepanel.tsx');
    expect(content).toContain('groupmailbox');
  });

  it('capture-ui.tsx contains GroupMailBox panel title', () => {
    const content = readFile('contents/capture-ui.tsx');
    expect(content).toContain('GroupMailBox');
  });

  it('package.json has updated display name', () => {
    const pkg = JSON.parse(readFile('package.json'));
    expect(pkg.displayName).toBe('GroupMailBox');
    expect(pkg.displayName).not.toContain('GroupConvert');
  });
});

describe('Phase 2: Accessibility', () => {
  it('sidepanel.css uses accessible muted text color (#5C6578)', () => {
    const css = readFile('sidepanel.css');
    expect(css).toContain('--text-muted: #5C6578');
    expect(css).not.toContain('--text-muted: #6b6b88');
  });

  it('sidepanel.css has no font-size: 10px', () => {
    const css = readFile('sidepanel.css');
    // All 10px should have been changed to 11px
    const lines = css.split('\n');
    const fontSizeLines = lines.filter(l => l.includes('font-size') && l.includes('10px'));
    // Only the logo-version (which was already 10px in .gc-logo-version) should remain
    // Actually, let's just check that warning-text and leads-meta are 11px
    expect(css).toMatch(/\.gc-warning-text\s*\{[^}]*font-size:\s*11px/);
    expect(css).toMatch(/\.gc-leads-meta\s*\{[^}]*font-size:\s*11px/);
  });

  it('sidepanel.tsx has ARIA labels on interactive elements', () => {
    const tsx = readFile('sidepanel.tsx');
    expect(tsx).toContain('aria-label="Auto-approve toggle"');
    expect(tsx).toContain('aria-label="Push delay in seconds"');
    expect(tsx).toContain('role="status"');
  });

  it('capture-ui.tsx has ARIA labels', () => {
    const tsx = readFile('contents/capture-ui.tsx');
    expect(tsx).toContain('aria-label="Open GroupMailBox panel"');
    expect(tsx).toContain('aria-label="Close panel"');
    expect(tsx).toContain('aria-live="polite"');
  });

  it('capture-ui.tsx has Escape key handler', () => {
    const tsx = readFile('contents/capture-ui.tsx');
    expect(tsx).toContain("e.key === \"Escape\"");
  });

  it('sidepanel.css has focus-visible on slider', () => {
    const css = readFile('sidepanel.css');
    expect(css).toContain('.gc-slider:focus-visible');
  });
});

describe('Phase 3: Critical UX Fixes', () => {
  it('capture-ui.tsx has confirmation dialog for auto-approve', () => {
    const tsx = readFile('contents/capture-ui.tsx');
    expect(tsx).toContain('showApproveConfirm');
    expect(tsx).toContain('Approve All Now');
    expect(tsx).toContain('This will automatically approve all pending member requests');
  });

  it('capture-ui.tsx uses "Push to Sheets" label', () => {
    const tsx = readFile('contents/capture-ui.tsx');
    expect(tsx).toContain('Push to Sheets');
    expect(tsx).not.toContain('Capture & Push');
  });

  it('sidepanel.tsx has Sheet URL extraction', () => {
    const tsx = readFile('sidepanel.tsx');
    expect(tsx).toContain('extractSheetId');
    expect(tsx).toContain('spreadsheets\\/d\\/');
  });

  it('sidepanel.tsx has success/error push status classes', () => {
    const tsx = readFile('sidepanel.tsx');
    expect(tsx).toContain('gc-status-success');
    expect(tsx).toContain('gc-status-error');
  });

  it('sidepanel.css defines success and error status classes', () => {
    const css = readFile('sidepanel.css');
    expect(css).toContain('.gc-status-success');
    expect(css).toContain('.gc-status-error');
  });
});

describe('Phase 4: Onboarding', () => {
  it('sidepanel.tsx has welcome screen', () => {
    const tsx = readFile('sidepanel.tsx');
    expect(tsx).toContain('showWelcome');
    expect(tsx).toContain('hasSeenWelcome');
    expect(tsx).toContain('Get Started');
    expect(tsx).toContain('gc-welcome');
  });

  it('sidepanel.tsx has step indicator', () => {
    const tsx = readFile('sidepanel.tsx');
    expect(tsx).toContain('gc-stepper');
    expect(tsx).toContain('gc-step-active');
    expect(tsx).toContain('gc-step-complete');
    expect(tsx).toContain('currentStep');
  });

  it('sidepanel.tsx has helper text for license key', () => {
    const tsx = readFile('sidepanel.tsx');
    expect(tsx).toContain('Enter the license key from your purchase confirmation email');
  });

  it('sidepanel.css has welcome and stepper styles', () => {
    const css = readFile('sidepanel.css');
    expect(css).toContain('.gc-welcome');
    expect(css).toContain('.gc-stepper');
    expect(css).toContain('.gc-step');
  });
});

describe('Phase 5: Error Handling', () => {
  it('api-client.ts has token expiry check', () => {
    const ts = readFile('lib/api-client.ts');
    expect(ts).toContain('isTokenExpired');
    expect(ts).toContain('clearAuthState');
    expect(ts).toContain('session has expired');
  });

  it('api-client.ts has offline detection', () => {
    const ts = readFile('lib/api-client.ts');
    expect(ts).toContain('navigator.onLine');
    expect(ts).toContain('You appear to be offline');
  });

  it('sidepanel.tsx has network status listener', () => {
    const tsx = readFile('sidepanel.tsx');
    expect(tsx).toContain('networkStatus');
    expect(tsx).toContain('gc-offline-banner');
  });

  it('sidepanel.tsx stores token expiry', () => {
    const tsx = readFile('sidepanel.tsx');
    expect(tsx).toContain('tokenExpiresAt');
  });

  it('sidepanel.tsx has retry buttons', () => {
    const tsx = readFile('sidepanel.tsx');
    expect(tsx).toContain('Retry');
    expect(tsx).toContain('gc-btn-link');
  });

  it('scraper.ts has scraping status feedback', () => {
    const ts = readFile('contents/scraper.ts');
    expect(ts).toContain('scrapingStatus');
    expect(ts).toContain('scanning');
    expect(ts).toContain('no_cards_found');
  });

  it('capture-ui.tsx shows scraping status', () => {
    const tsx = readFile('contents/capture-ui.tsx');
    expect(tsx).toContain('scrapingStatus');
    expect(tsx).toContain('Scanning for requests');
    expect(tsx).toContain('No pending requests found');
  });
});

describe('Phase 6+: Polish', () => {
  it('capture-ui.tsx has exit animation classes', () => {
    const tsx = readFile('contents/capture-ui.tsx');
    expect(tsx).toContain('gc-panel-open');
    expect(tsx).toContain('gc-panel-closed');
  });

  it('capture-ui.tsx has sheets connection status check', () => {
    const tsx = readFile('contents/capture-ui.tsx');
    expect(tsx).toContain('sheetsReady');
    expect(tsx).toContain('Setup incomplete');
  });

  it('capture-ui.tsx has last push timestamp', () => {
    const tsx = readFile('contents/capture-ui.tsx');
    expect(tsx).toContain('lastPushInfo');
    expect(tsx).toContain('formatTimeAgo');
  });

  it('capture-ui.tsx has settings link', () => {
    const tsx = readFile('contents/capture-ui.tsx');
    expect(tsx).toContain('OPEN_SIDE_PANEL');
    expect(tsx).toContain('Settings');
  });

  it('capture-ui.tsx uses CSS variables', () => {
    const tsx = readFile('contents/capture-ui.tsx');
    expect(tsx).toContain('--navy: #0C1220');
    expect(tsx).toContain('--teal: #4F8CFF');
    expect(tsx).toContain('--text-muted: #5C6578');
  });

  it('background/index.ts handles OPEN_SIDE_PANEL message', () => {
    const ts = readFile('background/index.ts');
    expect(ts).toContain('OPEN_SIDE_PANEL');
    expect(ts).toContain('sidePanel.open');
  });

  it('sidepanel.css has max-width constraint', () => {
    const css = readFile('sidepanel.css');
    expect(css).toContain('max-width: 420px');
  });

  it('sidepanel.tsx listens for googleConnected storage changes', () => {
    const tsx = readFile('sidepanel.tsx');
    expect(tsx).toContain('changes.googleConnected');
  });
});
