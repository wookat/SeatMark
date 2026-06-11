export interface PhotoLoadResult {
  photos: Map<string, string>
  matched: number
  unmatched: number
  errors: string[]
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('读取失败'))
    reader.readAsDataURL(file)
  })
}

/** 包含匹配时要求值至少 2 个字符，避免「1」「A」这类短值大面积误命中 */
const MIN_FUZZY_LENGTH = 2

/**
 * 文件名（去扩展名）匹配数据值：
 * 1. 完全一致优先；
 * 2. 否则取文件名中「包含」的最长值（如 张伟2023010101.jpg 同时包含姓名与学号，
 *    以姓名列匹配命中“张伟”，以学号列匹配命中“2023010101”）。
 */
function findMatch(
  baseName: string,
  matchValues: Set<string>,
): { key: string; exact: boolean } | null {
  if (matchValues.has(baseName)) return { key: baseName, exact: true }
  let best: string | null = null
  for (const value of matchValues) {
    if (value.length < MIN_FUZZY_LENGTH) continue
    if (!baseName.includes(value)) continue
    if (!best || value.length > best.length) best = value
  }
  return best ? { key: best, exact: false } : null
}

/**
 * 按匹配规则批量读取照片；同一数据值命中多个文件时，完全一致的文件优先。
 * 不匹配的文件会被跳过并记录原因。
 */
export async function loadPhotoFiles(
  files: File[],
  matchValues: Set<string>,
): Promise<PhotoLoadResult> {
  const result: PhotoLoadResult = { photos: new Map(), matched: 0, unmatched: 0, errors: [] }
  /** key -> 是否由完全一致命中（用于决定能否被后续文件覆盖） */
  const exactKeys = new Set<string>()

  const loadOne = async (file: File) => {
    const baseName = file.name.replace(/\.[^.]+$/, '')
    const match = findMatch(baseName, matchValues)
    if (!match) {
      result.unmatched++
      result.errors.push(`${file.name} - 未找到匹配的数据行（文件名需等于或包含匹配列的值）`)
      return
    }
    // 已有完全一致的照片时，不被包含匹配的文件覆盖
    if (exactKeys.has(match.key) && !match.exact) {
      result.matched++
      return
    }
    try {
      result.photos.set(match.key, await readAsDataURL(file))
      if (match.exact) exactKeys.add(match.key)
      result.matched++
    } catch {
      result.unmatched++
      result.errors.push(`${file.name} - 读取失败`)
    }
  }

  const batchSize = 10
  for (let i = 0; i < files.length; i += batchSize) {
    await Promise.all(files.slice(i, i + batchSize).map(loadOne))
  }

  return result
}
