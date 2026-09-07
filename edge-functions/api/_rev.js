/**
 * 部署观测标记：所有边缘函数响应统一带 X-SeatMark-Rev，探针可确认线上边缘函数版本。
 * 改动 edge-functions/ 任一文件时在此递增。
 */
export const SEATMARK_REV = 'r356'
export const REV_HEADER_NAME = 'X-SeatMark-Rev'
