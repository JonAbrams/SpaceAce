module.exports = {
  parserOptions: {
    ecmaVersion: 5,
  },
  extends: ['standard', 'prettier'],
  plugins: ['prettier'],
  rules: {
    'prettier/prettier': 'error',
  },
};
