'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const userModel = require('../../../src/models/user.model');

beforeEach(() => {
  userModel._reset();
});

describe('userModel.create()', () => {
  it('should create a user with an auto-incremented id', () => {
    const user = userModel.create({ username: 'alice', password: 'hashed' });
    assert.strictEqual(user.id, 1);
    assert.strictEqual(user.username, 'alice');
  });

  it('should assign sequential ids to multiple users', () => {
    const first = userModel.create({ username: 'alice', password: 'hashed' });
    const second = userModel.create({ username: 'bob', password: 'hashed' });
    assert.strictEqual(first.id, 1);
    assert.strictEqual(second.id, 2);
  });
});

describe('userModel.findByUsername()', () => {
  it('should return the user when the username matches', () => {
    userModel.create({ username: 'alice', password: 'hashed' });
    const found = userModel.findByUsername('alice');
    assert.ok(found);
    assert.strictEqual(found.username, 'alice');
  });

  it('should return undefined when the username does not exist', () => {
    const found = userModel.findByUsername('nobody');
    assert.strictEqual(found, undefined);
  });
});

describe('userModel.findById()', () => {
  it('should return the user when id matches', () => {
    const created = userModel.create({ username: 'alice', password: 'hashed' });
    const found = userModel.findById(created.id);
    assert.deepStrictEqual(found, created);
  });

  it('should return undefined when id does not exist', () => {
    const found = userModel.findById(999);
    assert.strictEqual(found, undefined);
  });
});

describe('userModel.findAll()', () => {
  it('should return an empty array when no users exist', () => {
    assert.deepStrictEqual(userModel.findAll(), []);
  });

  it('should return all created users', () => {
    userModel.create({ username: 'alice', password: 'hashed' });
    userModel.create({ username: 'bob', password: 'hashed' });
    assert.strictEqual(userModel.findAll().length, 2);
  });
});

describe('userModel._reset()', () => {
  it('should clear all users and reset id counter', () => {
    userModel.create({ username: 'alice', password: 'hashed' });
    userModel._reset();
    assert.deepStrictEqual(userModel.findAll(), []);
    const user = userModel.create({ username: 'bob', password: 'hashed' });
    assert.strictEqual(user.id, 1);
  });
});
