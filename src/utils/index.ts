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

// __BASE_PATH__ 由 vite.config.ts 通过 define 注入，部署到子路径时（如 /newsnow/）会包含前缀
declare const __BASE_PATH__: string

// 将 BASE_PATH 与 /api 拼接，去掉可能存在的多余斜杠，保证最终形如 "/newsnow/api"
const apiBase = `${__BASE_PATH__.replace(/\/$/, "")}/api`

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
