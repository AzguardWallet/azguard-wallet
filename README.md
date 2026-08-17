<p align="center">
  <img src="src/assets/logo_lg.png" alt="Azguard Wallet" width="96" />
</p>

<h1 align="center">Azguard Wallet</h1>

<p align="center">
  A user-friendly, self-custody wallet for the <a href="https://aztec.network/">Aztec network</a>,<br/>
  built privacy-first and powered by account abstraction.
</p>

<p align="center">
  <a href="https://chromewebstore.google.com/detail/azguard-wallet/pliilpflcmabdiapdeihifihkbdfnbmn">Chrome Web Store</a>
  ·
  <a href="LICENSE.md">Apache-2.0 License</a>
</p>

---

## Features

- **Self-custody** — private keys and secrets never leave your device.
- **Privacy by default** — Aztec's private execution model combined with an extension-wide "stealth mode" that disables external network calls (contract lookups, images, external links) unless you opt in.
- **Account abstraction** — built on Aztec's native account abstraction, powered by `@aztec/wallet-sdk`.
- **Dapp connectivity** — in-page provider injected via a content script, built on the Aztec SDK.

## Architecture

Azguard is a Manifest V3 browser extension with four entry points that communicate over a typed RPC-like message layer:

| Entry point      | Path                          | Purpose                                   |
| ----------------- | ------------------------------ | ------------------------------------------ |
| Service Worker    | `src/wallet/index.ts`          | Background services, business logic       |
| Popup UI          | `src/popup/index.ts`           | Vue 3 extension popup                     |
| Content Script    | `src/content-script/content.ts`| In-page provider injection                |
| Offscreen         | `src/offscreen/index.ts`       | PXE (Private Execution Environment)       |

The popup talks to the background service worker through a typed client/service pair (`ServiceClient` / `Service`, see `src/wallet/base/background/`) over `chrome.runtime.connect()`. Each domain (accounts, networks, transactions, tokens, config, ...) has its own service in `src/wallet/services/`.

```
src/
├── wallet/           # Service worker — all background services
│   ├── services/     # 20+ services (account, profile, network, transaction, etc.)
│   ├── storage/      # Chrome storage abstraction
│   └── config/       # Default config, incl. privacy/stealth mode settings
├── popup/            # Vue 3 popup application (file-based routing)
├── stores/           # Pinia state
├── composables/       # Vue composables
├── components/        # Global UI components
├── content-script/    # Content script & in-page injection
└── offscreen/          # PXE offscreen document
```

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org/) 20 or newer
- [Yarn](https://yarnpkg.com/)
- Google Chrome (or a Chromium-based browser) for local testing

### Setup

```bash
git clone https://github.com/<org>/azguard-wallet.git
cd azguard-wallet
yarn install
yarn dev            # starts the Chrome dev build with hot reload, port 8088
```

### Load the extension in Chrome

1. Run `yarn dev` (or `yarn build` for a production bundle).
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the `dist/chrome/` folder.


## Available scripts

| Command             | Description                                      |
| -------------------- | -------------------------------------------------- |
| `yarn dev`           | Dev server for Chrome (port 8088)                |
| `yarn build`         | Production build for Chrome                       |
| `yarn typecheck`     | Type-check with `vue-tsc`                          |
| `yarn test`          | Run unit tests (Vitest)                           |
| `yarn test:e2e`      | Run end-to-end tests (Vitest + Puppeteer)         |

## Testing

Unit tests live alongside the source and run with Vitest. End-to-end tests drive the built extension with Puppeteer and live in `tests/e2e/` (fixtures in `tests/e2e/fixtures/`); they require a Chrome build (`yarn build`) before running.

```bash
yarn test
yarn build && yarn test:e2e
```

## Privacy & stealth mode

Azguard ships with privacy-first defaults (`src/wallet/config/config.ts`):

- `stealthMode: true` — master switch for anything that leaves the device
- `contractRegistry: false` — external contract lookups
- `uploadExternalImages: false` — loading remote images
- `externalLinks: "disabled"` — how external links behave (`disabled` / `confirm` / `enabled`)

These can be reviewed and changed from **Settings → External services** in the popup.

## Contributing

Issues and pull requests are welcome. Before opening a PR:

1. Run `yarn typecheck` and `yarn test`.
2. Keep changes focused — see the code style conventions in [`CLAUDE.md`](CLAUDE.md) (component ordering, service/client patterns, etc.).
3. For UI changes, verify the flow manually by loading the unpacked extension.

## Security

Azguard manages private keys and user funds — please report suspected vulnerabilities privately rather than opening a public issue. Open a GitHub issue asking for a private contact channel, and a maintainer will follow up.

## License

Azguard Wallet is licensed under the [Apache License 2.0](LICENSE.md).
