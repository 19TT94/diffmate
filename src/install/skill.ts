export type InstallClient = 'claude' | 'cursor'

export const SKILL_NAME = 'diffmate-review'

const DESCRIPTION =
  'Opens a diffmate review in the browser so the user can approve, reject, ' +
  'comment on and ask about each hunk, then acts on the result. Reviews the ' +
  'uncommitted changes by default, or a branch or a GitHub PR URL when one is ' +
  'named. Use when the user asks to review changes, a branch or a PR with ' +
  'diffmate, or to walk through a diff hunk by hunk.'

// Lets Claude Code run the review loop without a prompt per tool call.
const CLAUDE_ALLOWED_TOOLS = [
  'mcp__diffmate__start_review',
  'mcp__diffmate__wait_for_activity',
  'mcp__diffmate__answer_question',
  'mcp__diffmate__end_review',
].join(' ')

// One body for every client; only the frontmatter differs.
const BODY = `# diffmate review

Review a diff with the user in diffmate's browser UI. diffmate only reads
git: approve and reject are signals for you to act on, never changes it
makes itself.

## Pick what to review

From the user's request:

- **Nothing named** ("review this", "review my changes"): the uncommitted
  changes, staged, unstaged and untracked. Call \`start_review\` with no
  target. If it reports there are no changes, ask the user what to review
  instead of guessing.
- **A branch** ("review feat/x", "review my commits"):
  \`start_review({ branch, base })\`. Leave \`base\` out to use the repo's
  default branch. A branch checked out in another worktree is reviewed
  there, uncommitted changes included; otherwise its commits are reviewed
  read-only.
- **A PR URL**: run \`gh pr view <url> --json headRefName,baseRefName,number\`.
  If the head branch isn't a local branch, ask the user before fetching it,
  then fetch it as one (for example \`git fetch origin pull/<number>/head:pr-<number>\`)
  and review it as a branch against the PR's base. Never check it out.

## Start the review

Call \`start_review\` with a short \`title\` and a \`summary\` of what the
change does and why. Add \`hunkSummaries\` in the order a human should read
the change, so what a change depends on comes first:

- **Your own changes:** one entry per hunk, saying why you made it and how
  it connects to what follows.
- **Code you didn't write** (a PR or someone else's branch): only hunks
  worth pointing out, such as risky logic or a missing test. Leave
  \`summary\` out of an entry to place its file in the order without a
  comment. Don't add a disclaimer.

Share the returned \`url\` with the user, since the browser may not have
opened.

## Run the loop

Call \`wait_for_activity\` again after each result:

- \`no_activity\`: call it again right away, without narrating.
- \`question\`: answer with \`answer_question\` (Markdown is rendered), then
  keep waiting.
- \`review_complete\`: stop waiting and act on the decisions below.
- \`review_ended\`: the review is over; stop.

## Act on the result

**Your own changes:** leave approved hunks alone. Change every rejected
hunk as its comment asks (no comment means revert it), and factor in
comments on pending hunks. Answer any \`unansweredQuestions\` in your
summary. Call \`end_review\`, then summarize what you changed.

**Code you didn't write:** call \`end_review\`, then draft a GitHub review:

- an inline comment at each rejected hunk, carrying its comment;
- inline comments for comments on approved or pending hunks;
- "Request changes" if anything was rejected, otherwise "Comment".

Show the draft and ask before posting it. Never edit, commit to or push the
PR's branch unless the user asks. If you fetched a branch for the review,
offer to delete it afterwards, and ask before deleting it.
`

function frontmatter(client: InstallClient): string {
  const lines = ['---', `name: ${SKILL_NAME}`, `description: ${DESCRIPTION}`]
  if (client === 'claude') lines.push(`allowed-tools: ${CLAUDE_ALLOWED_TOOLS}`)
  lines.push('---')
  return lines.join('\n')
}

export function renderSkill(client: InstallClient): string {
  return `${frontmatter(client)}\n\n${BODY}`
}
