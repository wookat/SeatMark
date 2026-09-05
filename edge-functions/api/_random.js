/**
 * 安全随机工具（Web Crypto getRandomValues），供验证码 / 邮箱码 / 批次与记录 ID 使用。
 * 不使用 Math.random：其序列可预测，不能用于任何安全相关取值。
 */

const TOKEN_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz'

/** [0, maxExclusive) 内的均匀随机整数（拒绝采样消除模偏差） */
export function randomInt(maxExclusive) {
  if (!Number.isInteger(maxExclusive) || maxExclusive < 1 || maxExclusive > 0x100000000) {
    throw new RangeError('randomInt: maxExclusive 需为 1–2^32 的整数')
  }
  const limit = 0x100000000 - (0x100000000 % maxExclusive)
  const buf = new Uint32Array(1)
  for (;;) {
    crypto.getRandomValues(buf)
    if (buf[0] < limit) return buf[0] % maxExclusive
  }
}

/** 从字母表中随机取 length 个字符 */
export function randomToken(length, alphabet = TOKEN_ALPHABET) {
  let out = ''
  for (let i = 0; i < length; i++) out += alphabet[randomInt(alphabet.length)]
  return out
}

/** 定长纯数字码（首位可为 0，如 6 位邮箱验证码） */
export function randomDigits(length) {
  return randomToken(length, '0123456789')
}

/** 时间戳 + 6 位随机后缀的记录 ID（替代 Date.now()+Math.random 拼接） */
export function randomId() {
  return `${Date.now()}-${randomToken(6)}`
}
