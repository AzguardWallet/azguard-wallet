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
- **Privacy** — Aztec's private execution model, plus an optional stealth mode that disables all external service calls.
- **Account abstraction** — built on Aztec's native account abstraction, powered by `@aztec/wallet-sdk`.
- **Dapp connectivity** — in-page provider injected via a content script, built on the Aztec SDK.

## Architecture

Azguard is a Manifest V3 browser extension with four entry points that communicate over a typed RPC-like message layer:

| Entry point    | Path                            | Purpose                             |
| -------------- | ------------------------------- | ----------------------------------- |
| Service Worker | `src/wallet/index.ts`           | Background services, business logic |
| Popup UI       | `src/popup/index.ts`            | Vue 3 extension popup               |
| Content Script | `src/content-script/content.ts` | In-page provider injection          |
| Offscreen      | `src/offscreen/index.ts`        | PXE (Private Execution Environment) |

The popup talks to the background service worker through a typed client/service pair (`ServiceClient` / `Service`, see `src/wallet/base/background/`) over `chrome.runtime.connect()`. Each domain (accounts, networks, transactions, tokens, config, ...) has its own service in `src/wallet/services/`.

```
src/
├── wallet/           # Service worker — all background services
│   ├── services/     # 20+ services (account, profile, network, transaction, etc.)
│   ├── storage/      # Chrome storage abstraction
│   └── config/       # Default config
├── popup/            # Vue 3 popup application (routes generated from the pages/ file tree)
├── stores/           # Pinia state
├── composables/      # Vue composables
├── components/       # Global UI components
├── content-script/   # Content script & in-page injection
└── offscreen/        # PXE offscreen document
```

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org/) 22 LTS (minimum 20.19)
- [Yarn](https://yarnpkg.com/)
- Google Chrome (or a Chromium-based browser) for local testing

### Build and load the extension

```bash
git clone https://github.com/AzguardWallet/azguard-wallet.git
cd azguard-wallet
yarn install
yarn build          # production bundle in dist/chrome/
```

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select the `dist/chrome/` folder.

### Development mode

`yarn dev` serves the extension with hot reload on port 8088. Run `yarn build` once before the first `yarn dev`, because the build copies dependencies the dev server needs.

## Available scripts

| Command          | Description                               |
| ---------------- | ----------------------------------------- |
| `yarn build`     | Production build for Chrome               |
| `yarn dev`       | Dev server for Chrome (port 8088)         |
| `yarn typecheck` | Type-check with `vue-tsc`                 |
| `yarn test`      | Run unit tests (Vitest)                   |
| `yarn test:e2e`  | Run end-to-end tests (Vitest + Puppeteer) |

## Testing

Unit tests live alongside the source and run with Vitest. End-to-end tests live in `tests/e2e/` and drive the built extension with Puppeteer, so they require `yarn build` first.

```bash
yarn test
yarn build && yarn test:e2e
```

## Privacy & stealth mode

Beyond Aztec's private execution model, Azguard offers a stealth mode that disables every external service call: contract registry lookups, WalletConnect, remote images and external links. The wallet offers it when you create your first profile, and you can toggle it any time under **Settings → Security → Privacy Settings**.

## Contributing

Issues and pull requests are welcome. Before opening a PR, run `yarn typecheck` and `yarn test`.

## Security

Azguard manages private keys and user funds, so please report suspected vulnerabilities privately rather than opening a public issue. Use GitHub's **Report a vulnerability** button on the repository's Security tab.

## License

Azguard Wallet is licensed under the [Apache License 2.0](LICENSE.md).
