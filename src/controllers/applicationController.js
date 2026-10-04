const asyncHandler = require('../utils/asyncHandler');
const service = require('../services/applicationService');

// Controllers are thin: pull validated input + req.user, call the service,
// shape the HTTP response. No business logic, no SQL.

const create = asyncHandler(async (req, res) => {
  const app = await service.create(req.user.id, req.validated.body);
  res.status(201).json(app);
});

const list = asyncHandler(async (req, res) => {
  const result = await service.list(req.user.id, req.validated.query);
  res.json(result); // { data, nextCursor }
});

const getById = asyncHandler(async (req, res) => {
  const app = await service.getById(req.user.id, req.validated.params.id);
  res.json(app);
});

const update = asyncHandler(async (req, res) => {
  const app = await service.update(req.user.id, req.validated.params.id, req.validated.body);
  res.json(app);
});

const remove = asyncHandler(async (req, res) => {
  await service.remove(req.user.id, req.validated.params.id);
  res.status(204).send();
});

const stats = asyncHandler(async (req, res) => {
  res.json(await service.stats(req.user.id));
});

module.exports = { create, list, getById, update, remove, stats };
