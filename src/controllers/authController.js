const asyncHandler = require('../utils/asyncHandler');
const authService = require('../services/authService');

// Controllers are thin: pull validated input, call the service, shape the
// HTTP response. No business logic here.

const register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.validated.body);
  res.status(201).json(result);
});

const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.validated.body);
  res.status(200).json(result);
});

const refresh = asyncHandler(async (req, res) => {
  const result = await authService.refresh(req.validated.body);
  res.status(200).json(result);
});

const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.validated.body);
  res.status(204).send();
});

const me = asyncHandler(async (req, res) => {
  const user = await authService.me(req.user.id);
  res.status(200).json(user);
});

module.exports = { register, login, refresh, logout, me };


// module.exports = { register, login, refresh, logout };
