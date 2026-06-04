import { $fetch } from "ofetch"
import { ProxyAgent } from "undici"

/**
 * 海外域名白名单：命中其中之一时走代理，其余直连
 * 仅列出 newsnow 内确实抓取的海外源域名，避免误代理国内流量
 */
const OVERSEAS_HOSTS = [
  "github.com",
  "api.github.com",
  "www.producthunt.com",
  "api.producthunt.com",
  "store.steampowered.com",
  "steamcommunity.com",
  "www.solidot.org",
  "linux.do",
  "sputniknews.cn",
  "chinese.aljazeera.net",
]

/**
 * 读取环境变量中的代理地址
 * 优先级：HTTPS_PROXY > HTTP_PROXY > ALL_PROXY
 * 支持形如：http://user:pass@host:port
 */
const proxyUrl
  = process.env.HTTPS_PROXY
    || process.env.https_proxy
    || process.env.HTTP_PROXY
    || process.env.http_proxy
    || process.env.ALL_PROXY
    || process.env.all_proxy
    || ""

/**
 * 仅当配置了代理时才创建 Agent，避免空配置时报错
 * undici 的 ProxyAgent 同时支持 HTTP/HTTPS 上游与 Basic Auth
 */
const proxyAgent = proxyUrl ? new ProxyAgent(proxyUrl) : undefined

/**
 * 判断给定 URL 是否需要走代理
 * 命中白名单且配置了代理时返回 true
 */
function shouldUseProxy(url: string): boolean {
  if (!proxyAgent) return false
  try {
    const host = new URL(url).hostname
    return OVERSEAS_HOSTS.some(h => host === h || host.endsWith(`.${h}`))
  } catch {
    return false
  }
}

export const myFetch = $fetch.create({
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  },
  timeout: 10000,
  retry: 3,
  /**
   * 请求拦截：根据目标域名注入 dispatcher
   * undici 风格的 fetch 通过 dispatcher 选项指定代理通道
   */
  onRequest({ request, options }) {
    const url = typeof request === "string" ? request : request.url
    if (shouldUseProxy(url)) {
      // @ts-expect-error ofetch 透传 undici 的 dispatcher 选项
      options.dispatcher = proxyAgent
    }
  },
})
