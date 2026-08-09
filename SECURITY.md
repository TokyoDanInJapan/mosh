# Security

## What this project is

`mosh` is a static page and one script. It runs entirely in the browser. There is no server, no build step and no
runtime dependency. The page never sends your image anywhere, and there is nothing here that stores or transmits data.

The demo does two things worth knowing about. It reads an image that you choose, drop or paste, and it decodes damaged
JPEG bytes with the browser's own decoder. The damaged bytes come from an image that you supplied, and only the browser
ever reads them.

## Reporting a problem

Report a suspected vulnerability through
[GitHub's private advisory form](https://github.com/TokyoDanInJapan/mosh/security/advisories/new). Please do not open a
public issue for a security problem.

Include the browser and version, the steps to reproduce the problem, and the image that triggers it if one is needed.
Expect a first reply within seven days.

## Supported versions

The tip of `main` is the only supported version.
