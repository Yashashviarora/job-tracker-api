// Opaque cursor: base64url(JSON). The client treats it as a token; we decode
// it back into { v, id } to build the keyset WHERE clause.

function encodeCursor(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}

function decodeCursor(str) {
  try {
    const obj = JSON.parse(Buffer.from(str, 'base64url').toString('utf8'));
    if (typeof obj !== 'object' || obj === null || !('v' in obj) || !('id' in obj)) return null;
    return obj;
  } catch {
    return null;
  }
}

module.exports = { encodeCursor, decodeCursor };
