import assert from 'node:assert/strict'
import { test } from 'node:test'

// Engine
import { parseDiff, parseUntrackedFile } from './parseDiff.js'

test('parses a simple modification', () => {
  const diff = `diff --git a/tracked.txt b/tracked.txt
index e69de29..4b825dc 100644
--- a/tracked.txt
+++ b/tracked.txt
@@ -1,2 +1,2 @@
 line one
-line two
+line two changed
`
  const [file] = parseDiff(diff)

  assert.equal(file.path, 'tracked.txt')
  assert.equal(file.oldPath, null)
  assert.equal(file.status, 'modified')
  assert.equal(file.binary, false)
  assert.equal(file.hunks.length, 1)

  const [hunk] = file.hunks
  assert.equal(hunk.oldStart, 1)
  assert.equal(hunk.newStart, 1)
  assert.deepEqual(
    hunk.lines.map((line) => line.type),
    ['context', 'del', 'add'],
  )
  assert.equal(hunk.lines[1]?.content, 'line two')
  assert.equal(hunk.lines[1]?.oldLineNumber, 2)
  assert.equal(hunk.lines[2]?.content, 'line two changed')
  assert.equal(hunk.lines[2]?.newLineNumber, 2)
})

test('detects an added file', () => {
  const diff = `diff --git a/new.txt b/new.txt
new file mode 100644
index 0000000..abc1234
--- /dev/null
+++ b/new.txt
@@ -0,0 +1,2 @@
+line one
+line two
`
  const [file] = parseDiff(diff)

  assert.equal(file.status, 'added')
  assert.equal(
    file.hunks[0]?.lines.every((line) => line.type === 'add'),
    true,
  )
})

test('detects a deleted file', () => {
  const diff = `diff --git a/old.txt b/old.txt
deleted file mode 100644
index abc1234..0000000
--- a/old.txt
+++ /dev/null
@@ -1,2 +0,0 @@
-line one
-line two
`
  const [file] = parseDiff(diff)

  assert.equal(file.status, 'deleted')
  assert.equal(
    file.hunks[0]?.lines.every((line) => line.type === 'del'),
    true,
  )
})

test('detects a rename with no content change', () => {
  const diff = `diff --git a/old-name.txt b/new-name.txt
similarity index 100%
rename from old-name.txt
rename to new-name.txt
`
  const [file] = parseDiff(diff)

  assert.equal(file.status, 'renamed')
  assert.equal(file.oldPath, 'old-name.txt')
  assert.equal(file.path, 'new-name.txt')
  assert.deepEqual(file.hunks, [])
})

test('detects a binary file', () => {
  const diff = `diff --git a/image.png b/image.png
index abc1234..def5678 100644
Binary files a/image.png and b/image.png differ
`
  const [file] = parseDiff(diff)

  assert.equal(file.binary, true)
  assert.deepEqual(file.hunks, [])
})

test('flags a submodule pointer change as unsupported', () => {
  const diff = `diff --git a/vendor/lib b/vendor/lib
index abc1234..def5678 160000
--- a/vendor/lib
+++ b/vendor/lib
@@ -1 +1 @@
-Subproject commit abc1234
+Subproject commit def5678
`
  const [file] = parseDiff(diff)

  assert.equal(file.status, 'unsupported')
  assert.deepEqual(file.hunks, [])
})

test('flags a symlink change as unsupported', () => {
  const diff = `diff --git a/link.txt b/link.txt
new file mode 120000
index 0000000..abc1234
--- /dev/null
+++ b/link.txt
@@ -0,0 +1 @@
+target.txt
`
  const [file] = parseDiff(diff)

  assert.equal(file.status, 'unsupported')
  assert.deepEqual(file.hunks, [])
})

test('parses multiple hunks in one file', () => {
  const diff = `diff --git a/multi.txt b/multi.txt
index e69de29..4b825dc 100644
--- a/multi.txt
+++ b/multi.txt
@@ -1,2 +1,2 @@
 top context
-top old
+top new
@@ -10,2 +10,2 @@
 bottom context
-bottom old
+bottom new
`
  const [file] = parseDiff(diff)

  assert.equal(file.hunks.length, 2)
  assert.equal(file.hunks[0]?.oldStart, 1)
  assert.equal(file.hunks[1]?.oldStart, 10)
})

test('parses multiple files in one diff', () => {
  const diff = `diff --git a/one.txt b/one.txt
index e69de29..4b825dc 100644
--- a/one.txt
+++ b/one.txt
@@ -1 +1 @@
-a
+b
diff --git a/two.txt b/two.txt
index e69de29..4b825dc 100644
--- a/two.txt
+++ b/two.txt
@@ -1 +1 @@
-c
+d
`
  const files = parseDiff(diff)

  assert.equal(files.length, 2)
  assert.deepEqual(
    files.map((file) => file.path),
    ['one.txt', 'two.txt'],
  )
})

test('returns an empty array for no diff', () => {
  assert.deepEqual(parseDiff(''), [])
  assert.deepEqual(parseDiff('   \n  '), [])
})

test('synthesizes an untracked file as one all-added hunk', () => {
  const file = parseUntrackedFile('brand-new.txt', 'first\nsecond\n')

  assert.equal(file.status, 'added')
  assert.equal(file.hunks.length, 1)
  assert.equal(file.hunks[0]?.lines.length, 2)
  assert.deepEqual(
    file.hunks[0]?.lines.map((line) => line.content),
    ['first', 'second'],
  )
  assert.equal(file.hunks[0]?.lines[0]?.newLineNumber, 1)
})
