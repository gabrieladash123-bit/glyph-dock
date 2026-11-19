# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *
from hashlib import sha256
from unicodedata import normalize
import json


SOURCE = 'https://www.unicode.org/Public/17.0.0/security/confusables.txt'
SOURCE_SHA256 = '091c7f82fc39ef208faf8f94d29c244de99254675e09de163160c810d13ef22a'
ALPHABET = (
    'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-'
    'αβγδεζηικνορτυχωΑΒΕΖΗΙΚΜΝΟΡΤΥΧ'
    'аеорсухіјѕАВЕКМНОРСТХІЈЅ'
)
ZERO = Address('0x0000000000000000000000000000000000000000')


def fail(message):
    raise gl.vm.UserError(message)


def encode(value):
    return json.dumps(value, ensure_ascii=True, sort_keys=True, separators=(',', ':'))


def source_bytes(response):
    if response.status != 200:
        fail('[EXTERNAL] Unicode source unavailable')
    if len(response.body) > 800000 or sha256(response.body).hexdigest() != SOURCE_SHA256:
        fail('[EXTERNAL] Unicode source digest mismatch')
    return response.body


def compile_table(body):
    table = {character: character for character in ALPHABET}
    seen = set()
    for line in body.decode('utf-8').splitlines():
        content = line.partition('#')[0].strip()
        if not content:
            continue
        fields = [field.strip() for field in content.split(';')]
        character = chr(int(fields[0], 16))
        if character not in table:
            continue
        if character in seen or fields[2] != 'MA':
            fail('[EXTERNAL] Invalid Unicode mapping')
        seen.add(character)
        table[character] = ''.join(chr(int(point, 16)) for point in fields[1].split())
    return table


def import_table():
    def lead():
        body = source_bytes(gl.nondet.web.get(SOURCE))
        return compile_table(body)

    def verify(proposal):
        try:
            body = source_bytes(gl.nondet.web.get(SOURCE))
        except gl.vm.UserError as error:
            return not isinstance(proposal, gl.vm.Return) and getattr(proposal, 'message', None) == error.message
        except Exception:
            return False
        if not isinstance(proposal, gl.vm.Return) or not isinstance(proposal.calldata, dict):
            return False
        # Independently index raw records by code point, then check every supported
        # character, including identity mappings justified by absence from the file.
        indexed = {}
        for line in body.decode('utf-8').splitlines():
            record = line.split('#', 1)[0].split(';')
            if len(record) < 3:
                continue
            point = int(record[0].strip(), 16)
            indexed[point] = ''.join(map(lambda token: chr(int(token, 16)), record[1].split()))
        expected = {character: indexed.get(ord(character), character) for character in ALPHABET}
        return encode(proposal.calldata) == encode(expected)

    return gl.vm.run_nondet_unsafe(lead, verify)


class GlyphDock(gl.Contract):
    mappings: TreeMap[str, str]
    registrations: TreeMap[str, str]
    epochs: TreeMap[str, u256]
    active: u256

    def __init__(self):
        # All admitted code points are NFD-stable. The pinned runner defines NFD
        # ordering for mapped output, including any combining characters.
        if normalize('NFD', ALPHABET) != ALPHABET:
            fail('Unsupported normalization runtime')
        agreed = import_table()
        for character in ALPHABET:
            self.mappings[character] = agreed[character]
        self.active = u256(0)

    @gl.public.view
    def policy(self) -> dict:
        return {'source_url': SOURCE, 'source_sha256': SOURCE_SHA256,
                'alphabet': ALPHABET, 'max_characters': 32,
                'mappings': {character: self.mappings[character] for character in ALPHABET},
                'active': int(self.active)}

    @gl.public.view
    def resolve(self, label: str) -> dict:
        if not 1 <= len(label) <= 32 or any(character not in ALPHABET for character in label):
            fail('Unsupported label')
        skeleton = normalize('NFD', ''.join(self.mappings[character] for character in label))
        epoch = int(self.epochs[skeleton]) if skeleton in self.epochs else 0
        if skeleton in self.registrations:
            entry = json.loads(self.registrations[skeleton])
            return {'skeleton': skeleton, 'epoch': epoch, **entry}
        return {'skeleton': skeleton, 'epoch': epoch, 'label': '', 'owner': ''}

    def _controlled(self, label, epoch):
        record = self.resolve(label)
        if not record['owner']:
            fail('Name is unclaimed')
        if record['label'] != label:
            fail('Use the exact registered label')
        if record['owner'] != str(gl.message.sender_address):
            fail('Only the current owner')
        if epoch != record['epoch']:
            fail('Stale name epoch')
        return record

    @gl.public.write
    def claim(self, label: str) -> None:
        record = self.resolve(label)
        if record['owner']:
            fail('Confusable name already reserved')
        owner = gl.message.sender_address
        if owner == ZERO:
            fail('Invalid owner')
        skeleton = record['skeleton']
        self.registrations[skeleton] = encode({'label': label, 'owner': str(owner)})
        self.epochs[skeleton] = u256(record['epoch'] + 1)
        self.active = u256(int(self.active) + 1)

    @gl.public.write
    def transfer(self, label: str, epoch: int, recipient: Address) -> None:
        record = self._controlled(label, epoch)
        recipient = Address(recipient)
        if recipient == ZERO or str(recipient) == record['owner']:
            fail('Invalid recipient')
        skeleton = record['skeleton']
        self.registrations[skeleton] = encode({'label': label, 'owner': str(recipient)})
        self.epochs[skeleton] = u256(epoch + 1)

    @gl.public.write
    def release(self, label: str, epoch: int) -> None:
        record = self._controlled(label, epoch)
        skeleton = record['skeleton']
        del self.registrations[skeleton]
        self.epochs[skeleton] = u256(epoch + 1)
        self.active = u256(int(self.active) - 1)
