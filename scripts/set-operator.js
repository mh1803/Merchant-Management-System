#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const Joi = require('joi');

function argValue(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1 || index + 1 >= process.argv.length) {
    return null;
  }

  return process.argv[index + 1];
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function getOperatorsFilePath() {
  return process.env.OPERATORS_FILE
    ? path.resolve(process.cwd(), process.env.OPERATORS_FILE)
    : path.resolve(process.cwd(), 'data/operators.json');
}

async function run() {
  const email = normalizeEmail(argValue('--email'));
  const password = argValue('--password');
  const role = argValue('--role') || 'operator';

  if (!email || !password) {
    console.error('Usage: npm run operator:set -- --email <email> --password <password> [--role admin|operator]');
    process.exit(1);
  }

  const schema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
    role: Joi.string().valid('admin', 'operator').required()
  });

  const { error } = schema.validate({ email, password, role }, { abortEarly: false });
  if (error) {
    const messages = error.details.map((item) => item.message).join('; ');
    console.error(`Validation failed: ${messages}`);
    process.exit(1);
  }

  const operatorsFile = getOperatorsFilePath();
  fs.mkdirSync(path.dirname(operatorsFile), { recursive: true });

  let operators = [];
  if (fs.existsSync(operatorsFile)) {
    const raw = fs.readFileSync(operatorsFile, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error(`Operator file must be an array: ${operatorsFile}`);
    }
    operators = parsed;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const existingIndex = operators.findIndex(
    (operator) => normalizeEmail(operator.email) === email
  );

  const nextRecord = {
    id: existingIndex >= 0 && operators[existingIndex].id ? operators[existingIndex].id : crypto.randomUUID(),
    email,
    passwordHash,
    role
  };

  if (existingIndex >= 0) {
    operators[existingIndex] = nextRecord;
  } else {
    operators.push(nextRecord);
  }

  fs.writeFileSync(operatorsFile, `${JSON.stringify(operators, null, 2)}\n`, 'utf8');
  console.log(`Operator saved: ${email} (${role}) -> ${operatorsFile}`);
  console.log('Restart the server to load new or updated operators.');
}

run().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
