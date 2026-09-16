# n8n-nodes-easypdf

This is an n8n community node for [EasyPDF](https://www.easypdf.fr). It lets you generate PDF documents from HTML, Markdown or templates, convert DOCX and HTML files to PDF, render page previews and track your API usage directly from your n8n workflows.

Typical uses: invoices and receipts from order data, contracts filled from a CRM record, reports built from a database query, certificates sent by email after a form submission.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/sustainable-use-license/) workflow automation platform.

- [Installation](#installation)
- [Credentials](#credentials)
- [Operations](#operations)
- [Usage](#usage)
- [Example workflows](#example-workflows)
- [Errors, quotas and rate limits](#errors-quotas-and-rate-limits)
- [Compatibility](#compatibility)
- [Resources](#resources)
- [Version history](#version-history)

## Installation

### n8n Cloud and self-hosted (nodes panel)

Once the node is verified by n8n, search for **EasyPDF** in the nodes panel and click **Install**.

### Self-hosted (community nodes settings)

1. Open **Settings > Community Nodes**.
2. Click **Install**.
3. Enter `n8n-nodes-easypdf` as the npm package name.
4. Accept the risks of installing unverified code and click **Install**.

See the [n8n community nodes installation guide](https://docs.n8n.io/integrations/community-nodes/installation-and-management/gui-installation/) for details.

### Manual installation (queue mode or Docker without the GUI)

```sh
cd ~/.n8n/nodes
npm install n8n-nodes-easypdf
```

Restart n8n afterwards.

## Credentials

The node authenticates with an EasyPDF API key sent in the `X-API-Key` header.

1. Sign in on [www.easypdf.fr](https://www.easypdf.fr).
2. Open the [API documentation page](https://www.easypdf.fr/api-docs) and create an API key in the key management section. The key starts with `sk_live_` and is shown only once, so copy it right away.
3. In n8n, create a new **EasyPDF API** credential and paste the key in **API Key**.
4. Click **Save**. n8n tests the key by calling `GET https://www.easypdf.fr/api/v1/usage`.

A revoked key returns a 403 error: create a new key and update the credential.

## Operations

All requests go to `https://www.easypdf.fr/api/v1`.

### PDF

| Operation | Endpoint | Input | Output |
| --- | --- | --- | --- |
| **Generate** | `POST /generate/pdf` | HTML string, Markdown string or template JSON | PDF binary |
| **Convert File** | `POST /generate/pdf/upload` | DOCX or HTML binary file | PDF binary |
| **Generate Preview** | `POST /generate/preview` | HTML string, Markdown string or template JSON | PNG binary of the first page |

**Generate** and **Generate Preview** parameters:

- **Source Format**: `HTML`, `Markdown` or `Template`.
- **Content**: the HTML or Markdown source (HTML and Markdown formats).
- **Template Data (JSON)**: the template definition (Template format), as described in the [API reference](https://www.easypdf.fr/api-docs).
- **Variables (JSON)**: an object whose keys replace `{{placeholders}}` in the content, for example `{"customer": "Acme", "total": "120 EUR"}`. You can build it with an expression such as `{{ JSON.stringify({ customer: $json.name }) }}`.
- **Page Options** (HTML): page format (A3, A4, A5, Legal, Letter, Tabloid), landscape, margins (CSS lengths such as `20mm`), header HTML and footer HTML. Header and footer templates support the Chromium classes `pageNumber`, `totalPages`, `date` and `title`.
- **Markdown Options** (Markdown): theme (`modern`, `academic`, `minimal`, `dark`, `newspaper`).

**Convert File** parameters:

- **Input Binary Field**: name of the binary field that holds the file (default `data`).
- **Variables (JSON)**: `{{placeholders}}` are replaced in the DOCX paragraphs, tables, headers and footers, or in the HTML source.
- **Options > Input File Name**: EasyPDF picks the converter from the file extension (`.docx`, `.html`, `.htm`). The node uses the binary file name, or the MIME type when the name has no extension. Set this option when neither is reliable.
- **Options > page layout**: same as Page Options above, applied to HTML files only.

Common output parameters:

- **Output Binary Field**: name of the binary field for the generated file (default `data`).
- **Output File Name**: defaults to `generated.pdf`, `preview.png`, or the input file name with a `.pdf` extension for conversions.

Each output item also contains `operation`, `fileName`, `mimeType` and `fileSize` in its JSON.

### Usage

| Operation | Endpoint | Output |
| --- | --- | --- |
| **Get** | `GET /usage` | `{ "month", "used", "limit", "remaining", "plan" }` for the current month |

Use it before a large batch to check the remaining quota, or on a schedule to alert your team.

## Usage

A common pattern:

1. A trigger brings the data (Webhook, Schedule, Google Sheets, Stripe, Airtable, ...).
2. **EasyPDF > PDF > Generate** turns an HTML template into a PDF, with variables mapped from the incoming item.
3. The PDF binary goes to **Gmail**, **Slack**, **Google Drive**, **S3** or any node that accepts binary data.

Tips:

- Keep the HTML template in the **Content** field and pass only the changing values through **Variables (JSON)**. The template stays readable and every item reuses it.
- Use **Generate Preview** while designing a template: previews do not count toward the monthly quota.
- Run large batches through **Loop Over Items** with a small batch size to stay within the per-minute rate limit of your plan.

## Example workflows

Import these files with **Workflows > Import from File**, then select your EasyPDF credential on the EasyPDF nodes:

- [`examples/html-invoice-to-pdf.json`](examples/html-invoice-to-pdf.json): builds invoice data, generates a PDF from an HTML template with a page number footer, then reads the API usage.
- [`examples/docx-contract-to-pdf.json`](examples/docx-contract-to-pdf.json): downloads a DOCX contract template, fills its `{{client_name}}` and `{{start_date}}` placeholders and converts it to PDF.

## Errors, quotas and rate limits

The node turns API errors into clear n8n errors:

| HTTP | Meaning | What to do |
| --- | --- | --- |
| 400 | Missing content, invalid JSON or unsupported file type | Check the node parameters |
| 401 | Invalid API key | Check the credential |
| 402 | Monthly quota exceeded | Upgrade your plan or wait for the next month |
| 403 | API key revoked | Create a new key |
| 422 | Request rejected by validation | Read the error description for the invalid field |
| 429 | Per-minute rate limit exceeded | The error shows the `Retry-After` delay. Enable **Retry On Fail** in the node settings (for example 3 tries, 30 seconds apart) |
| 500 | Generation failed | Check the HTML, Markdown, template or file content |

With **On Error > Continue**, failed items are returned with `error`, `httpCode` and `description` fields so you can route them.

Limits per plan are listed on the [API documentation page](https://www.easypdf.fr/api-docs).

## Compatibility

- Built with `@n8n/node-cli` 0.48 against `n8n-workflow` 2.x (`n8nNodesApiVersion` 1).
- No runtime dependencies.
- The node is marked `usableAsTool`, so AI Agent nodes can call it.

## Resources

- [EasyPDF API documentation](https://www.easypdf.fr/api-docs)
- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
- [Report an issue](https://github.com/Lorenzino69/n8n-nodes-easypdf/issues)

## Development

```sh
npm install
npm run build
npm run lint
npm run dev   # starts a local n8n with the node loaded
```

On Windows without Visual Studio Build Tools, `npm install` fails while compiling `isolated-vm` (a native dependency of the `n8n-workflow` peer package). Use `npm install --ignore-scripts`: build and lint do not need it.

Releases are published to npm from GitHub Actions with provenance (`.github/workflows/publish.yml`), triggered by `npm run release`.

## Version history

See [CHANGELOG.md](CHANGELOG.md).
