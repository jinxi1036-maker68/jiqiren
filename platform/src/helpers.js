import { round2 } from './db.js';

/**
 * Non-blocking best-effort Feishu Webhook notification.
 * Silently skips if FEISHU_WEBHOOK_URL is unset so local tests & offline mode never fail.
 */
export async function notifyFeishu(title, lines = []) {
  const url = String(process.env.FEISHU_WEBHOOK_URL || '').trim();
  if (!url) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2000);
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        msg_type: 'text',
        content: { text: `【凌矩协同平台通知】${title}\n${lines.join('\n')}` },
      }),
    });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

const BAD_TAG_DICTIONARY = [
  { match: /HAND_OUT|出画|脱画|手离开/i, label: '双手出画超时', tip: '操作时双手超出镜头视野超 3 秒，请将头戴/桌面机位倾角再下调 5–10 度，确保操作全程双手与道具同框。' },
  { match: /OCCLUSION|遮挡|挡住/i, label: '镜头遮挡', tip: '存在货架、手臂或身体遮挡主操作区，请调整站位侧身 30 度并清走镜头正前方遮挡物。' },
  { match: /BLUR|模糊|虚焦|抖动/i, label: '画面模糊或剧烈抖动', tip: '头部晃动过快或对焦漂移，转头动作放缓，开拍前先擦拭镜片并确认防抖档位开启。' },
  { match: /DARK|LIGHT|暗|逆光|反光/i, label: '光照过暗或强反光', tip: '工作台照度不足或正对强顶灯反光，请补开侧方补光灯并避开反光角度。' },
  { match: /FACE|MINOR|隐私|人脸|未成年/i, label: '涉及人脸或隐私红线', tip: '画面出现无关顾客正脸、收件单个人信息或未成年人，立即暂停并物理遮蔽快递面单/调节取景角度。' },
  { match: /EMPTY|IDLE|摆拍|废品|重复/i, label: '空桌摆拍或无效重复拆装', tip: '系统判定为静态摆拍或反复拆装同一废料，须严格按照真实工位完整工序与正常物料流转拍摄。' },
  { match: /TAPE|DISPOSABLE|胶带|一次性/i, label: '违规使用一次性耗材', tip: '严禁使用一次性胶带、撕毁标签或不可复用包装，请改用循环扣盒、魔术贴或可复位容器。' },
];

/**
 * Translate raw upstream rejection codes/notes into plain Chinese corrective coaching for agents.
 */
export function translateBadReasons(rawReasons) {
  let list = [];
  if (Array.isArray(rawReasons)) {
    list = rawReasons;
  } else if (typeof rawReasons === 'string' && rawReasons.trim()) {
    try {
      const parsed = JSON.parse(rawReasons);
      list = Array.isArray(parsed) ? parsed : [{ raw_tag: rawReasons }];
    } catch {
      list = rawReasons.split(/[;；\n]+/).map((s) => s.trim()).filter(Boolean).map((s) => ({ raw_tag: s }));
    }
  }

  return list.map((item) => {
    const rawCode = typeof item === 'string' ? item : String(item.raw_tag || item.code || item.reason || '').trim();
    const hours = typeof item === 'object' && item.hours !== undefined ? Number(item.hours) : null;
    const clipRef = typeof item === 'object' ? String(item.clip_ref || item.clip || '').trim() : '';
    const dictHit = BAD_TAG_DICTIONARY.find((d) => d.match.test(rawCode));
    return {
      clip_ref: clipRef || '批次片段',
      hours,
      raw_tag: rawCode || '质检未通过',
      category_zh: dictHit ? dictHit.label : '工艺与规范待整改',
      xiaoyou_plain_advice: (typeof item === 'object' && item.xiaoyou_plain_advice)
        ? String(item.xiaoyou_plain_advice)
        : (dictHit ? dictHit.tip : `请对照当前规则红线排查“${rawCode}”，修正后先试拍 10 分钟自检。`),
    };
  });
}

/**
 * Extract structured change card from raw pasted upstream group notice (AI draft for human review).
 */
export function draftRuleRevisionFromNotice(rawNotice, versionCode) {
  const lines = String(rawNotice || '')
    .split(/\r?\n|[。；;]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2);
  const bullets = lines.slice(0, 6).map((l, idx) => `${idx + 1}. ${l}`);
  return {
    version_code: versionCode,
    ai_structured_diff: bullets.length
      ? `【小优提炼 ${versionCode} 规则变更要点（待总控确认）】\n${bullets.join('\n')}`
      : `【小优提炼 ${versionCode} 规则变更要点】\n1. 请严格按最新质检标准执行。`,
    suggested_summary: bullets.slice(0, 3).join('；') || '更新项目操作红线与上传规范',
  };
}

/**
 * Parse pasted upstream QA report lines:
 * Format per line: batch_ref, device_or_account, report_date, uploaded_hours, valid_hours, raw_bad_reason
 */
export function parseUpstreamQaLines(rawText) {
  return String(rawText || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && !/^批次|^batch/i.test(l))
    .map((line) => {
      const parts = line.split(/[,，|\t]+/).map((p) => p.trim());
      const uploaded = Number(parts[3] || 0);
      const valid = Number(parts[4] || 0);
      const invalid = Math.max(0, round2(uploaded - valid));
      return {
        upstream_batch_ref: parts[0] || `UP-${Date.now().toString().slice(-4)}`,
        matched_key: parts[1] || '',
        report_date: parts[2] || new Date().toISOString().slice(0, 10),
        uploaded_hours: uploaded,
        valid_hours: valid,
        invalid_hours: invalid,
        raw_reason: parts[5] || '',
      };
    })
    .filter((r) => r.uploaded_hours > 0);
}

/**
 * Isolated per-(Project x Agent) XiaoYou Assistant Engine.
 * NEVER sees upstream_name_internal, upstream_base_rate_cny, or other agents.
 */
export function runProjectXiaoyouAssistant({ project, assignment, qaReports, ruleRevisions, question }) {
  const q = String(question || '').trim();

  // Check strict escalation triggers FIRST!
  const escalationPatterns = [
    { re: /涨价|降价|加价|补贴|单价|税点|垫资|提前结/i, cat: 'PRICE_OR_SETTLEMENT', label: '价格 / 税点 / 提前结算诉求' },
    { re: /申诉|误判|复核|凭什么扣|不认可无效|重审/i, cat: 'QA_DISPUTE', label: '甲方 QA 无效判罚申诉' },
    { re: /换场地|新门店|换城市|设备丢|摔坏|赔偿|免押/i, cat: 'DEVICE_OR_SCENE', label: '设备损赔 / 押金 / 变更执行场地' },
    { re: /验证码|登不上|账号异常|传不上去|报错拦截/i, cat: 'PORTAL_BLOCKED', label: '上传子账号 / 渠道访问阻塞' },
    { re: /转人工|人工客服|找老板|找管理员/i, cat: 'OTHER', label: '代理主动申请人工督导介入' },
  ];

  for (const pat of escalationPatterns) {
    if (pat.re.test(q)) {
      return {
        shouldEscalate: true,
        escalateCategory: pat.cat,
        escalateSummary: `[${project.code}] 代理提问触发人工红线（${pat.label}）：${q}`,
        reply: `【项目专属小优已为您拦截并升级】这个问题涉及「${pat.label}」，已超出 AI 自动答复权限。我已自动生成升级工单推给凌矩人工督导（并同步至总控待办），请留意回复。`,
      };
    }
  }

  // Repeat-error auto escalation check: >= 2 recent reports with invalid_hours > 0
  const recentInvalidCount = (qaReports || []).filter((r) => Number(r.invalid_hours || 0) > 0).length;
  if (/怎么老错|一直无效|连续被打回/i.test(q) || (recentInvalidCount >= 2 && /申诉|帮我看看|怎么办/i.test(q))) {
    return {
      shouldEscalate: true,
      escalateCategory: 'REPEAT_ERROR',
      escalateSummary: `[${project.code}] 该派单已出现 ${recentInvalidCount} 批无效时长记录，触发连续错误人工介入：${q}`,
      reply: `【项目专属小优预警】检测到您当前项目已有 ${recentInvalidCount} 个批次存在无效扣减，已触发「连续异常人工介入规则」，我已同步提交给凌矩交付督导帮您定向排查。`,
    };
  }

  // Routine isolated Q&A strictly from current project rules, SOP, portal policy, and QA reports
  if (/规则|变更|版本|红线|要求|注意/i.test(q)) {
    const latestRev = (ruleRevisions || [])[0];
    return {
      shouldEscalate: false,
      reply: [
        `【当前执行规则版本：${project.current_rule_version}】`,
        `核心 QA 红线：${project.qa_red_lines}`,
        latestRev ? `最新变更摘要（${latestRev.version_code}）：${latestRev.change_summary}` : '',
      ].filter(Boolean).join('\n'),
    };
  }

  if (/上传|账号|平台|设备|怎么传|路径/i.test(q)) {
    const devices = assignment ? (JSON.parse(assignment.bound_device_ids_json || '[]').join('、') || '暂未绑定设备号') : '待锁单后绑定';
    const acc = assignment?.upstream_upload_account || '待总控审批锁单后下发';
    return {
      shouldEscalate: false,
      reply: [
        `【${project.title} · 传片与归因绑定说明】`,
        `1. 授权传片账号/通道：${acc}`,
        `2. 已绑定归因设备号：${devices}（小优只据此回抓您的有效时长，请勿借给其它项目混用）`,
        `3. 通道指引：${project.upstream_upload_guide}`,
        `提醒：您只能通过凌矩本平台查看最终 QA 评估、无效原因与预估收益，无需也不可前往上游后台查看结算或商业模块。`,
      ].join('\n'),
    };
  }

  if (/无效|原因|预估|多少钱|有效|qa|收益/i.test(q)) {
    const latestQa = (qaReports || [])[0];
    if (!latestQa) {
      return {
        shouldEscalate: false,
        reply: `当前派单暂未收到小优回流的上游 QA 评估记录。请先按 ${project.first_piece_min_hours}–${project.first_piece_max_hours}h 首件标准上传，或填写今日批量日报，小优会在上游出结果后同步回本页。`,
      };
    }
    const reasons = translateBadReasons(latestQa.invalid_reasons_json);
    return {
      shouldEscalate: false,
      reply: [
        `【最近一批小优回流评估 · ${latestQa.report_date}】`,
        `上传 ${latestQa.uploaded_hours}h ｜ 有效 ${latestQa.valid_hours}h ｜ 无效 ${latestQa.invalid_hours}h ｜ QA 预估净收益 ¥${latestQa.estimated_agent_net_cny}（未决算，甲方回款后按背靠背结算）`,
        reasons.length ? `无效原因诊断：\n${reasons.map((r, i) => `${i + 1}) [${r.category_zh}] ${r.xiaoyou_plain_advice}`).join('\n')}` : '本批无无效片段扣减！',
      ].join('\n'),
    };
  }

  return {
    shouldEscalate: false,
    reply: `您好！我是「${project.title}」专属项目小优（仅服务您在本项目下的配额交付，当前规则 ${project.current_rule_version}）。您可以问我：「最新规则红线」、「传片账号与绑定设备号」、「最近批次无效原因和预估收益」，或者遇到价格/QA申诉时输入“转人工”直接升级督导。`,
  };
}

/**
 * Safely serialize rows to Excel-friendly UTF-8 BOM CSV (guards against formula injection).
 */
export function buildCsvUtf8Bom(headers, rows) {
  const escapeCell = (val) => {
    let s = String(val ?? '');
    if (/^[=+\-@]/.test(s)) s = `'${s}`;
    return `"${s.replaceAll('"', '""')}"`;
  };
  const lines = [headers.map(escapeCell).join(',')];
  for (const row of rows) {
    lines.push(row.map(escapeCell).join(','));
  }
  return `\uFEFF${lines.join('\r\n')}`;
}
