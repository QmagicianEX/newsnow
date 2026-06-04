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

// __API_BASE_URL__ 由 vite.config.ts 通过 define 在构建时替换为字符串字面量
// 例如部署到子路径 /newsnow/ 时，会被替换为 "/newsnow/api"；根路径部署则为 "/api"
declare const __API_BASE_URL__: string

export const myFetch = $fetch.create({
  timeout: 15000,
  retry: 0,
  baseURL: __API_BASE_URL__,
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
