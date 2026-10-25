// Avoid writing terminal/control bytes into paths or Markdown while retaining
// ordinary journal whitespace. Remote punctuation is escaped separately.
export function hasUnsupportedControls(value: string, allowWhitespace = false): boolean {
  return Array.from(value).some(character => {
    const code = character.charCodeAt(0);
    return (code < 32 || code === 127) && !(allowWhitespace && [9, 10, 13].includes(code));
  });
}

export function replaceControls(value: string, replacement: string): string {
  return Array.from(value, character => hasUnsupportedControls(character) ? replacement : character).join('');
}
