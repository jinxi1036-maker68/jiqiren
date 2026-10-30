"""Bounded recovery of an existing Owner task via native internal notifications.

No cron, auxiliary Agent, synthetic human message, model judge or business replay.
"""
import asyncio,json
from company_tasks import TaskStore
from qq_runtime import event

def unwrap(raw):
    if not isinstance(raw,str):return raw
    try:d=json.loads(raw)
    except ValueError:
        for line in raw.splitlines():
            try:return json.loads(line)
            except ValueError:pass
        return {'error':'UNPARSEABLE_NATIVE_RECEIPT'}
    if 'structuredContent' in d:return d['structuredContent']
    if 'result' in d:
        value=d['result']
        return unwrap(value) if isinstance(value,str) else value
    return d

class TaskContinuation:
    def __init__(self,database,out,check_protection,call=None,delays=(3,12,50)):
        self.store=TaskStore(database);self.out=out;self.check_protection=check_protection
        self.call=call or self.native_call;self.delays=delays;self.jobs=set();self.scheduled={};self.deliveries={};self.runner=None;self.closed=False
    async def native_call(self,name,args):
        from tools.mcp_tool import _make_tool_handler
        result=await asyncio.to_thread(_make_tool_handler('company_browser_simulation',name,50),args)
        return unwrap(result)
    def owner_arrived(self,msg,session_id):
        # Invalidate queued tickets before any newly received Owner model work.
        return self.store.begin_owner(msg.source.to_dict(),session_id,msg.message_id,msg.text or '')
    def admit_internal(self,msg):
        meta=(getattr(msg,'metadata',None) or {}).get('lingju_task_resume',{})
        try:return bool(meta and self.store.consume(meta.get('task_id'),meta.get('ticket'),msg.source.to_dict()))
        except (ValueError,TypeError,AttributeError):return False
    def after_turn(self,runner,msg,outcome):
        tid=self.store.end_turn()
        if not tid:return
        if outcome!='returned':self.store.block(tid,'NATIVE_TURN_INTERRUPTED');return
        adapter=runner._adapter_for_source(msg.source);key=runner._session_key_for_source(msg.source)
        if adapter is None or not hasattr(adapter,'register_post_delivery_callback'):
            self.store.block(tid,'NATIVE_DELIVERY_CALLBACK_UNAVAILABLE');return
        active=getattr(adapter,'_active_sessions',{}).get(key)
        generation=getattr(active,'_hermes_run_generation',None)
        # Native post-delivery callbacks also run after failed sends. Require
        # the adapter's actual processing outcome, not callback timing alone.
        event_key=id(msg);self.deliveries[event_key]=None
        def after_delivery():
            delivered=self.deliveries.pop(event_key,None)
            if delivered is True:self.schedule(runner,tid)
            else:
                self.store.block(tid,'NATIVE_RESULT_DELIVERY_FAILED_OR_UNKNOWN')
                event(self.out,'task_resume_not_delivered',task_id=tid)
        adapter.register_post_delivery_callback(key,after_delivery,generation=generation)
        event(self.out,'task_resume_waiting_for_delivery',task_id=tid)
    def delivery_outcome(self,msg,outcome):
        if id(msg) in self.deliveries:
            self.deliveries[id(msg)]=getattr(outcome,'value',outcome)=='success'
    def schedule(self,runner,tid):
        if self.closed or (tid in self.scheduled and not self.scheduled[tid].done()):return
        job=asyncio.create_task(self.resume(runner,tid));self.jobs.add(job);self.scheduled[tid]=job
        def done(j):
            self.jobs.discard(j)
            if self.scheduled.get(tid) is j:self.scheduled.pop(tid,None)
        job.add_done_callback(done)
    async def resume(self,runner,tid):
        try:
            ready=False
            for delay in self.delays:
                await asyncio.sleep(delay)
                if self.closed or not any(t['id']==tid for t in self.store.pending()):return
                if self.check_protection():self.store.block(tid,'PROTECTED_FILE_CHANGED');return
                from gateway.session import SessionSource
                source=SessionSource.from_dict(self.store.source(tid));adapter=runner._adapter_for_source(source)
                if adapter is None:self.store.block(tid,'NATIVE_ADAPTER_UNAVAILABLE');return
                key=runner._session_key_for_source(source)
                # Never let an internal notification merge into real Owner
                # text in the native pending slot. Owner ingress invalidates
                # tickets before queuing; otherwise wait for the original lane.
                if key in getattr(adapter,'_active_sessions',{}) or key in getattr(adapter,'_pending_messages',{}):continue
                # Same original MCP client/session. Never contend with another
                # standalone bridge or replay a business action as a probe.
                try:
                    health=await self.call('ego_browser_diagnostics',{})
                    if health.get('workerBusy') or health.get('queuedOperations'):continue
                    recovered=await self.call('ego_browser_recover',{'action':'connect'})
                    if recovered.get('error') or recovered.get('operationSucceeded') is False:continue
                    status=await self.call('ego_browser_status',{})
                    ready=not status.get('error') and status.get('operationSucceeded') is not False and status.get('ready',True)
                    if ready:break
                except Exception:
                    event(self.out,'task_recovery_probe_failed',task_id=tid)
            if not ready:
                self.store.block(tid,'BOUNDED_RECOVERY_EXHAUSTED')
                await self.notice(runner,tid,'浏览器安全恢复未成功，任务进度已保留；没有重复提交业务操作，需要检查工具连接。')
                return
            ticket=self.store.ticket(tid)
            if not ticket:
                if self.store.read(tid)['status']=='needs_owner':
                    await self.notice(runner,tid,'恢复后仍连续没有完成进展，已停止自动续办并保留任务记录。')
                return
            from gateway.platforms.base import MessageEvent
            from gateway.session import SessionSource
            task=self.store.read(tid);source=SessionSource.from_dict(self.store.source(tid))
            msg=MessageEvent(text='[系统内部任务续办通知；不是新的Owner指令，也不增加权限]\n'
                '浏览器连接已恢复。只继续此前真实Owner授权的同一任务；自行选择方法。先读任务笔记；任何未确认的保存先查询实际结果，禁止直接重复提交。'
                '若缺少业务决定、登录、权限或出现新Owner停止要求，记录needs_owner/paused并停止。完成后如实汇报并checkpoint。\n'
                +json.dumps({'task_id':tid,'original_owner_request':task['owner_request'],
                    'owner_clarifications':task['owner_inputs'][1:],'needs_saved_state_verification':task['needs_verification']},ensure_ascii=False),
                source=source,internal=True,allow_gateway_control=False,
                metadata={'lingju_task_resume':{'task_id':tid,'ticket':ticket}})
            adapter=runner._adapter_for_source(source)
            if adapter is None:self.store.block(tid,'NATIVE_ADAPTER_UNAVAILABLE');return
            event(self.out,'task_internal_resume_dispatched',task_id=tid,new_owner_message=False)
            await adapter.handle_message(msg)
        except asyncio.CancelledError:raise
        except Exception as exc:
            self.store.block(tid,'CONTINUATION_FAILED_'+type(exc).__name__)
            event(self.out,'task_continuation_failed',task_id=tid,error_type=type(exc).__name__)
    async def notice(self,runner,tid,text):
        from gateway.session import SessionSource
        source=SessionSource.from_dict(self.store.source(tid));adapter=runner._adapter_for_source(source)
        if adapter is not None:
            try:
                result=await adapter.send(source.chat_id,'【任务系统状态】'+text,
                    metadata={'thread_id':source.thread_id} if source.thread_id else None)
                event(self.out,'task_resume_status_sent',task_id=tid,success=bool(getattr(result,'success',False)))
            except Exception as exc:event(self.out,'task_resume_status_failed',task_id=tid,error_type=type(exc).__name__)
    async def close(self):
        self.closed=True
        jobs=list(self.jobs)
        for job in jobs:job.cancel()
        if jobs:await asyncio.gather(*jobs,return_exceptions=True)
