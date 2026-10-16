"""Exercise Windows kernel cleanup with only a child spawned by this test."""
import subprocess,sys,unittest
from owned_job import OwnedJob

class OwnedJobTests(unittest.TestCase):
    def test_closing_job_terminates_only_assigned_child(self):
        child=subprocess.Popen([sys.executable,'-I','-B','-c','import time;time.sleep(30)'],creationflags=subprocess.CREATE_NO_WINDOW)
        job=None
        try:
            job=OwnedJob();job.add(child)
            self.assertIsNone(child.poll())
            job.close();child.wait(timeout=5)
            self.assertIsNotNone(child.returncode)
        finally:
            if job:job.close()
            if child.poll() is None:child.terminate();child.wait(timeout=5)

if __name__=='__main__':unittest.main()
