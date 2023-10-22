module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
  ],
  parserOptions: {
    project: "./tsconfig.json"
  },
  overrides: [
    {
      files: ["*.ts"],
      rules: {
        '@typescript-eslint/no-floating-promises': ['error'],
        '@typescript-eslint/no-misued-promises': ['error'],
      },
    },
  ]
};
