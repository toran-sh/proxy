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
    expect(tryDecodeAsText(buffer, { controlCharThreshold: 1 })).toBe('\u0001\u0002\u0003');
  });

  it('respects maxBytes and decodes only the prefix', () => {
    const buffer = encoder.encode('hello');
    expect(tryDecodeAsText(buffer, { maxBytes: 2 })).toBe('he');
  });

  it('ignores null bytes beyond maxBytes', () => {
    const buffer = new Uint8Array([0x41, 0x42, 0x43, 0x00, 0x44]);
    expect(tryDecodeAsText(buffer, { maxBytes: 3 })).toBe('ABC');
  });

  it('accepts ArrayBuffer input', () => {
    const buffer = encoder.encode('array buffer').buffer;
    expect(tryDecodeAsText(buffer)).toBe('array buffer');
  });
});
