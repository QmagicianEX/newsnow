#!/usr/bin/env bash
# =============================================================================
# newsnow 腾讯云一键部署 / 更新脚本
# 适用：Ubuntu 22.04+，Node v24.12.0，pnpm 10.28.0，PM2，SQLite
#
# 用法：
#   首次部署：  bash deploy.sh init
#   日常更新：  bash deploy.sh update
#   仅重启：    bash deploy.sh restart
#   查看状态：  bash deploy.sh status
#
# 提示（Windows 用户必看）：
#   如果脚本在 Windows 上编辑过，行尾可能是 CRLF，需要先转换：
#     sed -i 's/\r$//' deploy.sh && chmod +x deploy.sh
# =============================================================================

set -euo pipefail

# ---------- 可按需修改的配置 ----------
APP_NAME="newsnow"                                      # PM2 应用名（需与 ecosystem.config.cjs 一致）
APP_DIR="${APP_DIR:-/home/ubuntu/easydesign/newsnow}"                      # 项目部署目录（允许通过环境变量覆盖）
REPO_URL="https://github.com/QmagicianEX/newsnow.git"    # 仓库地址
ENV_FILE=".env.server"                                  # 环境变量文件名
PM2_CONFIG="ecosystem.config.cjs"                       # PM2 配置文件名
MIN_FREE_MEM_MB=1500                                    # 构建建议的最小可用内存
# --------------------------------------

# 把 APP_DIR 导出，给 ecosystem.config.cjs 用于路径联动
export APP_DIR

# 彩色输出辅助函数：统一日志风格
log()  { echo -e "\033[32m[INFO]\033[0m  $*"; }
warn() { echo -e "\033[33m[WARN]\033[0m  $*"; }
err()  { echo -e "\033[31m[ERROR]\033[0m $*" >&2; }

# -----------------------------------------------------------------------------
# 函数：need_sudo
# 作用：当前用户不是 root 时返回 "sudo"，否则返回空串
#       这样 sudo 调用对 root / 非 root 用户都安全
# -----------------------------------------------------------------------------
need_sudo() {
  if [ "$(id -u)" -ne 0 ]; then
    echo "sudo"
  else
    echo ""
  fi
}

# -----------------------------------------------------------------------------
# 函数：check_env
# 作用：检查 node / pnpm / pm2 / git / openssl 等关键命令是否存在
# -----------------------------------------------------------------------------
check_env() {
  log "检查运行环境..."
  for cmd in node pnpm pm2 git openssl; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
      err "缺少命令：$cmd，请先安装"
      exit 1
    fi
  done
  log "Node 版本：$(node -v)"
  log "pnpm 版本：$(pnpm -v)"
  log "PM2 版本：$(pm2 -v)"

  # 内存预警：小内存机器编译 better-sqlite3 / sharp 可能 OOM
  if command -v free >/dev/null 2>&1; then
    local free_mb
    free_mb="$(free -m | awk '/^Mem:/ {print $7}')"
    if [ "${free_mb:-0}" -lt "$MIN_FREE_MEM_MB" ]; then
      warn "当前可用内存仅 ${free_mb}MB，构建可能 OOM"
      warn "建议先添加 swap：sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile"
    fi
  fi
}

# -----------------------------------------------------------------------------
# 函数：ensure_dir
# 作用：确保 APP_DIR 存在且属主是当前用户，避免后续 pnpm install 权限报错
# -----------------------------------------------------------------------------
ensure_dir() {
  local sudo_cmd
  sudo_cmd="$(need_sudo)"

  if [ ! -d "$APP_DIR" ]; then
    log "创建目录 $APP_DIR"
    $sudo_cmd mkdir -p "$APP_DIR"
  fi

  # 仅修改 APP_DIR 自身的属主，绝不递归父目录，避免误改 /www 下其它项目
  if [ -n "$sudo_cmd" ]; then
    $sudo_cmd chown "$USER":"$USER" "$APP_DIR"
  fi
}

# -----------------------------------------------------------------------------
# 函数：clone_or_verify
# 作用：APP_DIR 为空 → 克隆；非空但是个 git 仓库 → 跳过；非空且不是仓库 → 报错退出
#       避免在残留目录上盲目运行 pnpm install
# -----------------------------------------------------------------------------
clone_or_verify() {
  if [ -z "$(ls -A "$APP_DIR" 2>/dev/null || true)" ]; then
    log "克隆仓库到 $APP_DIR"
    git clone "$REPO_URL" "$APP_DIR"
  elif [ -d "$APP_DIR/.git" ] && [ -f "$APP_DIR/package.json" ]; then
    log "$APP_DIR 已是有效仓库，跳过克隆"
  else
    err "$APP_DIR 已存在但不是有效的 newsnow 仓库，请清理后重试"
    exit 1
  fi
}

# -----------------------------------------------------------------------------
# 函数：prepare_env_file
# 作用：若 .env.server 不存在则从模板复制，并自动写入随机 JWT_SECRET
# -----------------------------------------------------------------------------
prepare_env_file() {
  if [ ! -f "$ENV_FILE" ]; then
    log "生成 $ENV_FILE（OAuth 等敏感项请稍后手工填写）"
    cp example.env.server "$ENV_FILE"
    local secret
    secret="$(openssl rand -hex 32)"
    sed -i "s|^JWT_SECRET=.*|JWT_SECRET=${secret}|" "$ENV_FILE"
  else
    log "$ENV_FILE 已存在，跳过生成"
  fi
}

# -----------------------------------------------------------------------------
# 函数：build_project
# 作用：安装依赖并构建，构建后校验产物是否存在
# -----------------------------------------------------------------------------
build_project() {
  log "安装依赖（含 native 模块编译，耗时较久）..."
  pnpm install

  log "构建生产包..."
  pnpm run build

  if [ ! -f "dist/output/server/index.mjs" ]; then
    err "构建产物 dist/output/server/index.mjs 不存在，构建失败"
    exit 1
  fi
  log "构建产物校验通过"
}

# -----------------------------------------------------------------------------
# 函数：pm2_up
# 作用：幂等地启动或重载 PM2 进程，第一次跑或第 N 次跑都不会报错
# -----------------------------------------------------------------------------
pm2_up() {
  log "使用 PM2 启动 / 热重载..."
  # startOrReload：不存在则启动，存在则零停机热重载
  pm2 startOrReload "$PM2_CONFIG" --update-env
  pm2 save
}

# -----------------------------------------------------------------------------
# 函数：init_project
# 作用：首次部署的完整流程
# -----------------------------------------------------------------------------
init_project() {
  check_env
  ensure_dir
  clone_or_verify

  cd "$APP_DIR"

  prepare_env_file
  mkdir -p "$APP_DIR/logs"
  build_project
  pm2_up

  log "初始化完成 ✅"
  warn "后续请记得："
  warn "  1. 编辑 $APP_DIR/$ENV_FILE 填写 OAuth (G_CLIENT_ID/SECRET) 等配置"
  warn "  2. 执行 'pm2 startup systemd' 并按提示复制 sudo 命令配置开机自启"
  warn "  3. 配置 Nginx 反向代理到 127.0.0.1:4444 并申请 HTTPS 证书"
}

# -----------------------------------------------------------------------------
# 函数：update_project
# 作用：日常更新流程，自动 stash 本地改动避免 git pull 失败
# -----------------------------------------------------------------------------
update_project() {
  check_env

  if [ ! -d "$APP_DIR/.git" ]; then
    err "$APP_DIR 不是 git 仓库，请先执行 bash deploy.sh init"
    exit 1
  fi

  cd "$APP_DIR"

  # 暂存可能存在的本地改动（如 .env.server 之外的临时调试），避免 rebase 冲突
  local stash_msg="deploy.sh auto-stash $(date +%s)"
  local has_stash="no"
  if [ -n "$(git status --porcelain)" ]; then
    warn "检测到本地未提交改动，自动 stash"
    git stash push -u -m "$stash_msg" >/dev/null
    has_stash="yes"
  fi

  log "拉取最新代码..."
  git pull --rebase

  if [ "$has_stash" = "yes" ]; then
    warn "本地改动已 stash，可用 'git stash list' 查看，必要时 'git stash pop' 还原"
  fi

  log "同步依赖..."
  pnpm install

  log "重新构建..."
  pnpm run build
  if [ ! -f "dist/output/server/index.mjs" ]; then
    err "构建产物缺失，更新失败，保留原有 PM2 进程不动"
    exit 1
  fi

  log "热重载 PM2 进程..."
  pm2 reload "$APP_NAME" --update-env

  log "更新完成 ✅"
}

# -----------------------------------------------------------------------------
# 函数：restart_project
# 作用：仅重启 PM2 进程（不重新构建）
# -----------------------------------------------------------------------------
restart_project() {
  cd "$APP_DIR"
  pm2 restart "$APP_NAME" --update-env
  log "已重启 $APP_NAME"
}

# -----------------------------------------------------------------------------
# 函数：show_status
# 作用：展示 PM2 进程与最近日志，方便排查
# -----------------------------------------------------------------------------
show_status() {
  pm2 status
  echo ""
  pm2 logs "$APP_NAME" --lines 20 --nostream || true
}

# -----------------------------------------------------------------------------
# 主入口：根据第一个参数分发到对应函数
# -----------------------------------------------------------------------------
case "${1:-}" in
  init)    init_project ;;
  update)  update_project ;;
  restart) restart_project ;;
  status)  show_status ;;
  *)
    echo "用法: bash deploy.sh {init|update|restart|status}"
    exit 1
    ;;
esac
