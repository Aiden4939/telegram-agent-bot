const SECRET_PATTERNS: Array<{ regex: RegExp; replace: (m: RegExpExecArray) => string }> = [
  {
    regex: /\bgh[pousr]_[A-Za-z0-9]{8,}\b/g,
    replace: (m) => `${m[0].slice(0, 4)}****${m[0].slice(-4)}`,
  },
  {
    regex: /\bsk-[A-Za-z0-9_-]{16,}\b/g,
    replace: (m) => `${m[0].slice(0, 4)}****${m[0].slice(-4)}`,
  },
  {
    regex: /\b(?:cursor|csr)_[A-Za-z0-9_-]{10,}\b/gi,
    replace: (m) => `${m[0].slice(0, 6)}****`,
  },
  {
    regex: /\b\d{8,10}:[A-Za-z0-9_-]{20,}\b/g,
    replace: () => "telegram_token:****",
  },
  {
    regex: /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
    replace: () => "Bearer ****",
  },
  {
    regex: /(authorization\s*:\s*)(.+)/gi,
    replace: (m) => `${m[1]}****`,
  },
  {
    regex: /(cookie\s*:\s*)(.+)/gi,
    replace: (m) => `${m[1]}****`,
  },
  {
    regex: /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
    replace: () => "jwt:****",
  },
  {
    regex: /(postgres(?:ql)?:\/\/[^:\s]+:)([^@\s]+)(@)/gi,
    replace: (m) => `${m[1]}****${m[3]}`,
  },
  {
    regex: /-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH |)PRIVATE KEY-----/g,
    replace: () => "-----BEGIN PRIVATE KEY-----****-----END PRIVATE KEY-----",
  },
];

export function redactSecrets(input: string): string {
  let out = input;
  for (const { regex, replace } of SECRET_PATTERNS) {
    out = out.replace(regex, (...args) => {
      const match = args.slice(0, -2) as unknown as RegExpExecArray;
      return replace(match);
    });
  }
  return out;
}

export function redactJsonPayload(payload: unknown): string {
  const raw = typeof payload === "string" ? payload : JSON.stringify(payload ?? {});
  return redactSecrets(raw);
}
