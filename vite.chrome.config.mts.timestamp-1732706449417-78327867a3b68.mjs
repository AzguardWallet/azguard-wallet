// vite.chrome.config.mts
import { defineConfig as defineConfig2 } from "file:///C:/Users/user/Repos/azguard-wallet/node_modules/.pnpm/vite@5.4.11_@types+node@22.9.1_sass@1.80.6/node_modules/vite/dist/node/index.js";
import { crx } from "file:///C:/Users/user/Repos/azguard-wallet/node_modules/.pnpm/@crxjs+vite-plugin@2.0.0-beta.28/node_modules/@crxjs/vite-plugin/dist/index.mjs";

// manifest/manifest.chrome.config.ts
import { defineManifest } from "file:///C:/Users/user/Repos/azguard-wallet/node_modules/.pnpm/@crxjs+vite-plugin@2.0.0-beta.28/node_modules/@crxjs/vite-plugin/dist/index.mjs";

// package.json
var package_default = {
  name: "azguard-wallet",
  displayName: "Azguard Wallet",
  description: "Wallet for the Aztec blockchain",
  version: "0.1.0",
  scripts: {
    "build:full": "npm run build:chrome && npm run build:firefox",
    "build:chrome": "cross-env NODE_OPTIONS=--max-old-space-size=16000 vite build -c vite.chrome.config.mts",
    "build:firefox": "cross-env NODE_OPTIONS=--max-old-space-size=16000 vite build -c vite.firefox.config.mts",
    "dev:full": 'concurrently "npm run dev:chrome" "npm run dev:firefox"',
    "dev:chrome": "vite -c vite.chrome.config.mts",
    "dev:firefox": "vite build --mode development --watch -c vite.firefox.config.mts",
    preview: "vite preview",
    typecheck: "vue-tsc --noEmit",
    test: "vitest"
  },
  dependencies: {
    "@aztec/accounts": "^0.62.0",
    "@aztec/aztec.js": "^0.62.0",
    "@aztec/bb.js": "^0.62.0",
    "@aztec/foundation": "^0.62.0",
    "@reown/walletkit": "^1.1.1",
    "@walletconnect/core": "^2.17.2",
    "@walletconnect/logger": "^2.1.2",
    "@walletconnect/utils": "^2.17.2",
    bb: "^0.0.1",
    pinia: "^2.2.4",
    vue: "^3.5.12",
    "vue-router": "^4.4.5",
    "webextension-polyfill": "^0.12.0"
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
    "unplugin-vue-router": "^0.10.8",
    vite: "^5.4.9",
    "vite-plugin-node-polyfills": "^0.22.0",
    "vite-plugin-pages": "^0.32.3",
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
      allowedDeprecatedVersions: {
        "sourcemap-codec": "1.4.8"
      },
      allowedVersions: {},
      ignoreMissing: []
    }
  }
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
    default_popup: "src/popup/index.html"
  },
  background: {
    service_worker: "src/background/index.ts",
    type: "module"
  },
  // content_scripts: [
  // 	{
  // 		all_frames: true,
  // 		js: ["src/content-script/index.ts"],
  // 		matches: ["*://*/*"],
  // 		run_at: "document_end",
  // 	},
  // ],
  options_page: "src/options/index.html",
  offline_enabled: true,
  permissions: ["storage", "tabs", "background"],
  web_accessible_resources: [
    {
      matches: ["*://*/*"],
      resources: ["src/content-script/index.ts"]
    },
    {
      matches: ["*://*/*"],
      resources: ["src/content-script/iframe/index.html"]
    }
  ],
  content_security_policy: {
    extension_pages: "script-src 'self' 'wasm-unsafe-eval'"
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
import vue from "file:///C:/Users/user/Repos/azguard-wallet/node_modules/.pnpm/@vitejs+plugin-vue@5.2.0_vite@5.4.11_@types+node@22.9.1_sass@1.80.6__vue@3.5.13_typescript@5.6.3_/node_modules/@vitejs/plugin-vue/dist/index.mjs";
import usePages from "file:///C:/Users/user/Repos/azguard-wallet/node_modules/.pnpm/vite-plugin-pages@0.32.3_@vue+compiler-sfc@3.5.13_vite@5.4.11_@types+node@22.9.1_sass@1.80.6__kvtry26kez6rb6ju3btgv6tyym/node_modules/vite-plugin-pages/dist/index.js";
import useAutoImport from "file:///C:/Users/user/Repos/azguard-wallet/node_modules/.pnpm/unplugin-auto-import@0.18.5_rollup@4.27.3/node_modules/unplugin-auto-import/dist/vite.js";
import useComponents from "file:///C:/Users/user/Repos/azguard-wallet/node_modules/.pnpm/unplugin-vue-components@0.27.4_@babel+parser@7.26.2_rollup@4.27.3_vue@3.5.13_typescript@5.6.3_/node_modules/unplugin-vue-components/dist/vite.js";
import { defineConfig } from "file:///C:/Users/user/Repos/azguard-wallet/node_modules/.pnpm/vite@5.4.11_@types+node@22.9.1_sass@1.80.6/node_modules/vite/dist/node/index.js";
import { nodePolyfills } from "file:///C:/Users/user/Repos/azguard-wallet/node_modules/.pnpm/vite-plugin-node-polyfills@0.22.0_rollup@4.27.3_vite@5.4.11_@types+node@22.9.1_sass@1.80.6_/node_modules/vite-plugin-node-polyfills/dist/index.js";

// define.config.ts
var defineViteConfig = {
  __VERSION__: JSON.stringify(package_default.version),
  __NAME__: JSON.stringify(package_default.name),
  __DISPLAY_NAME__: JSON.stringify(package_default.displayName),
  "import.meta.env.HTML_TITLE": JSON.stringify(package_default.displayName),
  "process.env": process.env,
  "process.version": JSON.stringify(process.version),
  global: {}
};

// vite.config.ts
var __vite_injected_original_import_meta_url = "file:///C:/Users/user/Repos/azguard-wallet/vite.config.ts";
var vite_config_default = defineConfig({
  server: {
    port: 8080,
    strictPort: true,
    hmr: {
      port: 8080
    }
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", __vite_injected_original_import_meta_url)),
      "~": fileURLToPath(new URL("./src", __vite_injected_original_import_meta_url)),
      src: fileURLToPath(new URL("./src", __vite_injected_original_import_meta_url)),
      "@assets": fileURLToPath(new URL("src/assets", __vite_injected_original_import_meta_url)),
      "fs/promises": "node-stdlib-browser/mock/empty"
    }
  },
  css: {
    preprocessorOptions: {
      scss: {
        api: "modern"
      }
    }
  },
  plugins: [
    nodePolyfills({
      globals: {
        Buffer: true,
        global: true,
        process: true
      },
      exclude: [
        "fs"
      ]
    }),
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
          dir: "src/options/pages",
          baseRoute: "options"
        },
        {
          dir: "src/content-script/iframe/pages",
          baseRoute: "iframe"
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
        const assetsPath = relative(dirname(path), "/assets").replace(
          /\\/g,
          "/"
        );
        return html.replace(/"\/assets\//g, `"${assetsPath}/`);
      }
    }
  ],
  build: {
    target: "esnext",
    rollupOptions: {
      input: {
        iframe: "src/content-script/iframe/index.html",
        popup: "src/popup/index.html",
        setup: "src/setup/index.html",
        options: "src/options/index.html"
      }
    }
  },
  optimizeDeps: {
    include: ["vue", "webextension-polyfill"],
    exclude: ["vue-demi"],
    esbuildOptions: {
      target: "esnext"
    }
  },
  define: defineViteConfig
});

// vite.chrome.config.mts
vite_config_default.plugins?.push(
  crx({
    manifest: manifest_chrome_config_default,
    browser: "chrome",
    contentScripts: {
      injectCss: true
    }
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jaHJvbWUuY29uZmlnLm10cyIsICJtYW5pZmVzdC9tYW5pZmVzdC5jaHJvbWUuY29uZmlnLnRzIiwgInBhY2thZ2UuanNvbiIsICJtYW5pZmVzdC9tYW5pZmVzdC5jb25maWcudHMiLCAidml0ZS5jb25maWcudHMiLCAiZGVmaW5lLmNvbmZpZy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIkM6XFxcXFVzZXJzXFxcXHVzZXJcXFxcUmVwb3NcXFxcYXpndWFyZC13YWxsZXRcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkM6XFxcXFVzZXJzXFxcXHVzZXJcXFxcUmVwb3NcXFxcYXpndWFyZC13YWxsZXRcXFxcdml0ZS5jaHJvbWUuY29uZmlnLm10c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vQzovVXNlcnMvdXNlci9SZXBvcy9hemd1YXJkLXdhbGxldC92aXRlLmNocm9tZS5jb25maWcubXRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSBcInZpdGVcIlxyXG5pbXBvcnQgeyBjcnggfSBmcm9tIFwiQGNyeGpzL3ZpdGUtcGx1Z2luXCJcclxuXHJcbmltcG9ydCBtYW5pZmVzdCBmcm9tIFwiLi9tYW5pZmVzdC9tYW5pZmVzdC5jaHJvbWUuY29uZmlnXCJcclxuaW1wb3J0IHZpdGVDb25maWcgZnJvbSBcIi4vdml0ZS5jb25maWdcIlxyXG5cclxudml0ZUNvbmZpZy5wbHVnaW5zPy5wdXNoKFxyXG5cdGNyeCh7XHJcblx0XHRtYW5pZmVzdCxcclxuXHRcdGJyb3dzZXI6IFwiY2hyb21lXCIsXHJcblx0XHRjb250ZW50U2NyaXB0czoge1xyXG5cdFx0XHRpbmplY3RDc3M6IHRydWUsXHJcblx0XHR9LFxyXG5cdH0pXHJcbilcclxuXHJcbmlmICghdml0ZUNvbmZpZy5idWlsZCkge1xyXG5cdHZpdGVDb25maWcuYnVpbGQgPSB7fVxyXG59XHJcblxyXG52aXRlQ29uZmlnLmJ1aWxkLm91dERpciA9IFwiZGlzdC9jaHJvbWVcIlxyXG5cclxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcclxuXHQuLi52aXRlQ29uZmlnLFxyXG59KVxyXG4iLCAiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIkM6XFxcXFVzZXJzXFxcXHVzZXJcXFxcUmVwb3NcXFxcYXpndWFyZC13YWxsZXRcXFxcbWFuaWZlc3RcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkM6XFxcXFVzZXJzXFxcXHVzZXJcXFxcUmVwb3NcXFxcYXpndWFyZC13YWxsZXRcXFxcbWFuaWZlc3RcXFxcbWFuaWZlc3QuY2hyb21lLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vQzovVXNlcnMvdXNlci9SZXBvcy9hemd1YXJkLXdhbGxldC9tYW5pZmVzdC9tYW5pZmVzdC5jaHJvbWUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lTWFuaWZlc3QgfSBmcm9tICdAY3J4anMvdml0ZS1wbHVnaW4nXHJcblxyXG5pbXBvcnQgTWFuaWZlc3RDb25maWcgZnJvbSAnLi9tYW5pZmVzdC5jb25maWcnXHJcblxyXG4vLyBAdHMtZXhwZWN0LWVycm9yIE1hbmlmZXN0Q29uZmlnIHByb3ZpZGVzIGFsbCByZXF1aXJlZCBmaWVsZHNcclxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lTWFuaWZlc3QoKF9lbnYpID0+ICh7XHJcbiAgLi4uTWFuaWZlc3RDb25maWcsXHJcbn0pKVxyXG4iLCAie1xuXHRcIm5hbWVcIjogXCJhemd1YXJkLXdhbGxldFwiLFxuXHRcImRpc3BsYXlOYW1lXCI6IFwiQXpndWFyZCBXYWxsZXRcIixcblx0XCJkZXNjcmlwdGlvblwiOiBcIldhbGxldCBmb3IgdGhlIEF6dGVjIGJsb2NrY2hhaW5cIixcblx0XCJ2ZXJzaW9uXCI6IFwiMC4xLjBcIixcblx0XCJzY3JpcHRzXCI6IHtcblx0XHRcImJ1aWxkOmZ1bGxcIjogXCJucG0gcnVuIGJ1aWxkOmNocm9tZSAmJiBucG0gcnVuIGJ1aWxkOmZpcmVmb3hcIixcblx0XHRcImJ1aWxkOmNocm9tZVwiOiBcImNyb3NzLWVudiBOT0RFX09QVElPTlM9LS1tYXgtb2xkLXNwYWNlLXNpemU9MTYwMDAgdml0ZSBidWlsZCAtYyB2aXRlLmNocm9tZS5jb25maWcubXRzXCIsXG5cdFx0XCJidWlsZDpmaXJlZm94XCI6IFwiY3Jvc3MtZW52IE5PREVfT1BUSU9OUz0tLW1heC1vbGQtc3BhY2Utc2l6ZT0xNjAwMCB2aXRlIGJ1aWxkIC1jIHZpdGUuZmlyZWZveC5jb25maWcubXRzXCIsXG5cdFx0XCJkZXY6ZnVsbFwiOiBcImNvbmN1cnJlbnRseSBcXFwibnBtIHJ1biBkZXY6Y2hyb21lXFxcIiBcXFwibnBtIHJ1biBkZXY6ZmlyZWZveFxcXCJcIixcblx0XHRcImRldjpjaHJvbWVcIjogXCJ2aXRlIC1jIHZpdGUuY2hyb21lLmNvbmZpZy5tdHNcIixcblx0XHRcImRldjpmaXJlZm94XCI6IFwidml0ZSBidWlsZCAtLW1vZGUgZGV2ZWxvcG1lbnQgLS13YXRjaCAtYyB2aXRlLmZpcmVmb3guY29uZmlnLm10c1wiLFxuXHRcdFwicHJldmlld1wiOiBcInZpdGUgcHJldmlld1wiLFxuXHRcdFwidHlwZWNoZWNrXCI6IFwidnVlLXRzYyAtLW5vRW1pdFwiLFxuXHRcdFwidGVzdFwiOiBcInZpdGVzdFwiXG5cdH0sXG5cdFwiZGVwZW5kZW5jaWVzXCI6IHtcblx0XHRcIkBhenRlYy9hY2NvdW50c1wiOiBcIl4wLjYyLjBcIixcblx0XHRcIkBhenRlYy9henRlYy5qc1wiOiBcIl4wLjYyLjBcIixcblx0XHRcIkBhenRlYy9iYi5qc1wiOiBcIl4wLjYyLjBcIixcblx0XHRcIkBhenRlYy9mb3VuZGF0aW9uXCI6IFwiXjAuNjIuMFwiLFxuXHRcdFwiQHJlb3duL3dhbGxldGtpdFwiOiBcIl4xLjEuMVwiLFxuXHRcdFwiQHdhbGxldGNvbm5lY3QvY29yZVwiOiBcIl4yLjE3LjJcIixcblx0XHRcIkB3YWxsZXRjb25uZWN0L2xvZ2dlclwiOiBcIl4yLjEuMlwiLFxuXHRcdFwiQHdhbGxldGNvbm5lY3QvdXRpbHNcIjogXCJeMi4xNy4yXCIsXG5cdFx0XCJiYlwiOiBcIl4wLjAuMVwiLFxuXHRcdFwicGluaWFcIjogXCJeMi4yLjRcIixcblx0XHRcInZ1ZVwiOiBcIl4zLjUuMTJcIixcblx0XHRcInZ1ZS1yb3V0ZXJcIjogXCJeNC40LjVcIixcblx0XHRcIndlYmV4dGVuc2lvbi1wb2x5ZmlsbFwiOiBcIl4wLjEyLjBcIlxuXHR9LFxuXHRcImRldkRlcGVuZGVuY2llc1wiOiB7XG5cdFx0XCJAYmlvbWVqcy9iaW9tZVwiOiBcIl4xLjkuNFwiLFxuXHRcdFwiQGNyeGpzL3ZpdGUtcGx1Z2luXCI6IFwiXjIuMC4wLWJldGEuMjZcIixcblx0XHRcIkB0eXBlcy9ub2RlXCI6IFwiXjIyLjcuOFwiLFxuXHRcdFwiQHR5cGVzL3dlYmV4dGVuc2lvbi1wb2x5ZmlsbFwiOiBcIl4wLjEyLjFcIixcblx0XHRcIkB2aXRlanMvcGx1Z2luLXZ1ZVwiOiBcIl41LjEuNFwiLFxuXHRcdFwiQHZ1ZS9jb21waWxlci1zZmNcIjogXCJeMy41LjEyXCIsXG5cdFx0XCJjaHJvbWUtdHlwZXNcIjogXCJeMC4xLjMxMVwiLFxuXHRcdFwiY29uY3VycmVudGx5XCI6IFwiXjkuMC4xXCIsXG5cdFx0XCJjcm9zcy1lbnZcIjogXCJeNy4wLjNcIixcblx0XHRcImdsb2JhbHNcIjogXCJeMTUuMTEuMFwiLFxuXHRcdFwianNkb21cIjogXCJeMjUuMC4xXCIsXG5cdFx0XCJwb3N0Y3NzXCI6IFwiXjguNC40N1wiLFxuXHRcdFwic2Fzc1wiOiBcIl4xLjgwLjNcIixcblx0XHRcInR5cGVzY3JpcHRcIjogXCJeNS42LjNcIixcblx0XHRcInVucGx1Z2luLWF1dG8taW1wb3J0XCI6IFwiXjAuMTguM1wiLFxuXHRcdFwidW5wbHVnaW4tdnVlLWNvbXBvbmVudHNcIjogXCJeMC4yNy40XCIsXG5cdFx0XCJ1bnBsdWdpbi12dWUtcm91dGVyXCI6IFwiXjAuMTAuOFwiLFxuXHRcdFwidml0ZVwiOiBcIl41LjQuOVwiLFxuXHRcdFwidml0ZS1wbHVnaW4tbm9kZS1wb2x5ZmlsbHNcIjogXCJeMC4yMi4wXCIsXG5cdFx0XCJ2aXRlLXBsdWdpbi1wYWdlc1wiOiBcIl4wLjMyLjNcIixcblx0XHRcInZpdGUtcGx1Z2luLXZ1ZS1kZXZ0b29sc1wiOiBcIl43LjUuM1wiLFxuXHRcdFwidml0ZXN0XCI6IFwiXjIuMS4zXCIsXG5cdFx0XCJ2dWUtdHNjXCI6IFwiXjIuMS42XCIsXG5cdFx0XCJ3ZWJleHQtYnJpZGdlXCI6IFwiXjYuMC4xXCJcblx0fSxcblx0XCJvdmVycmlkZXNcIjoge1xuXHRcdFwiQGNyeGpzL3ZpdGUtcGx1Z2luXCI6IFwiJEBjcnhqcy92aXRlLXBsdWdpblwiXG5cdH0sXG5cdFwicG5wbVwiOiB7XG5cdFx0XCJvdmVycmlkZXNcIjoge30sXG5cdFx0XCJwZWVyRGVwZW5kZW5jeVJ1bGVzXCI6IHtcblx0XHRcdFwiYWxsb3dBbnlcIjogW10sXG5cdFx0XHRcImFsbG93ZWREZXByZWNhdGVkVmVyc2lvbnNcIjoge1xuXHRcdFx0XHRcInNvdXJjZW1hcC1jb2RlY1wiOiBcIjEuNC44XCJcblx0XHRcdH0sXG5cdFx0XHRcImFsbG93ZWRWZXJzaW9uc1wiOiB7fSxcblx0XHRcdFwiaWdub3JlTWlzc2luZ1wiOiBbXVxuXHRcdH1cblx0fVxufVxuIiwgImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFx1c2VyXFxcXFJlcG9zXFxcXGF6Z3VhcmQtd2FsbGV0XFxcXG1hbmlmZXN0XCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFx1c2VyXFxcXFJlcG9zXFxcXGF6Z3VhcmQtd2FsbGV0XFxcXG1hbmlmZXN0XFxcXG1hbmlmZXN0LmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vQzovVXNlcnMvdXNlci9SZXBvcy9hemd1YXJkLXdhbGxldC9tYW5pZmVzdC9tYW5pZmVzdC5jb25maWcudHNcIjtpbXBvcnQgdHlwZSB7IE1hbmlmZXN0VjNFeHBvcnQgfSBmcm9tIFwiQGNyeGpzL3ZpdGUtcGx1Z2luXCJcclxuaW1wb3J0IHBhY2thZ2VKc29uIGZyb20gXCIuLi9wYWNrYWdlLmpzb25cIlxyXG5cclxuY29uc3QgeyB2ZXJzaW9uLCBuYW1lLCBkZXNjcmlwdGlvbiwgZGlzcGxheU5hbWUgfSA9IHBhY2thZ2VKc29uXHJcblxyXG5jb25zdCBbbWFqb3IsIG1pbm9yLCBwYXRjaCwgbGFiZWwgPSBcIjBcIl0gPSB2ZXJzaW9uXHJcblx0LnJlcGxhY2UoL1teXFxkLi1dKy9nLCBcIlwiKVxyXG5cdC5zcGxpdCgvWy4tXS8pXHJcblxyXG5leHBvcnQgZGVmYXVsdCB7XHJcblx0bmFtZTogZGlzcGxheU5hbWUgfHwgbmFtZSxcclxuXHRkZXNjcmlwdGlvbixcclxuXHR2ZXJzaW9uOiBgJHttYWpvcn0uJHttaW5vcn0uJHtwYXRjaH0uJHtsYWJlbH1gLFxyXG5cdHZlcnNpb25fbmFtZTogdmVyc2lvbixcclxuXHRtYW5pZmVzdF92ZXJzaW9uOiAzLFxyXG5cdGFjdGlvbjoge1xyXG5cdFx0ZGVmYXVsdF9wb3B1cDogXCJzcmMvcG9wdXAvaW5kZXguaHRtbFwiLFxyXG5cdH0sXHJcblx0YmFja2dyb3VuZDoge1xyXG5cdFx0c2VydmljZV93b3JrZXI6IFwic3JjL2JhY2tncm91bmQvaW5kZXgudHNcIixcclxuXHRcdHR5cGU6IFwibW9kdWxlXCIsXHJcblx0fSxcclxuXHQvLyBjb250ZW50X3NjcmlwdHM6IFtcclxuXHQvLyBcdHtcclxuXHQvLyBcdFx0YWxsX2ZyYW1lczogdHJ1ZSxcclxuXHQvLyBcdFx0anM6IFtcInNyYy9jb250ZW50LXNjcmlwdC9pbmRleC50c1wiXSxcclxuXHQvLyBcdFx0bWF0Y2hlczogW1wiKjovLyovKlwiXSxcclxuXHQvLyBcdFx0cnVuX2F0OiBcImRvY3VtZW50X2VuZFwiLFxyXG5cdC8vIFx0fSxcclxuXHQvLyBdLFxyXG5cdG9wdGlvbnNfcGFnZTogXCJzcmMvb3B0aW9ucy9pbmRleC5odG1sXCIsXHJcblx0b2ZmbGluZV9lbmFibGVkOiB0cnVlLFxyXG5cdHBlcm1pc3Npb25zOiBbXCJzdG9yYWdlXCIsIFwidGFic1wiLCBcImJhY2tncm91bmRcIl0sXHJcblx0d2ViX2FjY2Vzc2libGVfcmVzb3VyY2VzOiBbXHJcblx0XHR7XHJcblx0XHRcdG1hdGNoZXM6IFtcIio6Ly8qLypcIl0sXHJcblx0XHRcdHJlc291cmNlczogW1wic3JjL2NvbnRlbnQtc2NyaXB0L2luZGV4LnRzXCJdLFxyXG5cdFx0fSxcclxuXHRcdHtcclxuXHRcdFx0bWF0Y2hlczogW1wiKjovLyovKlwiXSxcclxuXHRcdFx0cmVzb3VyY2VzOiBbXCJzcmMvY29udGVudC1zY3JpcHQvaWZyYW1lL2luZGV4Lmh0bWxcIl0sXHJcblx0XHR9LFxyXG5cdF0sXHJcblx0Y29udGVudF9zZWN1cml0eV9wb2xpY3k6IHtcclxuXHRcdGV4dGVuc2lvbl9wYWdlczogXCJzY3JpcHQtc3JjICdzZWxmJyAnd2FzbS11bnNhZmUtZXZhbCdcIixcclxuXHR9LFxyXG5cdGljb25zOiB7XHJcblx0XHQxNjogXCJzcmMvYXNzZXRzL2xvZ28ucG5nXCIsXHJcblx0XHQyNDogXCJzcmMvYXNzZXRzL2xvZ28ucG5nXCIsXHJcblx0XHQzMjogXCJzcmMvYXNzZXRzL2xvZ28ucG5nXCIsXHJcblx0XHQxMjg6IFwic3JjL2Fzc2V0cy9sb2dvLnBuZ1wiLFxyXG5cdH0sXHJcbn0gYXMgTWFuaWZlc3RWM0V4cG9ydFxyXG4iLCAiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIkM6XFxcXFVzZXJzXFxcXHVzZXJcXFxcUmVwb3NcXFxcYXpndWFyZC13YWxsZXRcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkM6XFxcXFVzZXJzXFxcXHVzZXJcXFxcUmVwb3NcXFxcYXpndWFyZC13YWxsZXRcXFxcdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0M6L1VzZXJzL3VzZXIvUmVwb3MvYXpndWFyZC13YWxsZXQvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkaXJuYW1lLCByZWxhdGl2ZSB9IGZyb20gXCJub2RlOnBhdGhcIlxyXG5pbXBvcnQgeyBmaWxlVVJMVG9QYXRoLCBVUkwgfSBmcm9tIFwibm9kZTp1cmxcIlxyXG5pbXBvcnQgdnVlIGZyb20gXCJAdml0ZWpzL3BsdWdpbi12dWVcIlxyXG5pbXBvcnQgdXNlUGFnZXMgZnJvbSBcInZpdGUtcGx1Z2luLXBhZ2VzXCJcclxuaW1wb3J0IHVzZUF1dG9JbXBvcnQgZnJvbSBcInVucGx1Z2luLWF1dG8taW1wb3J0L3ZpdGVcIlxyXG5pbXBvcnQgdXNlQ29tcG9uZW50cyBmcm9tIFwidW5wbHVnaW4tdnVlLWNvbXBvbmVudHMvdml0ZVwiXHJcbmltcG9ydCB7IGRlZmluZUNvbmZpZyB9IGZyb20gXCJ2aXRlXCJcclxuaW1wb3J0IHsgbm9kZVBvbHlmaWxscyB9IGZyb20gXCJ2aXRlLXBsdWdpbi1ub2RlLXBvbHlmaWxsc1wiXHJcbmltcG9ydCB7IGRlZmluZVZpdGVDb25maWcgYXMgZGVmaW5lIH0gZnJvbSBcIi4vZGVmaW5lLmNvbmZpZ1wiXHJcblxyXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xyXG5cdHNlcnZlcjoge1xyXG5cdFx0cG9ydDogODA4MCxcclxuXHRcdHN0cmljdFBvcnQ6IHRydWUsXHJcblx0XHRobXI6IHtcclxuXHRcdFx0cG9ydDogODA4MCxcclxuXHRcdH0sXHJcblx0fSxcclxuXHRyZXNvbHZlOiB7XHJcblx0XHRhbGlhczoge1xyXG5cdFx0XHRcIkBcIjogZmlsZVVSTFRvUGF0aChuZXcgVVJMKFwiLi9zcmNcIiwgaW1wb3J0Lm1ldGEudXJsKSksXHJcblx0XHRcdFwiflwiOiBmaWxlVVJMVG9QYXRoKG5ldyBVUkwoXCIuL3NyY1wiLCBpbXBvcnQubWV0YS51cmwpKSxcclxuXHRcdFx0c3JjOiBmaWxlVVJMVG9QYXRoKG5ldyBVUkwoXCIuL3NyY1wiLCBpbXBvcnQubWV0YS51cmwpKSxcclxuXHRcdFx0XCJAYXNzZXRzXCI6IGZpbGVVUkxUb1BhdGgobmV3IFVSTChcInNyYy9hc3NldHNcIiwgaW1wb3J0Lm1ldGEudXJsKSksXHJcblx0XHRcdFwiZnMvcHJvbWlzZXNcIjogXCJub2RlLXN0ZGxpYi1icm93c2VyL21vY2svZW1wdHlcIixcclxuXHRcdH0sXHJcblx0fSxcclxuXHRjc3M6IHtcclxuXHRcdHByZXByb2Nlc3Nvck9wdGlvbnM6IHtcclxuXHRcdFx0c2Nzczoge1xyXG5cdFx0XHRcdGFwaTogXCJtb2Rlcm5cIixcclxuXHRcdFx0fSxcclxuXHRcdH0sXHJcblx0fSxcclxuXHRwbHVnaW5zOiBbXHJcblx0XHRub2RlUG9seWZpbGxzKHtcclxuXHRcdFx0Z2xvYmFsczoge1xyXG5cdFx0XHRcdEJ1ZmZlcjogdHJ1ZSxcclxuXHRcdFx0XHRnbG9iYWw6IHRydWUsXHJcblx0XHRcdFx0cHJvY2VzczogdHJ1ZSxcclxuXHRcdFx0fSxcclxuXHRcdFx0ZXhjbHVkZTpbXHJcblx0XHRcdFx0J2ZzJyxcclxuXHRcdFx0XSxcclxuXHRcdH0pLFxyXG5cclxuXHRcdHZ1ZSgpLFxyXG5cclxuXHRcdHVzZVBhZ2VzKHtcclxuXHRcdFx0ZGlyczogW1xyXG5cdFx0XHRcdHtcclxuXHRcdFx0XHRcdGRpcjogXCJzcmMvcGFnZXNcIixcclxuXHRcdFx0XHRcdGJhc2VSb3V0ZTogXCJjb21tb25cIixcclxuXHRcdFx0XHR9LFxyXG5cdFx0XHRcdHtcclxuXHRcdFx0XHRcdGRpcjogXCJzcmMvc2V0dXAvcGFnZXNcIixcclxuXHRcdFx0XHRcdGJhc2VSb3V0ZTogXCJzZXR1cFwiLFxyXG5cdFx0XHRcdH0sXHJcblx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0ZGlyOiBcInNyYy9wb3B1cC9wYWdlc1wiLFxyXG5cdFx0XHRcdFx0YmFzZVJvdXRlOiBcInBvcHVwXCIsXHJcblx0XHRcdFx0fSxcclxuXHRcdFx0XHR7XHJcblx0XHRcdFx0XHRkaXI6IFwic3JjL29wdGlvbnMvcGFnZXNcIixcclxuXHRcdFx0XHRcdGJhc2VSb3V0ZTogXCJvcHRpb25zXCIsXHJcblx0XHRcdFx0fSxcclxuXHRcdFx0XHR7XHJcblx0XHRcdFx0XHRkaXI6IFwic3JjL2NvbnRlbnQtc2NyaXB0L2lmcmFtZS9wYWdlc1wiLFxyXG5cdFx0XHRcdFx0YmFzZVJvdXRlOiBcImlmcmFtZVwiLFxyXG5cdFx0XHRcdH0sXHJcblx0XHRcdF0sXHJcblx0XHR9KSxcclxuXHJcblx0XHR1c2VBdXRvSW1wb3J0KHtcclxuXHRcdFx0aW1wb3J0czogW1xyXG5cdFx0XHRcdFwidnVlXCIsXHJcblx0XHRcdFx0XCJ2dWUtcm91dGVyXCIsXHJcblx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0XCJ3ZWJleHRlbnNpb24tcG9seWZpbGxcIjogW1tcIipcIiwgXCJicm93c2VyXCJdXSxcclxuXHRcdFx0XHR9LFxyXG5cdFx0XHRdLFxyXG5cdFx0XHRkdHM6IFwic3JjL3R5cGVzL2F1dG8taW1wb3J0cy5kLnRzXCIsXHJcblx0XHRcdGRpcnM6IFtcInNyYy9jb21wb3NhYmxlcy9cIiwgXCJzcmMvc3RvcmVzL1wiLCBcInNyYy91dGlscy9cIl0sXHJcblx0XHRcdGVzbGludHJjOiB7XHJcblx0XHRcdFx0ZW5hYmxlZDogdHJ1ZSxcclxuXHRcdFx0XHRmaWxlcGF0aDogXCJzcmMvdHlwZXMvLmVzbGludHJjLWF1dG8taW1wb3J0Lmpzb25cIixcclxuXHRcdFx0fSxcclxuXHRcdH0pLFxyXG5cclxuXHRcdHVzZUNvbXBvbmVudHMoe1xyXG5cdFx0XHRkaXJzOiBbXCJzcmMvY29tcG9uZW50c1wiXSxcclxuXHRcdFx0ZHRzOiBcInNyYy90eXBlcy9jb21wb25lbnRzLmQudHNcIixcclxuXHRcdH0pLFxyXG5cclxuXHRcdHtcclxuXHRcdFx0bmFtZTogXCJhc3NldHMtcmV3cml0ZVwiLFxyXG5cdFx0XHRlbmZvcmNlOiBcInBvc3RcIixcclxuXHRcdFx0YXBwbHk6IFwiYnVpbGRcIixcclxuXHRcdFx0dHJhbnNmb3JtSW5kZXhIdG1sKGh0bWwsIHsgcGF0aCB9KSB7XHJcblx0XHRcdFx0Y29uc3QgYXNzZXRzUGF0aCA9IHJlbGF0aXZlKGRpcm5hbWUocGF0aCksIFwiL2Fzc2V0c1wiKS5yZXBsYWNlKFxyXG5cdFx0XHRcdFx0L1xcXFwvZyxcclxuXHRcdFx0XHRcdFwiL1wiXHJcblx0XHRcdFx0KVxyXG5cdFx0XHRcdHJldHVybiBodG1sLnJlcGxhY2UoL1wiXFwvYXNzZXRzXFwvL2csIGBcIiR7YXNzZXRzUGF0aH0vYClcclxuXHRcdFx0fSxcclxuXHRcdH0sXHJcblx0XSxcclxuXHRidWlsZDoge1xyXG5cdFx0dGFyZ2V0OiBcImVzbmV4dFwiLFxyXG5cdFx0cm9sbHVwT3B0aW9uczoge1xyXG5cdFx0XHRpbnB1dDoge1xyXG5cdFx0XHRcdGlmcmFtZTogXCJzcmMvY29udGVudC1zY3JpcHQvaWZyYW1lL2luZGV4Lmh0bWxcIixcclxuXHRcdFx0XHRwb3B1cDogXCJzcmMvcG9wdXAvaW5kZXguaHRtbFwiLFxyXG5cdFx0XHRcdHNldHVwOiBcInNyYy9zZXR1cC9pbmRleC5odG1sXCIsXHJcblx0XHRcdFx0b3B0aW9uczogXCJzcmMvb3B0aW9ucy9pbmRleC5odG1sXCIsXHJcblx0XHRcdH0sXHJcblx0XHR9LFxyXG5cdH0sXHJcblx0b3B0aW1pemVEZXBzOiB7XHJcblx0XHRpbmNsdWRlOiBbXCJ2dWVcIiwgXCJ3ZWJleHRlbnNpb24tcG9seWZpbGxcIl0sXHJcblx0XHRleGNsdWRlOiBbXCJ2dWUtZGVtaVwiXSxcclxuXHRcdGVzYnVpbGRPcHRpb25zOiB7XHJcblx0XHRcdHRhcmdldDogXCJlc25leHRcIixcclxuXHRcdH0sXHJcblx0fSxcclxuXHRkZWZpbmUsXHJcbn0pXHJcbiIsICJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcdXNlclxcXFxSZXBvc1xcXFxhemd1YXJkLXdhbGxldFwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcdXNlclxcXFxSZXBvc1xcXFxhemd1YXJkLXdhbGxldFxcXFxkZWZpbmUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9DOi9Vc2Vycy91c2VyL1JlcG9zL2F6Z3VhcmQtd2FsbGV0L2RlZmluZS5jb25maWcudHNcIjtpbXBvcnQgcGFja2FnZUpzb24gZnJvbSBcIi4vcGFja2FnZS5qc29uXCJcclxuXHJcbmV4cG9ydCBjb25zdCBkZWZpbmVWaXRlQ29uZmlnID0ge1xyXG5cdF9fVkVSU0lPTl9fOiBKU09OLnN0cmluZ2lmeShwYWNrYWdlSnNvbi52ZXJzaW9uKSxcclxuXHRfX05BTUVfXzogSlNPTi5zdHJpbmdpZnkocGFja2FnZUpzb24ubmFtZSksXHJcblx0X19ESVNQTEFZX05BTUVfXzogSlNPTi5zdHJpbmdpZnkocGFja2FnZUpzb24uZGlzcGxheU5hbWUpLFxyXG5cclxuXHRcImltcG9ydC5tZXRhLmVudi5IVE1MX1RJVExFXCI6IEpTT04uc3RyaW5naWZ5KHBhY2thZ2VKc29uLmRpc3BsYXlOYW1lKSxcclxuXHJcblx0XCJwcm9jZXNzLmVudlwiOiBwcm9jZXNzLmVudixcclxuXHRcInByb2Nlc3MudmVyc2lvblwiOiBKU09OLnN0cmluZ2lmeShwcm9jZXNzLnZlcnNpb24pLFxyXG5cdGdsb2JhbDoge30sXHJcbn1cclxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUFrVCxTQUFTLGdCQUFBQSxxQkFBb0I7QUFD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
