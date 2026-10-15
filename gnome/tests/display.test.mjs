import assert from 'node:assert/strict';
import test from 'node:test';
import {changeMessage, errorState, mapping, menuState, pathLevel, permissionNames, shortId} from '../dist/display.js';

test('peer path colors follow stable state codes', () => {
    assert.equal(pathLevel('up', false), 'good');
    assert.equal(pathLevel('no_path', false), 'broken');
    assert.equal(pathLevel('no_handshake', false), 'attention');
    assert.equal(pathLevel('waiting_for_removal', false), 'attention');
    assert.equal(pathLevel('future_state', false), 'off');
    assert.equal(pathLevel('up', true), 'off');
});

test('menu actions follow the daemon phase and proposals', () => {
    assert.deepEqual(menuState({phase: 'none', name: 'node'}).actions, ['create', 'join']);
    assert.deepEqual(menuState({phase: 'pending', name: 'node'}).actions, ['status', 'cancel']);
    assert.deepEqual(menuState({phase: 'stopping', warnings: ['step failed']}).actions, ['retry', 'logs']);
    const member = {phase: 'member', name: 'node', warnings: [], members: 3,
        permissions: {admin: true, vote: false, relay: false}};
    assert.deepEqual(menuState(member).actions, ['status', 'peers']);
    assert.deepEqual(menuState(member, [{id: 'a'}]).actions, ['status', 'peers', 'approvals']);
    // Only an admin may approve or reject, so other members get no approvals page.
    const voter = {...member, permissions: {admin: false, vote: true, relay: true}};
    assert.deepEqual(menuState(voter, [{id: 'a'}]).actions, ['status', 'peers']);
    assert.equal(menuState(voter, [{id: 'a'}]).approvals, 0);
    assert.equal(menuState({...member, warnings: ['warning']}).level, 'attention');
});

test('permissions are named for people', () => {
    assert.equal(permissionNames({admin: true, vote: true, relay: true}), 'All');
    assert.equal(permissionNames({admin: false, vote: true, relay: true}), 'Voter, Relay');
    assert.equal(permissionNames({admin: true, vote: false, relay: true}), 'Admin, Relay');
    assert.equal(permissionNames({admin: true, vote: false, relay: false}), 'Admin');
    assert.equal(permissionNames({admin: false, vote: false, relay: false}), 'Member');
});

test('refusal and API mismatch are distinct from a stopped daemon', () => {
    assert.equal(errorState({kind: 'refused', message: 'denied'}).title, 'Cheesecloth group only');
    assert.equal(errorState({kind: 'version', message: 'api 2'}).title, 'Needs reinstall');
    assert.equal(errorState({kind: 'unreachable', message: 'missing'}).title, 'Not responding');
});

test('mapping and result labels use the documented values', () => {
    assert.equal(mapping({port_mapping: null}, 'wireguard')[0], 'Off');
    assert.equal(mapping({port_mapping: [{port: 'wireguard', mapped: null, error: null}]}, 'wireguard')[0], 'Requesting');
    assert.equal(mapping({port_mapping: [{port: 'wireguard', mapped: null, error: 'no router'}]}, 'wireguard')[0], 'Not mapped');
    assert.equal(mapping({port_mapping: [{port: 'wireguard', mapped: {external: '1.2.3.4', method: 'PCP'}, error: null}]}, 'wireguard')[0], 'Mapped');
    assert.equal(changeMessage({outcome: 'approved', remaining: 2}), 'Approved. 2 more approval(s) needed.');
    assert.equal(shortId('0123456789abcdef0123456789abcdef'), '0123456789ab…cdef');
});
