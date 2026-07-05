# Contributing to framewise

Thanks for your interest in improving `framewise`! Contributions of all
kinds — bug reports, feature ideas, docs, and code — are welcome.

## Code of Conduct

This project follows a [Code of Conduct](./CODE_OF_CONDUCT.md). By
participating, you are expected to uphold it.

## Getting started

### Prerequisites

- **Node.js** >= 20
- **pnpm** (this project uses pnpm as its package manager)
- An `ffmpeg` binary on your `PATH`, or the optional `ffmpeg-static`
  dependency. The unit tests do **not** require ffmpeg.

### Setup

```bash
git clone https://github.com/doryski/framewise.git
cd framewise
pnpm install
```

## Development scripts

| Script             | What it does                                   |
| ------------------ | ---------------------------------------------- |
| `pnpm build`       | Compile TypeScript to `dist/` (`tsc`)          |
| `pnpm dev`         | Compile in watch mode (`tsc --watch`)          |
| `pnpm type-check`  | Type-check without emitting (`tsc --noEmit`)   |
| `pnpm lint`        | Lint the `src` directory (`eslint src`)        |
| `pnpm test`        | Run the test suite once (`vitest run --bail=5`)|
| `pnpm test:watch`  | Run tests in watch mode (`vitest`)             |

Before opening a pull request, please make sure the following all pass:

```bash
pnpm build
pnpm type-check
pnpm lint
pnpm test
```

## Commit messages

This project uses [Conventional Commits](https://www.conventionalcommits.org/).
Prefix your commit subject with a type, for example:

- `feat: add webp quality option`
- `fix: never drop the last frame in the blur gate`
- `docs: clarify dedupeThreshold behavior`
- `test: cover hamming distance edge cases`
- `chore: bump dev dependencies`

## Pull request process

1. Fork the repository and create a feature branch off `main`.
2. Make your change, adding or updating tests where it makes sense.
3. Ensure `build`, `type-check`, `lint`, and `test` all pass.
4. Keep the public API and README in sync — if you change behavior or
   options, update `README.md` accordingly.
5. Open a pull request against `main` and fill out the PR template.

## Reporting bugs and requesting features

Please use the GitHub issue templates:

- [Bug report](https://github.com/doryski/framewise/issues/new?template=bug_report.md)
- [Feature request](https://github.com/doryski/framewise/issues/new?template=feature_request.md)

## License

By contributing, you agree that your contributions will be licensed under the
[MIT License](./LICENSE).
