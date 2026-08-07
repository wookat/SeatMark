/**
 * 页脚精选教程链接（轻量静态清单）。
 * App 壳层（AppFooter）直接使用，避免把整套教程正文打进主包；
 * 与 guides.ts 前几篇保持一致，新增/调整精选时手动同步。
 */
export const footerGuideLinks: { label: string; to: string }[] = [
  {
    label: '考场座位贴怎么批量打印？Excel 名单一键生成考场座签完整教程',
    to: '/guides/exam-seat-label-batch-print',
  },
  {
    label: 'Excel 名单一键生成桌牌：会议桌牌、姓名牌批量制作方法',
    to: '/guides/excel-generate-desk-cards',
  },
  {
    label: 'A4 纸打印席位卡的尺寸与排版指南：每页几枚、边距怎么留',
    to: '/guides/a4-seat-card-size-layout',
  },
  {
    label: '监考照片核验标签制作教程：带照片的考场座签怎么批量生成',
    to: '/guides/photo-verification-label',
  },
]
