"""Private operational task notes for one original employee; not MEMORY/USER."""
import contextlib,hashlib,json,re,secrets,sqlite3,time,uuid
from pathlib import Path
from safety import ordinary_path

STATUSES={'active','blocked_tool','needs_owner','paused','completed','cancelled','awaiting_review'}
OWNER_BLOCKERS=('EGO_OWNER_','EGO_USER_CONTROL','EGO_EXTENSION_','EGO_ACTUAL_PROFILE_','EGO_PROFILE_',
                'EGO_WORKPLACE_AMBIGUOUS','EGO_WORKPLACE_NAME_CONFLICT','EGO_COMPANY_PROFILE_MISSING','EGO_SCOPE_')
def text(value,limit=32000):
    value=str(value or '')
    value=re.sub(r'(?im)^([^\n]*(?:password|api[_ -]?key|authorization|cookie|密码|验证码)\s*[:=])[^\n]*',r'\1 [redacted]',value)
    value=re.sub(r'\bsk-[A-Za-z0-9_-]{16,}\b','[redacted-key]',value)
    if len(value)>limit:raise ValueError('Task text too large; reference company file rather than silently truncate')
    return value
def route_key(source):
    return hashlib.sha256(json.dumps({k:source.get(k) for k in ['platform','user_id','chat_id','thread_id']},sort_keys=True).encode()).hexdigest()
def recoverable(code):
    # UI/HTTP failures are not proof of a broken worker. No scheduled replay.
    return code in {'EGO_UNAVAILABLE','EGO_BUSY','EGO_TRANSPORT_FAILED','EGO_NATIVE_PROCESS_START_FAILED',
                    'EGO_NATIVE_HANDSHAKE_FAILED','EGO_NATIVE_INITIALIZATION_FAILED','EGO_GATEWAY_INTERRUPTED'}

class TaskStore:
    def __init__(self,path,clock=time.time):
        self.path=ordinary_path(path,allow_missing=True);self.clock=clock
        ordinary_path(self.path.parent)
        with self.connection() as c:
            c.executescript('''CREATE TABLE IF NOT EXISTS context(id INTEGER PRIMARY KEY CHECK(id=1),doc TEXT NOT NULL);
             CREATE TABLE IF NOT EXISTS tasks(id TEXT PRIMARY KEY,doc TEXT NOT NULL);
             CREATE TABLE IF NOT EXISTS receipts(id TEXT PRIMARY KEY,task_id TEXT,doc TEXT NOT NULL);
             CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY,task_id TEXT,kind TEXT,at REAL);
             ''')
    @contextlib.contextmanager
    def connection(self):
        c=sqlite3.connect(self.path,timeout=3);c.row_factory=sqlite3.Row
        try:
            c.execute('PRAGMA busy_timeout=3000');c.execute('BEGIN IMMEDIATE');yield c;c.commit()
        except BaseException:c.rollback();raise
        finally:c.close()
    def _ctx(self,c):
        row=c.execute('SELECT doc FROM context WHERE id=1').fetchone();return json.loads(row[0]) if row else None
    def _putctx(self,c,x):c.execute('INSERT OR REPLACE INTO context VALUES(1,?)',(json.dumps(x,ensure_ascii=False),))
    def _get(self,c,tid):
        row=c.execute('SELECT doc FROM tasks WHERE id=?',(tid,)).fetchone()
        if not row:raise ValueError('Task not found')
        return json.loads(row[0])
    def _put(self,c,t):
        t['updated_at']=self.clock();t['revision']=t.get('revision',0)+1
        c.execute('INSERT OR REPLACE INTO tasks VALUES(?,?)',(t['id'],json.dumps(t,ensure_ascii=False)))
    def _log(self,c,t,kind):c.execute('INSERT INTO events(task_id,kind,at) VALUES(?,?,?)',(t,kind,self.clock()))
    def begin_owner(self,source,session_id,message_id,owner_text):
        if source.get('platform')!='feishu' or source.get('chat_type')!='dm':raise ValueError('Original Owner DM only')
        with self.connection() as c:
            old=self._ctx(c);generation=(old or {}).get('generation',0)+1
            for row in c.execute('SELECT doc FROM tasks').fetchall():
                t=json.loads(row[0])
                if t.get('resume_requested') or t.get('ticket_hash'):
                    t.update(resume_requested=False,ticket_hash=None,status='paused');self._put(c,t)
            x={'generation':generation,'kind':'owner','open':True,'source':source,'route':route_key(source),
               'session_id':session_id,'message_id':message_id,'owner_text':text(owner_text),'task_id':None}
            self._putctx(c,x);return generation
    def preempt_pending(self):
        """Ingress invalidation, before the native adapter can queue a new Owner message.

        Keep the active turn's context for its receipts; do not turn the new
        message into a grant until the native runner actually dispatches it.
        """
        with self.connection() as c:
            x=self._ctx(c)
            if x:x['preempted']=True;self._putctx(c,x)
            for row in c.execute('SELECT doc FROM tasks').fetchall():
                t=json.loads(row[0])
                if t.get('resume_requested') or t.get('ticket_hash'):
                    t.update(resume_requested=False,ticket_hash=None,status='paused');self._put(c,t)
    def _active(self,c):
        x=self._ctx(c)
        if not x or not x.get('open'):raise ValueError('No active authorized Owner/resume turn')
        return x
    def _ensure(self,c,x):
        if x.get('task_id'):return self._get(c,x['task_id'])
        if x['kind']!='owner':raise ValueError('An internal turn cannot create a new Owner task')
        t={'id':uuid.uuid4().hex,'owner_request':x['owner_text'],'owner_inputs':[{'message_id':x['message_id'],'text':x['owner_text']}],
           'source':x['source'],'route':x['route'],'session_id':x['session_id'],'generation':x['generation'],
           'status':'active','note':'','items':[],'resume_requested':False,'needs_verification':False,
           'last_failure':None,'stalled_resumes':0,'progress':'','created_at':self.clock()}
        x['task_id']=t['id'];self._putctx(c,x);self._put(c,t);self._log(c,t['id'],'owner_task_recorded');return t
    def checkpoint(self,args):
        if set(args)-{'action','task_id','status','items','note','resume_after_recovery','verification_ref','verification_note'}:raise ValueError('Unknown task field')
        if 'resume_after_recovery' in args and not isinstance(args['resume_after_recovery'],bool):raise ValueError('Boolean resume flag required')
        with self.connection() as c:
            x=self._active(c);tid=args.get('task_id')
            if tid:
                t=self._get(c,tid)
                if t['route']!=x['route'] or (x['kind']=='resume' and tid!=x['task_id']):raise ValueError('Foreign task/context denied')
                if x['kind']=='owner' and not any(i['message_id']==x['message_id'] for i in t['owner_inputs']):
                    t['owner_inputs'].append({'message_id':x['message_id'],'text':x['owner_text']})
                x['task_id']=tid;self._putctx(c,x)
                if t['generation']!=x['generation']:t['total_resumes']=0
                t['generation']=x['generation']
            else:t=self._ensure(c,x)
            status=args.get('status',t['status'])
            if status not in STATUSES:raise ValueError('Unknown task state')
            items=args.get('items',t['items'])
            if not isinstance(items,list) or len(items)>200:raise ValueError('Invalid task items')
            clean=[]
            for item in items:
                if not isinstance(item,dict) or not item.get('key') or any(i['key']==item['key'] for i in clean):raise ValueError('Unique nonempty item keys required')
                if set(item)-{'key','state','description','evidence_ref'} or item.get('state') not in {'pending','done','unknown'}:raise ValueError('Invalid task item')
                clean.append({'key':text(item.get('key'),200),'state':item['state'],'description':text(item.get('description'),1000),
                              'evidence_ref':text(item.get('evidence_ref'),200)})
            progress=json.dumps(sorted(i['key'] for i in clean if i['state']=='done'))
            if progress!=t.get('progress'):t['stalled_resumes']=0
            t.update(status=status,note=text(args.get('note',t['note']),12000),items=clean,progress=progress,
                     resume_requested=bool(args.get('resume_after_recovery',False)) and not x.get('preempted') and status in {'active','blocked_tool'})
            if args.get('verification_ref'):
                row=c.execute('SELECT task_id,doc FROM receipts WHERE id=?',(args['verification_ref'],)).fetchone()
                if not row or row['task_id']!=t['id']:raise ValueError('Verification requires a real observation receipt for this task')
                observed=json.loads(row['doc'])
                if not observed.get('observation') or observed.get('revision',0)<=t.get('failure_revision',0):raise ValueError('Verification must be a fresh observation after the uncertain action')
                t.update(needs_verification=False,verification_ref=args['verification_ref'],verification_note=text(args.get('verification_note'),2000))
            if status in {'needs_owner','paused','completed','cancelled'}:t.update(resume_requested=False,ticket_hash=None)
            if status=='completed' and t['needs_verification']:raise ValueError('Uncertain action requires a fresh saved-state observation before completion')
            t['completion_basis']='Agent report; receipt reference is not independent business verification'
            self._put(c,t);self._log(c,t['id'],'checkpoint');return self._public(t)
    def browser_event(self,tool,ok,code,receipt,digest):
        with self.connection() as c:
            x=self._ctx(c)
            if not x or not x.get('open'):return {'recorded':False}
            if tool not in {'ego_browser_actions','ego_browser_observe','ego_browser_pages','ego_browser_screenshot'} and not x.get('task_id'):return {'recorded':False}
            t=self._ensure(c,x);observation=ok and tool in {'ego_browser_observe','ego_browser_actions'}
            c.execute('INSERT OR REPLACE INTO receipts VALUES(?,?,?)',(receipt,t['id'],json.dumps({'tool':tool,'ok':bool(ok),'code':code,'digest':digest,'observation':observation,'at':self.clock(),'revision':t.get('revision',0)+1})))
            if not ok:
                t['last_failure']={'code':str(code or 'EGO_OPERATION_FAILED'),'tool':tool,'receipt':receipt}
                if tool=='ego_browser_actions':t.update(needs_verification=True,failure_revision=t.get('revision',0)+1)
                if t['status'] not in {'needs_owner','paused','completed','cancelled'}:
                    automatic=recoverable(code) and not x.get('preempted')
                    owner_required=any(str(code).startswith(p) for p in OWNER_BLOCKERS)
                    t.update(status='blocked_tool' if automatic else 'needs_owner' if owner_required else 'active',resume_requested=automatic)
            elif t['status']=='blocked_tool':t.update(status='active',resume_requested=False,last_failure=None)
            self._put(c,t);return {'recorded':True,'task_id':t['id'],'receipt':receipt,'needs_verification':t['needs_verification']}
    def end_turn(self):
        with self.connection() as c:
            x=self._ctx(c)
            if not x:return None
            x['open']=False;self._putctx(c,x)
            if not x.get('task_id'):return None
            t=self._get(c,x['task_id'])
            if t['status']=='active' and not t['resume_requested']:t['status']='awaiting_review';self._put(c,t)
            return t['id'] if t.get('resume_requested') else None
    def pending(self):
        with self.connection() as c:
            x=self._ctx(c)
            return [self._public(t) for t in (json.loads(row[0]) for row in c.execute('SELECT doc FROM tasks'))
                    if t.get('resume_requested') and t['status'] in {'active','blocked_tool'} and x and not x.get('preempted') and t['generation']==x['generation']]
    def list(self,*,summaries=False):
        with self.connection() as c:
            rows=[self._public(json.loads(r[0])) for r in c.execute("SELECT doc FROM tasks ORDER BY json_extract(doc,'$.updated_at') DESC LIMIT 30")]
        if not summaries:return rows
        return [{'id':t['id'],'status':t['status'],'goal_excerpt':t['owner_request'][:500],
                 'item_counts':{s:sum(i['state']==s for i in t['items']) for s in ['pending','done','unknown']},
                 'needs_verification':t['needs_verification'],'resume_requested':t['resume_requested'],
                 'last_failure_code':(t.get('last_failure') or {}).get('code'),'updated_at':t['updated_at']} for t in rows]
    def read(self,tid):
        with self.connection() as c:return self._public(self._get(c,tid))
    def search(self,query):
        if not isinstance(query,str) or not query.strip() or len(query)>160:raise ValueError('Search query1-160 characters required')
        with self.connection() as c:
            x=self._active(c)
            rows=c.execute("""SELECT id,doc FROM tasks WHERE json_extract(doc,'$.route')=?
                AND instr(lower(coalesce(json_extract(doc,'$.owner_request'),'') || ' ' ||
                 coalesce(json_extract(doc,'$.note'),'') || ' ' || coalesce(json_extract(doc,'$.items'),'')),lower(?))>0
                ORDER BY json_extract(doc,'$.updated_at') DESC LIMIT 10""",(x['route'],query.strip())).fetchall()
            found=[]
            for row in rows:
                t=json.loads(row['doc']);count=c.execute('SELECT count(*) FROM receipts WHERE task_id=?',(row['id'],)).fetchone()[0]
                found.append({'id':t['id'],'status':t['status'],'goal_excerpt':t['owner_request'][:300],
                    'lesson_excerpt':t.get('note','')[:1200],'receipt_count':count,'needs_verification':t['needs_verification'],
                    'updated_at':t['updated_at']})
            return found
    def _public(self,t):return {k:v for k,v in t.items() if k not in {'source','route','ticket_hash','ticket_expires'}}
    def source(self,tid):
        with self.connection() as c:return self._get(c,tid)['source']
    def ticket(self,tid):
        with self.connection() as c:
            x=self._ctx(c);t=self._get(c,tid)
            if not x or x.get('preempted') or t['generation']!=x['generation'] or not t.get('resume_requested') or t['status'] not in {'active','blocked_tool'}:return None
            if t.get('stalled_resumes',0)>=2 or t.get('total_resumes',0)>=2:
                t.update(status='needs_owner',resume_requested=False,last_failure={'code':'NO_PROGRESS_AFTER_RECOVERY','tool':'task_resume'});self._put(c,t);return None
            token=secrets.token_urlsafe(32);t.update(ticket_hash=hashlib.sha256(token.encode()).hexdigest(),ticket_expires=self.clock()+120,
                stalled_resumes=t.get('stalled_resumes',0)+1,total_resumes=t.get('total_resumes',0)+1,resume_requested=False)
            self._put(c,t);return token
    def consume(self,tid,token,source):
        with self.connection() as c:
            x=self._ctx(c);t=self._get(c,tid)
            if not x or x.get('preempted') or t['generation']!=x['generation'] or t['route']!=route_key(source) or t.get('ticket_expires',0)<self.clock():return False
            if not secrets.compare_digest(t.get('ticket_hash') or '',hashlib.sha256(str(token).encode()).hexdigest()):return False
            t.update(ticket_hash=None,status='active');self._put(c,t)
            self._putctx(c,{'generation':t['generation'],'kind':'resume','open':True,'source':source,'route':t['route'],
                'session_id':t['session_id'],'message_id':None,'owner_text':'','task_id':tid})
            self._log(c,tid,'authorized_internal_resume');return True
    def block(self,tid,code):
        with self.connection() as c:
            t=self._get(c,tid);t.update(status='needs_owner',resume_requested=False,ticket_hash=None,last_failure={'code':str(code),'tool':'recovery'});self._put(c,t)
    def restart_candidates(self):
        with self.connection() as c:
            x=self._ctx(c)
            if x and x.get('open') and x.get('task_id'):
                t=self._get(c,x['task_id'])
                if x.get('preempted'):
                    t.update(status='paused',resume_requested=False,ticket_hash=None);self._put(c,t)
                elif t['status'] not in {'completed','cancelled','needs_owner','paused'}:
                    t.update(status='blocked_tool',resume_requested=True,needs_verification=True,last_failure={'code':'EGO_GATEWAY_INTERRUPTED','tool':'gateway'});self._put(c,t)
                x['open']=False;self._putctx(c,x)
        return self.pending()
