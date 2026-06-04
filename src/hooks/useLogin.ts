const userAtom = atomWithStorage<{
  name?: string
  avatar?: string
}>("user", {})

const jwtAtom = atomWithStorage("jwt", "")

const enableLoginAtom = atomWithStorage<{
  enable: boolean
  url?: string
}>("login", {
  enable: true,
})

enableLoginAtom.onMount = (set) => {
  myFetch("/enable-login").then((r) => {
    set(r)
  }).catch((e) => {
    if (e.statusCode === 506) {
      set({ enable: false })
      localStorage.removeItem("jwt")
    }
  })
}

export function useLogin() {
  const userInfo = useAtomValue(userAtom)
  const jwt = useAtomValue(jwtAtom)
  const enableLogin = useAtomValue(enableLoginAtom)

  const login = useCallback(() => {
    // 登录跳转地址需带上部署前缀（如 /newsnow/api/login），__API_BASE_URL__ 由 vite 构建时注入
    window.location.href = enableLogin.url || `${__API_BASE_URL__}/login`
  }, [enableLogin])

  const logout = useCallback(() => {
    window.localStorage.clear()
    window.location.reload()
  }, [])

  return {
    loggedIn: !!jwt,
    userInfo,
    enableLogin: !!enableLogin.enable,
    logout,
    login,
  }
}
