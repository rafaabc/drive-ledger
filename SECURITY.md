# Security Policy

Norevify is a live production application handling authentication credentials
and payment data (via Stripe). Reports of genuine vulnerabilities are welcome
and taken seriously.

## Reporting a vulnerability

Please **do not** open a public GitHub issue for a security finding. Instead,
email **faelsabc21@gmail.com** with:

- A description of the vulnerability and its impact
- Steps to reproduce (proof-of-concept if possible)
- Any relevant logs, requests, or screenshots

You should expect an initial response within a few days. Please give a
reasonable window to investigate and ship a fix before any public disclosure.

## Scope

In scope: the application and API at `app.norevify.com` and this repository.
Out of scope: third-party services this app depends on (Vercel, MongoDB
Atlas, Stripe, Resend, Sentry, PostHog) — please report those directly to
the respective vendor.

## A note on this repository

This repository is source-available for portfolio review (see
[LICENSE](LICENSE)) — not open source, and not accepting code contributions
(see [CONTRIBUTING.md](CONTRIBUTING.md)). Vulnerability reports through the
channel above are still very much wanted.
