import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import { pdfFields, pdfOperations, usageOperations } from './descriptions';
import { buildMultipartBody, easyPdfApiRequest, parseJsonBody } from './transport';

type SourceFormat = 'html' | 'markdown' | 'template';

const PAGE_OPTION_KEYS: Record<string, string> = {
	pageFormat: 'page_format',
	landscape: 'landscape',
	marginTop: 'margin_top',
	marginBottom: 'margin_bottom',
	marginLeft: 'margin_left',
	marginRight: 'margin_right',
	headerHtml: 'header_html',
	footerHtml: 'footer_html',
	theme: 'theme',
};

const HTML_MIME_TYPES = ['text/html', 'application/xhtml+xml'];
const DOCX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function parseJsonParameter(
	this: IExecuteFunctions,
	value: unknown,
	parameterName: string,
	itemIndex: number,
): IDataObject {
	if (value === undefined || value === null || value === '') return {};
	if (typeof value === 'object' && !Array.isArray(value)) return value as IDataObject;
	if (typeof value === 'string') {
		try {
			const parsed = JSON.parse(value) as unknown;
			if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
				return parsed as IDataObject;
			}
		} catch {
			// handled below
		}
	}
	throw new NodeOperationError(this.getNode(), `"${parameterName}" must be a valid JSON object`, {
		itemIndex,
	});
}

function toApiOptions(options: IDataObject): IDataObject {
	const apiOptions: IDataObject = {};
	for (const [key, value] of Object.entries(options)) {
		const apiKey = PAGE_OPTION_KEYS[key];
		if (!apiKey) continue;
		if (typeof value === 'string' && value.trim() === '') continue;
		apiOptions[apiKey] = value;
	}
	return apiOptions;
}

function resolveUploadFileName(
	fileName: string | undefined,
	mimeType: string | undefined,
): string | undefined {
	const lowerName = (fileName ?? '').toLowerCase();
	if (lowerName.endsWith('.docx') || lowerName.endsWith('.html') || lowerName.endsWith('.htm')) {
		return fileName;
	}
	const baseName = fileName && fileName.trim() !== '' ? fileName : 'document';
	if (mimeType === DOCX_MIME_TYPE) return `${baseName}.docx`;
	if (mimeType && HTML_MIME_TYPES.includes(mimeType)) return `${baseName}.html`;
	return undefined;
}

function replaceExtension(fileName: string, extension: string): string {
	const dotIndex = fileName.lastIndexOf('.');
	const baseName = dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName;
	return `${baseName}.${extension}`;
}

export class EasyPdf implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'EasyPDF',
		name: 'easyPdf',
		icon: { light: 'file:../../icons/easypdf.svg', dark: 'file:../../icons/easypdf.dark.svg' },
		group: ['transform'],
		version: [1],
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Generate and convert PDF documents with the EasyPDF API',
		defaults: {
			name: 'EasyPDF',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		credentials: [
			{
				name: 'easyPdfApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'PDF',
						value: 'pdf',
					},
					{
						name: 'Usage',
						value: 'usage',
					},
				],
				default: 'pdf',
			},
			...pdfOperations,
			...pdfFields,
			...usageOperations,
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const resource = this.getNodeParameter('resource', i) as string;
				const operation = this.getNodeParameter('operation', i) as string;

				if (resource === 'usage' && operation === 'get') {
					const response = await easyPdfApiRequest.call(this, i, 'GET', '/usage');
					const usage = parseJsonBody(response.body);
					if (!usage) {
						throw new NodeOperationError(
							this.getNode(),
							'EasyPDF returned an unexpected usage response',
							{ itemIndex: i },
						);
					}
					returnData.push({ json: usage, pairedItem: { item: i } });
					continue;
				}

				if (resource !== 'pdf') {
					throw new NodeOperationError(this.getNode(), `Unsupported resource "${resource}"`, {
						itemIndex: i,
					});
				}

				const outputBinaryPropertyName = this.getNodeParameter(
					'outputBinaryPropertyName',
					i,
				) as string;
				const outputFileNameParameter = (
					this.getNodeParameter('outputFileName', i, '') as string
				).trim();
				const variables = parseJsonParameter.call(
					this,
					this.getNodeParameter('variables', i, '{}'),
					'Variables (JSON)',
					i,
				);

				let responseBody: Buffer;
				let fileName: string;
				let mimeType: string;

				if (operation === 'generate' || operation === 'preview') {
					const sourceFormat = this.getNodeParameter('sourceFormat', i) as SourceFormat;
					const requestBody: IDataObject = { format: sourceFormat, variables };

					if (sourceFormat === 'template') {
						requestBody.template_data = parseJsonParameter.call(
							this,
							this.getNodeParameter('templateData', i),
							'Template Data (JSON)',
							i,
						);
					} else {
						const content = this.getNodeParameter('content', i) as string;
						if (!content || content.trim() === '') {
							throw new NodeOperationError(this.getNode(), '"Content" must not be empty', {
								itemIndex: i,
							});
						}
						requestBody.content = content;
						const optionsParameter = sourceFormat === 'html' ? 'pageOptions' : 'markdownOptions';
						const apiOptions = toApiOptions(
							this.getNodeParameter(optionsParameter, i, {}) as IDataObject,
						);
						if (Object.keys(apiOptions).length > 0) requestBody.options = apiOptions;
					}

					const response = await easyPdfApiRequest.call(
						this,
						i,
						'POST',
						operation === 'generate' ? '/generate/pdf' : '/generate/preview',
						JSON.stringify(requestBody),
						{ 'Content-Type': 'application/json' },
					);
					responseBody = response.body;

					if (operation === 'generate') {
						mimeType = 'application/pdf';
						fileName = outputFileNameParameter || 'generated.pdf';
					} else {
						mimeType = 'image/png';
						fileName = outputFileNameParameter || 'preview.png';
					}
				} else if (operation === 'convertFile') {
					const binaryPropertyName = this.getNodeParameter('binaryPropertyName', i) as string;
					const convertOptions = this.getNodeParameter('convertOptions', i, {}) as IDataObject;
					const binaryData = this.helpers.assertBinaryData(i, binaryPropertyName);
					const fileBuffer = await this.helpers.getBinaryDataBuffer(i, binaryPropertyName);

					const inputFileNameOverride =
						typeof convertOptions.inputFileName === 'string'
							? convertOptions.inputFileName.trim()
							: '';
					const uploadFileName = resolveUploadFileName(
						inputFileNameOverride || binaryData.fileName,
						binaryData.mimeType,
					);
					if (!uploadFileName) {
						throw new NodeOperationError(
							this.getNode(),
							'The input file must be a DOCX or HTML file',
							{
								itemIndex: i,
								description:
									'EasyPDF selects the converter from the file extension. Set "Input File Name" in the options, for example "contract.docx".',
							},
						);
					}

					const { body, contentType } = buildMultipartBody(
						{
							variables: JSON.stringify(variables),
							options: JSON.stringify(toApiOptions(convertOptions)),
						},
						{
							fieldName: 'file',
							fileName: uploadFileName,
							mimeType: binaryData.mimeType || 'application/octet-stream',
							data: fileBuffer,
						},
					);

					const response = await easyPdfApiRequest.call(
						this,
						i,
						'POST',
						'/generate/pdf/upload',
						body,
						{ 'Content-Type': contentType },
					);
					responseBody = response.body;
					mimeType = 'application/pdf';
					fileName = outputFileNameParameter || replaceExtension(uploadFileName, 'pdf');
				} else {
					throw new NodeOperationError(
						this.getNode(),
						`Unsupported operation "${operation}" for resource "${resource}"`,
						{ itemIndex: i },
					);
				}

				const binary = await this.helpers.prepareBinaryData(responseBody, fileName, mimeType);

				returnData.push({
					json: {
						operation,
						fileName,
						mimeType,
						fileSize: responseBody.length,
					},
					binary: { [outputBinaryPropertyName]: binary },
					pairedItem: { item: i },
				});
			} catch (error) {
				if (this.continueOnFail()) {
					const failure: IDataObject = { error: (error as Error).message };
					if (error instanceof NodeApiError) {
						failure.httpCode = error.httpCode;
						failure.description = error.description;
					}
					returnData.push({ json: failure, pairedItem: { item: i } });
					continue;
				}
				if (error instanceof NodeOperationError) {
					// Returns the original error instance, context included.
					throw new NodeOperationError(this.getNode(), error, { itemIndex: i });
				}
				// Returns the original instance for NodeApiError thrown by the transport,
				// wraps network and unexpected errors otherwise.
				throw new NodeApiError(this.getNode(), error as JsonObject, { itemIndex: i });
			}
		}

		return [returnData];
	}
}
