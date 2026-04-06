# Bee-Audit 🐝

Bee-Audit is a powerful, standalone Code Inspection System built for JavaScript/TypeScript projects, with first-class support for Monorepos (Turborepo, Nx, Pnpm Workspaces) and Next.js applications.

It provides a unified Command Line Interface (CLI) and a reusable GitHub Actions CI workflow to ensure your codebase is completely secure, robust, and free of vulnerabilities.

## Features

- **Automated Repository Cloning:** Securely fetches targeted branches.
- **Environment Detection:** Automatically identifies `pnpm`, `npm`, `yarn`, and Monorepo structures.
- **Code Quality:** Resiliently runs `lint`, `type-check`, and `test` suites.
- **Secrets Scanning:** Auto-downloads and executes `Gitleaks` securely across the repository history.
- **Dependency Security:** Performs vulnerability limits checks via package manager `audit`.
- **Normalized Reporting:** Outputs a clear Markdown `summary.md` and machine-readable `details.json`.

---

## Local Development & Usage

### 1. Installation

If you're running it locally from this source directory:
```bash
npm install
npm run build
```

### 2. Using the CLI

Run the tool locally against any GitHub repository:

```bash
npx bee-audit --repo-url https://github.com/facebook/react --branch main
```

**Options:**
- `--repo-url`: Repository URL (HTTPS or SSH).
- `--branch`: Specific branch to test (default: `main`).
- `--skip-tests`: Bypass the testing phase.
- `--workdir`: Override the temporary clone directory.

### 3. Generated Output

Upon completion, a **`bee-audit-report/`** directory is created in your Current Working Directory containing:
- `summary.md`: Human-readable status matrix.
- `details.json`: Raw telemetry data for dashboards.

---

## GitHub Actions CI Integration

To integrate Bee-Audit into your repository's CI/CD pipeline, simply copy the `templates/bee-audit.yml` file into your `.github/workflows/` directory.

```bash
mkdir -p .github/workflows
cp tools/bee-audit/templates/bee-audit.yml .github/workflows/
```

### CI Pipeline Highlights
- **Gitleaks Action:** Hard-fails the pull request if API Keys or Secrets are committed.
- **Audit Limits:** Hard-fails the build if `Critical` or `High` vulnerabilities exist in `package.json`.
- **SonarQube (Phase 2):** Sonar analysis is cleanly stubbed in the YAML. To enable it, uncomment the block and add your `SONAR_TOKEN` to your GitHub Repository Secrets.

### Monorepo Support Notes
The CI template includes hints for utilizing `turbo run test`. If `turbo.json` is detected locally by the CLI, it natively overrides default `npm run test` with `npx turbo run test --continue`.

*Bee OS Sovereign Intelligence Initiative.*
