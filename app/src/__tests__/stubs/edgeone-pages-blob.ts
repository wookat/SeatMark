/**
 * @edgeone/pages-blob 的测试替身：SDK 仅存在于 EdgeOne 运行时，
 * 测试中 getStore 直接抛错，驱动 _storage.js 走 catch 降级分支
 * （需要 Blob 行为的用例通过 env.seatmark_blob 注入内存模拟 Store）。
 */
export function getStore(): never {
  throw new Error('@edgeone/pages-blob is unavailable outside the EdgeOne runtime')
}
