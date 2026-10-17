import fs from "fs";
import path from "path";

const CONFIG_PATH = "D:\\website\\github-token.json";
if (!fs.existsSync(CONFIG_PATH)) {
    console.error("Config file not found:", CONFIG_PATH);
    process.exit(1);
}

const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
const SOURCE_DIR = "D:\\website";

const headers = {
    Authorization: `Bearer ${config.token}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "IPO-Sync-Agent",
    "X-GitHub-Api-Version": "2022-11-28"
};

async function api(endpoint, options = {}) {
    const url = `https://api.github.com${endpoint}`;
    const res = await fetch(url, {
        ...options,
        headers: {
            ...headers,
            ...(options.headers || {})
        }
    });
    const text = await res.text();
    let data;
    try {
        data = JSON.parse(text);
    } catch {
        data = text;
    }
    if (!res.ok) {
        throw new Error(`GitHub API Error [${res.status}] at ${endpoint}: ${JSON.stringify(data)}`);
    }
    return data;
}

function getAllFiles(dir, fileList = [], baseDir = dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');

        if (
            relPath.startsWith('node_modules') ||
            relPath.startsWith('github/') ||
            relPath === 'github' ||
            relPath === 'github-token.json' ||
            relPath.endsWith('.tmp')
        ) {
            continue;
        }

        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            getAllFiles(fullPath, fileList, baseDir);
        } else {
            fileList.push({ fullPath, relPath });
        }
    }
    return fileList;
}

export async function deployToGitHub(commitMessage = "Update website files from local workspace") {
    console.log(`\n🚀 Deploying updates to GitHub: ${config.owner}/${config.repo}...`);

    // 1. Get latest commit on main branch
    const ref = await api(`/repos/${config.owner}/${config.repo}/git/ref/heads/${config.branch}`);
    const parentCommitSha = ref.object.sha;

    // 2. Collect local files
    const files = getAllFiles(SOURCE_DIR);
    console.log(`Scanning ${files.length} project files...`);

    // 3. Create Blobs for each file
    const treeItems = [];
    for (const f of files) {
        const content = fs.readFileSync(f.fullPath);
        const base64Content = content.toString("base64");

        const blob = await api(`/repos/${config.owner}/${config.repo}/git/blobs`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                content: base64Content,
                encoding: "base64"
            })
        });

        treeItems.push({
            path: f.relPath,
            mode: "100644",
            type: "blob",
            sha: blob.sha
        });
    }

    // 4. Create Tree
    const tree = await api(`/repos/${config.owner}/${config.repo}/git/trees`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tree: treeItems })
    });

    // 5. Create Commit
    const commit = await api(`/repos/${config.owner}/${config.repo}/git/commits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            message: commitMessage,
            tree: tree.sha,
            parents: [parentCommitSha]
        })
    });

    // 6. Update main branch reference
    await api(`/repos/${config.owner}/${config.repo}/git/refs/heads/${config.branch}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            sha: commit.sha,
            force: true
        })
    });

    console.log(`✓ Deployment successful! Commit: ${commit.sha.slice(0, 7)}`);
    console.log(`🌐 Live site will reflect updates shortly at: https://${config.owner}.github.io/${config.repo}/\n`);
}

// Allow direct CLI execution: node deploy.js "commit message"
if (process.argv[1] && process.argv[1].endsWith('deploy.js')) {
    const msg = process.argv.slice(2).join(' ') || "Update website files from local workspace";
    deployToGitHub(msg).catch(err => {
        console.error("Deploy failed:", err.message);
        process.exit(1);
    });
}
