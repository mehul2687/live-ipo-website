/**
 * LiveIPO Cloud Sync Proxy - Cloudflare Worker
 * Safely holds GITHUB_PAT (and optional ADMIN_KEY) in Cloudflare Secrets,
 * allowing any browser/device on liveipo.in to run instant sync without
 * ever entering or exposing a GitHub Personal Access Token in the browser.
 *
 * Required Cloudflare Secret:
 *   - GITHUB_PAT : Classic PAT with `repo` and `workflow` scopes
 * Optional Cloudflare Secret:
 *   - ADMIN_KEY  : Custom PIN required from Admin UI (leave unset for origin-locked one-click sync)
 */

const OWNER_REPO = "mehul2687/live-ipo-website";
const WORKFLOW_FILE = "sync.yml";

const ALLOWED_ORIGINS = [
  "https://liveipo.in",
  "https://www.liveipo.in",
  "https://mehul2687.github.io"
];

function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
}

function corsHeaders(origin) {
  const allowOrigin = isAllowedOrigin(origin) ? origin : "https://liveipo.in";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-admin-key",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}

function jsonResponse(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...corsHeaders(origin)
    }
  });
}

function authorizeRequest(request, env, origin, { checkPin = true } = {}) {
  if (origin && !isAllowedOrigin(origin)) {
    return { ok: false, status: 403, error: "Forbidden origin." };
  }
  if (checkPin) {
    const requiredPin = (env.ADMIN_KEY || "").trim();
    if (requiredPin) {
      const provided = (request.headers.get("x-admin-key") || "").trim();
      if (!provided || provided !== requiredPin) {
        return { ok: false, status: 401, error: "Admin Sync PIN અમાન્ય અથવા ખૂટે છે." };
      }
    }
  }
  return { ok: true };
}

function githubHeaders(token) {
  return {
    "Authorization": `Bearer ${token}`,
    "Accept": "application/vnd.github+json",
    "User-Agent": "LiveIPO-Cloudflare-Sync-Worker",
    "Content-Type": "application/json"
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin");
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    if (request.method === "OPTIONS") {
      if (origin && !isAllowedOrigin(origin)) {
        return new Response("Forbidden", { status: 403 });
      }
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    const token = (env.GITHUB_PAT || "").trim();

    // 1. Health & configuration check (no secrets returned)
    if (request.method === "GET" && (path === "/health" || path === "/")) {
      const auth = authorizeRequest(request, env, origin, { checkPin: false });
      if (!auth.ok) return jsonResponse({ ok: false, error: auth.error }, auth.status, origin);
      return jsonResponse({
        ok: true,
        hasToken: Boolean(token),
        requiresPin: Boolean((env.ADMIN_KEY || "").trim()),
        repo: OWNER_REPO
      }, 200, origin);
    }

    // 2. Dispatch GitHub Actions sync workflow
    if (request.method === "POST" && path === "/dispatch") {
      const auth = authorizeRequest(request, env, origin, { checkPin: true });
      if (!auth.ok) return jsonResponse({ ok: false, error: auth.error }, auth.status, origin);

      if (!token) {
        return jsonResponse({
          ok: false,
          status: 500,
          error: "Cloudflare Worker માં GITHUB_PAT Secret સેટ કરેલું નથી."
        }, 500, origin);
      }

      let body = {};
      try {
        body = await request.json();
      } catch (_) {}

      const cleanId = String(body.targetIpoId || "").trim().toUpperCase();
      const inputs = {
        sync_mode: cleanId ? "single" : String(body.syncMode || "all")
      };
      if (cleanId) {
        inputs.target_ipo_id = cleanId;
      }

      const dispatchStartedAt = Date.now() - 8000;
      const ghRes = await fetch(
        `https://api.github.com/repos/${OWNER_REPO}/actions/workflows/${WORKFLOW_FILE}/dispatches`,
        {
          method: "POST",
          headers: githubHeaders(token),
          body: JSON.stringify({ ref: "main", inputs })
        }
      );

      if (ghRes.status === 204 || ghRes.ok) {
        return jsonResponse({ ok: true, status: ghRes.status, dispatchStartedAt }, 200, origin);
      }

      let errMsg = `GitHub HTTP ${ghRes.status}`;
      try {
        const errJson = await ghRes.json();
        if (errJson && errJson.message) errMsg = `${errJson.message} (HTTP ${ghRes.status})`;
      } catch (_) {}

      if (ghRes.status === 401 || ghRes.status === 403) {
        errMsg = `Cloudflare માં સેવ કરેલ GITHUB_PAT અમાન્ય છે અથવા 'workflow' પરમિશન ખૂટે છે (${errMsg}).`;
      }

      return jsonResponse({ ok: false, status: ghRes.status, error: errMsg }, ghRes.status, origin);
    }

    // 3. Poll latest workflow run status
    if (request.method === "GET" && path === "/status") {
      const auth = authorizeRequest(request, env, origin, { checkPin: true });
      if (!auth.ok) return jsonResponse({ ok: false, error: auth.error }, auth.status, origin);

      if (!token) {
        return jsonResponse({ ok: false, status: 500, run: null, error: "Missing GITHUB_PAT secret" }, 500, origin);
      }

      const sinceMs = Number(url.searchParams.get("since") || 0);
      const runIdParam = Number(url.searchParams.get("runId") || 0);

      const ghRes = await fetch(
        `https://api.github.com/repos/${OWNER_REPO}/actions/workflows/${WORKFLOW_FILE}/runs?event=workflow_dispatch&per_page=6`,
        { headers: githubHeaders(token) }
      );

      if (!ghRes.ok) {
        return jsonResponse({ ok: false, status: ghRes.status, run: null }, ghRes.status, origin);
      }

      const data = await ghRes.json();
      const runs = Array.isArray(data.workflow_runs) ? data.workflow_runs : [];
      let matched = null;
      if (runIdParam) {
        matched = runs.find(r => r.id === runIdParam) || null;
      }
      if (!matched && sinceMs) {
        matched = runs.find(r => new Date(r.created_at).getTime() >= sinceMs) || null;
      }

      return jsonResponse({
        ok: true,
        run: matched ? {
          id: matched.id,
          status: matched.status,
          conclusion: matched.conclusion,
          html_url: matched.html_url,
          created_at: matched.created_at,
          updated_at: matched.updated_at
        } : null
      }, 200, origin);
    }

    return jsonResponse({ ok: false, error: "Not found" }, 404, origin);
  }
};
