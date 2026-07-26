import test from 'node:test';
import assert from 'node:assert';
import { resolveModel, messagesToPrompt, extractTextsFromLine, cleanText } from './gemini.js';

test('resolveModel defaults correctly', () => {
    const res = resolveModel('unknown-model');
    assert.strictEqual(res.resolvedName, 'unknown-model');
    assert.strictEqual(res.modelId, 1);
    assert.strictEqual(res.thinkMode, 4);
});

test('resolveModel with think override', () => {
    const res = resolveModel('gemini-3.5-flash-thinking@think=2');
    assert.strictEqual(res.resolvedName, 'gemini-3.5-flash-thinking');
    assert.strictEqual(res.modelId, 2);
    assert.strictEqual(res.thinkMode, 2);
});

test('messagesToPrompt conversion', () => {
    const messages = [
        { role: 'system', content: 'You are a bot.' },
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' }
    ];
    const prompt = messagesToPrompt(messages);
    assert.ok(prompt.includes('[System instruction]: You are a bot.'));
    assert.ok(prompt.includes('Hello'));
    assert.ok(prompt.includes('[Assistant]: Hi there!'));
});

test('cleanText removes code execution blocks', () => {
    const raw = "Here is some text\n```python?code_reference&code_event_index=0\nprint('hello')\n```\nAnd more text";
    const cleaned = cleanText(raw);
    assert.strictEqual(cleaned, "Here is some text\nAnd more text");
});

test('extractTextsFromLine extracts valid text', () => {
    const mockInner = JSON.stringify([null, null, null, null, [ [null, ["Extracted text!"]] ] ]);
    const mockWrb = JSON.stringify([["wrb.fr", null, mockInner]]);

    // pad to > 200 chars to pass the check
    const padded = mockWrb + " ".repeat(200);
    const texts = extractTextsFromLine(padded);

    assert.deepStrictEqual(texts, ["Extracted text!"]);
});
