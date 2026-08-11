import { describe, expect, it, vi } from 'vitest'

import {
  binarizePixelData,
  buildFieldFileNames,
  CSS_PX_PER_MM,
  defaultPngExportName,
  EINK_PRESETS,
  exactPixelHeight,
  exactPixelNamePrefix,
  exactPixelScale,
  exactPixelSupersample,
  exportPagedPng,
  findEinkPreset,
  isValidExactPixelWidth,
  MAX_FILE_NAME_PART_LENGTH,
  PNG_BASE_SCALE,
  PNG_MAX_SCALE,
  PNG_MIN_OUTPUT_WIDTH,
  pngPageFileName,
  pngRasterScale,
  presetAspectMismatch,
  sanitizeFileNamePart,
} from '@/utils/pngExport'

describe('精确像素映射', () => {
  it('eink800：200mm 宽映射 800px 的倍率 × 页面 CSS 宽度 = 800', () => {
    const scale = exactPixelScale(800, 200)
    expect(scale * 200 * CSS_PX_PER_MM).toBeCloseTo(800, 6)
  })

  it('高度按模板宽高比推导：200×120mm + 800px 宽 → 480px 高', () => {
    expect(exactPixelHeight(800, 200, 120)).toBe(480)
    expect(exactPixelHeight(1280, 200, 112.5)).toBe(720)
  })

  it('像素宽度校验：仅接受 100–4096 的整数', () => {
    expect(isValidExactPixelWidth(800)).toBe(true)
    expect(isValidExactPixelWidth(100)).toBe(true)
    expect(isValidExactPixelWidth(4096)).toBe(true)
    expect(isValidExactPixelWidth(99)).toBe(false)
    expect(isValidExactPixelWidth(4097)).toBe(false)
    expect(isValidExactPixelWidth(800.5)).toBe(false)
    expect(isValidExactPixelWidth(NaN)).toBe(false)
  })

  it('超采样倍数：渲染宽度不超上限时 2 倍，超出退回 1 倍直出', () => {
    expect(exactPixelSupersample(800)).toBe(2)
    expect(exactPixelSupersample(1280)).toBe(2)
    expect(exactPixelSupersample(2048)).toBe(2)
    expect(exactPixelSupersample(2049)).toBe(1)
    expect(exactPixelSupersample(3840)).toBe(1)
    expect(exactPixelSupersample(4096)).toBe(1)
  })
})

describe('pngRasterScale', () => {
  it('常规尺寸固定 300dpi 基准，不随页数降档', () => {
    // A4 整页 210mm / 会议桌牌 200mm：300dpi 下输出宽已远超最小宽度
    expect(pngRasterScale(210)).toBe(PNG_BASE_SCALE)
    expect(pngRasterScale(200)).toBe(PNG_BASE_SCALE)
  })

  it('小尺寸标签提倍保证输出宽度 ≥ 最小输出宽度', () => {
    // 60mm 姓名贴：300dpi 仅 ≈709px，应提倍到 1000px
    const scale = pngRasterScale(60)
    expect(scale).toBeGreaterThan(PNG_BASE_SCALE)
    expect(scale * 60 * CSS_PX_PER_MM).toBeCloseTo(PNG_MIN_OUTPUT_WIDTH, 6)
  })

  it('极小标签受倍率上限保护', () => {
    expect(pngRasterScale(10)).toBe(PNG_MAX_SCALE)
    expect(pngRasterScale(0)).toBe(PNG_BASE_SCALE)
  })
})

describe('纯黑白二值化', () => {
  it('按亮度阈值就地改为纯黑或纯白，且不透明', () => {
    const data = new Uint8ClampedArray([
      // 深灰 → 黑
      60, 60, 60, 255,
      // 浅灰 → 白
      220, 220, 220, 255,
      // 半透明像素也归一为不透明
      0, 0, 0, 128,
    ])
    binarizePixelData(data)
    expect(Array.from(data.slice(0, 4))).toEqual([0, 0, 0, 255])
    expect(Array.from(data.slice(4, 8))).toEqual([255, 255, 255, 255])
    expect(Array.from(data.slice(8, 12))).toEqual([0, 0, 0, 255])
  })

  it('输出仅含 0/255 两种通道值', () => {
    const data = new Uint8ClampedArray(64)
    for (let i = 0; i < data.length; i++) data[i] = (i * 37) % 256
    binarizePixelData(data)
    for (let i = 0; i < data.length; i++) {
      expect([0, 255]).toContain(data[i])
    }
  })
})

describe('文件命名', () => {
  it('多页 zip 内单页文件名三位页码', () => {
    expect(pngPageFileName('座签', 0)).toBe('座签-001.png')
    expect(pngPageFileName('座签', 99)).toBe('座签-100.png')
  })

  it('默认导出名含日期戳与前缀', () => {
    expect(defaultPngExportName()).toMatch(/^考场座位标签-\d{8}-\d{4}$/)
    expect(defaultPngExportName('桌牌')).toMatch(/^桌牌-/)
  })

  it('精确像素前缀追加实际分辨率，模板名自带规格时以实际输出为准', () => {
    expect(exactPixelNamePrefix('电子座签 800×480', 296, 128)).toBe('电子座签 800×480-296x128')
    expect(defaultPngExportName(exactPixelNamePrefix('座签', 640, 384))).toMatch(
      /^座签-640x384-\d{8}-\d{4}$/,
    )
  })
})

describe('文件名清洗', () => {
  it('去掉非法字符与控制字符，折叠空白，去首尾点号', () => {
    expect(sanitizeFileNamePart('张/三:第*1?考"场<>|')).toBe('张三第1考场')
    expect(sanitizeFileNamePart('  张三\t\n第1考场  ')).toBe('张三 第1考场')
    expect(sanitizeFileNamePart('..张三..')).toBe('张三')
    expect(sanitizeFileNamePart('a\\b\u0000c')).toBe('abc')
  })

  it('纯非法字符清洗后为空串', () => {
    expect(sanitizeFileNamePart('/:*?"<>|')).toBe('')
    expect(sanitizeFileNamePart('   ')).toBe('')
  })

  it('折叠空字段留下的悬挂/连续分隔符', () => {
    expect(sanitizeFileNamePart('唐瑶-')).toBe('唐瑶')
    expect(sanitizeFileNamePart('-第1考场')).toBe('第1考场')
    expect(sanitizeFileNamePart('张三--第1考场')).toBe('张三-第1考场')
    expect(sanitizeFileNamePart('张三 - _ 第1考场')).toBe('张三-第1考场')
    expect(sanitizeFileNamePart('张三_-_')).toBe('张三')
    expect(sanitizeFileNamePart('---')).toBe('')
  })

  it('超长字段截断到上限', () => {
    expect(sanitizeFileNamePart('张'.repeat(200))).toHaveLength(MAX_FILE_NAME_PART_LENGTH)
  })
})

describe('按名单字段命名', () => {
  it('按模板求值并追加 .png', () => {
    const names = buildFieldFileNames({
      template: '{姓名}-{考场}',
      rows: [
        { 姓名: '张三', 考场: '第1考场' },
        { 姓名: '李四', 考场: '第2考场' },
      ],
      fallbackPrefix: '座签',
    })
    expect(names).toEqual(['张三-第1考场.png', '李四-第2考场.png'])
  })

  it('重名追加 -2、-3 递增，与已有名称撞名时继续递增', () => {
    const names = buildFieldFileNames({
      template: '{姓名}',
      rows: [{ 姓名: '张三' }, { 姓名: '张三' }, { 姓名: '张三-2' }, { 姓名: '张三' }],
      fallbackPrefix: '座签',
    })
    expect(names).toEqual(['张三.png', '张三-2.png', '张三-2-2.png', '张三-3.png'])
  })

  it('空字段/空行/纯非法字符回退为前缀加三位序号', () => {
    const names = buildFieldFileNames({
      template: '{姓名}',
      rows: [{ 姓名: '' }, null, { 姓名: '???' }],
      fallbackPrefix: '座签',
    })
    expect(names).toEqual(['座签-001.png', '座签-002.png', '座签-003.png'])
  })

  it('引用不存在的列按空串处理，整体为空时回退序号', () => {
    const names = buildFieldFileNames({
      template: '{不存在的列}',
      rows: [{ 姓名: '张三' }],
      fallbackPrefix: '座签',
    })
    expect(names).toEqual(['座签-001.png'])
  })

  it('字段值中的非法字符被过滤', () => {
    const names = buildFieldFileNames({
      template: '{姓名}',
      rows: [{ 姓名: '张/三:丰*' }],
      fallbackPrefix: '座签',
    })
    expect(names).toEqual(['张三丰.png'])
  })
})

describe('eink 分辨率预设', () => {
  it('包含 800×480 等 6 个常见规格，尺寸均在宽度限制内', () => {
    expect(EINK_PRESETS).toHaveLength(6)
    const p800 = findEinkPreset('eink-800x480')
    expect(p800).toMatchObject({ width: 800, height: 480 })
    for (const p of EINK_PRESETS) {
      expect(isValidExactPixelWidth(p.width)).toBe(true)
      expect(p.height).toBeGreaterThan(0)
    }
    expect(findEinkPreset('custom')).toBeUndefined()
  })

  it('预设像素宽度映射的渲染倍率能还原目标宽度', () => {
    for (const p of EINK_PRESETS) {
      const scale = exactPixelScale(p.width, 200)
      expect(scale * 200 * CSS_PX_PER_MM).toBeCloseTo(p.width, 6)
    }
  })

  it('宽高比判定：5:3 模板与 800×480 一致，与 400×300 不一致', () => {
    expect(presetAspectMismatch({ width: 800, height: 480 }, 200, 120)).toBe(false)
    expect(presetAspectMismatch({ width: 400, height: 300 }, 200, 120)).toBe(true)
    expect(presetAspectMismatch({ width: 1280, height: 720 }, 200, 112.5)).toBe(false)
  })
})

describe('导出防线', () => {
  it('页数为 0 时报「没有可导出的页面」', async () => {
    await expect(
      exportPagedPng({
        pageCount: 0,
        getPage: () => document.createElement('div'),
        pageWidth: 200,
        pageHeight: 120,
      }),
    ).rejects.toThrow('没有可导出的页面')
  })

  it('逐标签导出：标签全为空位时报「没有可导出的标签」', async () => {
    await expect(
      exportPagedPng({
        pageCount: 2,
        getPage: () => document.createElement('div'),
        pageWidth: 210,
        pageHeight: 297,
        labelsByPage: [[], []],
      }),
    ).rejects.toThrow('没有可导出的标签')
  })

  it('逐标签导出：取消信号已中止时立即失败，不调用 getPage', async () => {
    const getPage = vi.fn(() => document.createElement('div'))
    const abort = new AbortController()
    abort.abort()
    await expect(
      exportPagedPng({
        pageCount: 1,
        getPage,
        pageWidth: 210,
        pageHeight: 297,
        labelsByPage: [
          [
            { rect: { x: 5, y: 5, width: 90, height: 54 }, fileName: '张三.png' },
            { rect: { x: 105, y: 5, width: 90, height: 54 }, fileName: '李四.png' },
          ],
        ],
        signal: abort.signal,
      }),
    ).rejects.toThrow('已取消导出')
    expect(getPage).not.toHaveBeenCalled()
  })

  it('取消信号已中止时立即以「已取消导出」失败，不调用 getPage', async () => {
    const getPage = vi.fn(() => document.createElement('div'))
    const abort = new AbortController()
    abort.abort()
    await expect(
      exportPagedPng({
        pageCount: 3,
        getPage,
        pageWidth: 210,
        pageHeight: 297,
        signal: abort.signal,
      }),
    ).rejects.toThrow('已取消导出')
    expect(getPage).not.toHaveBeenCalled()
  })
})
