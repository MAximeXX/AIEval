module.exports = {
  env: {
    browser: true,
    es2021: true,
  },
  extends: [
    "airbnb",
    "airbnb/hooks",
    "airbnb-typescript",
    "plugin:react/recommended",
    "plugin:react/jsx-runtime",
    "plugin:@typescript-eslint/recommended",
    "plugin:jsx-a11y/recommended",
    "prettier",
  ],
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    project: "./tsconfig.json",
  },
  plugins: ["react", "@typescript-eslint", "jsx-a11y"],
  rules: {
    "react/react-in-jsx-scope": "off",
    "react/jsx-props-no-spreading": "off",
    "react/require-default-props": "off",
    "@typescript-eslint/no-use-before-define": "off"
  },
  settings: {
    react: {
      version: "detect",
    },
  },
};
