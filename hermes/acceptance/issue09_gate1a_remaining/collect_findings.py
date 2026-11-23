"""Export bounded metadata and explicit tool errors; no original private text.

Does not restart applications, patch runtime assets, call models or replay tests.
"""
from pathlib import Path
import datetime, hashlib, json, re

B = Path(__file__).resolve().parent
P = B / 'private'
O = B.parent / 'hermes_issue09_gate1a_acceptance_publication'
E = O / 'hermes/evidence/issue09_gate1a_acceptance'
E.mkdir(parents=True, exist_ok=True)


def read(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))


def save(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def alias(value):
    if isinstance(value, list):
        return [alias(v) for v in value]
    if isinstance(value, dict):
        return {k: alias(v) for k, v in value.items()}
    if isinstance(value, str):
        for original, replacement in [(str(Path.home() / '.hermes'), 'H'), (str(Path.home() / 'AppData/Roaming/Hermes'), 'D'), (str(Path.home() / 'AppData/Local/hermes/hermes-agent'), 'I'), (str(Path.home()), '<USER_HOME>')]:
            value = value.replace(original, replacement).replace(original.replace('\\', '/'), replacement)
    return value


prior = B.parent / 'hermes_issue09_gate1a/private'
transaction = read(prior / 'transaction_local_only.json')
expected = {r['path']: r['after_sha256'] for r in transaction['original_file_before']}
prep = read(B.parent / 'hermes_issue09_preparation/private/watched_hashes_local_only.json')
for name in ('memories/MEMORY.md', 'memories/USER.md', 'cron/jobs.json'):
    path = str(Path.home() / '.hermes' / name)
    expected[path] = prep[path]
selected = read(P / 'selected_before_local_only.json')
rows = []
for row in selected:
    after = hashlib.sha256(Path(row['Path']).read_bytes()).hexdigest()
    rows.append({'path': alias(row['Path']), 'expected_pr12_or_inherited_sha256': expected[row['Path']], 'round_before_sha256': row['SHA256'], 'round_after_sha256': after, 'matches': expected[row['Path']] == row['SHA256'] == after})
assert len(rows) == 6 and all(r['matches'] for r in rows)
save(P / 'selected_final_local_only.json', rows)

processes = read(P / 'running_processes_local_only.json')
session = read(P / 'latest_desktop_session_local_only.json')
public_session = dict(session)
public_session['rows'] = []
for row in session['rows']:
    item = dict(row)
    item['id_sha256'] = hashlib.sha256(item.pop('id').encode()).hexdigest()
    item['id_date_prefix'] = row['id'][:15]
    public_session['rows'].append(alias(item))
public_session['selected_id_dates_are_pre_integration'] = all(row['id'][:8].isdigit() and row['id'][:8] < '20261016' for row in session['rows'])
public_session['not_current_desktop_cwd_proof'] = True
public_session['earlier_observations_from_tool_transcript'] = [
 {'checked_at_utc': '2026-10-16T12:00:08.005874+00:00', 'selection': 'by_id', 'id_date_prefix': '20261015_224929', 'id_sha256': '041974333ef1ce734a7d7f3304719ea691956e8ac2e784033ad0c70b3dc07250', 'cwd': '<USER_HOME>'},
 {'checked_at_utc': '2026-10-16T12:06:02.211217+00:00', 'selection': 'by_started_at', 'id_date_prefix': '20260910_223300', 'id_sha256': '4cc11fe5d51ef42910aabc204c0910c9a1fc3990b7c015fe05a61d81474ff8ab', 'cwd': '<USER_HOME>'}
]
public_session['selection_changed_between_observations'] = 'First by_id read selected October15; final by_id/started_at reads selected September10. Reason unknown. This reader executes SELECT/PRAGMA query_only only; no DML, repair or broader history inspection was performed.'

# Only five matching lines from the three exactly identified current-date logs.
# No full log, stack dump, chat history, executable search or helper launch.
logroot = Path.home() / 'AppData/Local/Codex/logs/2026/10/16'
known = [
'codex-desktop-de617712-f367-4b72-ab7a-25634ca3fdaa-7280-t2-i1-094305-0.log',
'codex-desktop-de617712-f367-4b72-ab7a-25634ca3fdaa-7280-t1-i1-090933-0.log',
'codex-desktop-de617712-f367-4b72-ab7a-25634ca3fdaa-7280-t0-i1-090812-0.log']
log_findings = []
for name in known:
    count = 0
    with (logroot / name).open(encoding='utf-8', errors='replace') as f:
        for line_number, line in enumerate(f, 1):
            if not any(word in line for word in ('kernel assets', 'node_repl', 'ENOENT', 'os error 3')):
                continue
            if count == 5:
                break
            count += 1
            # Explicit summaries instead of exporting raw lines or stacks.
            if 'windows_core_runtime_component_resolved' in line:
                log_findings.append({'file': 'selected_current_date_desktop_log', 'line': line_number, 'timestamp_utc': line.split(' ')[0], 'event': 'windows_core_runtime_component_resolved', 'component': 'node-repl', 'consumer': re.search(r'consumer=([^ ]+)', line).group(1), 'source': 'copied', 'inference_limit': 'Resolution metadata is not proof of successful kernel asset preparation.'})
            elif 'bundled_plugin_status_unknown' in line:
                plugin = re.search(r'pluginName=([^ ]+)', line)
                log_findings.append({'file': 'selected_current_date_desktop_log', 'line': line_number, 'timestamp_utc': line.split(' ')[0], 'event': 'bundled_plugin_status_unknown', 'plugin': plugin.group(1) if plugin else 'unknown', 'error': 'path not found (os error 3)', 'inference_limit': 'Earlier plugin status warning; not proven to cause current node_repl failure.'})

attempts = [read(P / name) for name in ('cu_attempt1_local_only.json', 'cu_attempt2_local_only.json', 'kernel_probe_local_only.json')]
assert all(r.get('isError') for r in attempts)
failure = {
 'scope': 'Codex development tool; not Hermes software diagnosis',
 'attempts': [
  {'n': 1, 'action': 'documented @oai/sky import via node_repl', 'result': attempts[0]},
  {'n': 2, 'action': 'same initialization after one successful js_reset', 'result': attempts[1]},
  {'n': 3, 'action': 'plain nodeRepl.write sentinel; no desktop module/API imported', 'result': attempts[2]}],
 'reset_count': 1, 'retrying_stopped': True,
 'confirmed': {'temp_and_tmp_exist': True, 'own_temp_read_write_probe_succeeded_and_removed': True, 'configured_workspace_exists': True, 'bundled_node_cli_version': 'v24.19.0', 'bundled_python_file_exists': True, 'primary_runtime_bundle_version': '26.1013.11914', 'computer_use_skill_version': '26.1013.31256', 'logged_plugin_source_paths_currently_exist': alias(read(P / 'logged_source_paths_local_only.json'))},
 'selected_log_findings': log_findings,
 'inference': 'Even a plain Node REPL sentinel fails before returning output; failure appears in node_repl session resource preparation rather than a Hermes UI action. Exact failing asset source/destination is unknown.',
 'not_established': ['exact missing kernel asset path', 'causality of earlier bundled-plugin status warnings', 'whether restarting Codex will repair the issue', 'whether any app update is required'],
 'not_performed': ['helper executable search/launch or custom client', 'manual asset/cache copying or directory guessing', 'app/config/security changes', 'process kill/restart', 'alternative UI/CLI/CDP/IPC control channel', 'new model credentials'],
 'official_reference': {'url': 'https://developers.openai.com/plugins/deploy/troubleshooting', 'used_for': 'isolate failing layer and collect bounded logs/tool transcript for escalation', 'does_not_provide': 'a specific kernel-assets path-not-found repair procedure'}
}
save(E / 'TOOL_FAILURE.json', failure)
save(E / 'FINDINGS.json', {
 'checked_at_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
 'authorization': 'https://github.com/jinxi1036-maker68/jiqiren/issues/9#issuecomment-6213175793',
 'latest_review': 'https://github.com/jinxi1036-maker68/jiqiren/pull/12#pullrequestreview-5547274086',
 'status': 'applied_pending_desktop_acceptance_tool_still_blocked',
 'inherited_pr12_head': '2b7c8f6b74fd1324d547b89decb830db85294120',
 'selected_file_hashes': rows,
 'original_running_metadata': alias(processes),
 'owner_observations': [
  {'source': 'human reply in this Codex conversation', 'observation': 'original Desktop is open but idle'},
  {'source': 'human reply in this Codex conversation', 'observation': 'UI normal and chat input available', 'acceptance_limit': 'Owner visual confirmation, not Codex independent UI inspection, model success or company context proof'}],
 'session_metadata': public_session,
 'original_hermes_started_or_restarted_by_codex_this_round': False,
 'model_dialogues_this_round': 0,
 'model_dialogues_gate1a_total_recorded': 0,
 'model_dialogue_limit': 3,
 'agent_identity_knowledge_qa_partial_failure_acceptance': 'not_run',
 'old_memory_semantic_conflict': 'not_observed_no_new_agent_response',
 'complete_prompt_toolset_truncation_memory_reflow': 'not_verified',
 'native_loader_and_component_tests_rerun': False,
 'backup_or_full_audit_rerun': False,
 'original_file_changes_this_round': [],
 'new_company_knowledge_applied_this_round': False,
 'openclaw_gateway': {'enabled': True, 'state': 'Ready', 'changed': False},
 'rollback': 'not performed; latest user explicitly requests preserving existing changes if desktop tool remains unusable',
 'real_backend_login_or_business_operations': False,
 'pr_merges_or_base_changes': False,
 'Gate1A_passed': False, 'Gate1B_or_Gate2_entered': False
 })
pr13 = read(P / 'pr13_sources_latest_local_only.json')
save(E / 'BUSINESS_FRESHNESS.json', {
 'pr13_head': pr13['ref'], 'earlier_read_ref': 'f7a53eef0c45b65f305d4eac0c128c761c3fb993', 'pr13_state_when_read': 'open_unmerged',
 'files_read': [{'path': p, 'sha256_utf8_content': hashlib.sha256(v.encode()).hexdigest(), 'url': 'https://github.com/jinxi1036-maker68/jiqiren/blob/' + pr13['ref'] + '/' + p} for p,v in pr13['files'].items()],
 'owner_reported': {'scene_preparation_completed': '2026-10-15', 'internal_rehearsal': '2026-10-16'},
 'plan_only': {'trial_start': '2026-10-17', 'devices': 3, 'capture_hours_per_device': 6, 'effective_target_per_device': 4, 'aggregate_capture_target': 18, 'aggregate_effective_target': 12},
 'actual_capture_upload_qa_settlement': 'not_verified',
 'daily_report_sections': ['今日投入及产出', '设备盘点', '时间/人力及场景计划', '上传情况及按采集日期追踪积压'],
 'daily_report_recipient_channel_deadline_and_efficiency_metric': 'pending',
 'owner_forwarded_partner_followup': {'trial_effective_hours_feedback': 'T+1', 'week_end_feedback': 'no later than T+3', 'T_origin_calendar_business_day_cutoff_and_final_QA_definition': 'pending', 'payment_timing_promised': False, 'not_guaranteed_effective_hours': True},
 'pr13_index_consistency_warning': 'PR13 currently changes only 3 files; PROJECT_INDEX/SCENE_PIPELINE/PARTNER_LEDGER synchronization is still incomplete. No merge or wholesale CURRENT_WORK replacement is performed here.',
 'local_workspace_snapshot': {'ref': '053b5b4cd2476fdf6df68e2c924a6b1c7d28e080', 'files': 18, 'contains_pr13_new_files': False, 'refreshed_this_round': False},
 'safe_handling': 'Manual task 1 explicitly separates local fixed snapshot from Owner-provided newer PR13 context. This is not proof of on-disk knowledge refresh or autonomous reading of PR13.'
 })
print(json.dumps({'evidence_exported': 3, 'selected_hashes_match': 6, 'model_dialogues': 0, 'tool_attempts': 3, 'original_changes': 0, 'Gate1A_passed': False}))
