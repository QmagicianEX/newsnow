/**
 * PM2 进程配置文件
 * 用途：在腾讯云 Linux 服务器上以生产模式启动 newsnow 应用
 * 入口：Nitro 构建产物 dist/output/server/index.mjs
 * 环境变量：通过 Node 24 原生支持的 --env-file 从 .env.server 注入
 *
 * 路径联动：cwd 优先读取环境变量 APP_DIR，没设置时回退到 process.cwd()
 *           这样 deploy.sh 中只需维护一份 APP_DIR，避免双处硬编码不一致
 *
 * 常用命令：
 *   pm2 start ecosystem.config.cjs    首次启动
 *   pm2 startOrReload ecosystem.config.cjs  幂等启动 / 热重载
 *   pm2 restart newsnow               重启
 *   pm2 logs newsnow                  查看日志
 *   pm2 save && pm2 startup           配置开机自启
 */
const path = require("node:path")

// 解析项目根目录：优先环境变量 APP_DIR，便于 deploy.sh 注入；否则用当前目录
const APP_DIR = process.env.APP_DIR || process.cwd()

module.exports = {
  apps: [
    {
      // 应用名称，PM2 中通过该名称管理进程
      name: "newsnow",

      // 启动脚本：Nitro 构建后的 Node 服务入口（使用绝对路径，避免 cwd 异常时找不到）
      script: path.join(APP_DIR, "dist/output/server/index.mjs"),

      // 传递给 Node 的参数：使用 Node 24 内置的 --env-file 加载环境变量文件
      // 使用绝对路径，避免 PM2 启动时 cwd 不一致导致找不到 .env.server
      node_args: `--env-file=${path.join(APP_DIR, ".env.server")}`,

      // 工作目录
      cwd: APP_DIR,

      // 实例数：Nitro + SQLite 写入不支持多进程并发，必须为 1
      instances: 1,

      // 执行模式：fork 单进程；cluster 模式与 better-sqlite3 不兼容
      exec_mode: "fork",

      // 异常退出时自动重启
      autorestart: true,

      // 监控相关：关闭 watch，避免生产环境因日志/数据变动触发重启
      watch: false,

      // 内存超过该阈值自动重启，防止内存泄漏拖垮服务器
      max_memory_restart: "512M",

      // 运行时环境变量（与 .env.server 同时生效，此处变量优先级更高）
      env: {
        NODE_ENV: "production",
        HOST: "0.0.0.0",
        PORT: 4444,
      },

      // 日志输出
      out_file: path.join(APP_DIR, "logs/out.log"),
      error_file: path.join(APP_DIR, "logs/err.log"),
      merge_logs: true,
      time: true,

      // 重启节流：30 秒内最多重启 10 次，避免崩溃循环
      min_uptime: "30s",
      max_restarts: 10,
    },
  ],
}
