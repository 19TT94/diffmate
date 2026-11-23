import assert from 'node:assert/strict'
import { test } from 'node:test'

// Install
import { renderSkill } from '../skill.js'

function split(skill: string): { frontmatter: string[]; body: string } {
  const match = skill.match(/^---\n([\s\S]*?)\n---\n\n([\s\S]*)$/)
  assert.ok(match, 'skill starts with a frontmatter block')
  return { frontmatter: match[1]!.split('\n'), body: match[2]! }
}

test('each client gets its own frontmatter over one shared body', () => {
  const claude = split(renderSkill('claude'))
  const cursor = split(renderSkill('cursor'))

  assert.equal(claude.body, cursor.body)
  for (const { frontmatter } of [claude, cursor]) {
    assert.ok(frontmatter.includes('name: diffmate-review'))
    assert.ok(frontmatter.some((line) => /^description: \S/.test(line)))
  }
  const allowed = claude.frontmatter.find((line) =>
    line.startsWith('allowed-tools: '),
  )
  for (const tool of [
    'start_review',
    'wait_for_activity',
    'answer_question',
    'end_review',
  ]) {
    assert.match(allowed ?? '', new RegExp(`mcp__diffmate__${tool}`))
  }
  assert.ok(
    !cursor.frontmatter.some((line) => line.startsWith('allowed-tools')),
  )
})

test('the skill covers uncommitted changes, a branch, and a PR URL', () => {
  const { body } = split(renderSkill('claude'))

  // Uncommitted changes by default, asking when there are none.
  assert.match(body, /uncommitted changes/)
  assert.match(body, /no changes, ask the user what to review/)
  // A branch.
  assert.match(body, /start_review\(\{ branch, base \}\)/)
  // A PR URL: ask before fetching and before posting.
  assert.match(body, /gh pr view/)
  assert.match(body, /ask the user before fetching it/)
  assert.match(body, /ask before posting it/)
  assert.match(body, /Never edit, commit to or push/)
})
