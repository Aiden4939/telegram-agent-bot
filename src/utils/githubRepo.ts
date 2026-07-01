const OWNER_REPO_REGEX = /\b([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\b/;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function repoNameMatchesText(name: string, text: string): boolean {
  if (!name) {
    return false;
  }
  const escaped = escapeRegExp(name.toLowerCase());
  return new RegExp(
    `(?<![A-Za-z0-9_.-])${escaped}(?![A-Za-z0-9_.-])`,
    "i"
  ).test(text.toLowerCase());
}

function mentionsForeignRepoName(text: string, allowedName: string): boolean {
  const tokens = text.match(/\b[a-z0-9][a-z0-9-]*[a-z0-9]\b/gi) ?? [];
  const allowedLower = allowedName.toLowerCase();

  return tokens.some((token) => {
    if (token.length < 4 || !token.includes("-")) {
      return false;
    }
    return token.toLowerCase() !== allowedLower;
  });
}

export function parseOwnerRepo(text: string): string | null {
  const match = text.match(OWNER_REPO_REGEX);
  if (!match) {
    return null;
  }
  return `${match[1]}/${match[2]}`;
}

export function resolveAllowedRepo(
  text: string,
  allowedRepos: string[]
): string | null {
  const normalizedAllowed = allowedRepos.map((repo) => repo.trim()).filter(Boolean);
  if (normalizedAllowed.length === 0) {
    return null;
  }

  const explicit = parseOwnerRepo(text);
  if (explicit) {
    const matched = normalizedAllowed.find(
      (repo) => repo.toLowerCase() === explicit.toLowerCase()
    );
    return matched ?? null;
  }

  const byName = normalizedAllowed.filter((repo) => {
    const name = repo.split("/")[1];
    return name ? repoNameMatchesText(name, text) : false;
  });

  if (byName.length === 1) {
    return byName[0];
  }

  if (normalizedAllowed.length === 1) {
    const sole = normalizedAllowed[0];
    const soleName = sole.split("/")[1] ?? "";
    if (mentionsForeignRepoName(text, soleName)) {
      return null;
    }
    return sole;
  }

  return null;
}
