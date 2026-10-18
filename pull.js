import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG_PATH = path.join(__dirname, "github-token.json");
if (!fs.existsSync(CONFIG_PATH)) {
    console.error("Config file not found:", CONFIG_PATH);
    process.exit(1);
}

const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
const TARGET_DIR = __dirname;

const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "IPO-Sync-Agent",
    "X-GitHub-Api-Version": "2022-11-28"
};

if (config.token && !config.token.startsWith("EXPIRED")) {
    headers.Authorization = `Bearer ${config.token}`;
}

async function api(endpoint) {
    const url = `https://api.github.com${endpoint}`;
    let res = await fetch(url, { headers });
    if (res.status === 401 && headers.Authorization) {
        // Fallback without auth for public repository
        delete headers.Authorization;
        res = await fetch(url, { headers });
    }
    if (!res.ok) {
        throw new Error(`GitHub API Error [${res.status}] at ${endpoint}`);
    }
    return await res.json();
}

export async function pullFromGitHub() {
    console.log(`\n📥 Fetching latest files from GitHub: ${config.owner}/${config.repo} (${config.branch})...`);

    // 1. Get latest commit and tree
    const ref = await api(`/repos/${config.owner}/${config.repo}/git/ref/heads/${config.branch}`);
    const commitSha = ref.object.sha;
    const commit = await api(`/repos/${config.owner}/${config.repo}/git/commits/${commitSha}`);
    const treeSha = commit.tree.sha;

    // 2. Get full tree recursively
    const tree = await api(`/repos/${config.owner}/${config.repo}/git/trees/${treeSha}?recursive=1`);
    console.log(`Found ${tree.tree.length} items in remote repository.`);

    let updatedCount = 0;

    for (const item of tree.tree) {
        if (item.type !== "blob") continue;

        // Skip internal or local-only files
        if (
            item.path.startsWith("node_modules") ||
            item.path === "github-token.json" ||
            item.path.startsWith(".git")
        ) {
            continue;
        }

        const localFilePath = path.join(TARGET_DIR, item.path);
        const localDir = path.dirname(localFilePath);

        if (!fs.existsSync(localDir)) {
            fs.mkdirSync(localDir, { recursive: true });
        }

        // Fetch blob content
        const blob = await api(`/repos/${config.owner}/${config.repo}/git/blobs/${item.sha}`);
        const content = Buffer.from(blob.content, "base64");

        // Check if file is already identical
        let isDifferent = true;
        if (fs.existsSync(localFilePath)) {
            const localContent = fs.readFileSync(localFilePath);
            if (localContent.equals(content)) {
                isDifferent = false;
            }
        }

        if (isDifferent) {
            fs.writeFileSync(localFilePath, content);
            console.log(`  ✓ Updated: ${item.path}`);
            updatedCount++;
        }
    }

    console.log(`\n✅ Pull Complete! ${updatedCount} file(s) updated to match GitHub.\n`);
}

// Allow direct execution: node pull.js
if (process.argv[1] && process.argv[1].endsWith("pull.js")) {
    pullFromGitHub().catch(err => {
        console.error("Pull failed:", err.message);
        process.exit(1);
    });
}
