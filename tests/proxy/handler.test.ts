import { describe, it, expect } from 'vitest';
import { tryDecodeAsText } from '../../src/proxy/handler.js';

const encoder = new TextEncoder();

describe('tryDecodeAsText', () => {
  it('returns empty string for empty buffer', () => {
    const buffer = new Uint8Array();
    expect(tryDecodeAsText(buffer)).toBe('');
  });

  it('decodes valid UTF-8 text', () => {
    const buffer = encoder.encode('hello world');
    expect(tryDecodeAsText(buffer)).toBe('hello world');
  });

  it('rejects buffers containing null bytes', () => {
    const buffer = new Uint8Array([0x41, 0x00, 0x42]);
    expect(tryDecodeAsText(buffer)).toBeNull();
  });

  it('rejects invalid UTF-8 sequences', () => {
    const buffer = new Uint8Array([0xc3, 0x28]);
    expect(tryDecodeAsText(buffer)).toBeNull();
  });

  it('rejects when control character ratio is too high', () => {
    const buffer = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x41]);
    expect(tryDecodeAsText(buffer)).toBeNull();
  });

  it('allows common whitespace control characters', () => {
    const buffer = encoder.encode('a\tb\nc\rd');
    expect(tryDecodeAsText(buffer)).toBe('a\tb\nc\rd');
  });

  it('allows control chars when threshold is relaxed', () => {
    const buffer = new Uint8Array([0x01, 0x02, 0x03]);
    expect(
      tryDecodeAsText(buffer, { controlCharThreshold: 1, printableCharThreshold: 0 })
    ).toBe('\u0001\u0002\u0003');
  });

  it('rejects when buffer exceeds maxBytes', () => {
    const buffer = encoder.encode('hello');
    expect(tryDecodeAsText(buffer, { maxBytes: 2 })).toBeNull();
  });

  it('accepts ArrayBuffer input', () => {
    const buffer = encoder.encode('array buffer').buffer;
    expect(tryDecodeAsText(buffer)).toBe('array buffer');
  });

  it('rejects when printable ratio is too low', () => {
    const buffer = new Uint8Array([0x10, 0x11, 0x12, 0x13, 0x41]);
    expect(tryDecodeAsText(buffer, { printableCharThreshold: 0.9 })).toBeNull();
  });

  it('accepts when printable ratio is satisfied', () => {
    const buffer = encoder.encode('abc 123');
    expect(tryDecodeAsText(buffer, { printableCharThreshold: 0.9 })).toBe('abc 123');
  });

  // UTF-8 multi-byte text (international characters)
  it('decodes Chinese text', () => {
    const buffer = encoder.encode('你好世界');
    expect(tryDecodeAsText(buffer)).toBe('你好世界');
  });

  it('decodes Japanese text', () => {
    const buffer = encoder.encode('こんにちは');
    expect(tryDecodeAsText(buffer)).toBe('こんにちは');
  });

  it('decodes Arabic text', () => {
    const buffer = encoder.encode('مرحبا بالعالم');
    expect(tryDecodeAsText(buffer)).toBe('مرحبا بالعالم');
  });

  it('decodes emoji', () => {
    const buffer = encoder.encode('Hello 👋🌍🎉');
    expect(tryDecodeAsText(buffer)).toBe('Hello 👋🌍🎉');
  });

  it('decodes mixed ASCII and Chinese', () => {
    const buffer = encoder.encode('Hello 你好 World');
    expect(tryDecodeAsText(buffer)).toBe('Hello 你好 World');
  });
});
