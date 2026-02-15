const PREFIX = {
  info: '\x1b[36m[INFO]\x1b[0m',
  ok: '\x1b[32m[OK]\x1b[0m',
  warn: '\x1b[33m[WARN]\x1b[0m',
  err: '\x1b[31m[ERR]\x1b[0m',
};

module.exports = {
  info: (...args) => console.log(PREFIX.info, ...args),
  ok: (...args) => console.log(PREFIX.ok, ...args),
  warn: (...args) => console.warn(PREFIX.warn, ...args),
  err: (...args) => console.error(PREFIX.err, ...args),
};
