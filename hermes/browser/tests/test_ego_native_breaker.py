"""Real installed Hermes handler, isolated I/O; no import of identity/model/runtime."""
import ast,asyncio,contextvars,json,pathlib,subprocess,sys,types,unittest

class Lock:
    async def __aenter__(self):return self
    async def __aexit__(self,*args):pass

class NativeBreakerCompatibility(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.original=pathlib.Path.home()/'AppData/Local/hermes/hermes-agent/tools/mcp_tool.py'
        if not cls.original.exists():raise unittest.SkipTest('Original local Hermes installation unavailable')
        tree=ast.parse(cls.original.read_text('utf-8'))
        names={'_make_tool_handler','_bump_server_error','_reset_server_error'}
        cls.native=ast.Module(body=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name in names],type_ignores=[])
        assert len(cls.native.body)==3
        for file,name in [('agent/display.py','_detect_tool_failure'),('agent/tool_guardrails.py','classify_tool_failure')]:
            other=ast.parse((cls.original.parents[1]/file).read_text('utf-8'))
            cls.native.body.extend(n for n in other.body if isinstance(n,ast.FunctionDef) and n.name==name)
        module=(pathlib.Path(__file__).resolve().parents[1]/'ego/lifecycle.mjs').as_uri()
        code=f"import {{operationResult}} from '{module}'; console.log(JSON.stringify(operationResult({{error:'synthetic hidden button',code:'EGO_OPERATION_FAILED'}})));"
        cls.fixed=json.loads(subprocess.run([r'C:\Program Files\nodejs\node.exe','--input-type=module','-e',code],check=True,capture_output=True,text=True).stdout)
    def environment(self,result):
        self.calls=0;self.now=100.0
        async def call(*args,**kwargs):
            self.calls+=1
            return types.SimpleNamespace(content=[types.SimpleNamespace(text=x['text']) for x in result['content']],isError=result.get('isError',False),structuredContent=result.get('structuredContent'))
        server=types.SimpleNamespace(session=types.SimpleNamespace(call_tool=call),_rpc_lock=Lock())
        def field(o,a,b=None,default=None):return getattr(o,a,getattr(o,b,default) if b else default)
        ns=dict(json=json,contextvars=contextvars,time=types.SimpleNamespace(monotonic=lambda:self.now),
            _server_error_counts={},_server_breaker_opened_at={},_CIRCUIT_BREAKER_THRESHOLD=3,_CIRCUIT_BREAKER_COOLDOWN_SEC=60.0,
            _trust_gate_check=lambda *a:None,_get_connected_server_for_call=lambda *a:server,
            _mark_server_call_started=lambda *a:None,_run_on_mcp_loop=lambda f,**kw:asyncio.run(f()),
            mcp_field=field,tool_error=lambda x:json.dumps({'error':x}),_sanitize_error=lambda x:x,
            _truncate_mcp_text_result=lambda x:x,strip_unicode_tags=lambda x:x,
            _strip_reserved_meta_keys=lambda x:x,_MCP_HARD_RESULT_CAP_CHARS=1000000,
            file_mutation_result_landed=lambda *a:False,safe_json_loads=lambda x:json.loads(x))
        exec(compile(self.native,str(self.original),'exec'),ns)
        return ns,ns['_make_tool_handler']('fixture','fixture',5)
    def test_prior_response_reproduces_false_unreachable_after_three_page_failures(self):
        old={'isError':True,'content':[{'text':json.dumps({'error':'synthetic hidden button'})}]}
        ns,h=self.environment(old)
        for _ in range(3):self.assertIn('error',json.loads(h({})))
        self.now=113.0;out=json.loads(h({}));self.assertIn('unreachable',out['error']);self.assertIn('~47s',out['error']);self.assertEqual(self.calls,3)
    def test_fixed_completed_page_failures_reach_native_handler_without_opening_breaker(self):
        ns,h=self.environment(self.fixed)
        for _ in range(4):
            out=json.loads(h({}));self.assertNotIn('error',out)
            actual=out['structuredContent'];self.assertFalse(actual['operationSucceeded']);self.assertTrue(actual['transportHealthy']);self.assertIn('error',actual)
            rendered=json.dumps(out)
            self.assertTrue(ns['_detect_tool_failure']('fixture',rendered)[0])
            self.assertTrue(ns['classify_tool_failure']('fixture',rendered)[0])
        self.assertEqual(self.calls,4);self.assertEqual(ns['_server_error_counts']['fixture'],0)
    def test_genuine_MCP_error_envelope_still_triggers_original_breaker(self):
        err={'isError':True,'content':[{'text':'synthetic transport not available'}]}
        ns,h=self.environment(err)
        for _ in range(3):h({})
        self.assertIn('unreachable',json.loads(h({}))['error']);self.assertEqual(self.calls,3)

if __name__=='__main__':unittest.main()
