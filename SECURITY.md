# Security Policy

## Supported Versions

`framewise` is pre-1.0 and evolving. Security fixes are applied to the latest
released version on the `main` branch. Please always upgrade to the most recent
release before reporting an issue.

| Version | Supported          |
| ------- | ------------------ |
| latest  | :white_check_mark: |
| older   | :x:                |

## Reporting a Vulnerability

Please **do not** report security vulnerabilities through public GitHub issues.

Instead, report them privately using GitHub's
[private vulnerability reporting](https://github.com/doryski/framewise/security/advisories/new)
for this repository. This creates a private security advisory visible only to
the maintainer.

When reporting, please include as much of the following as you can:

- A description of the vulnerability and its potential impact
- Steps to reproduce, or a proof-of-concept
- The `framewise` version and Node.js version affected
- Any suggested mitigation, if you have one

## What to Expect

- Acknowledgement of your report as soon as reasonably possible.
- An assessment of the issue and, if confirmed, a fix targeted for the next
  release.
- Credit for the discovery in the release notes, unless you prefer to remain
  anonymous.

## Scope Notes

`framewise` shells out to an `ffmpeg` binary using `execFile` with an argument
array (never a shell string), so user-supplied paths cannot inject shell
commands. If you believe you have found a way around this, that is exactly the
kind of report we want to receive.
