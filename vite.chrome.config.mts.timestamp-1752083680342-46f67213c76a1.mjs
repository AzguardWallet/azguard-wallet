// vite.chrome.config.mts
import { defineConfig as defineConfig2 } from "file:///C:/Users/user/Repos/azguard-wallet/node_modules/vite/dist/node/index.js";
import { crx } from "file:///C:/Users/user/Repos/azguard-wallet/node_modules/@crxjs/vite-plugin/dist/index.mjs";

// manifest/manifest.chrome.config.ts
import { defineManifest } from "file:///C:/Users/user/Repos/azguard-wallet/node_modules/@crxjs/vite-plugin/dist/index.mjs";

// package.json
var package_default = {
  name: "azguard-wallet",
  displayName: "Azguard Wallet",
  description: "User-friendly self-custody wallet for Aztec network, preserving your privacy and revealing the power of account abstraction.",
  version: "0.3.5",
  sentinel: "1",
  scripts: {
    "build:full": "npm run build:chrome && npm run build:firefox",
    build: "cross-env NODE_OPTIONS=--max-old-space-size=16000 vite build -c vite.chrome.config.mts",
    "build:chrome": "cross-env NODE_OPTIONS=--max-old-space-size=16000 vite build -c vite.chrome.config.mts",
    "build:firefox": "cross-env NODE_OPTIONS=--max-old-space-size=16000 vite build -c vite.firefox.config.mts",
    "dev:full": 'concurrently "npm run dev:chrome" "npm run dev:firefox"',
    dev: "vite -c vite.chrome.config.mts",
    "dev:chrome": "vite -c vite.chrome.config.mts",
    "dev:firefox": "vite build --mode development --watch -c vite.firefox.config.mts",
    preview: "vite preview",
    typecheck: "vue-tsc --noEmit",
    test: "vitest"
  },
  dependencies: {
    "@aztec/aztec.js": "0.87.8",
    "@aztec/bb.js": "0.87.8",
    "@aztec/constants": "0.87.8",
    "@aztec/foundation": "0.87.8",
    "@aztec/noir-contracts.js": "0.87.8",
    "@aztec/pxe": "0.87.8",
    "@aztec/stdlib": "0.87.8",
    "@codemirror/lang-json": "^6.0.1",
    "@reown/walletkit": "^1.1.1",
    "@replit/codemirror-indentation-markers": "^6.5.3",
    "@walletconnect/core": "^2.17.2",
    "@walletconnect/utils": "^2.17.2",
    "bignumber.js": "^9.1.2",
    codemirror: "^6.0.1",
    "focus-trap": "^7.6.2",
    "lean-qr": "^2.3.4",
    luxon: "^3.5.0",
    pinia: "^2.2.4",
    vue: "^3.5.12",
    "vue-router": "^4.4.5",
    "webextension-polyfill": "^0.12.0",
    zod: "^3.23.8"
  },
  devDependencies: {
    "@biomejs/biome": "^1.9.4",
    "@crxjs/vite-plugin": "^2.0.0-beta.26",
    "@types/node": "^22.7.8",
    "@types/webextension-polyfill": "^0.12.1",
    "@vitejs/plugin-vue": "^5.1.4",
    "@vue/compiler-sfc": "^3.5.12",
    "chrome-types": "^0.1.311",
    concurrently: "^9.0.1",
    "cross-env": "^7.0.3",
    globals: "^15.11.0",
    jsdom: "^25.0.1",
    postcss: "^8.4.47",
    sass: "^1.80.3",
    typescript: "^5.6.3",
    "unplugin-auto-import": "^0.18.3",
    "unplugin-vue-components": "^0.27.4",
    "unplugin-vue-router": "^0.10.9",
    vite: "^5.4.9",
    "vite-plugin-node-polyfills": "^0.23.0",
    "vite-plugin-pages": "^0.32.3",
    "vite-plugin-static-copy": "^2.2.0",
    "vite-plugin-vue-devtools": "^7.5.3",
    vitest: "^2.1.3",
    "vue-tsc": "^2.1.6",
    "webext-bridge": "^6.0.1"
  },
  overrides: {
    "@crxjs/vite-plugin": "$@crxjs/vite-plugin"
  },
  pnpm: {
    overrides: {},
    peerDependencyRules: {
      allowAny: [],
      allowedVersions: {},
      ignoreMissing: []
    }
  },
  packageManager: "yarn@1.22.22+sha512.a6b2f7906b721bba3d67d4aff083df04dad64c399707841b7acf00f6b133b7ac24255f2652fa22ae3534329dc6180534e98d17432037ff6fd140556e2bb3137e"
};

// manifest/manifest.config.ts
var { version, name, description, displayName } = package_default;
var [major, minor, patch, label = "0"] = version.replace(/[^\d.-]+/g, "").split(/[.-]/);
var manifest_config_default = {
  name: displayName || name,
  description,
  version: `${major}.${minor}.${patch}.${label}`,
  version_name: version,
  manifest_version: 3,
  action: {
    default_popup: "src/popup/index.html#/popup/general"
  },
  background: {
    service_worker: "src/background/index.ts",
    type: "module"
  },
  side_panel: {
    default_path: "src/popup/index.html"
  },
  content_scripts: [
    {
      all_frames: true,
      js: ["src/content-script/content.ts"],
      matches: ["*://*/*"],
      run_at: "document_start"
    }
  ],
  permissions: ["offscreen", "storage", "sidePanel", "unlimitedStorage"],
  content_security_policy: {
    extension_pages: "script-src 'self' 'wasm-unsafe-eval'"
  },
  cross_origin_embedder_policy: {
    value: "require-corp"
  },
  cross_origin_opener_policy: {
    value: "same-origin"
  },
  icons: {
    16: "src/assets/logo.png",
    24: "src/assets/logo.png",
    32: "src/assets/logo.png",
    128: "src/assets/logo.png"
  }
};

// manifest/manifest.chrome.config.ts
var manifest_chrome_config_default = defineManifest((_env) => ({
  ...manifest_config_default
}));

// vite.config.ts
import { dirname, relative } from "node:path";
import { fileURLToPath, URL } from "node:url";
import vue from "file:///C:/Users/user/Repos/azguard-wallet/node_modules/@vitejs/plugin-vue/dist/index.mjs";
import usePages from "file:///C:/Users/user/Repos/azguard-wallet/node_modules/vite-plugin-pages/dist/index.js";
import useAutoImport from "file:///C:/Users/user/Repos/azguard-wallet/node_modules/unplugin-auto-import/dist/vite.js";
import useComponents from "file:///C:/Users/user/Repos/azguard-wallet/node_modules/unplugin-vue-components/dist/vite.js";
import { defineConfig } from "file:///C:/Users/user/Repos/azguard-wallet/node_modules/vite/dist/node/index.js";
import { nodePolyfills } from "file:///C:/Users/user/Repos/azguard-wallet/node_modules/vite-plugin-node-polyfills/dist/index.js";
import { viteStaticCopy } from "file:///C:/Users/user/Repos/azguard-wallet/node_modules/vite-plugin-static-copy/dist/index.js";
var __vite_injected_original_import_meta_url = "file:///C:/Users/user/Repos/azguard-wallet/vite.config.ts";
var vite_config_default = defineConfig({
  server: {
    port: 8088,
    strictPort: true,
    hmr: {
      port: 8088
    },
    // Headers needed for bb WASM to work in multithreaded mode
    headers: {
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Cross-Origin-Opener-Policy": "same-origin"
    }
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", __vite_injected_original_import_meta_url)),
      "~": fileURLToPath(new URL("./src", __vite_injected_original_import_meta_url)),
      src: fileURLToPath(new URL("./src", __vite_injected_original_import_meta_url)),
      "@assets": fileURLToPath(new URL("src/assets", __vite_injected_original_import_meta_url)),
      comlink: "comlink",
      debug: "debug"
    }
  },
  css: {
    preprocessorOptions: {
      scss: {
        includePaths: [fileURLToPath(new URL("./src/assets/styles", __vite_injected_original_import_meta_url))]
      },
      quietDeps: true
    }
  },
  plugins: [
    vue(),
    usePages({
      dirs: [
        {
          dir: "src/pages",
          baseRoute: "common"
        },
        {
          dir: "src/setup/pages",
          baseRoute: "setup"
        },
        {
          dir: "src/popup/pages",
          baseRoute: "popup"
        },
        {
          dir: "src/popup/windows",
          baseRoute: "windows"
        }
      ]
    }),
    useAutoImport({
      imports: [
        "vue",
        "vue-router",
        {
          "webextension-polyfill": [["*", "browser"]]
        }
      ],
      dts: "src/types/auto-imports.d.ts",
      dirs: ["src/composables/", "src/stores/", "src/utils/"],
      eslintrc: {
        enabled: true,
        filepath: "src/types/.eslintrc-auto-import.json"
      }
    }),
    useComponents({
      dirs: ["src/components"],
      dts: "src/types/components.d.ts"
    }),
    {
      name: "assets-rewrite",
      enforce: "post",
      apply: "build",
      transformIndexHtml(html, { path }) {
        const assetsPath = relative(dirname(path), "/assets").replace(/\\/g, "/");
        return html.replace(/"\/assets\//g, `"${assetsPath}/`);
      }
    },
    {
      name: "wasm-content-type",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url?.endsWith(".wasm")) {
            res.setHeader("Content-Type", "application/wasm");
          }
          next();
        });
      }
    },
    viteStaticCopy({
      targets: [
        {
          src: "./libs/@aztec/bb.js/*.wasm.gz",
          dest: "assets/"
        }
      ]
    }),
    nodePolyfills({
      include: [
        "buffer",
        /*"crypto",*/
        "net",
        "path",
        "stream",
        "tty",
        "vm",
        "util"
      ]
    })
  ],
  build: {
    target: "esnext",
    rollupOptions: {
      input: {
        offscreen: "src/offscreen/index.html",
        popup: "src/popup/index.html",
        setup: "src/setup/index.html"
      }
    }
  },
  optimizeDeps: {
    include: ["vue", "webextension-polyfill"],
    exclude: ["vue-demi", "@aztec/bb.js", "@aztec/noir-acvm_js", "@aztec/noir-noirc_abi"],
    esbuildOptions: {
      target: "esnext"
    }
  },
  define: {
    __VERSION__: JSON.stringify(package_default.version),
    __SENTINEL__: JSON.stringify(package_default.sentinel),
    __AZTEC_VERSION__: JSON.stringify(package_default.dependencies["@aztec/pxe"] ?? "unknown"),
    __NAME__: JSON.stringify(package_default.name),
    __DISPLAY_NAME__: JSON.stringify(package_default.displayName),
    "import.meta.env.HTML_TITLE": JSON.stringify(package_default.displayName),
    "process.browser": true,
    "process.env": JSON.stringify({
      LOG_LEVEL: "verbose",
      BB_WASM_PATH: "/assets/barretenberg.wasm.gz"
    })
  }
});

// vite.chrome.config.mts
vite_config_default.plugins?.push(
  crx({
    manifest: manifest_chrome_config_default,
    browser: "chrome"
  })
);
if (!vite_config_default.build) {
  vite_config_default.build = {};
}
vite_config_default.build.outDir = "dist/chrome";
var vite_chrome_config_default = defineConfig2({
  ...vite_config_default
});
export {
  vite_chrome_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jaHJvbWUuY29uZmlnLm10cyIsICJtYW5pZmVzdC9tYW5pZmVzdC5jaHJvbWUuY29uZmlnLnRzIiwgInBhY2thZ2UuanNvbiIsICJtYW5pZmVzdC9tYW5pZmVzdC5jb25maWcudHMiLCAidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFx1c2VyXFxcXFJlcG9zXFxcXGF6Z3VhcmQtd2FsbGV0XCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFx1c2VyXFxcXFJlcG9zXFxcXGF6Z3VhcmQtd2FsbGV0XFxcXHZpdGUuY2hyb21lLmNvbmZpZy5tdHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0M6L1VzZXJzL3VzZXIvUmVwb3MvYXpndWFyZC13YWxsZXQvdml0ZS5jaHJvbWUuY29uZmlnLm10c1wiO2ltcG9ydCB7IGRlZmluZUNvbmZpZyB9IGZyb20gXCJ2aXRlXCJcclxuaW1wb3J0IHsgY3J4IH0gZnJvbSBcIkBjcnhqcy92aXRlLXBsdWdpblwiXHJcblxyXG5pbXBvcnQgbWFuaWZlc3QgZnJvbSBcIi4vbWFuaWZlc3QvbWFuaWZlc3QuY2hyb21lLmNvbmZpZ1wiXHJcbmltcG9ydCB2aXRlQ29uZmlnIGZyb20gXCIuL3ZpdGUuY29uZmlnXCJcclxuXHJcbnZpdGVDb25maWcucGx1Z2lucz8ucHVzaChcclxuXHRjcngoe1xyXG5cdFx0bWFuaWZlc3QsXHJcblx0XHRicm93c2VyOiBcImNocm9tZVwiLFxyXG5cdH0pXHJcbilcclxuXHJcbmlmICghdml0ZUNvbmZpZy5idWlsZCkge1xyXG5cdHZpdGVDb25maWcuYnVpbGQgPSB7fVxyXG59XHJcblxyXG52aXRlQ29uZmlnLmJ1aWxkLm91dERpciA9IFwiZGlzdC9jaHJvbWVcIlxyXG5cclxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcclxuXHQuLi52aXRlQ29uZmlnLFxyXG59KVxyXG4iLCAiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIkM6XFxcXFVzZXJzXFxcXHVzZXJcXFxcUmVwb3NcXFxcYXpndWFyZC13YWxsZXRcXFxcbWFuaWZlc3RcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkM6XFxcXFVzZXJzXFxcXHVzZXJcXFxcUmVwb3NcXFxcYXpndWFyZC13YWxsZXRcXFxcbWFuaWZlc3RcXFxcbWFuaWZlc3QuY2hyb21lLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vQzovVXNlcnMvdXNlci9SZXBvcy9hemd1YXJkLXdhbGxldC9tYW5pZmVzdC9tYW5pZmVzdC5jaHJvbWUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lTWFuaWZlc3QgfSBmcm9tICdAY3J4anMvdml0ZS1wbHVnaW4nXHJcblxyXG5pbXBvcnQgTWFuaWZlc3RDb25maWcgZnJvbSAnLi9tYW5pZmVzdC5jb25maWcnXHJcblxyXG4vLyBAdHMtZXhwZWN0LWVycm9yIE1hbmlmZXN0Q29uZmlnIHByb3ZpZGVzIGFsbCByZXF1aXJlZCBmaWVsZHNcclxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lTWFuaWZlc3QoKF9lbnYpID0+ICh7XHJcbiAgLi4uTWFuaWZlc3RDb25maWcsXHJcbn0pKVxyXG4iLCAie1xyXG5cdFwibmFtZVwiOiBcImF6Z3VhcmQtd2FsbGV0XCIsXHJcblx0XCJkaXNwbGF5TmFtZVwiOiBcIkF6Z3VhcmQgV2FsbGV0XCIsXHJcblx0XCJkZXNjcmlwdGlvblwiOiBcIlVzZXItZnJpZW5kbHkgc2VsZi1jdXN0b2R5IHdhbGxldCBmb3IgQXp0ZWMgbmV0d29yaywgcHJlc2VydmluZyB5b3VyIHByaXZhY3kgYW5kIHJldmVhbGluZyB0aGUgcG93ZXIgb2YgYWNjb3VudCBhYnN0cmFjdGlvbi5cIixcclxuXHRcInZlcnNpb25cIjogXCIwLjMuNVwiLFxyXG5cdFwic2VudGluZWxcIjogXCIxXCIsXHJcblx0XCJzY3JpcHRzXCI6IHtcclxuXHRcdFwiYnVpbGQ6ZnVsbFwiOiBcIm5wbSBydW4gYnVpbGQ6Y2hyb21lICYmIG5wbSBydW4gYnVpbGQ6ZmlyZWZveFwiLFxyXG5cdFx0XCJidWlsZFwiOiBcImNyb3NzLWVudiBOT0RFX09QVElPTlM9LS1tYXgtb2xkLXNwYWNlLXNpemU9MTYwMDAgdml0ZSBidWlsZCAtYyB2aXRlLmNocm9tZS5jb25maWcubXRzXCIsXHJcblx0XHRcImJ1aWxkOmNocm9tZVwiOiBcImNyb3NzLWVudiBOT0RFX09QVElPTlM9LS1tYXgtb2xkLXNwYWNlLXNpemU9MTYwMDAgdml0ZSBidWlsZCAtYyB2aXRlLmNocm9tZS5jb25maWcubXRzXCIsXHJcblx0XHRcImJ1aWxkOmZpcmVmb3hcIjogXCJjcm9zcy1lbnYgTk9ERV9PUFRJT05TPS0tbWF4LW9sZC1zcGFjZS1zaXplPTE2MDAwIHZpdGUgYnVpbGQgLWMgdml0ZS5maXJlZm94LmNvbmZpZy5tdHNcIixcclxuXHRcdFwiZGV2OmZ1bGxcIjogXCJjb25jdXJyZW50bHkgXFxcIm5wbSBydW4gZGV2OmNocm9tZVxcXCIgXFxcIm5wbSBydW4gZGV2OmZpcmVmb3hcXFwiXCIsXHJcblx0XHRcImRldlwiOiBcInZpdGUgLWMgdml0ZS5jaHJvbWUuY29uZmlnLm10c1wiLFxyXG5cdFx0XCJkZXY6Y2hyb21lXCI6IFwidml0ZSAtYyB2aXRlLmNocm9tZS5jb25maWcubXRzXCIsXHJcblx0XHRcImRldjpmaXJlZm94XCI6IFwidml0ZSBidWlsZCAtLW1vZGUgZGV2ZWxvcG1lbnQgLS13YXRjaCAtYyB2aXRlLmZpcmVmb3guY29uZmlnLm10c1wiLFxyXG5cdFx0XCJwcmV2aWV3XCI6IFwidml0ZSBwcmV2aWV3XCIsXHJcblx0XHRcInR5cGVjaGVja1wiOiBcInZ1ZS10c2MgLS1ub0VtaXRcIixcclxuXHRcdFwidGVzdFwiOiBcInZpdGVzdFwiXHJcblx0fSxcclxuXHRcImRlcGVuZGVuY2llc1wiOiB7XHJcblx0XHRcIkBhenRlYy9henRlYy5qc1wiOiBcIjAuODcuOFwiLFxyXG5cdFx0XCJAYXp0ZWMvYmIuanNcIjogXCIwLjg3LjhcIixcclxuXHRcdFwiQGF6dGVjL2NvbnN0YW50c1wiOiBcIjAuODcuOFwiLFxyXG5cdFx0XCJAYXp0ZWMvZm91bmRhdGlvblwiOiBcIjAuODcuOFwiLFxyXG5cdFx0XCJAYXp0ZWMvbm9pci1jb250cmFjdHMuanNcIjogXCIwLjg3LjhcIixcclxuXHRcdFwiQGF6dGVjL3B4ZVwiOiBcIjAuODcuOFwiLFxyXG5cdFx0XCJAYXp0ZWMvc3RkbGliXCI6IFwiMC44Ny44XCIsXHJcblx0XHRcIkBjb2RlbWlycm9yL2xhbmctanNvblwiOiBcIl42LjAuMVwiLFxyXG5cdFx0XCJAcmVvd24vd2FsbGV0a2l0XCI6IFwiXjEuMS4xXCIsXHJcblx0XHRcIkByZXBsaXQvY29kZW1pcnJvci1pbmRlbnRhdGlvbi1tYXJrZXJzXCI6IFwiXjYuNS4zXCIsXHJcblx0XHRcIkB3YWxsZXRjb25uZWN0L2NvcmVcIjogXCJeMi4xNy4yXCIsXHJcblx0XHRcIkB3YWxsZXRjb25uZWN0L3V0aWxzXCI6IFwiXjIuMTcuMlwiLFxyXG5cdFx0XCJiaWdudW1iZXIuanNcIjogXCJeOS4xLjJcIixcclxuXHRcdFwiY29kZW1pcnJvclwiOiBcIl42LjAuMVwiLFxyXG5cdFx0XCJmb2N1cy10cmFwXCI6IFwiXjcuNi4yXCIsXHJcblx0XHRcImxlYW4tcXJcIjogXCJeMi4zLjRcIixcclxuXHRcdFwibHV4b25cIjogXCJeMy41LjBcIixcclxuXHRcdFwicGluaWFcIjogXCJeMi4yLjRcIixcclxuXHRcdFwidnVlXCI6IFwiXjMuNS4xMlwiLFxyXG5cdFx0XCJ2dWUtcm91dGVyXCI6IFwiXjQuNC41XCIsXHJcblx0XHRcIndlYmV4dGVuc2lvbi1wb2x5ZmlsbFwiOiBcIl4wLjEyLjBcIixcclxuXHRcdFwiem9kXCI6IFwiXjMuMjMuOFwiXHJcblx0fSxcclxuXHRcImRldkRlcGVuZGVuY2llc1wiOiB7XHJcblx0XHRcIkBiaW9tZWpzL2Jpb21lXCI6IFwiXjEuOS40XCIsXHJcblx0XHRcIkBjcnhqcy92aXRlLXBsdWdpblwiOiBcIl4yLjAuMC1iZXRhLjI2XCIsXHJcblx0XHRcIkB0eXBlcy9ub2RlXCI6IFwiXjIyLjcuOFwiLFxyXG5cdFx0XCJAdHlwZXMvd2ViZXh0ZW5zaW9uLXBvbHlmaWxsXCI6IFwiXjAuMTIuMVwiLFxyXG5cdFx0XCJAdml0ZWpzL3BsdWdpbi12dWVcIjogXCJeNS4xLjRcIixcclxuXHRcdFwiQHZ1ZS9jb21waWxlci1zZmNcIjogXCJeMy41LjEyXCIsXHJcblx0XHRcImNocm9tZS10eXBlc1wiOiBcIl4wLjEuMzExXCIsXHJcblx0XHRcImNvbmN1cnJlbnRseVwiOiBcIl45LjAuMVwiLFxyXG5cdFx0XCJjcm9zcy1lbnZcIjogXCJeNy4wLjNcIixcclxuXHRcdFwiZ2xvYmFsc1wiOiBcIl4xNS4xMS4wXCIsXHJcblx0XHRcImpzZG9tXCI6IFwiXjI1LjAuMVwiLFxyXG5cdFx0XCJwb3N0Y3NzXCI6IFwiXjguNC40N1wiLFxyXG5cdFx0XCJzYXNzXCI6IFwiXjEuODAuM1wiLFxyXG5cdFx0XCJ0eXBlc2NyaXB0XCI6IFwiXjUuNi4zXCIsXHJcblx0XHRcInVucGx1Z2luLWF1dG8taW1wb3J0XCI6IFwiXjAuMTguM1wiLFxyXG5cdFx0XCJ1bnBsdWdpbi12dWUtY29tcG9uZW50c1wiOiBcIl4wLjI3LjRcIixcclxuXHRcdFwidW5wbHVnaW4tdnVlLXJvdXRlclwiOiBcIl4wLjEwLjlcIixcclxuXHRcdFwidml0ZVwiOiBcIl41LjQuOVwiLFxyXG5cdFx0XCJ2aXRlLXBsdWdpbi1ub2RlLXBvbHlmaWxsc1wiOiBcIl4wLjIzLjBcIixcclxuXHRcdFwidml0ZS1wbHVnaW4tcGFnZXNcIjogXCJeMC4zMi4zXCIsXHJcbiAgICBcdFwidml0ZS1wbHVnaW4tc3RhdGljLWNvcHlcIjogXCJeMi4yLjBcIixcclxuXHRcdFwidml0ZS1wbHVnaW4tdnVlLWRldnRvb2xzXCI6IFwiXjcuNS4zXCIsXHJcblx0XHRcInZpdGVzdFwiOiBcIl4yLjEuM1wiLFxyXG5cdFx0XCJ2dWUtdHNjXCI6IFwiXjIuMS42XCIsXHJcblx0XHRcIndlYmV4dC1icmlkZ2VcIjogXCJeNi4wLjFcIlxyXG5cdH0sXHJcblx0XCJvdmVycmlkZXNcIjoge1xyXG5cdFx0XCJAY3J4anMvdml0ZS1wbHVnaW5cIjogXCIkQGNyeGpzL3ZpdGUtcGx1Z2luXCJcclxuXHR9LFxyXG5cdFwicG5wbVwiOiB7XHJcblx0XHRcIm92ZXJyaWRlc1wiOiB7fSxcclxuXHRcdFwicGVlckRlcGVuZGVuY3lSdWxlc1wiOiB7XHJcblx0XHRcdFwiYWxsb3dBbnlcIjogW10sXHJcblx0XHRcdFwiYWxsb3dlZFZlcnNpb25zXCI6IHt9LFxyXG5cdFx0XHRcImlnbm9yZU1pc3NpbmdcIjogW11cclxuXHRcdH1cclxuXHR9LFxyXG5cdFwicGFja2FnZU1hbmFnZXJcIjogXCJ5YXJuQDEuMjIuMjIrc2hhNTEyLmE2YjJmNzkwNmI3MjFiYmEzZDY3ZDRhZmYwODNkZjA0ZGFkNjRjMzk5NzA3ODQxYjdhY2YwMGY2YjEzM2I3YWMyNDI1NWYyNjUyZmEyMmFlMzUzNDMyOWRjNjE4MDUzNGU5OGQxNzQzMjAzN2ZmNmZkMTQwNTU2ZTJiYjMxMzdlXCJcclxufVxyXG4iLCAiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIkM6XFxcXFVzZXJzXFxcXHVzZXJcXFxcUmVwb3NcXFxcYXpndWFyZC13YWxsZXRcXFxcbWFuaWZlc3RcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkM6XFxcXFVzZXJzXFxcXHVzZXJcXFxcUmVwb3NcXFxcYXpndWFyZC13YWxsZXRcXFxcbWFuaWZlc3RcXFxcbWFuaWZlc3QuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9DOi9Vc2Vycy91c2VyL1JlcG9zL2F6Z3VhcmQtd2FsbGV0L21hbmlmZXN0L21hbmlmZXN0LmNvbmZpZy50c1wiO2ltcG9ydCB0eXBlIHsgTWFuaWZlc3RWM0V4cG9ydCB9IGZyb20gXCJAY3J4anMvdml0ZS1wbHVnaW5cIlxyXG5pbXBvcnQgcGFja2FnZUpzb24gZnJvbSBcIi4uL3BhY2thZ2UuanNvblwiXHJcblxyXG5jb25zdCB7IHZlcnNpb24sIG5hbWUsIGRlc2NyaXB0aW9uLCBkaXNwbGF5TmFtZSB9ID0gcGFja2FnZUpzb25cclxuXHJcbmNvbnN0IFttYWpvciwgbWlub3IsIHBhdGNoLCBsYWJlbCA9IFwiMFwiXSA9IHZlcnNpb24ucmVwbGFjZSgvW15cXGQuLV0rL2csIFwiXCIpLnNwbGl0KC9bLi1dLylcclxuXHJcbmV4cG9ydCBkZWZhdWx0IHtcclxuXHRuYW1lOiBkaXNwbGF5TmFtZSB8fCBuYW1lLFxyXG5cdGRlc2NyaXB0aW9uLFxyXG5cdHZlcnNpb246IGAke21ham9yfS4ke21pbm9yfS4ke3BhdGNofS4ke2xhYmVsfWAsXHJcblx0dmVyc2lvbl9uYW1lOiB2ZXJzaW9uLFxyXG5cdG1hbmlmZXN0X3ZlcnNpb246IDMsXHJcblx0YWN0aW9uOiB7XHJcblx0XHRkZWZhdWx0X3BvcHVwOiBcInNyYy9wb3B1cC9pbmRleC5odG1sIy9wb3B1cC9nZW5lcmFsXCIsXHJcblx0fSxcclxuXHRiYWNrZ3JvdW5kOiB7XHJcblx0XHRzZXJ2aWNlX3dvcmtlcjogXCJzcmMvYmFja2dyb3VuZC9pbmRleC50c1wiLFxyXG5cdFx0dHlwZTogXCJtb2R1bGVcIixcclxuXHR9LFxyXG5cdHNpZGVfcGFuZWw6IHtcclxuXHRcdGRlZmF1bHRfcGF0aDogXCJzcmMvcG9wdXAvaW5kZXguaHRtbFwiLFxyXG5cdH0sXHJcblx0Y29udGVudF9zY3JpcHRzOiBbXHJcblx0XHR7XHJcblx0XHRcdGFsbF9mcmFtZXM6IHRydWUsXHJcblx0XHRcdGpzOiBbXCJzcmMvY29udGVudC1zY3JpcHQvY29udGVudC50c1wiXSxcclxuXHRcdFx0bWF0Y2hlczogW1wiKjovLyovKlwiXSxcclxuXHRcdFx0cnVuX2F0OiBcImRvY3VtZW50X3N0YXJ0XCIsXHJcblx0XHR9LFxyXG5cdF0sXHJcblx0cGVybWlzc2lvbnM6IFtcIm9mZnNjcmVlblwiLCBcInN0b3JhZ2VcIiwgXCJzaWRlUGFuZWxcIiwgXCJ1bmxpbWl0ZWRTdG9yYWdlXCJdLFxyXG5cdGNvbnRlbnRfc2VjdXJpdHlfcG9saWN5OiB7XHJcblx0XHRleHRlbnNpb25fcGFnZXM6IFwic2NyaXB0LXNyYyAnc2VsZicgJ3dhc20tdW5zYWZlLWV2YWwnXCIsXHJcblx0fSxcclxuXHRjcm9zc19vcmlnaW5fZW1iZWRkZXJfcG9saWN5OiB7XHJcblx0ICB2YWx1ZTogXCJyZXF1aXJlLWNvcnBcIlxyXG5cdH0sXHJcblx0Y3Jvc3Nfb3JpZ2luX29wZW5lcl9wb2xpY3k6IHtcclxuXHQgIHZhbHVlOiBcInNhbWUtb3JpZ2luXCJcclxuXHR9LFxyXG5cdGljb25zOiB7XHJcblx0XHQxNjogXCJzcmMvYXNzZXRzL2xvZ28ucG5nXCIsXHJcblx0XHQyNDogXCJzcmMvYXNzZXRzL2xvZ28ucG5nXCIsXHJcblx0XHQzMjogXCJzcmMvYXNzZXRzL2xvZ28ucG5nXCIsXHJcblx0XHQxMjg6IFwic3JjL2Fzc2V0cy9sb2dvLnBuZ1wiLFxyXG5cdH0sXHJcbn0gYXMgTWFuaWZlc3RWM0V4cG9ydFxyXG4iLCAiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIkM6XFxcXFVzZXJzXFxcXHVzZXJcXFxcUmVwb3NcXFxcYXpndWFyZC13YWxsZXRcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkM6XFxcXFVzZXJzXFxcXHVzZXJcXFxcUmVwb3NcXFxcYXpndWFyZC13YWxsZXRcXFxcdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0M6L1VzZXJzL3VzZXIvUmVwb3MvYXpndWFyZC13YWxsZXQvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkaXJuYW1lLCByZWxhdGl2ZSB9IGZyb20gXCJub2RlOnBhdGhcIlxyXG5pbXBvcnQgeyBmaWxlVVJMVG9QYXRoLCBVUkwgfSBmcm9tIFwibm9kZTp1cmxcIlxyXG5pbXBvcnQgdnVlIGZyb20gXCJAdml0ZWpzL3BsdWdpbi12dWVcIlxyXG5pbXBvcnQgdXNlUGFnZXMgZnJvbSBcInZpdGUtcGx1Z2luLXBhZ2VzXCJcclxuaW1wb3J0IHVzZUF1dG9JbXBvcnQgZnJvbSBcInVucGx1Z2luLWF1dG8taW1wb3J0L3ZpdGVcIlxyXG5pbXBvcnQgdXNlQ29tcG9uZW50cyBmcm9tIFwidW5wbHVnaW4tdnVlLWNvbXBvbmVudHMvdml0ZVwiXHJcbmltcG9ydCB7IGRlZmluZUNvbmZpZyB9IGZyb20gXCJ2aXRlXCJcclxuaW1wb3J0IHsgbm9kZVBvbHlmaWxscyB9IGZyb20gXCJ2aXRlLXBsdWdpbi1ub2RlLXBvbHlmaWxsc1wiXHJcbmltcG9ydCBwYWNrYWdlSnNvbiBmcm9tIFwiLi9wYWNrYWdlLmpzb25cIlxyXG5pbXBvcnQgeyB2aXRlU3RhdGljQ29weSB9IGZyb20gXCJ2aXRlLXBsdWdpbi1zdGF0aWMtY29weVwiXHJcblxyXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xyXG5cdHNlcnZlcjoge1xyXG5cdFx0cG9ydDogODA4OCxcclxuXHRcdHN0cmljdFBvcnQ6IHRydWUsXHJcblx0XHRobXI6IHtcclxuXHRcdFx0cG9ydDogODA4OCxcclxuXHRcdH0sXHJcblx0XHQvLyBIZWFkZXJzIG5lZWRlZCBmb3IgYmIgV0FTTSB0byB3b3JrIGluIG11bHRpdGhyZWFkZWQgbW9kZVxyXG5cdFx0aGVhZGVyczoge1xyXG5cdFx0XHRcIkNyb3NzLU9yaWdpbi1FbWJlZGRlci1Qb2xpY3lcIjogXCJyZXF1aXJlLWNvcnBcIixcclxuXHRcdFx0XCJDcm9zcy1PcmlnaW4tT3BlbmVyLVBvbGljeVwiOiBcInNhbWUtb3JpZ2luXCIsXHJcblx0XHR9LFxyXG5cdH0sXHJcblx0cmVzb2x2ZToge1xyXG5cdFx0YWxpYXM6IHtcclxuXHRcdFx0XCJAXCI6IGZpbGVVUkxUb1BhdGgobmV3IFVSTChcIi4vc3JjXCIsIGltcG9ydC5tZXRhLnVybCkpLFxyXG5cdFx0XHRcIn5cIjogZmlsZVVSTFRvUGF0aChuZXcgVVJMKFwiLi9zcmNcIiwgaW1wb3J0Lm1ldGEudXJsKSksXHJcblx0XHRcdHNyYzogZmlsZVVSTFRvUGF0aChuZXcgVVJMKFwiLi9zcmNcIiwgaW1wb3J0Lm1ldGEudXJsKSksXHJcblx0XHRcdFwiQGFzc2V0c1wiOiBmaWxlVVJMVG9QYXRoKG5ldyBVUkwoXCJzcmMvYXNzZXRzXCIsIGltcG9ydC5tZXRhLnVybCkpLFxyXG5cdFx0XHRjb21saW5rOiBcImNvbWxpbmtcIixcclxuXHRcdFx0ZGVidWc6IFwiZGVidWdcIixcclxuXHRcdH0sXHJcblx0fSxcclxuXHRjc3M6IHtcclxuXHRcdHByZXByb2Nlc3Nvck9wdGlvbnM6IHtcclxuXHRcdFx0c2Nzczoge1xyXG5cdFx0XHRcdGluY2x1ZGVQYXRoczogW2ZpbGVVUkxUb1BhdGgobmV3IFVSTChcIi4vc3JjL2Fzc2V0cy9zdHlsZXNcIiwgaW1wb3J0Lm1ldGEudXJsKSldLFxyXG5cdFx0XHR9LFxyXG5cdFx0XHRxdWlldERlcHM6IHRydWUsXHJcblx0XHR9LFxyXG5cdH0sXHJcblx0cGx1Z2luczogW1xyXG5cdFx0dnVlKCksXHJcblxyXG5cdFx0dXNlUGFnZXMoe1xyXG5cdFx0XHRkaXJzOiBbXHJcblx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0ZGlyOiBcInNyYy9wYWdlc1wiLFxyXG5cdFx0XHRcdFx0YmFzZVJvdXRlOiBcImNvbW1vblwiLFxyXG5cdFx0XHRcdH0sXHJcblx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0ZGlyOiBcInNyYy9zZXR1cC9wYWdlc1wiLFxyXG5cdFx0XHRcdFx0YmFzZVJvdXRlOiBcInNldHVwXCIsXHJcblx0XHRcdFx0fSxcclxuXHRcdFx0XHR7XHJcblx0XHRcdFx0XHRkaXI6IFwic3JjL3BvcHVwL3BhZ2VzXCIsXHJcblx0XHRcdFx0XHRiYXNlUm91dGU6IFwicG9wdXBcIixcclxuXHRcdFx0XHR9LFxyXG5cdFx0XHRcdHtcclxuXHRcdFx0XHRcdGRpcjogXCJzcmMvcG9wdXAvd2luZG93c1wiLFxyXG5cdFx0XHRcdFx0YmFzZVJvdXRlOiBcIndpbmRvd3NcIixcclxuXHRcdFx0XHR9LFxyXG5cdFx0XHRdLFxyXG5cdFx0fSksXHJcblxyXG5cdFx0dXNlQXV0b0ltcG9ydCh7XHJcblx0XHRcdGltcG9ydHM6IFtcclxuXHRcdFx0XHRcInZ1ZVwiLFxyXG5cdFx0XHRcdFwidnVlLXJvdXRlclwiLFxyXG5cdFx0XHRcdHtcclxuXHRcdFx0XHRcdFwid2ViZXh0ZW5zaW9uLXBvbHlmaWxsXCI6IFtbXCIqXCIsIFwiYnJvd3NlclwiXV0sXHJcblx0XHRcdFx0fSxcclxuXHRcdFx0XSxcclxuXHRcdFx0ZHRzOiBcInNyYy90eXBlcy9hdXRvLWltcG9ydHMuZC50c1wiLFxyXG5cdFx0XHRkaXJzOiBbXCJzcmMvY29tcG9zYWJsZXMvXCIsIFwic3JjL3N0b3Jlcy9cIiwgXCJzcmMvdXRpbHMvXCJdLFxyXG5cdFx0XHRlc2xpbnRyYzoge1xyXG5cdFx0XHRcdGVuYWJsZWQ6IHRydWUsXHJcblx0XHRcdFx0ZmlsZXBhdGg6IFwic3JjL3R5cGVzLy5lc2xpbnRyYy1hdXRvLWltcG9ydC5qc29uXCIsXHJcblx0XHRcdH0sXHJcblx0XHR9KSxcclxuXHJcblx0XHR1c2VDb21wb25lbnRzKHtcclxuXHRcdFx0ZGlyczogW1wic3JjL2NvbXBvbmVudHNcIl0sXHJcblx0XHRcdGR0czogXCJzcmMvdHlwZXMvY29tcG9uZW50cy5kLnRzXCIsXHJcblx0XHR9KSxcclxuXHJcblx0XHR7XHJcblx0XHRcdG5hbWU6IFwiYXNzZXRzLXJld3JpdGVcIixcclxuXHRcdFx0ZW5mb3JjZTogXCJwb3N0XCIsXHJcblx0XHRcdGFwcGx5OiBcImJ1aWxkXCIsXHJcblx0XHRcdHRyYW5zZm9ybUluZGV4SHRtbChodG1sLCB7IHBhdGggfSkge1xyXG5cdFx0XHRcdGNvbnN0IGFzc2V0c1BhdGggPSByZWxhdGl2ZShkaXJuYW1lKHBhdGgpLCBcIi9hc3NldHNcIikucmVwbGFjZSgvXFxcXC9nLCBcIi9cIilcclxuXHRcdFx0XHRyZXR1cm4gaHRtbC5yZXBsYWNlKC9cIlxcL2Fzc2V0c1xcLy9nLCBgXCIke2Fzc2V0c1BhdGh9L2ApXHJcblx0XHRcdH0sXHJcblx0XHR9LFxyXG5cclxuXHRcdHtcclxuXHRcdFx0bmFtZTogXCJ3YXNtLWNvbnRlbnQtdHlwZVwiLFxyXG5cdFx0XHRjb25maWd1cmVTZXJ2ZXIoc2VydmVyKSB7XHJcblx0XHRcdFx0c2VydmVyLm1pZGRsZXdhcmVzLnVzZSgocmVxLCByZXMsIG5leHQpID0+IHtcclxuXHRcdFx0XHRcdGlmIChyZXEudXJsPy5lbmRzV2l0aChcIi53YXNtXCIpKSB7XHJcblx0XHRcdFx0XHRcdHJlcy5zZXRIZWFkZXIoXCJDb250ZW50LVR5cGVcIiwgXCJhcHBsaWNhdGlvbi93YXNtXCIpXHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRuZXh0KClcclxuXHRcdFx0XHR9KVxyXG5cdFx0XHR9LFxyXG5cdFx0fSxcclxuXHJcblx0XHR2aXRlU3RhdGljQ29weSh7XHJcblx0XHRcdHRhcmdldHM6IFtcclxuXHRcdFx0XHR7XHJcblx0XHRcdFx0XHRzcmM6IFwiLi9saWJzL0BhenRlYy9iYi5qcy8qLndhc20uZ3pcIixcclxuXHRcdFx0XHRcdGRlc3Q6IFwiYXNzZXRzL1wiLFxyXG5cdFx0XHRcdH0sXHJcblx0XHRcdF0sXHJcblx0XHR9KSxcclxuXHJcblx0XHRub2RlUG9seWZpbGxzKHtcclxuXHRcdFx0aW5jbHVkZTogW1wiYnVmZmVyXCIsIC8qXCJjcnlwdG9cIiwqLyBcIm5ldFwiLCBcInBhdGhcIiwgXCJzdHJlYW1cIiwgXCJ0dHlcIiwgXCJ2bVwiLCBcInV0aWxcIl0sXHJcblx0XHR9KSxcclxuXHRdLFxyXG5cdGJ1aWxkOiB7XHJcblx0XHR0YXJnZXQ6IFwiZXNuZXh0XCIsXHJcblx0XHRyb2xsdXBPcHRpb25zOiB7XHJcblx0XHRcdGlucHV0OiB7XHJcblx0XHRcdFx0b2Zmc2NyZWVuOiBcInNyYy9vZmZzY3JlZW4vaW5kZXguaHRtbFwiLFxyXG5cdFx0XHRcdHBvcHVwOiBcInNyYy9wb3B1cC9pbmRleC5odG1sXCIsXHJcblx0XHRcdFx0c2V0dXA6IFwic3JjL3NldHVwL2luZGV4Lmh0bWxcIixcclxuXHRcdFx0fSxcclxuXHRcdH0sXHJcblx0fSxcclxuXHRvcHRpbWl6ZURlcHM6IHtcclxuXHRcdGluY2x1ZGU6IFtcInZ1ZVwiLCBcIndlYmV4dGVuc2lvbi1wb2x5ZmlsbFwiXSxcclxuXHRcdGV4Y2x1ZGU6IFtcInZ1ZS1kZW1pXCIsIFwiQGF6dGVjL2JiLmpzXCIsIFwiQGF6dGVjL25vaXItYWN2bV9qc1wiLCBcIkBhenRlYy9ub2lyLW5vaXJjX2FiaVwiXSxcclxuXHRcdGVzYnVpbGRPcHRpb25zOiB7XHJcblx0XHRcdHRhcmdldDogXCJlc25leHRcIixcclxuXHRcdH0sXHJcblx0fSxcclxuXHRkZWZpbmU6IHtcclxuXHRcdF9fVkVSU0lPTl9fOiBKU09OLnN0cmluZ2lmeShwYWNrYWdlSnNvbi52ZXJzaW9uKSxcclxuXHRcdF9fU0VOVElORUxfXzogSlNPTi5zdHJpbmdpZnkocGFja2FnZUpzb24uc2VudGluZWwpLFxyXG5cdFx0X19BWlRFQ19WRVJTSU9OX186IEpTT04uc3RyaW5naWZ5KHBhY2thZ2VKc29uLmRlcGVuZGVuY2llc1tcIkBhenRlYy9weGVcIl0gPz8gXCJ1bmtub3duXCIpLFxyXG5cdFx0X19OQU1FX186IEpTT04uc3RyaW5naWZ5KHBhY2thZ2VKc29uLm5hbWUpLFxyXG5cdFx0X19ESVNQTEFZX05BTUVfXzogSlNPTi5zdHJpbmdpZnkocGFja2FnZUpzb24uZGlzcGxheU5hbWUpLFxyXG5cdFx0XCJpbXBvcnQubWV0YS5lbnYuSFRNTF9USVRMRVwiOiBKU09OLnN0cmluZ2lmeShwYWNrYWdlSnNvbi5kaXNwbGF5TmFtZSksXHJcblx0XHRcInByb2Nlc3MuYnJvd3NlclwiOiB0cnVlLFxyXG5cdFx0XCJwcm9jZXNzLmVudlwiOiBKU09OLnN0cmluZ2lmeSh7XHJcblx0XHRcdExPR19MRVZFTDogXCJ2ZXJib3NlXCIsXHJcblx0XHRcdEJCX1dBU01fUEFUSDogXCIvYXNzZXRzL2JhcnJldGVuYmVyZy53YXNtLmd6XCIsXHJcblx0XHR9KSxcclxuXHR9LFxyXG59KVxyXG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQWtULFNBQVMsZ0JBQUFBLHFCQUFvQjtBQUMvVSxTQUFTLFdBQVc7OztBQ0RpVSxTQUFTLHNCQUFzQjs7O0FDQXBYO0FBQUEsRUFDQyxNQUFRO0FBQUEsRUFDUixhQUFlO0FBQUEsRUFDZixhQUFlO0FBQUEsRUFDZixTQUFXO0FBQUEsRUFDWCxVQUFZO0FBQUEsRUFDWixTQUFXO0FBQUEsSUFDVixjQUFjO0FBQUEsSUFDZCxPQUFTO0FBQUEsSUFDVCxnQkFBZ0I7QUFBQSxJQUNoQixpQkFBaUI7QUFBQSxJQUNqQixZQUFZO0FBQUEsSUFDWixLQUFPO0FBQUEsSUFDUCxjQUFjO0FBQUEsSUFDZCxlQUFlO0FBQUEsSUFDZixTQUFXO0FBQUEsSUFDWCxXQUFhO0FBQUEsSUFDYixNQUFRO0FBQUEsRUFDVDtBQUFBLEVBQ0EsY0FBZ0I7QUFBQSxJQUNmLG1CQUFtQjtBQUFBLElBQ25CLGdCQUFnQjtBQUFBLElBQ2hCLG9CQUFvQjtBQUFBLElBQ3BCLHFCQUFxQjtBQUFBLElBQ3JCLDRCQUE0QjtBQUFBLElBQzVCLGNBQWM7QUFBQSxJQUNkLGlCQUFpQjtBQUFBLElBQ2pCLHlCQUF5QjtBQUFBLElBQ3pCLG9CQUFvQjtBQUFBLElBQ3BCLDBDQUEwQztBQUFBLElBQzFDLHVCQUF1QjtBQUFBLElBQ3ZCLHdCQUF3QjtBQUFBLElBQ3hCLGdCQUFnQjtBQUFBLElBQ2hCLFlBQWM7QUFBQSxJQUNkLGNBQWM7QUFBQSxJ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
