# Changelog

All notable changes to this package are documented in this file.

## 0.1.0 (2026-09-16)

Initial release.

- **EasyPDF API** credentials with an `X-API-Key` header and a credential test against `GET /api/v1/usage`.
- **PDF > Generate**: generate a PDF from HTML, Markdown or template JSON (`POST /api/v1/generate/pdf`), with `{{variable}}` replacement, page layout options for HTML and themes for Markdown.
- **PDF > Convert File**: convert a DOCX or HTML binary file to PDF (`POST /api/v1/generate/pdf/upload`).
- **PDF > Generate Preview**: render the first page as a PNG (`POST /api/v1/generate/preview`).
- **Usage > Get**: read the current month usage (`GET /api/v1/usage`).
- Explicit error messages for invalid or revoked keys (401, 403), exhausted quota (402), validation errors (422) and rate limits (429, with the `Retry-After` delay).
