export const DOCKER_OPS_DISABLED_MESSAGE = [
  "Docker 主機查詢目前基於安全考量暫停使用。",
  "",
  "目前仍可執行服務 Health Check。",
  "如需查看 Container 狀態或 Log，請暫時透過 SSH 至主機查詢。",
].join("\n");

export const HOST_DISK_USAGE_DISABLED_MESSAGE =
  "Host 磁碟查詢目前尚未提供安全的查詢通道。";

export const DOCKER_CLI_UNAVAILABLE_MESSAGE = [
  "此容器映像未安裝 Docker CLI，無法執行 Docker 查詢。",
  "",
  "Production 應保持 OPS_DOCKER_ENABLED=false，並使用 HTTP Health Check。",
].join("\n");
