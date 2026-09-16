import type { INodeProperties } from 'n8n-workflow';

const pageLayoutOptions: INodeProperties[] = [
	{
		displayName: 'Footer HTML',
		name: 'footerHtml',
		type: 'string',
		typeOptions: { rows: 3 },
		default: '',
		description: 'HTML template repeated at the bottom of every page',
	},
	{
		displayName: 'Header HTML',
		name: 'headerHtml',
		type: 'string',
		typeOptions: { rows: 3 },
		default: '',
		description: 'HTML template repeated at the top of every page',
	},
	{
		displayName: 'Landscape',
		name: 'landscape',
		type: 'boolean',
		default: false,
		description: 'Whether to render the pages in landscape orientation',
	},
	{
		displayName: 'Margin Bottom',
		name: 'marginBottom',
		type: 'string',
		default: '20mm',
		description: 'Bottom page margin as a CSS length, for example 20mm or 1in',
	},
	{
		displayName: 'Margin Left',
		name: 'marginLeft',
		type: 'string',
		default: '15mm',
		description: 'Left page margin as a CSS length, for example 15mm or 0.5in',
	},
	{
		displayName: 'Margin Right',
		name: 'marginRight',
		type: 'string',
		default: '15mm',
		description: 'Right page margin as a CSS length, for example 15mm or 0.5in',
	},
	{
		displayName: 'Margin Top',
		name: 'marginTop',
		type: 'string',
		default: '20mm',
		description: 'Top page margin as a CSS length, for example 20mm or 1in',
	},
	{
		displayName: 'Page Format',
		name: 'pageFormat',
		type: 'options',
		options: [
			{ name: 'A3', value: 'A3' },
			{ name: 'A4', value: 'A4' },
			{ name: 'A5', value: 'A5' },
			{ name: 'Legal', value: 'Legal' },
			{ name: 'Letter', value: 'Letter' },
			{ name: 'Tabloid', value: 'Tabloid' },
		],
		default: 'A4',
		description: 'Paper size of the generated PDF',
	},
];

const variablesField = (operations: string[]): INodeProperties => ({
	displayName: 'Variables (JSON)',
	name: 'variables',
	type: 'json',
	default: '{}',
	description:
		'Values that replace {{placeholders}} in the content, for example {"customer": "Acme", "total": "120 EUR"}',
	displayOptions: {
		show: {
			resource: ['pdf'],
			operation: operations,
		},
	},
});

export const pdfOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['pdf'],
			},
		},
		options: [
			{
				name: 'Convert File',
				value: 'convertFile',
				action: 'Convert a DOCX or HTML file to PDF',
				description:
					'Convert a DOCX or HTML binary file to PDF, with optional variable replacement',
			},
			{
				name: 'Generate',
				value: 'generate',
				action: 'Generate a PDF from HTML, markdown or a template',
				description: 'Generate a PDF document from HTML, Markdown or template JSON',
			},
			{
				name: 'Generate Preview',
				value: 'preview',
				action: 'Generate a PNG preview of the first page',
				description:
					'Render the first page as a PNG image. Previews do not count toward the monthly quota.',
			},
		],
		default: 'generate',
	},
];

export const pdfFields: INodeProperties[] = [
	/* -------------------------------------------------------------------------- */
	/*                         pdf:generate, pdf:preview                          */
	/* -------------------------------------------------------------------------- */
	{
		displayName: 'Source Format',
		name: 'sourceFormat',
		type: 'options',
		noDataExpression: true,
		options: [
			{
				name: 'HTML',
				value: 'html',
				description: 'Render an HTML string with page layout options',
			},
			{
				name: 'Markdown',
				value: 'markdown',
				description: 'Render a Markdown string with a visual theme',
			},
			{
				name: 'Template',
				value: 'template',
				description: 'Render an EasyPDF template described as JSON',
			},
		],
		default: 'html',
		displayOptions: {
			show: {
				resource: ['pdf'],
				operation: ['generate', 'preview'],
			},
		},
	},
	{
		displayName: 'Content',
		name: 'content',
		type: 'string',
		typeOptions: { rows: 8 },
		required: true,
		default: '',
		placeholder: '<h1>Invoice {{invoice_number}}</h1>',
		description: 'HTML or Markdown source of the document. Use {{name}} for variables.',
		displayOptions: {
			show: {
				resource: ['pdf'],
				operation: ['generate', 'preview'],
				sourceFormat: ['html', 'markdown'],
			},
		},
	},
	{
		displayName: 'Template Data (JSON)',
		name: 'templateData',
		type: 'json',
		required: true,
		default: '{}',
		description:
			'Template definition (pages, elements and variables) as documented in the EasyPDF API reference',
		displayOptions: {
			show: {
				resource: ['pdf'],
				operation: ['generate', 'preview'],
				sourceFormat: ['template'],
			},
		},
	},
	variablesField(['generate', 'preview']),
	{
		displayName: 'Page Options',
		name: 'pageOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['pdf'],
				operation: ['generate', 'preview'],
				sourceFormat: ['html'],
			},
		},
		options: pageLayoutOptions,
	},
	{
		displayName: 'Markdown Options',
		name: 'markdownOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['pdf'],
				operation: ['generate', 'preview'],
				sourceFormat: ['markdown'],
			},
		},
		options: [
			{
				displayName: 'Theme',
				name: 'theme',
				type: 'options',
				options: [
					{ name: 'Academic', value: 'academic' },
					{ name: 'Dark', value: 'dark' },
					{ name: 'Minimal', value: 'minimal' },
					{ name: 'Modern', value: 'modern' },
					{ name: 'Newspaper', value: 'newspaper' },
				],
				default: 'modern',
				description: 'Visual theme applied to the Markdown document',
			},
		],
	},

	/* -------------------------------------------------------------------------- */
	/*                              pdf:convertFile                               */
	/* -------------------------------------------------------------------------- */
	{
		displayName: 'Input Binary Field',
		name: 'binaryPropertyName',
		type: 'string',
		required: true,
		default: 'data',
		hint: 'The name of the input binary field containing the DOCX or HTML file',
		displayOptions: {
			show: {
				resource: ['pdf'],
				operation: ['convertFile'],
			},
		},
	},
	variablesField(['convertFile']),
	{
		displayName: 'Options',
		name: 'convertOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['pdf'],
				operation: ['convertFile'],
			},
		},
		options: [
			{
				displayName: 'Input File Name',
				name: 'inputFileName',
				type: 'string',
				default: '',
				placeholder: 'contract.docx',
				description:
					'Overrides the input file name sent to EasyPDF. The extension (.docx, .html or .htm) selects the converter.',
			},
			...pageLayoutOptions.map((option) => ({
				...option,
				description: `${option.description as string} (HTML files only)`,
			})),
		],
	},

	/* -------------------------------------------------------------------------- */
	/*                              pdf: all outputs                              */
	/* -------------------------------------------------------------------------- */
	{
		displayName: 'Output Binary Field',
		name: 'outputBinaryPropertyName',
		type: 'string',
		required: true,
		default: 'data',
		hint: 'The name of the output binary field to put the file in',
		displayOptions: {
			show: {
				resource: ['pdf'],
			},
		},
	},
	{
		displayName: 'Output File Name',
		name: 'outputFileName',
		type: 'string',
		default: '',
		placeholder: 'invoice.pdf',
		description:
			'Name of the generated file. Leave empty to use the input file name or a default name.',
		displayOptions: {
			show: {
				resource: ['pdf'],
			},
		},
	},
];

export const usageOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['usage'],
			},
		},
		options: [
			{
				name: 'Get',
				value: 'get',
				action: 'Get API usage for the current month',
				description: 'Return used, remaining and total generations for the current month',
			},
		],
		default: 'get',
	},
];
