const Joi = require('joi');
const { login, refresh } = require('../services/authService');

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required()
});

const refreshSchema = Joi.object({
  refreshToken: Joi.string().required()
});

async function loginController(req, res, next) {
  try {
    const value = await loginSchema.validateAsync(req.body, { abortEarly: false });
    const response = await login(value);
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
}

async function refreshController(req, res, next) {
  try {
    const value = await refreshSchema.validateAsync(req.body, { abortEarly: false });
    const response = await refresh(value);
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  loginController,
  refreshController
};
