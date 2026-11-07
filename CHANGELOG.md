# Changelog

## [Unreleased]

## [0.2.5] - 2026-11-07

- Commit dead-key composition on `compositionend`, so accented characters typed through Chromium's composition path on Wayland advance the run, with a guard against Firefox's repeated input event.
- Add Repeat (Esc) and New text (Tab) buttons to the results panel in English and Brazilian Portuguese.
- Patch security advisories across the Rails components (8.1.4.1), `addressable`, `nokogiri`, `loofah`, and `rails-html-sanitizer`.
- Refresh dependencies: RuboCop 1.92.2 and plugins, Selenium 4.52.0, `json` 3.1.0, `tailwindcss-ruby` 4.3.4, Electron 42.11.18, electron-builder 26.18.0, and `js-yaml` 4.3.2.
- Pin CI and publishing runners to `ubuntu-24.04`, where the project's Ruby 3.4.8 toolchain is available.

## [0.2.4] - 2026-10-22

- Add an experimental Windows-only Electron desktop build (NSIS installer) that embeds the Rails app, Ruby 3.4.8, and precompiled assets. macOS and Linux packaging are not yet implemented; see the README "Electron desktop" section for the supported commands, prerequisites, and known limitations.
- Refresh runtime, test, and security-tooling dependencies, including Rails 8.1.x components, Selenium, SimpleCov, Brakeman, and Thruster.
- Automate Dependabot minor and patch updates with grouped weekly PRs and CI-gated auto-merge; major bumps still get manual review.

## [0.2.3] - 2026-06-23

- Merge community pt-BR accent-practice guardrails and additional normalization regression coverage.
- Refresh dependency and GitHub Actions pins for the release pipeline.

## [0.2.2] - 2026-06-19

- Preserve Brazilian Portuguese accents in practice text and accept committed dead-key/Option-produced accented input through a focused text input sink.

## [0.2.1] - 2026-06-15

- Support macOS-style backward deletion shortcuts during typing: `Option+Backspace` deletes the previous word, and `Command+Backspace` deletes to the start of the current visual line.

## [0.2.0] - 2026-06-15

- Pause the typing timer when the practice surface loses focus, then resume without counting away time.
