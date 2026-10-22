import assert from 'node:assert/strict';
import test from 'node:test';
import {changeMessage, errorState, mapping, menuState, pathLight, permissionBadges, permissionNames, roleBadges, shortId} from '../dist/display.js';

test('peer path lights follow stable state codes, and name the state', () => {
    const light = (path_state, path_detail = path_state, this_node = false) =>
        pathLight({path_state, path_detail, this_node});
    assert.equal(light('up').level, 'good');
    assert.equal(light('no_handshake').level, 'attention');
    assert.equal(light('waiting_for_removal').level, 'attention');
    assert.equal(light('stale').level, 'degraded');
    assert.equal(light('no_path').level, 'broken');
    assert.equal(light('no_path', 'no path; retry in 20s').tooltip,
        'No path; retry in 20s\nNAT hole punching failed, so there is no path to this member. It is tried again later.');
    // A state from a newer daemon is grey, and its tooltip is the daemon's detail.
    assert.deepEqual(light('future_state', 'something new'), {level: 'off', tooltip: 'Something new'});
    // Inherited object keys are not states.
    assert.equal(light('constructor').level, 'off');
    assert.deepEqual(light('self', '-', true), {level: 'off', tooltip: 'This computer'});
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

test('roles and permissions have an icon each, and Member when there are none', () => {
    const icons = badges => badges.map(badge => badge.icon);
    assert.deepEqual(icons(roleBadges({acceptor: true, relay: true})),
        ['object-select-symbolic', 'network-transmit-receive-symbolic']);
    assert.deepEqual(roleBadges({acceptor: false, relay: false}),
        [{icon: 'avatar-default-symbolic', tooltip: 'Member: no other role now', dim: true}]);
    assert.deepEqual(icons(permissionBadges({admin: true, vote: true, relay: true})),
        ['security-high-symbolic', 'object-select-symbolic', 'network-transmit-receive-symbolic']);
    assert.equal(permissionBadges({admin: false, vote: true, relay: false})[0].tooltip,
        'Voter: may be an acceptor, and take joins to the network');
    assert.deepEqual(permissionBadges({admin: false, vote: false, relay: false}),
        [{icon: 'avatar-default-symbolic', tooltip: 'Member: may use the network and leave', dim: true}]);
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
