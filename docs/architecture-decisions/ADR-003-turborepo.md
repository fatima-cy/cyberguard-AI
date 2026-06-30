# ADR-003: Monorepo Build Tool: Turborepo vs Nx vs Independent Repos

## Status
Accepted

## Context
The platform has multiple interdependent TypeScript projects: backend API, frontend web, and shared library. We need a workspace build tool to coordinate building, linting, typechecking, and testing.

## Options Considered
- **Option A: Turborepo**: High-performance caching build system with minimal configuration.
- **Option B: Nx**: Full-featured build system with extensive code generation, but higher complexity.
- **Option C: Independent Repositories**: Individual repos for api, web, and shared. Low workspace friction but very high coordination overhead for changes.

## Decision
**Option A: Turborepo.**

### Rationale
1. **Lightweight Configuration**: Uses a single root `turbo.json` file.
2. **Speed**: Parallel execution and remote caching (caching outputs to local/CI store) saves up to 60-80% of build times.
3. **Workspace Integration**: Integrates directly with native npm workspaces.

## Consequences
- **Positive**: Blazing fast local/CI pipelines; shared package types are instantly available to both api and web.
- **Negative**: Hoisted `node_modules` structure could theoretically cause package versions to conflict, mitigated by maintaining explicit dependencies in each package's `package.json`.
