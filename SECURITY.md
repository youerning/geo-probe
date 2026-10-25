# Security Policy

## Reporting

Please use GitHub's **private vulnerability reporting** on this repository. If that is unavailable, contact the maintainers at `673125641@qq.com`.

Do not open a public issue for a vulnerability that could expose API keys or user data.

## API key handling

- GEO Probe is a static app. It has no backend and does not receive or store keys on a server.
- The key is stored in the browser (`localStorage`, or `sessionStorage` if “仅本次会话” is enabled) and sent directly to DeepSeek.
- Keys are excluded from JSON exports and are never written to the repository.
- If you configure a custom proxy, the proxy may see the request. Only use a proxy you trust.

## What to include in a report

- A clear description and reproduction steps.
- Affected browser/OS and app version.
- Whether a custom proxy or API base was configured.
- **Do not paste a real API key.** Use a revoked/test key if a request capture is necessary.

## Supported versions

Security fixes target the latest `main` branch and the latest release.

## Proxy example

`examples/cloudflare-worker-proxy` is an example, not a hardened service. It is an open proxy unless you add authentication and rate limiting. Do not deploy it publicly without those controls.
