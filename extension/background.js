const PYTHON_SERVER_URL = "http://localhost:8081";

async function fetchXsrfToken() {
  try {
    const res = await fetch("https://gemini.google.com/app", { credentials: "include" });
    const text = await res.text();
    const match = text.match(/"SNlM0e":"([^"]+)"/);
    if (match) {
      return match[1];
    }
  } catch (e) {
    console.error("Failed to fetch XSRF token:", e);
  }
  return null;
}

async function handleTask(task) {
  try {
    console.log(`Handling task ${task.task_id}`);
    const xsrfToken = await fetchXsrfToken();
    const reqid = Math.floor(Date.now() / 1000) % 1000000;
    const url = `https://gemini.google.com/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate?bl=boq_assistant-bard-web-server_20260716.08_p0&hl=en&_reqid=${reqid}&rt=c`;

    const inner = new Array(102).fill(null);
    if (task.file_refs && task.file_refs.length > 0) {
       inner[0] = [task.prompt, 0, null, task.file_refs.map(ref => [null, null, ref]), null, null, 0];
    } else {
       inner[0] = [task.prompt, 0, null, null, null, null, 0];
    }
    inner[1] = ["en"];
    inner[2] = ["", "", "", null, null, null, null, null, null, ""];
    inner[6] = [0];
    inner[7] = 1;
    inner[10] = 1;
    inner[11] = 0;
    inner[17] = [[task.think_mode]];
    inner[18] = 0;
    inner[27] = 1;
    inner[30] = [4];
    inner[41] = [2];
    inner[53] = 0;
    inner[59] = crypto.randomUUID();
    inner[61] = [];
    inner[68] = 1;
    inner[79] = task.model_id;
    if (task.extra_fields) {
       for (const [k, v] of Object.entries(task.extra_fields)) {
           inner[k] = v;
       }
    }

    const outer = [null, JSON.stringify(inner)];
    const params = new URLSearchParams();
    params.append("f.req", JSON.stringify(outer));
    if (xsrfToken) {
       params.append("at", xsrfToken);
    }

    const response = await fetch(url, {
       method: "POST",
       headers: { "Content-Type": "application/x-www-form-urlencoded" },
       body: params.toString(),
       credentials: "include"
    });

    if (!response.ok) {
       throw new Error(`Gemini API returned ${response.status} ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");

    while(true) {
       const { done, value } = await reader.read();
       if (done) break;
       const chunk = decoder.decode(value, { stream: true });
       await fetch(`${PYTHON_SERVER_URL}/internal/chunk/${task.task_id}`, {
          method: "POST",
          body: chunk
       });
    }
    // send end signal
    await fetch(`${PYTHON_SERVER_URL}/internal/chunk/${task.task_id}?done=1`, {
       method: "POST"
    });
    console.log(`Finished task ${task.task_id}`);
  } catch(e) {
    console.error(`Task ${task.task_id} failed:`, e);
    await fetch(`${PYTHON_SERVER_URL}/internal/error/${task.task_id}`, {
       method: "POST",
       body: e.toString()
    });
  }
}

async function pollTasks() {
  while (true) {
    try {
      const res = await fetch(`${PYTHON_SERVER_URL}/internal/poll`);
      if (res.status === 200) {
        const task = await res.json();
        // Handle task asynchronously so we can poll for more immediately
        handleTask(task);
      }
    } catch (e) {
      // Server down or offline, sleep a bit before retrying
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

// Start polling
pollTasks();
