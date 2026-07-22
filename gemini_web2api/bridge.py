import queue
import threading
import time

class Task:
    def __init__(self, task_id, data):
        self.task_id = task_id
        self.data = data
        self.queue = queue.Queue()
        self.done = False
        self.error = None
        self.created_at = time.time()

class BridgeManager:
    def __init__(self):
        self.pending_tasks = queue.Queue()
        self.tasks = {}
        self.lock = threading.Lock()

    def submit_task(self, task_id, data):
        task = Task(task_id, data)
        with self.lock:
            self.tasks[task_id] = task
        self.pending_tasks.put(task)
        return task

    def get_pending_task(self, timeout=None):
        try:
            task = self.pending_tasks.get(timeout=timeout)
            return task
        except queue.Empty:
            return None

    def push_chunk(self, task_id, chunk):
        with self.lock:
            task = self.tasks.get(task_id)
        if task:
            task.queue.put(("chunk", chunk))

    def mark_done(self, task_id):
        with self.lock:
            task = self.tasks.get(task_id)
        if task:
            task.queue.put(("done", None))
            task.done = True

    def mark_error(self, task_id, error):
        with self.lock:
            task = self.tasks.get(task_id)
        if task:
            task.queue.put(("error", error))
            task.error = error
            task.done = True

    def remove_task(self, task_id):
        with self.lock:
            if task_id in self.tasks:
                del self.tasks[task_id]

bridge_manager = BridgeManager()
