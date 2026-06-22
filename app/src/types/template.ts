export type FieldType = 'text' | 'image'
export type TextAlign = 'left' | 'center' | 'right'
export type VerticalAlign = 'top' | 'middle' | 'bottom'
export type FontWeight = 'normal' | 'bold'

/** 模板中的一个字段（文本或照片），坐标与尺寸单位均为 mm */
export interface TemplateField {
  id: string
  label: string
  type: FieldType
  x: number
  y: number
  width: number
  height: number
  fontSize?: number
  fontWeight?: FontWeight
  align?: TextAlign
  verticalAlign?: VerticalAlign
  color?: string
  /** 中文（主）字体栈；未设置时跟随模板 */
  fontFamily?: string
  /** 西文字体栈（英文/数字），合并时置于中文字体前，仅覆盖拉丁字形；未设置时跟随模板 */
  fontFamilyEn?: string
  /** 字距，单位 em（相对字号） */
  letterSpacing?: number
  lineHeight?: number
  padding?: number
  maxLines?: number
  border?: boolean
  borderWidth?: number
  borderColor?: string
  radius?: number
  /** 字段填充背景色（如色块、深色条） */
  background?: string
  /** hero 字段（如座位号）会以更重的字重展示 */
  emphasis?: 'hero'
  /** 标签名前缀（如「姓名」），渲染在内容前的小字标题 */
  caption?: string
  /** 缩略图与设计器中展示的示例内容 */
  sample?: string
  /**
   * 固定文本：设置后该字段不参与 Excel 映射，
   * 每枚标签都渲染相同内容（如“请对号入座”、机构名称）
   */
  fixedText?: string
  /**
   * 固定图片（dataURL）：设置后图片字段不再按列匹配照片，
   * 每枚标签渲染相同图片（如校徽 / Logo）
   */
  imageSrc?: string
}

/** 单枚标签的纸面规格，单位 mm */
export interface LabelSpec {
  width: number
  height: number
  radius?: number
  borderWidth?: number
  borderColor?: string
  background?: string
}

/** 整页纸张与排版规格，单位 mm */
export interface PageSpec {
  paperWidth: number
  paperHeight: number
  rows: number
  cols: number
  marginTop: number
  marginBottom: number
  marginLeft: number
  marginRight: number
  gapX: number
  gapY: number
}

export interface LabelTemplate {
  id: string
  name: string
  description: string
  scenario?: string
  accent?: string
  builtin?: boolean
  sampleData?: Record<string, string>
  /** 模板全局中文（主）字体栈 */
  fontFamily?: string
  /** 模板全局西文字体栈（英文/数字），合并时置于中文字体前 */
  fontFamilyEn?: string
  label: LabelSpec
  page: PageSpec
  fields: TemplateField[]
  showLabelBorder: boolean
}

/** Excel 中的一行数据：表头 -> 单元格文本 */
export type DataRow = Record<string, string>

/** 模板字段 id -> Excel 表头 */
export type FieldMapping = Record<string, string>

export interface ParsedExcel {
  fileName: string
  sheetName: string
  headers: string[]
  rows: DataRow[]
}
