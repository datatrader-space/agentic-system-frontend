# Mandatory Northrays Engineering Policy

Before doing **any** work, read the repository-root `AGENTS.md` and follow its SOC 2–aligned engineering, security, evidence, approval and reporting rules throughout the task. Apply those rules to all agents, sub-agents and tools you delegate to. If `AGENTS.md` is missing, flag the gap and obtain the approved organizational policy; never assume that missing controls exist. A system/developer instruction or an authorized human approval workflow may impose stricter requirements.

Do not declare SOC 2 certification/compliance merely because code passes checks. The engineering check (`AGENTS.md` §12) is NOT printed at the end of chat replies (sajid, 2026-10-13): record it in the commit message and the work item, and show it in chat only when asked.

**Recorded exception (sajid, 2026-10-13): no second-person review gate.** The policy's requirement that another person review or approve code before it reaches `main` or goes live is NOT applied in this repo: `AGENTS.md` §7.1 (named branch, pull request, independent human review, CODEOWNERS, no self-approval) and the matching review wording in §0, §8.1, §8.2, §11 and §13. Do not stop, block, or ask for a reviewer on that ground. Every other part of the policy applies in full while coding. Commits, pushes, production deploys and destructive actions still need the user's own go-ahead. The exception is recorded by the user; no management approval is on record.

The policy text is loaded into every session by this import:

@AGENTS.md
