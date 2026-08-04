/**
 * 站点运营与备案信息（集中维护，改这里全站生效）。
 *
 * - OPERATOR_NAME：运营主体名称（个体工商户 / 公司注册名），营业执照办理后替换占位符；
 * - ICP_BEIAN：工信部 ICP 备案号（https://beian.miit.gov.cn 查询）；
 * - POLICE_BEIAN：公安联网备案号（如「湘公网安备 43010202000000号」），办理后填写即自动展示；
 * - POLICE_BEIAN_CODE：公安备案号中的纯数字编码，用于生成备案查询链接。
 */

/** 运营主体名称（法务文书落款用）。TODO(老板)：注册完成后替换为营业执照名称 */
export const OPERATOR_NAME = '【运营主体名称】'

/** 工信部 ICP 备案号 */
export const ICP_BEIAN = '湘ICP备2026009844号'
export const ICP_BEIAN_URL = 'https://beian.miit.gov.cn'

/** 公安联网备案号（未办理时留空，页脚自动隐藏） */
export const POLICE_BEIAN = ''
/** 公安备案号纯数字编码（用于备案查询链接） */
export const POLICE_BEIAN_CODE = ''

/** 法务文书生效/更新日期 */
export const LEGAL_UPDATED_AT = '2026-08-04'
