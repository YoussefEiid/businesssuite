module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/test/**/*.spec.ts'],
  moduleNameMapper: {
    '^@business-suite/shared$': '<rootDir>/../../packages/shared/dist/index',
  },
};
