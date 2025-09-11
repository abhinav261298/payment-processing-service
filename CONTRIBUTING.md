# Contributing to Payment Processing Service

Thank you for considering contributing to the Payment Processing Service! We appreciate your time and effort in helping us improve this project. Please take a moment to review this document for guidelines on how to contribute.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Setting Up the Development Environment](#setting-up-the-development-environment)
- [Development Workflow](#development-workflow)
  - [Branching Strategy](#branching-strategy)
  - [Commit Message Guidelines](#commit-message-guidelines)
  - [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Documentation](#documentation)
- [Security](#security)
- [Questions and Support](#questions-and-support)

## Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report any unacceptable behavior to the project maintainers.

## Getting Started

### Prerequisites

- Node.js (v16 or later)
- npm (v7 or later) or yarn (v1.22 or later)
- PostgreSQL (v12 or later)
- Git

### Setting Up the Development Environment

1. **Fork the repository** on GitHub.
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/your-username/payment-processing-service.git
   cd payment-processing-service
   ```
3. **Set up the upstream remote**:
   ```bash
   git remote add upstream https://github.com/organization/payment-processing-service.git
   ```
4. **Install dependencies**:
   ```bash
   npm install
   ```
5. **Set up environment variables**:
   ```bash
   cp .env.example .env
   ```
   Update the `.env` file with your configuration.

6. **Set up the database**:
   ```bash
   # Create databases
   createdb payment_processing
   createdb payment_processing_test
   
   # Run migrations
   npm run migrate
   
   # (Optional) Seed the database
   npm run seed
   ```

7. **Start the development server**:
   ```bash
   npm run dev
   ```

## Development Workflow

### Branching Strategy

We follow the [GitFlow](https://nvie.com/posts/a-successful-git-branching-model/) branching model:

- `main` - Production code (protected branch)
- `develop` - Integration branch for features (protected branch)
- `feature/*` - New features
- `bugfix/*` - Bug fixes
- `hotfix/*` - Critical production fixes
- `release/*` - Release preparation

### Commit Message Guidelines

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

**Types**:
- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation only changes
- `style`: Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc.)
- `refactor`: A code change that neither fixes a bug nor adds a feature
- `perf`: A code change that improves performance
- `test`: Adding missing tests or correcting existing tests
- `chore`: Changes to the build process or auxiliary tools and libraries

**Example**:
```
feat(payments): add support for partial refunds

Add new endpoint for processing partial refunds with amount validation.

Closes #123
```

### Pull Request Process

1. Create a feature branch from `develop`:
   ```bash
   git checkout develop
   git pull upstream develop
   git checkout -b feature/your-feature-name
   ```

2. Make your changes and commit them following the commit message guidelines.

3. Push your branch to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```

4. Open a Pull Request (PR) to the `develop` branch.

5. Ensure all tests pass and the build is successful.

6. Request a review from at least one maintainer.

7. Address any feedback and update your PR as needed.

8. Once approved, your PR will be squashed and merged.

## Coding Standards

- Follow the [TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html)
- Use ESLint and Prettier for code formatting
- Write clean, self-documenting code with meaningful variable and function names
- Keep functions small and focused on a single responsibility
- Add comments for complex logic
- Write unit tests for new features and bug fixes

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests
npm run test:integration

# Run tests with coverage
npm run test:coverage
```

### Writing Tests

- Write tests using Jest
- Use descriptive test names that explain what is being tested
- Follow the Arrange-Act-Assert pattern
- Mock external dependencies
- Test edge cases and error conditions
- Keep tests independent and isolated

## Documentation

- Update the README.md with any changes to the setup or usage
- Document new API endpoints
- Add comments for complex logic
- Keep the OpenAPI/Swagger documentation up to date

## Security

- Never commit sensitive information (API keys, passwords, etc.)
- Follow security best practices
- Report any security vulnerabilities to security@example.com
- Keep dependencies up to date
- Use parameterized queries to prevent SQL injection
- Validate and sanitize all user input

## Questions and Support

If you have any questions or need help, please:

1. Check the [documentation](README.md)
2. Search the [issue tracker](https://github.com/organization/payment-processing-service/issues)
3. If you don't find an answer, open a new issue

Thank you for contributing to the Payment Processing Service! 🎉

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
