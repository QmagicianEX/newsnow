import { join } from "node:path"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react-swc"
import { TanStackRouterVite } from "@tanstack/router-plugin/vite"
import unocss from "unocss/vite"
import unimport from "unimport/unplugin"
import dotenv from "dotenv"
import nitro from "./nitro.config"
import { projectDir } from "./shared/dir"
import pwa from "./pwa.config"

dotenv.config({
  path: join(projectDir, ".env.server"),
})

// 解析部署路径前缀：优先读取 BASE_PATH 环境变量，默认根路径
// 用于：1) Vite base 控制静态资源前缀  2) define 注入客户端代码用于 API baseURL
const BASE_PATH = process.env.BASE_PATH || "/"
// eslint-disable-next-line no-console
console.log(`[vite.config] BASE_PATH = ${BASE_PATH}`)

export default defineConfig({
  base: BASE_PATH,
  // 把 BASE_PATH 注入到客户端代码，供前端 API 请求拼接路径前缀
  define: {
    __BASE_PATH__: JSON.stringify(BASE_PATH),
  },
  resolve: {
    alias: {
      "~": join(projectDir, "src"),
      "@shared": join(projectDir, "shared"),
    },
  },
  plugins: [
    TanStackRouterVite({
      // error with auto import and vite-plugin-pwa
      // autoCodeSplitting: true,
    }),
    unimport.vite({
      dirs: ["src/hooks", "src/utils", "src/atoms", "shared/{consts,metadata,sources,type.util,utils,verify}.ts"],
      presets: ["react", {
        from: "jotai",
        imports: ["atom", "useAtom", "useAtomValue", "useSetAtom"],
      }],
      imports: [
        { from: "clsx", name: "clsx", as: "$" },
        { from: "jotai/utils", name: "atomWithStorage" },
      ],
      dts: "imports.app.d.ts",
    }),
    unocss(),
    react(),
    pwa(),
    nitro(),
  ],
})
