# LDP 新建任务稳定操作覆盖规则

> 适用于本机正式 Hermes 的 `ldp-platform-map`。本规则只提供可靠浏览器动作，不替 Hermes 决定业务目标、SOP、人员、设备或是否获准写入。

## 当前强制规则

1. 同一业务目标只使用固定 TaskSpace `lingju-ldp-production`，始终复用该空间第一张托管页面（新空间默认 `p1`）。不得为一次任务不断创建 `probe*`、`build*` 等新空间。
2. 普通 Ant Design 表单只允许 Ego 的高层 `click`、`fill` 与状态回读。不得用 `Input.dispatchMouseEvent`、坐标点击、直接 `HTMLElement.click()`、React native value setter 或手工派发 `input/change` 事件。
3. 新建任务统一调用 `scripts/ldp-task-form.mjs`。Hermes 根据当前工作自行准备请求 JSON；工具负责打开表单、精确选项目/设备、填字段并逐项读回。
4. `submit=true` 时必须同时写 `writeAuthorized=true`，仅表示当前任务已有真实业务写入授权。脚本提交最多一次。
5. 提交后只有“弹窗关闭且当前列表可见目标任务”才记为已确认；否则记为 `unknown_query_once_do_not_resubmit`，只允许独立查询一次，禁止盲目再次提交。
6. 任何选择必须唯一匹配并在 `.ant-select-selection-item` 中读回。匹配 0 项或多项立即停止，不能按硬编码序号、旧索引或坐标猜选。
7. 运行脚本使用 `.mjs` 文件导入，不把长脚本、中文任务名、SOP 或员工资料塞进 `ego-browser nodejs -e`。

## 调用方式

把本轮请求写到本机私有文件 `C:\Users\Administrator\.hermes\runs\ldp-task-request.json`。示例仅表示字段结构：

```json
{
  "taskName": "任务名称",
  "project": "平台上现场读到的完整项目名",
  "device": "平台上现场核对的设备标识",
  "collectionHours": 6,
  "deliveryHours": 6,
  "sop": "1. 正式SOP……",
  "openAnnotation": true,
  "submit": false,
  "writeAuthorized": false,
  "discardAfterPrepare": true
}
```

零写入预检使用 `submit=false`，工具填表、逐项读回并关闭弹窗。获准真实写入时使用 `submit=true` 且 `writeAuthorized=true`：

```powershell
ego-browser nodejs -e "await import('file:///C:/Users/Administrator/.hermes/skills/company-ops/ldp-platform-map/scripts/ldp-task-form.mjs')"
```

`preflight` 七项必须全为 `true`。`confirmed_visible` 才算已确认；`unknown_query_once_do_not_resubmit` 只允许独立查询一次，不能重提。脚本异常时原样汇报错误码和已做范围，不新增 TaskSpace、不切换裸 Chrome、不扩大权限。

