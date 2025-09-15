const js = require('@eslint/js');
const tseslint = require('typescript-eslint');

module.exports = [
  // Base configuration
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // TypeScript files
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 2021,
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true
        }
      },
      globals: {
        console: 'readonly',
        process: 'readonly',
        __DEV__: 'readonly',
        URL: 'readonly',
        fetch: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearTimeout: 'readonly',
        clearInterval: 'readonly',
        Promise: 'readonly',
        Date: 'readonly',
        Math: 'readonly',
        JSON: 'readonly',
        Error: 'readonly',
        Object: 'readonly',
        Array: 'readonly',
        String: 'readonly',
        Number: 'readonly',
        Boolean: 'readonly'
      }
    },
    rules: {
      // TypeScript specific - relaxed for existing codebase
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'off', // Allow any for now
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',

      // General code quality - important errors only
      'no-console': 'off', // Allow console (handled by Babel in prod)
      'no-debugger': 'error',
      'no-alert': 'warn',
      'prefer-const': 'warn',
      'no-var': 'error',

      // Critical bugs only
      'no-undef': 'error',
      'no-unreachable': 'error'
    }
  },

  // JavaScript files
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        }
      },
      globals: {
        console: 'readonly',
        process: 'readonly',
        __DEV__: 'readonly'
      }
    },
    rules: {
      // General code quality
      'no-console': 'warn', // Warn but allow (removed by Babel in production)
      'no-debugger': 'error',
      'no-alert': 'warn',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'prefer-const': 'error',
      'no-var': 'error',

      // Style consistency (basic rules)
      'quotes': ['warn', 'single', { allowTemplateLiterals: true }],
      'semi': ['warn', 'always'],
      'comma-dangle': ['warn', 'never'],

      // Import organization
      'no-duplicate-imports': 'error',

      // Potential bugs
      'no-undef': 'error',
      'no-unreachable': 'error',
      'no-constant-condition': 'warn'
    }
  },

  // Test files with Jest globals
  {
    files: ['src/**/*.test.{ts,tsx,js,jsx}', 'src/**/__tests__/**/*.{ts,tsx,js,jsx}'],
    languageOptions: {
      globals: {
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        jest: 'readonly'
      }
    },
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-unused-vars': 'off' // Allow unused in tests
    }
  },

  // Config files - very relaxed
  {
    files: ['*.config.js', 'babel.config.js', 'metro.config.js', 'eslint.config.js'],
    languageOptions: {
      globals: {
        module: 'readonly',
        require: 'readonly',
        __dirname: 'readonly',
        process: 'readonly'
      }
    },
    rules: {
      'no-console': 'off',
      'no-undef': 'off'
    }
  },

  // Ignore patterns
  {
    ignores: [
      'node_modules/',
      'dist/',
      'build/',
      '.expo/',
      'android/',
      'ios/',
      'web-build/',
      'coverage/',
      '*.log'
    ]
  }
];