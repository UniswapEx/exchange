module.exports = {
  'env': {
    'browser': true,
    'es6': true,
  },
  'extends': [
    'google',
  ],
  'globals': {
    'Atomics': 'readonly',
    'SharedArrayBuffer': 'readonly',
  },
  'parserOptions': {
    'ecmaVersion': 2018,
    'sourceType': 'module',
  },
  'rules': {
    "require-jsdoc": "off",
    "guard-for-in": "off",
    "max-len": [2, { "code": 120, "tabWidth": 2, "ignoreUrls": true }]
  },
};
