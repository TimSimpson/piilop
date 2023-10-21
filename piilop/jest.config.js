module.exports = {
    globalSetup: './config/setup.js',
    globalTeardown: './config/teardown.js',
    testEnvironment: './config/environment.js',
    reporters: ['default', '<rootDir>/config/failure-reporter.js'],
    testTimeout: 100000,
};
