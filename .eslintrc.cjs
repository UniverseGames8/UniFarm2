module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:import/errors',
    'plugin:import/warnings',
    'plugin:import/typescript',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  plugins: [
    'react',
    '@typescript-eslint',
    'import',
    'filename-rules',
  ],
  settings: {
    react: {
      version: 'detect',
    },
    'import/resolver': {
      node: {
        extensions: ['.js', '.jsx', '.ts', '.tsx'],
      },
    },
  },
  rules: {
    // Правила для именования файлов
    'filename-rules/match': [
      'error',
      {
        // React компоненты в PascalCase
        'src/components/**/*.{jsx,tsx}': /^[A-Z][a-zA-Z0-9]*\.(jsx|tsx)$/,
        // Сервисы, контроллеры и утилиты в camelCase
        'server/services/**/*.ts': /^[a-z][a-zA-Z0-9]*Service\.ts$/,
        'server/services/instances/**/*.ts': /^[a-z][a-zA-Z0-9]*ServiceInstance\.ts$/,
        'server/controllers/**/*.ts': /^[a-z][a-zA-Z0-9]*Controller\.ts$/,
        'server/utils/**/*.ts': /^[a-z][a-zA-Z0-9]*\.ts$/,
        'shared/**/*.{ts,tsx}': /^[a-z][a-zA-Z0-9]*\.ts$/,
        // TypeScript типы и интерфейсы в PascalCase
        'shared/types/**/*.ts': /^[A-Z][a-zA-Z0-9]*\.ts$/,
      },
    ],
    // Дополнительные правила 
    'react/react-in-jsx-scope': 'off', // Не требуется импорт React в новых версиях
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'import/no-unresolved': 'error',
    'import/named': 'error',
  },
};