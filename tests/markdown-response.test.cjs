const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { test } = require('node:test');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const filename = path.resolve(__dirname, '../components/markdown-response.tsx');
const source = fs.readFileSync(filename, 'utf8') + '\nexport { parseMarkdownBlocks };';
const compiled = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const loaded = new Module(filename, module);
loaded.filename = filename;
loaded.paths = Module._nodeModulePaths(path.dirname(filename));
loaded._compile(compiled, filename);
const { parseMarkdownBlocks, MarkdownResponse } = loaded.exports;

test('meeting notes render as an accessible table in normal and compact views', () => {
  const notes = '## To-dos\n\n| An wen | Auftrag | Termin |\n|---|---|---|\n| Frank | **BA-Kanal** einrichten | Heute |\n| Adam | `JBoss` prüfen | Freitag |\n\nNachtrag';
  assert.deepEqual(parseMarkdownBlocks(notes).map(b => b.type), ['heading', 'table', 'paragraph']);
  for (const compact of [false, true]) {
    const html = renderToStaticMarkup(React.createElement(MarkdownResponse, { content: notes, compact }));
    assert.match(html, /<table/);
    assert.match(html, /scope="col"/);
    assert.match(html, /<strong[^>]*>BA-Kanal<\/strong>/);
    assert.match(html, /overflow-x-auto/);
    assert.equal((html.match(/<td /g) || []).length, 6);
  }
});
test('optional outer pipes, alignment, escaped pipes and uneven rows', () => {
  const [table] = parseMarkdownBlocks('Name | Mitte | Ende\n:--- | :---: | ---:\nA \\| B | C\nD | E | F | extra');
  assert.equal(table.type, 'table');
  assert.deepEqual(table.alignments, ['left', 'center', 'right']);
  assert.deepEqual(table.rows[0], ['A | B', 'C']);
  const html = renderToStaticMarkup(React.createElement(MarkdownResponse, { content: 'A | B\n--- | ---\none\n' }));
  assert.match(html, /<table/);
  assert.match(html, /<p>one<\/p>/);
});
test('code fences and ordinary pipe text remain unchanged; malformed separators are not tables', () => {
  assert.equal(parseMarkdownBlocks('```\n| A | B |\n| --- | --- |\n```')[0].type, 'code');
  assert.equal(parseMarkdownBlocks('A | B\nnot a separator')[0].type, 'paragraph');
  assert.equal(parseMarkdownBlocks('| A | B |\n| --- |')[0].type, 'paragraph');
  assert.deepEqual(parseMarkdownBlocks('- [TODO] Task\n\nParagraph').map(b => b.type), ['list', 'paragraph']);
});
