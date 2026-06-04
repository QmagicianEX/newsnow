import ReactDOM from "react-dom/client"
import { RouterProvider, createRouter } from "@tanstack/react-router"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { routeTree } from "./routeTree.gen"

const queryClient = new QueryClient()

// 路由 basepath：取自 Vite 内置的 BASE_URL，需去掉末尾斜杠
// 部署到子路径（如 /newsnow/）时，router 需要感知该前缀，避免地址栏被改回根路径
const routerBasepath = import.meta.env.BASE_URL.replace(/\/$/, "") || "/"

const router = createRouter({
  routeTree,
  basepath: routerBasepath,
  context: {
    queryClient,
  },
})

const rootElement = document.getElementById("app")!

if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}
