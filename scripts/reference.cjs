const fs = require('node:fs');
const crypto = require('node:crypto');

const url = 'https://www.unicode.org/Public/17.0.0/security/confusables.txt';
const hash = '091c7f82fc39ef208faf8f94d29c244de99254675e09de163160c810d13ef22a';
const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-'
  + 'αβγδεζηικνορτυχωΑΒΕΖΗΙΚΜΝΟΡΤΥΧ'
  + 'аеорсухіјѕАВЕКМНОРСТХІЈЅ';

function unicodeTable(body) {
  if (crypto.createHash('sha256').update(body).digest('hex') !== hash) throw Error('Wrong Unicode source bytes');
  const mappings = new Map();
  for (const line of body.toString('utf8').split(/\r?\n/)) {
    const content = line.split('#', 1)[0].trim();
    if (!content) continue;
    const [from, to, kind] = content.split(';').map(part => part.trim());
    if (kind !== 'MA') throw Error('Unexpected mapping kind');
    const key = String.fromCodePoint(parseInt(from, 16));
    if (mappings.has(key)) throw Error('Duplicate mapping');
    mappings.set(key, to.split(/\s+/).map(point => String.fromCodePoint(parseInt(point, 16))).join(''));
  }
  return Object.fromEntries([...alphabet].map(character => [character, mappings.get(character) || character]));
}

const mappings = unicodeTable(fs.readFileSync('fixtures/confusables.txt'));
const skeleton = label => [...label].map(character => {
  if (!Object.hasOwn(mappings, character)) throw Error('Unsupported label');
  return mappings[character];
}).join('').normalize('NFD');

module.exports = {url, hash, alphabet, mappings, skeleton};
