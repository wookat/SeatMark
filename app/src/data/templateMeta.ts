/**
 * 模板库轻量元数据。
 * 首页等首屏路径直接使用，避免为展示数量而引入完整模板定义 chunk；
 * 与 defaultTemplates 的实际数量由单测保证同步。
 */
export const TEMPLATE_COUNT = 446

/** 纸型库收录数量（与 labelPapers 实际条数一致，单测保证同步） */
export const PAPER_COUNT = 56

/** 纸型专用模板数量（designedForPaper 标记，含横向进纸版型，单测保证同步） */
export const PAPER_TEMPLATE_COUNT = 220
