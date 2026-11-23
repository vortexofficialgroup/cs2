const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { hashPassword, verifyPassword } = require('./password-hash');

const PERMISSIONS = ['schedule', 'rooms', 'professors', 'announcements', 'reports', 'chatbot'];
const STORE_FILE = process.env.STAFF_STORE_FILE || path.join(os.homedir(), '.ue-portal', 'staff-users.json');

function readUsers() {
  try {
    const users = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
    if (!Array.isArray(users)) throw new Error('Staff account data must be an array.');
    return users;
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

function writeUsers(users) {
  const dir = path.dirname(STORE_FILE);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const tempFile = `${STORE_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(users, null, 2), { mode: 0o600 });
  fs.renameSync(tempFile, STORE_FILE);
}

function publicUser(user) {
  const { id, username, displayName, title, permissions } = user;
  return { id, username, displayName, title, permissions };
}

function create({ username, displayName, title, password, permissions }) {
  const users = readUsers();
  const normalizedUsername = username.trim().toLowerCase();
  if (users.some(user => user.username === normalizedUsername)) return null;

  const passwordRecord = hashPassword(password);
  const user = {
    id: crypto.randomUUID(),
    username: normalizedUsername,
    displayName: displayName.trim(),
    title: title.trim(),
    ...passwordRecord,
    permissions,
  };
  users.push(user);
  writeUsers(users);
  return publicUser(user);
}

function authenticate(username, password) {
  if (typeof username !== 'string' || typeof password !== 'string' || password.length > 128) return null;
  const normalizedUsername = username.trim().toLowerCase();
  const user = readUsers().find(item => item.username === normalizedUsername);
  if (!user) return null;
  if (!verifyPassword(password, user.salt, user.passwordHash)) return null;
  return publicUser(user);
}

function list() {
  return readUsers().map(publicUser);
}

function findById(id) {
  const user = readUsers().find(item => item.id === id);
  return user ? publicUser(user) : null;
}

function remove(id) {
  const users = readUsers();
  const remaining = users.filter(user => user.id !== id);
  if (remaining.length === users.length) return false;
  writeUsers(remaining);
  return true;
}

module.exports = { PERMISSIONS, authenticate, create, findById, list, remove };
