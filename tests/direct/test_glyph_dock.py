from pathlib import Path
from unicodedata import normalize
import re

import pytest


URL = 'https://www.unicode.org/Public/17.0.0/security/confusables.txt'
BODY = Path('fixtures/confusables.txt').read_bytes()


def address(value):
    return '0x' + value.hex() if isinstance(value, bytes) else str(value).lower()


def mock(vm, body=BODY, status=200):
    vm.clear_mocks()
    vm.mock_web(re.escape(URL), {'status': status, 'body': body})


def deploy(vm, direct_deploy):
    mock(vm)
    return direct_deploy('contracts/glyph_dock.py', sdk_version='v0.2.16')


def reference_table():
    records = {}
    for line in BODY.decode().splitlines():
        data = line.partition('#')[0].strip()
        if data:
            left, right, kind = [field.strip() for field in data.split(';')]
            assert kind == 'MA'
            records[chr(int(left, 16))] = ''.join(chr(int(point, 16)) for point in right.split())
    return records


def test_full_source_import_and_validator_checks(direct_vm, direct_deploy):
    contract = deploy(direct_vm, direct_deploy)
    policy = contract.policy()
    expected = reference_table()
    assert normalize('NFD', policy['alphabet']) == policy['alphabet']
    assert policy['mappings'] == {letter: expected.get(letter, letter) for letter in policy['alphabet']}
    assert direct_vm.run_validator() is True
    wrong = dict(policy['mappings'])
    wrong['m'] = 'm'
    assert direct_vm.run_validator(leader_result=wrong) is False
    missing = dict(policy['mappings'])
    del missing['a']
    assert direct_vm.run_validator(leader_result=missing) is False
    extra = {**policy['mappings'], 'injected': 'x'}
    assert direct_vm.run_validator(leader_result=extra) is False
    mock(direct_vm, BODY.replace(b'006D', b'006E', 1))
    assert direct_vm.run_validator() is False


@pytest.mark.parametrize(('left', 'right'), [
    ('m', 'rn'), ('l', '1'), ('O', '0'), ('scope', 'ѕсоре'),
    ('alpha', 'alphа'), ('pay', 'pаy'), ('X', 'Χ'), ('B', 'Β'),
])
def test_confusable_names_share_one_reservation(direct_vm, direct_deploy, direct_alice, direct_bob, left, right):
    contract = deploy(direct_vm, direct_deploy)
    direct_vm.sender = direct_alice
    before = contract.resolve(left)
    assert before == contract.resolve(right)
    contract.claim(left)
    owned = contract.resolve(left)
    assert owned == contract.resolve(right)
    assert owned['owner'].lower() == address(direct_alice)
    direct_vm.sender = direct_bob
    with direct_vm.expect_revert('Confusable name already reserved'):
        contract.claim(right)
    assert contract.resolve(left) == owned
    assert contract.policy()['active'] == 1


def test_owner_transfer_release_reclaim_and_stale_epoch(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = deploy(direct_vm, direct_deploy)
    direct_vm.sender = direct_alice
    contract.claim('scope')
    with direct_vm.expect_revert('Use the exact registered label'):
        contract.release('ѕсоре', 1)
    direct_vm.sender = direct_bob
    with direct_vm.expect_revert('Only the current owner'):
        contract.release('scope', 1)
    direct_vm.sender = direct_alice
    contract.transfer('scope', 1, direct_bob)
    assert contract.resolve('ѕсоре')['owner'].lower() == address(direct_bob)
    assert contract.resolve('scope')['epoch'] == 2
    with direct_vm.expect_revert('Only the current owner'):
        contract.release('scope', 2)
    direct_vm.sender = direct_bob
    with direct_vm.expect_revert('Stale name epoch'):
        contract.release('scope', 1)
    contract.release('scope', 2)
    assert contract.policy()['active'] == 0
    assert contract.resolve('scope') == {'skeleton': 'scope', 'epoch': 3, 'owner': '', 'label': ''}
    direct_vm.sender = direct_alice
    contract.claim('ѕсоре')
    assert contract.resolve('scope')['epoch'] == 4
    assert contract.resolve('scope')['label'] == 'ѕсоре'
    with direct_vm.expect_revert('Stale name epoch'):
        contract.release('ѕсоре', 1)


@pytest.mark.parametrize('label', ['', 'a'*33, 'hello.world', 'name\u200b', 'a\u0301', 'é', '😀'])
def test_unsupported_labels_leave_state_unchanged(direct_vm, direct_deploy, label):
    contract = deploy(direct_vm, direct_deploy)
    with direct_vm.expect_revert('Unsupported label'):
        contract.claim(label)
    assert contract.policy()['active'] == 0


def test_distinct_labels_boundary_and_invalid_transfers(direct_vm, direct_deploy, direct_alice):
    contract = deploy(direct_vm, direct_deploy)
    direct_vm.sender = direct_alice
    contract.claim('a'*32)
    contract.claim('b'*32)
    assert contract.policy()['active'] == 2
    assert contract.resolve('a'*32)['skeleton'] != contract.resolve('b'*32)['skeleton']
    with direct_vm.expect_revert('Invalid recipient'):
        contract.transfer('a'*32, 1, '0x0000000000000000000000000000000000000000')
    with direct_vm.expect_revert('Invalid recipient'):
        contract.transfer('a'*32, 1, direct_alice)
    with direct_vm.expect_revert('Name is unclaimed'):
        contract.release('free', 0)
    assert contract.policy()['active'] == 2


@pytest.mark.parametrize(('body','status','message'), [
    (BODY[:-1], 200, '[EXTERNAL] Unicode source digest mismatch'),
    (b'not found', 404, '[EXTERNAL] Unicode source unavailable'),
])
def test_source_failure_cannot_create_registry(direct_vm, direct_deploy, body, status, message):
    mock(direct_vm, body, status)
    with direct_vm.expect_revert(message):
        direct_deploy('contracts/glyph_dock.py', sdk_version='v0.2.16')


def test_every_supported_character_matches_independent_unicode_oracle(direct_vm, direct_deploy):
    contract = deploy(direct_vm, direct_deploy)
    table = reference_table()
    alphabet = contract.policy()['alphabet']
    for character in alphabet:
        assert contract.resolve(character)['skeleton'] == normalize('NFD', table.get(character, character))
    for index, left in enumerate(alphabet):
        right = alphabet[(index * 31 + 7) % len(alphabet)]
        expected = normalize('NFD', table.get(left, left) + table.get(right, right))
        assert contract.resolve(left + right)['skeleton'] == expected
