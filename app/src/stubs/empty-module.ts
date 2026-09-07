/**
 * 空模块桩：vite.config.ts resolve.alias 把 jspdf 从不调用的可选依赖
 * （html2canvas / dompurify / canvg）指向这里，避免打出无用 chunk。
 */
export default undefined
