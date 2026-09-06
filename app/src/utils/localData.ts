/**
 * 「清除本地数据」：删除本站写入浏览器 localStorage / sessionStorage 的全部键
 * （工坊名单暂存、座位表/宴会草稿、自定义模板、配额计数、界面偏好等）。
 * 只处理本站前缀键，不触碰第三方统计脚本或其他站点的数据；登录 Cookie 由退出登录处理。
 */
const LOCAL_KEY_PREFIXES = ['seatmark.', 'seatmark:', 'seat-label-', 'sm-']

export function isSeatMarkStorageKey(key: string): boolean {
  return LOCAL_KEY_PREFIXES.some((p) => key.startsWith(p))
}

function clearStore(store: Storage): number {
  const keys: string[] = []
  for (let i = 0; i < store.length; i++) {
    const k = store.key(i)
    if (k && isSeatMarkStorageKey(k)) keys.push(k)
  }
  for (const k of keys) store.removeItem(k)
  return keys.length
}

/** 返回删除的键数量；存储不可用（隐私模式等）时返回 0 */
export function clearLocalData(): number {
  let removed = 0
  try {
    removed += clearStore(localStorage)
  } catch {
    /* 存储不可用 */
  }
  try {
    removed += clearStore(sessionStorage)
  } catch {
    /* 存储不可用 */
  }
  return removed
}
