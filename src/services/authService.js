const bcrypt = require('bcryptjs');
const AppError = require('../utils/AppError');
const { pool } = require('../db/mysql');
const userRepo = require('../repositories/userRepository');
const tokenRepo = require('../repositories/refreshTokenRepository');
const tokens = require('../utils/tokens');

const BCRYPT_ROUNDS = 12;

// Shared by login and refresh: sign a pair, persist the refresh jti.
async function issueTokenPair(user, conn = pool) {
  const accessToken = tokens.signAccessToken(user);
  const refresh = tokens.signRefreshToken(user);
  await tokenRepo.insert(
    { jti: refresh.jti, userId: user.id, expiresAt: refresh.expiresAt },
    conn,
  );
  return { accessToken, refreshToken: refresh.token };
}

async function register({ email, password }) {
  const existing = await userRepo.findByEmail(email);
  if (existing) throw AppError.conflict('Email already registered');

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  let id;
  try {
    id = await userRepo.create({ email, passwordHash });
  } catch (err) {
    // Race: two registrations for the same email between the SELECT and INSERT.
    // The unique index is the real guard; the SELECT above is just a nicer path.
    if (err.code === 'ER_DUP_ENTRY') throw AppError.conflict('Email already registered');
    throw err;
  }

  const user = await userRepo.findById(id);
  return { user, ...(await issueTokenPair(user)) };
}

async function login({ email, password }) {
  const user = await userRepo.findByEmail(email);
  // Same message whether the email or the password is wrong: don't leak
  // which accounts exist.
  if (!user) throw AppError.unauthorized('Invalid email or password');

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) throw AppError.unauthorized('Invalid email or password');

  const { password_hash, ...safeUser } = user;
  return { user: safeUser, ...(await issueTokenPair(safeUser)) };
}

async function refresh({ refreshToken }) {
  let payload;
  try {
    payload = tokens.verifyRefreshToken(refreshToken);
  } catch {
    throw AppError.unauthorized('Invalid or expired refresh token');
  }

  const userId = Number(payload.sub);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Single-use: deleting is the claim. If nothing was deleted, this token
    // was already rotated or revoked -> possible theft -> kill every session.
    const consumed = await tokenRepo.deleteByJti(payload.jti, conn);
    if (!consumed) {
      await tokenRepo.deleteAllForUser(userId, conn);
      await conn.commit();
      throw AppError.unauthorized('Refresh token reuse detected');
    }

    const user = await userRepo.findById(userId); // fresh role from the DB
    if (!user) throw AppError.unauthorized('User no longer exists');

    const pair = await issueTokenPair(user, conn);
    await conn.commit();
    return pair;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function logout({ refreshToken }) {
  let payload;
  try {
    payload = tokens.verifyRefreshToken(refreshToken);
  } catch {
    return; // already invalid; logout is idempotent
  }
  await tokenRepo.deleteByJti(payload.jti);
}


async function me(userId) {
  const user = await userRepo.findById(userId);
  if (!user) throw AppError.notFound('User not found');
  return user;
}

module.exports = { register, login, refresh, logout, me };

