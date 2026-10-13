import assert from 'node:assert/strict';
import test from 'node:test';
import {ApiError, decodeEnvelope, validateHello, validateResult} from '../dist/protocol.js';

const status = {
    phase: 'member', name: 'node', node_id: 'a'.repeat(64), cluster_id: 'b'.repeat(64),
    members: 2, warnings: [], public: false, relay: true, ipv4: '100.80.11.5',
    ipv6: null, keepalive: 25, changes_paused: false, version: 3,
    acceptors: ['a'.repeat(64)], config: 1, security: 'relaxed', quorum: 1,
    reachable_voters: 1, strict_security: false, buffer_nodes: 0,
    wg_backend: 'kernel', wg_interface: 'wg0', wg_port: 51820,
    control_addr: null, port_mapping: [{port: 'wireguard', mapped: null, error: null}],
};

const peer = {
    node_id: 'a'.repeat(64), name: 'node', ipv4: '100.80.11.5',
    acceptor: true, relay: false, this_node: false, connected: false,
    present: true, path: 'punch', path_state: 'no_path',
    path_detail: 'no path; retry in 20s', retry_in_secs: 20,
    wg_endpoint: null, handshake_age_secs: null,
};

test('peer replies keep the path code and readable detail', () => {
    const result = validateResult('peers', [peer, {...peer, path_state: 'future_state', retry_in_secs: null}]);
    assert.equal(result[0].path_state, 'no_path');
    assert.equal(result[0].path_detail, 'no path; retry in 20s');
    assert.equal(result[0].retry_in_secs, 20);
    assert.equal(result[1].path_state, 'future_state');
    assert.equal(result[1].retry_in_secs, null);
    assert.throws(() => validateResult('peers', [{...peer, retry_in_secs: '20'}]), error =>
        error instanceof ApiError && error.kind === 'protocol');
});

test('valid replies ignore new fields and keep nullable values', () => {
    assert.deepEqual(validateHello(decodeEnvelope({ok: {api: 1, daemon: '0.5.0', extra: true}})),
        {api: 1, daemon: '0.5.0'});
    const result = validateResult('status', {...status, extra: true});
    assert.equal(result.control_addr, null);
    assert.equal(result.port_mapping[0].mapped, null);
    assert.equal(validateResult('join', {joined: false, node_id: 'a'.repeat(64)}).joined, false);
    assert.equal(validateResult('leave', {outcome: 'left', problems: []}).outcome, 'left');
});

test('daemon errors preserve codes and messages', () => {
    assert.throws(() => decodeEnvelope({err: {code: 'permission_denied', message: 'operator denied'}}), error =>
        error instanceof ApiError && error.kind === 'refused' &&
        error.code === 'permission_denied' && error.message === 'operator denied');
    assert.throws(() => decodeEnvelope({err: {code: 'access_check_failed', message: 'group lookup failed'}}), error =>
        error instanceof ApiError && error.kind === 'daemon' &&
        error.code === 'access_check_failed' && error.message === 'group lookup failed');
    assert.throws(() => decodeEnvelope({err: {code: 'new_code', message: 'more detail'}}), error =>
        error instanceof ApiError && error.kind === 'daemon' &&
        error.code === 'new_code' && error.message === 'more detail');
    assert.throws(() => decodeEnvelope({err: 'older daemon'}), error =>
        error instanceof ApiError && error.kind === 'version' && error.code === 'api_version_mismatch');
    assert.throws(() => decodeEnvelope({err: {message: 'missing code'}}), error =>
        error instanceof ApiError && error.kind === 'protocol');
    assert.throws(() => decodeEnvelope({ok: null, err: {code: 'wrong', message: 'both'}}), error =>
        error instanceof ApiError && error.kind === 'protocol');
});

test('malformed nested replies and closed enum values are protocol errors', () => {
    for (const [cmd, reply] of [
        ['status', {...status, warnings: null}],
        ['status', {...status, phase: 'unknown'}],
        ['status', {...status, port_mapping: [{port: 'wireguard', mapped: {external: 3, method: 'PCP'}, error: null}]}],
        ['peers', [{node_id: 'a'.repeat(64), name: 'peer'}]],
        ['pending', [{kind: 'join', approvals: 'bad'}]],
        ['approve', {outcome: 'approved'}],
        ['join', {joined: false}],
    ]) {
        assert.throws(() => validateResult(cmd, reply), error =>
            error instanceof ApiError && error.kind === 'protocol', cmd);
    }
    assert.throws(() => validateHello({api: '1', daemon: '0.5.0'}), error =>
        error instanceof ApiError && error.kind === 'protocol');
});
