# Ego browser adapter (candidate, 2026-10-28)

This is a browser capability for the **existing original Hermes**, not a new
employee, model, business system, or script containing a business click order.
The original registered MCP launcher remains intact. An explicit private
`lingju.ego-browser.v1` runtime selects `ego/bridge.mjs`; absence of that runtime
preserves the existing route.

## Current status

- Installed native Ego/CLI: **0.6.1.13**, official guide **2.1.0**.
- Eight typed MCP tools: guide, status, owned-window recovery, observation,
  short action batches, actual image screenshots, owned Pages, and handoff.
- Native component calls and original-Hermes tool discovery passed. No Hermes
  model message has been sent for this integration.
- **Synthetic only. Production is rejected in both Python and Node.** Do not
  change this switch merely because a demonstration succeeded.

## Why production is still closed

The main Page's GET requests were allowed and a project POST was denied before
reaching the fixture. A separate related-popup probe nevertheless delivered a
synthetic POST. `Target.autoAttachRelated(waitForDebuggerOnStart=true)` reported
the related Page with `waitingForDebugger=false` on this installed build.
A second response-policy experiment also failed its outcome checks. Successful
CDP acknowledgements are not proof of enforcement. See the latest section of
the [living report](../reports/2026-10-27_STATISTICS_READONLY_PREPARATION.md)
and [evidence](../evidence/ego-install-preparation-2026-10-28.json).

Before real login/data, a browser-level boundary must cover popups, frames,
workers, WebSockets and request methods, with actual outcome evidence.
The current adapter is not a Python/Node execution sandbox and does not expose
arbitrary Node, filesystem, shell, page JavaScript, CDP, raw requests, credentials,
upload or download as Agent tools.

## Runtime and lifecycle

The private runtime lives under `H/tools/company-browser/runs/`, pins all four
adapter modules plus CLI and official-guide SHA256, and names an existing Space.
The Node bridge launches the verified official CLI with a newly generated UTF-8
bootstrap module. Inputs never depend on environment inheritance inside Ego.
An authenticated loopback worker serializes operations. The browser remains
owned by Ego; only this invocation's worker is managed by the adapter.
An exclusive owned lock avoids conflicting Desktop/Feishu execution. A worker
heartbeat timeout releases the hook after loss of its client. A disconnected
MCP client does not prove the Space is finished, and is never an excuse to
recreate a Space or resubmit a business action.

The original native tool catalogue was probed without starting adapters, a
gateway, Desktop conversation or model. This is **not** proof that the currently
running Desktop/Feishu process has loaded the tools. No persistent default
switch has been made.

## Local checks

```text
node --test hermes/browser/tests/ego_adapter.test.mjs
<original Hermes Python> -I -B hermes/browser/tests/test_ego_runtime.py
```

Only an approved synthetic runtime may be used for component invocation. A
receipt describes dispatch; saved results must be verified separately.
Screenshots are returned as MCP images, but actual model visual understanding
remains untested. Unknown HTTP 503 causes remain unknown.

## Recovery

Only `H/tools/company-browser/dispatch.py` was an existing file changed in this
stage. Its private preimage and before/after hashes are in the local deployment
receipt. Restore that one file only if its current hash still matches this
stage; otherwise stop for concurrent-change review. New adapter modules can
remain inert. Do not restore an entire old workspace or replay business work.
SOUL, HERMES.md, MEMORY/USER, R3, Manifest, model/credentials, saved MCP config,
QQ/voice, cron and old profiles were not write targets.
