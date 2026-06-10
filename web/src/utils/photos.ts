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

/**
 * 按“文件名（去扩展名）= 匹配列的值”的规则批量读取照片。
 * 不匹配的文件会被跳过并记录原因。
 */
export async function loadPhotoFiles(
  files: File[],
  matchValues: Set<string>,
): Promise<PhotoLoadResult> {
  const result: PhotoLoadResult = { photos: new Map(), matched: 0, unmatched: 0, errors: [] }

  const loadOne = async (file: File) => {
    const baseName = file.name.replace(/\.[^.]+$/, '')
    if (!matchValues.has(baseName)) {
      result.unmatched++
      result.errors.push(`${file.name} - 未找到匹配的数据行`)
      return
    }
    try {
      result.photos.set(baseName, await readAsDataURL(file))
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
