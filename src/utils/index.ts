import type { MaybePromise } from "@shared/type.util"
import { $fetch } from "ofetch"

export function safeParseString(str: any) {
  try {
    return JSON.parse(str)
  } catch {
    return ""
  }
}

export class Timer {
  private timerId?: any
  private start!: number
  private remaining: number
  private callback: () => MaybePromise<void>

  constructor(callback: () => MaybePromise<void>, delay: number) {
    this.callback = callback
    this.remaining = delay
    this.resume()
  }

  pause() {
    clearTimeout(this.timerId)
    this.remaining -= Date.now() - this.start
  }

  resume() {
    this.start = Date.now()
    clearTimeout(this.timerId)
    this.timerId = setTimeout(this.callback, this.remaining)
  }

  clear() {
    clearTimeout(this.timerId)
  }
}

// 使用 Vite 内置的 import.meta.env.BASE_URL，自动取自 vite.config.ts 中的 base 配置
// 部署到子路径（如 /newsnow/）时该值即为 "/newsnow/"，根路径部署时为 "/"
// 拼接后形如 "/newsnow/api" 或 "/api"
const apiBase = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/api`

export const myFetch = $fetch.create({
  timeout: 15000,
  retry: 0,
  baseURL: apiBase,
})

export function isiOS() {
  return [
    "iPad Simulator",
    "iPhone Simulator",
    "iPod Simulator",
    "iPad",
    "iPhone",
    "iPod",
  ].includes(navigator.platform)
  || (navigator.userAgent.includes("Mac") && "ontouchend" in document)
}
