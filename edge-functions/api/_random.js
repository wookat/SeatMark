/**
 * 安全随机源（CSPRNG）：验证码、一次性 ID 等安全路径统一从这里取随机数，
 * 禁止在这些路径使用 Math.random（可预测）。
 */

/** [0, maxExclusive) 均匀随机整数：crypto.getRandomValues + 拒绝采样，避免取模偏差 */
export function randomInt(maxExclusive) {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0 || maxExclusive > 0x100000000) {
    throw new RangeError('randomInt: maxExclusive 需为 1–2^32 的整数')
  }
  const limit = 0x100000000 - (0x100000000 % maxExclusive)
  const buf = new Uint32Array(1)
  for (;;) {
    crypto.getRandomValues(buf)
    if (buf[0] < limit) return buf[0] % maxExclusive
  }
}

/** n 位十进制数字串（邮件验证码 / 找回验证码），首位可为 0 */
export function randomDigits(n) {
  let s = ''
  for (let i = 0; i < n; i++) s += String(randomInt(10))
  return s
}

const TOKEN36_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz'

/** len 位 [0-9a-z] 令牌（一次性 ID / 批次号） */
export function randomToken36(len) {
  let s = ''
  for (let i = 0; i < len; i++) s += TOKEN36_ALPHABET[randomInt(TOKEN36_ALPHABET.length)]
  return s
}

/** 从字母表（默认 [0-9a-z]）中随机取 length 个字符 */
export function randomToken(length, alphabet = TOKEN36_ALPHABET) {
  let s = ''
  for (let i = 0; i < length; i++) s += alphabet[randomInt(alphabet.length)]
  return s
}

/** 时间戳 + 6 位随机后缀的记录 ID（替代 Date.now()+Math.random 拼接） */
export function randomId() {
  return `${Date.now()}-${randomToken36(6)}`
}
