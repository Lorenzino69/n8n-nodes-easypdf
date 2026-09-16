import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

export const EASYPDF_API_BASE_URL = 'https://www.easypdf.fr/api/v1';

export interface EasyPdfResponse {
	body: Buffer;
	headers: IDataObject;
	statusCode: number;
}

export interface MultipartFile {
	fieldName: string;
	fileName: string;
	mimeType: string;
	data: Buffer;
}

function toBuffer(body: unknown): Buffer {
	if (Buffer.isBuffer(body)) return body;
	if (body instanceof ArrayBuffer) return Buffer.from(body);
	if (ArrayBuffer.isView(body)) {
		return Buffer.from(body.buffer, body.byteOffset, body.byteLength);
	}
	if (typeof body === 'string') return Buffer.from(body, 'utf8');
	if (body === undefined || body === null) return Buffer.alloc(0);
	return Buffer.from(JSON.stringify(body), 'utf8');
}

function headerValue(headers: IDataObject, name: string): string | undefined {
	const key = Object.keys(headers).find((header) => header.toLowerCase() === name.toLowerCase());
	if (!key) return undefined;
	const value = headers[key];
	return Array.isArray(value) ? String(value[0]) : value === undefined ? undefined : String(value);
}

/**
 * Parses a JSON response body. Returns undefined when the body is not JSON.
 */
export function parseJsonBody(body: Buffer): IDataObject | undefined {
	try {
		const parsed = JSON.parse(body.toString('utf8')) as unknown;
		if (parsed && typeof parsed === 'object') return parsed as IDataObject;
		return undefined;
	} catch {
		return undefined;
	}
}

/**
 * Builds a multipart/form-data body without any runtime dependency.
 */
export function buildMultipartBody(
	fields: Record<string, string>,
	file: MultipartFile,
): { body: Buffer; contentType: string } {
	const boundary = `----EasyPdfN8nBoundary${Date.now().toString(16)}${Math.random()
		.toString(16)
		.slice(2)}`;
	const chunks: Buffer[] = [];
	const safeFileName = file.fileName.replace(/["\r\n]/g, '_');

	for (const [name, value] of Object.entries(fields)) {
		chunks.push(
			Buffer.from(
				`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
				'utf8',
			),
		);
	}

	chunks.push(
		Buffer.from(
			`--${boundary}\r\nContent-Disposition: form-data; name="${file.fieldName}"; filename="${safeFileName}"\r\nContent-Type: ${file.mimeType}\r\n\r\n`,
			'utf8',
		),
	);
	chunks.push(file.data);
	chunks.push(Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8'));

	return {
		body: Buffer.concat(chunks),
		contentType: `multipart/form-data; boundary=${boundary}`,
	};
}

/**
 * Sends an authenticated request to the EasyPDF API v1 and returns the raw
 * response. Any HTTP status >= 400 is converted into a NodeApiError with the
 * message returned by the API (invalid key, quota, rate limit, ...).
 */
export async function easyPdfApiRequest(
	this: IExecuteFunctions,
	itemIndex: number,
	method: IHttpRequestMethods,
	path: string,
	body?: Buffer | string,
	headers: IDataObject = {},
): Promise<EasyPdfResponse> {
	const options: IHttpRequestOptions = {
		method,
		url: `${EASYPDF_API_BASE_URL}${path}`,
		headers: {
			Accept: 'application/pdf, image/png, application/json',
			...headers,
		},
		encoding: 'arraybuffer',
		json: false,
		returnFullResponse: true,
		ignoreHttpStatusErrors: true,
	};
	if (body !== undefined) options.body = body;

	const response = (await this.helpers.httpRequestWithAuthentication.call(
		this,
		'easyPdfApi',
		options,
	)) as { body: unknown; headers?: IDataObject; statusCode?: number };

	const statusCode = response.statusCode ?? 200;
	const responseHeaders = response.headers ?? {};
	const responseBody = toBuffer(response.body);

	if (statusCode >= 400) {
		throw buildApiError.call(this, itemIndex, statusCode, responseBody, responseHeaders);
	}

	return { body: responseBody, headers: responseHeaders, statusCode };
}

function buildApiError(
	this: IExecuteFunctions,
	itemIndex: number,
	statusCode: number,
	body: Buffer,
	headers: IDataObject,
): NodeApiError {
	const parsed = parseJsonBody(body);
	const detail = parsed?.detail;

	let errorCode: string | undefined;
	let apiMessage: string | undefined;
	let retryAfter: string | undefined = headerValue(headers, 'retry-after');

	if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
		const detailObject = detail as IDataObject;
		errorCode = detailObject.error ? String(detailObject.error) : undefined;
		apiMessage = detailObject.message ? String(detailObject.message) : undefined;
		if (detailObject.retry_after !== undefined) retryAfter = String(detailObject.retry_after);
	} else if (Array.isArray(detail)) {
		apiMessage = (detail as IDataObject[])
			.map((entry) => {
				const location = Array.isArray(entry.loc) ? entry.loc.join('.') : '';
				return location ? `${location}: ${String(entry.msg)}` : String(entry.msg);
			})
			.join('; ');
	} else if (typeof detail === 'string') {
		apiMessage = detail;
	} else if (!parsed && body.length > 0 && body.length < 2000) {
		apiMessage = body.toString('utf8');
	}

	let message: string;
	let description: string | undefined = apiMessage;

	switch (statusCode) {
		case 401:
			message = 'Invalid EasyPDF API key';
			description = 'Check the API key stored in your EasyPDF API credentials.';
			break;
		case 402:
			message = 'EasyPDF monthly quota exceeded';
			description =
				apiMessage ?? 'Your plan has used all of its monthly generations. Upgrade your plan.';
			break;
		case 403:
			message = 'EasyPDF API key revoked';
			description = 'This API key has been revoked. Create a new key and update your credentials.';
			break;
		case 422:
			message = 'EasyPDF rejected the request';
			break;
		case 429:
			message = 'EasyPDF rate limit exceeded';
			description = `${apiMessage ?? 'Too many requests.'}${
				retryAfter ? ` Retry after ${retryAfter} seconds.` : ''
			} Enable "Retry On Fail" in the node settings to retry automatically.`;
			break;
		default:
			message = apiMessage ?? `EasyPDF API request failed with status ${statusCode}`;
	}

	const errorResponse: JsonObject = {
		statusCode,
		error: errorCode ?? null,
		message: apiMessage ?? message,
	};
	if (retryAfter) errorResponse.retryAfter = retryAfter;

	return new NodeApiError(this.getNode(), errorResponse, {
		itemIndex,
		httpCode: String(statusCode),
		message,
		description,
	});
}
