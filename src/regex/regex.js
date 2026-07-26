// 正则源（契约 §4.6）：仅显示层，不改楼层字段；流式与最终态一致；幂等；不匹配安全失败为原样显示。
// 打包期由 pipeline 映射为卡内 regex_scripts 格式（placement=AI输出、markdownOnly=仅显示）。

export const REGEX_SCRIPTS = [
  {
    scriptName: '网瘾学园-隐藏变量更新块',
    findRegex: '/<UpdateVariable>[\\s\\S]*?<\\/UpdateVariable>/g',
    replaceString: '',
    // 显示层专用：markdownOnly=true 只影响渲染，不改存储与提示词
    placement: [2], disabled: false, markdownOnly: true, promptOnly: false, runOnEdit: true,
  },
  {
    scriptName: '网瘾学园-隐藏结算标签',
    findRegex: '/<结算[^>]*\\/>/g',
    replaceString: '',
    placement: [2], disabled: false, markdownOnly: true, promptOnly: false, runOnEdit: true,
  },
  {
    // 流式期间半截 <UpdateVariable 开标签（尚无闭合）也不得闪现明文（契约 §4.6）
    scriptName: '网瘾学园-隐藏流式半截更新块',
    findRegex: '/<(?:UpdateVariable|结算)[^]*$/g',
    replaceString: '',
    placement: [2], disabled: false, markdownOnly: true, promptOnly: false, runOnEdit: true,
  },
  {
    // 提示词瘦身（样例卡实证技巧）：深度≥4 的旧楼层不再携带更新块与结算标签
    scriptName: '网瘾学园-旧楼层提示词裁剪',
    findRegex: '/<UpdateVariable>[\\s\\S]*?<\\/UpdateVariable>|<结算[^>]*\\/>/g',
    replaceString: '',
    placement: [2], disabled: false, markdownOnly: false, promptOnly: true, runOnEdit: true,
    minDepth: 4,
  },
];
