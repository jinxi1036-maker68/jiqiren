import sys,tempfile,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from company_tasks import TaskStore
SOURCE={'platform':'feishu','chat_type':'dm','user_id':'synthetic-owner','chat_id':'synthetic-chat','thread_id':None}

class ExperienceSearch(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
        self.store=TaskStore(Path(self.tmp.name)/'tasks.sqlite')
    def add(self,source,note):
        self.store.begin_owner(source,'synthetic-session',note,'Synthetic browser task')
        receipt=self.store.browser_event('ego_browser_observe',True,None,note,'synthetic-digest')
        t=self.store.checkpoint({'action':'checkpoint','status':'completed','note':note});self.store.end_turn();return t['id']
    def test_same_route_prior_lessons_have_receipt_counts_and_other_owner_is_excluded(self):
        target=self.add(SOURCE,'Learned device menu selection method; receipt lesson')
        self.add({**SOURCE,'user_id':'different-owner'},'device menu private other owner')
        self.store.begin_owner(SOURCE,'new-session','new-message','Find useful prior experience')
        found=self.store.search('device menu')
        self.assertEqual(len(found),1);self.assertEqual(found[0]['id'],target);self.assertEqual(found[0]['receipt_count'],1)
        self.assertNotIn('private other owner',str(found))
    def test_search_requires_active_grant_and_literal_bounded_query(self):
        self.add(SOURCE,'menu selection')
        with self.assertRaises(ValueError):self.store.search('menu')
        self.store.begin_owner(SOURCE,'new-session','new-message','Continue')
        for query in ['',None,'a'*161]:
            with self.assertRaises(ValueError):self.store.search(query)
        self.assertEqual(self.store.search("%' OR 1=1 --"),[])

if __name__=='__main__':unittest.main()
