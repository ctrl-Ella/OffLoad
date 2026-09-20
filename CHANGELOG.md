# Changelog

What changed in OFFLOAD, newest first.

Every pull request adds a line here before asking for review. It is on the template's checklist, and the reason is that a log written at the end of a project is written from memory — and memory at three in the morning invents things.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the change types match the ones we use for commits.

---

## Unreleased

### Added

- The Nebius benchmark, in `bench/`: 36 real product cases, the five-model comparison from 2026-09-18 and the fourteen result files behind it, plus `npm run bench:transcribe` to turn the recorded sentences into transcripts through the product's own route. It arrives as a standalone npm package, with the three defects that blocked the voice measurement fixed.
- Mia, the character, with her five states and her voice: the drawing on the door and on a `/system` reference page, her colour tokens, the SLNG synthesis call with its environment contract, and `npm run mia:say` to hear her from the command line.
- Initial database migration: seven tables and the `Circulo` enum, generated with `migrate diff --from-empty` so the SQL could be reviewed before it was applied.
- Production image and Railway deployment guide: a four-stage `Dockerfile` with an unprivileged user, `.dockerignore`, Next's `standalone` output and the `/api/health` route.
- Repository README, with status badges for continuous integration, open issues and open pull requests.
- Application skeleton: TypeScript, Next.js, Tailwind and ESLint configuration, the Prisma schema and a placeholder page. With this the project builds and deploys.
- Project scaffolding: instructions for Claude Code sessions, one agent per lane, the working process, issue and pull request templates, labels and continuous integration.

### Changed

- The whole project moves to English: rules, documentation, code comments, templates, labels, agent instructions and product copy.
- Required pull request approvals drop to zero on `main` and `dev` for the duration of the hackathon. A pull request and green CI are still enforced. Another person reviewing stays the team's agreement, now with no machine checking it.

### Fixed

- Continuous integration was failing when generating the Prisma client. `prisma.config.ts` resolves `DATABASE_URL` as it loads, so the placeholder value moves to the job level instead of only the build step.
