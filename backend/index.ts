import express from "express";
import axios from "axios";
import cors from "cors";
import dotenv from "dotenv";
import MiniSearch from "minisearch";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

app.use(express.json());

const PORT = process.env.PORT || 5000;

// In-memory store
let currentScheduleJson: string | null = null;
let currentThreadId: string | null = null; // NEW: thread memory

// JSON validity check
const isValidJson = (text: string) => {
  try {
    const parsed = JSON.parse(text);
    return parsed && parsed.tasks && parsed.tasks.rows;
  } catch {
    return false;
  }
};

app.post("/schedule", async (req, res) => {
  const userPrompt = req.body.prompt;
  const headers = {
    "api-key": process.env.OPENAI_API_KEY,
    "Content-Type": "application/json",
  };

  try {
    const effectivePrompt = currentScheduleJson
      ? `This is the current schedule JSON:\n${currentScheduleJson}\n\nNow, based on this schedule, ${userPrompt}`
      : userPrompt;

    const endpoint = `https://sivac-m74yevap-eastus2.openai.azure.com/openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT}/chat/completions?api-version=${process.env.AZURE_OPENAI_API_VERSION}`;

    const requestBody = {
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant for scheduling.",
        },
        { role: "user", content: effectivePrompt },
      ],
      max_tokens: 1024,
      temperature: 0.7,
    };

    const response = await axios.post(endpoint, requestBody, { headers });
    const content = response.data.choices[0].message.content;

    // Extract JSON block
    const match =
      content.match(/```json\n([\s\S]*?)```/) || content.match(/({[\s\S]*})/);
    const jsonText = match ? match[1] : null;

    if (jsonText && isValidJson(jsonText)) {
      currentScheduleJson = jsonText;
      console.log("✅ JSON schedule updated");
    } else {
      console.log("⚠️ No valid JSON found. Schedule remains unchanged.");
    }

    res.json({ scheduleJson: content });
  } catch (error: any) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ error: "Assistant request failed" });
  }
});

app.post("/reset-schedule", (req, res) => {
  currentScheduleJson = null;
  currentThreadId = null; // RESET thread as well
  res.json({ message: "Schedule reset" });
});

/* ---------- Types (unchanged) ---------- */
type P6Task = {
  id: number;
  activityid?: string | null;
  name: string;
  startDate?: string | null;
  endDate?: string | null;
  status?: string | null;
  percentDone?: number | null;
  isCritical?: boolean | null;
  totalslack?: string | number | null;
  activityCodes?:
    | { code_Name?: string; code_Description?: string; code_Value?: string }[]
    | null;
  children?: P6Task[] | null;
};

type MapFinding = {
  id: number;
  activityid?: string | null;
  name: string;
  startDate?: string | null;
  endDate?: string | null;
  status?: string | null;
  percentDone?: number | null;
  isCritical?: boolean | null;
  totalslack?: string | null;
  reason?: string;
};

type ReduceOutput = {
  answer: string;
  verified: MapFinding[];
  notFound: { name?: string; id?: string }[];
};

/* ---------- Minimal utils ---------- */
const mkJson = (v: any) => JSON.stringify(v);
const flattenTree = (root: P6Task[]): P6Task[] => {
  const out: P6Task[] = [];
  const stack = [...root];
  while (stack.length) {
    const n = stack.pop()!;
    out.push(n);
    if (n.children?.length) stack.push(...n.children);
  }
  return out;
};

// Build quick parent map to recover lineage in O(depth)
function buildParentIndex(tasks: P6Task[]) {
  const byId = new Map<number, P6Task>();
  tasks.forEach((t) => byId.set(t.id, t));
  const parentOf = new Map<number, number | null>();
  // We don’t have explicit parents on each node; derive via a pass
  for (const t of tasks) {
    if (!t.children) continue;
    for (const ch of t.children) parentOf.set(ch.id, t.id);
  }
  // Ensure roots exist in map
  tasks.forEach((t) => {
    if (!parentOf.has(t.id)) parentOf.set(t.id, null);
  });
  return { byId, parentOf };
}

function lineageNames(
  id: number,
  idx: { byId: Map<number, P6Task>; parentOf: Map<number, number | null> }
) {
  const names: string[] = [];
  let cur: number | null | undefined = id;
  while (cur != null) {
    const node = idx.byId.get(cur);
    if (node?.name) names.push(node.name);
    cur = idx.parentOf.get(cur) ?? null;
  }
  return names.reverse(); // root → leaf
}

/* ---------- Responses API (1 helper) ---------- */
async function responsesCall(payload: any) {
  const endpoint = `${process.env.AZURE_OPENAI_ENDPOINT}/openai/responses?api-version=2025-04-01-preview`;
  const resp = await axios.post(endpoint, payload, {
    headers: {
      "api-key": process.env.OPENAI_API_KEY!,
      "Content-Type": "application/json",
    },
    // timeout: 60_000,
  });
  return resp.data;
}
const extractAssistantText = (output: any): string => {
  if (!output) return "";

  // Case: direct string
  if (typeof output === "string") return output;

  // Case: already unwrapped by SDK
  if (output.output_text) return output.output_text;

  // Case: Responses API array
  if (Array.isArray(output)) {
    const msg = output.find(
      (o: any) => o.type === "message" && Array.isArray(o.content)
    );
    if (msg) {
      const c = msg.content.find(
        (p: any) => p.type === "output_text" || p.type === "text"
      );
      if (c?.text) return c.text;
    }
  }

  // Case: single message object
  if (Array.isArray(output.content)) {
    const c = output.content.find(
      (p: any) => p.type === "output_text" || p.type === "text"
    );
    if (c?.text) return c.text;
  }

  // Fallback
  return JSON.stringify(output);
};

/* ---------- Index types ---------- */
type IndexDoc = {
  id: number;
  activityid: string;
  name: string;
  text: string; // composite field (status, slack, codes, lineage names)
  status: string;
  codes: string;
};

let mini: MiniSearch<IndexDoc>;
let rawTasksFlat: P6Task[] = [];
let idxMaps: {
  byId: Map<number, P6Task>;
  parentOf: Map<number, number | null>;
};

/* ---------- Startup indexing (fast, in-memory) ---------- */
async function fetchTasks(
  projectNumber: string,
  token: string
): Promise<P6Task[]> {
  const p6Resp = await axios.get(
    `${process.env.P6_API_URL}/p6-activites?baselineId=${encodeURIComponent(
      projectNumber
    )}`,
    {
      headers: {
        accept: "application/json;odata=verbose",
        Authorization: `Bearer ${token}`,
      },
      // timeout: 60_000
    }
  );
  const tree: P6Task[] = p6Resp?.data?.tasks?.children || [];
  return flattenTree(tree);
}

function buildIndex(tasks: P6Task[]) {
  idxMaps = buildParentIndex(tasks);
  const docs: IndexDoc[] = tasks.map((t) => {
    const codesArr = (t.activityCodes || [])
      .map((c) => c.code_Name || c.code_Description || c.code_Value)
      .filter(Boolean) as string[];
    const lineage = lineageNames(t.id, idxMaps).join(" > ");
    const fields = [
      t.name || "",
      t.activityid || "",
      t.status || "",
      (t.totalslack ?? "").toString(),
      codesArr.join(" "),
      lineage,
    ].join(" | ");
    return {
      id: t.id,
      activityid: (t.activityid ?? "") + "",
      name: t.name || "",
      status: t.status || "",
      codes: codesArr.join(" "),
      text: fields,
    };
  });

  mini = new MiniSearch<IndexDoc>({
    idField: "id",
    fields: ["name", "activityid", "status", "codes", "text"],
    storeFields: ["id", "activityid", "name", "status", "codes", "text"], // <-- add text
    searchOptions: {
      prefix: true,
      fuzzy: 0.2,
      boost: { name: 2, activityid: 1.8, codes: 1.5 },
      combineWith: "OR", // <-- default to OR; don't AND every token
    },
  });
  mini.addAll(docs);
  rawTasksFlat = tasks;
}

async function expandQuery(prompt: string) {
  const system =
    "You rewrite a construction scheduling query into structured search terms. " +
    "Return STRICT JSON with keys {must:string[], should:string[], exclude:string[], synonyms:string[]}.\n" +
    "Keep it short (<= 20 total terms). Use common industry synonyms (e.g., mobilization, crane, rigging, demo, piling, excavation, shoring, MEP, commissioning, punchlist, TCO, NTP, RFI, submittals). " +
    "Include likely abbreviations and variants. Do not add dates or IDs unless explicitly provided.";
  const data = await responsesCall({
    model: process.env.AZURE_OPENAI_DEPLOYMENT,
    // text: { format: "json" },
    // temperature: 0,
    input: [
      { role: "system", content: [{ type: "input_text", text: system }] },
      { role: "user", content: [{ type: "input_text", text: prompt }] },
    ],
  });
  try {
    return JSON.parse(extractAssistantText(data.output));
  } catch {
    return { must: [], should: [], exclude: [], synonyms: [] };
  }
}

type QX = {
  must: string[];
  should: string[];
  synonyms: string[];
  exclude: string[];
};

function parseQueryExpansion(raw: any): QX {
  // If it's the full Responses API array, pluck the assistant text
  if (Array.isArray(raw)) {
    const msg = raw.find((p: any) => p?.type === "message");
    const text =
      msg?.content?.find((c: any) => c?.type === "output_text")?.text ?? "";
    raw = text;
  }
  // If it's a string, strip code fences and parse JSON
  if (typeof raw === "string") {
    const stripped = raw
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```$/i, "");
    try {
      raw = JSON.parse(stripped);
    } catch {
      raw = {};
    }
  }

  // Normalize into arrays of strings
  const asArr = (v: any): string[] =>
    Array.isArray(v)
      ? v.map(String).filter(Boolean)
      : typeof v === "string" && v.trim()
      ? [v.trim()]
      : [];

  const qx: QX = {
    must: asArr(raw?.must),
    should: asArr(raw?.should),
    synonyms: asArr(raw?.synonyms),
    exclude: asArr(raw?.exclude),
  };

  // Deduplicate case-insensitively
  const dedupe = (xs: string[]) =>
    Array.from(new Set(xs.map((s) => s.toLowerCase())));
  qx.must = dedupe(qx.must);
  qx.should = dedupe(qx.should);
  qx.synonyms = dedupe(qx.synonyms);
  qx.exclude = dedupe(qx.exclude);

  return qx;
}

function searchIndex(rawQx: any, k = 250) {
  const qx = parseQueryExpansion(rawQx);

  const optsBase = {
    prefix: true,
    fuzzy: 0.2,
    combineWith: "OR" as const,
  };

  const contains = (field: unknown, needle: string) => {
    if (!field) return false;
    const n = needle.toLowerCase();
    if (Array.isArray(field))
      return field.some((v) => String(v).toLowerCase().includes(n));
    return String(field).toLowerCase().includes(n);
  };

  const excludeFilter = (r: any) =>
    !qx.exclude.some(
      (x) => contains(r.text, x) || contains(r.name, x) || contains(r.codes, x)
    );

  // 1) Hard filter: MUST terms via set intersection of individual searches
  let mustSet: Set<number> | null = null;
  if (qx.must.length) {
    for (const t of qx.must) {
      const hits = mini.search(t, { ...optsBase, filter: excludeFilter });
      const ids = new Set<number>(hits.map((h) => h.id as number));
      if (mustSet == null) {
        mustSet = ids;
      } else {
        mustSet = new Set<number>(
          [...mustSet].filter((x: number) => ids.has(x))
        );
      }
      if (mustSet.size === 0) break;
    }
  }

  // 2) Soft signals: OR search over should + synonyms
  const softTerms = [...new Set([...qx.should, ...qx.synonyms])];
  const softHits = softTerms.length
    ? mini.search(softTerms.join(" "), { ...optsBase, filter: excludeFilter })
    : [];

  // 3) Merge & score: prefer MUST matches, then soft
  const score = new Map<number, number>();
  const bump = (id: number, s: number) =>
    score.set(id, (score.get(id) ?? 0) + s);

  if (mustSet && mustSet.size) {
    // run a broader OR search to get scores for the must candidates
    const probe = mini.search([...qx.must, ...softTerms].join(" "), {
      ...optsBase,
      filter: excludeFilter,
    });
    const probeMap = new Map<number, number>(
      probe.map((h) => [h.id as number, h.score])
    );
    for (const id of mustSet) bump(id, (probeMap.get(id) ?? 1) * 10); // big boost for MUST
  }

  for (const h of softHits) bump(h.id as number, h.score);

  // 4) Fallback: if totally empty, at least try the raw prompt words OR a single strong term
  if (score.size === 0) {
    const rescueTerms = qx.must[0] ?? qx.should[0] ?? qx.synonyms[0] ?? "";
    if (rescueTerms) {
      for (const h of mini.search(rescueTerms, {
        ...optsBase,
        filter: excludeFilter,
      })) {
        bump(h.id as number, h.score);
      }
    }
  }

  // 5) Rank & return top-K ids
  const ranked = [...score.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, k)
    .map(([id]) => id);

  return ranked;
}

async function finalAnswerLLM(
  prompt: string,
  rows: P6Task[]
): Promise<ReduceOutput> {
  const system =
    "You are a Project Controls Analyst working with Primavera P6-style construction schedules.\n" +
    "Use accurate construction terminology and standards for interpretation (OSHA 29 CFR 1926, NFPA 70/70E, IBC, ACI, AISC, ASME B30, typical Cx/punch/NTP/TCO terms), but DO NOT invent data.\n" +
    "You will receive a small JSON array of tasks. Write a concise answer to the user's question, and also return structured 'verified' rows you relied on.\n" +
    "Output STRICT JSON: {answer:string, verified:[{id,activityid?,name,startDate?,endDate?,status?,percentDone?,isCritical?,totalslack?,reason?}], notFound:[{name?:string,id?:string}]}.";

  // Trim rows to just the fields we need (reduces tokens)
  const slim = rows.map((t) => ({
    id: t.id,
    activityid: t.activityid ?? null,
    name: t.name,
    startDate: t.startDate ?? null,
    endDate: t.endDate ?? null,
    status: t.status ?? null,
    percentDone: t.percentDone ?? null,
    isCritical: !!t.isCritical,
    totalslack: (t.totalslack ?? "").toString(),
    codes: (t.activityCodes || [])
      .map((c) => c.code_Name || c.code_Description || c.code_Value)
      .filter(Boolean),
  }));

  const user =
    `Question:\n${prompt}\n\n` +
    `Tasks (trimmed):\n${mkJson(slim)}\n` +
    `Guidance: Be decisive, do not claim 'not found' unless clearly absent from these rows.`;

  const data = await responsesCall({
    model: process.env.AZURE_OPENAI_DEPLOYMENT,
    // text: { format: "json" },
    // temperature: 0.2,
    input: [
      { role: "system", content: [{ type: "input_text", text: system }] },
      { role: "user", content: [{ type: "input_text", text: user }] },
    ],
  });

  let parsed: ReduceOutput;
  try {
    parsed = JSON.parse(extractAssistantText(data.output));
  } catch {
    parsed = {
      answer: "Here are the relevant results.",
      verified: slim,
      notFound: [],
    };
  }
  return parsed;
}

app.post("/index-project", async (req: any, res: any) => {
  const { projectNumber, token } = req.body || {};
  if (!projectNumber || !token)
    return res.status(400).json({ error: "projectNumber, token required" });
  try {
    const tasks = await fetchTasks(projectNumber, token);
    if (!tasks.length) return res.json({ ok: true, total: 0 });
    buildIndex(tasks);
    return res.json({ ok: true, total: tasks.length });
  } catch (e: any) {
    console.error("Indexing failed:", e?.response?.data || e?.message || e);
    return res.status(500).json({ error: "Indexing failed" });
  }
});

app.post("/llm-project-query", async (req: any, res: any) => {
  const { prompt } = req.body || {};
  if (!prompt) return res.status(400).json({ error: "prompt required" });
  if (!mini)
    return res
      .status(400)
      .json({ error: "Index not built. Call /index-project first." });

  try {
    const t0 = Date.now();
    const qx = await expandQuery(prompt);
    const ids = searchIndex(qx, 250);
    const rows = (ids.length ? ids : rawTasksFlat.map((t) => t.id))
      .map((id: number) => idxMaps.byId.get(id)!)
      .filter(Boolean);

    // ensure explicit IDs quoted by user aren’t missed
    const explicitIds = Array.from(
      prompt.matchAll(/\b[A-Z]{2,6}-?\d{3,6}\b/gi)
    ).map((m: any) => m[0].toUpperCase());
    if (explicitIds.length) {
      const byActivity = new Map(
        rawTasksFlat
          .filter((t) => t.activityid)
          .map((t) => [t.activityid!.toUpperCase(), t])
      );
      explicitIds.forEach((aid) => {
        const t = byActivity.get(aid);
        if (t && !ids.includes(t.id)) rows.push(t);
      });
    }
    const t1 = Date.now();
    // Final single LLM pass on a small slice
    const reduced = await finalAnswerLLM(prompt, rows);
    const t2 = Date.now();

    const t3 = Date.now();
    return res.json({
      answer: reduced.answer,
      verified: reduced.verified,
      notFound: reduced.notFound,
      meta: {
        totalIndexed: rawTasksFlat.length,
        retrieved: rows.length,
        totalElapsedMs: t3 - t0,
        llmCallElapsedMs: t2 - t1,
      },
    });
  } catch (e: any) {
    console.error("LLM pipeline failed:", e?.response?.data || e?.message || e);
    return res.status(500).json({ error: "LLM pipeline failed" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
