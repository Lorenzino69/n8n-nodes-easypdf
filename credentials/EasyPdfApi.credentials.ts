import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class EasyPdfApi implements ICredentialType {
	name = 'easyPdfApi';

	displayName = 'EasyPDF API';

	icon: Icon = { light: 'file:../icons/easypdf.svg', dark: 'file:../icons/easypdf.dark.svg' };

	documentationUrl =
		'https://github.com/Lorenzino69/n8n-nodes-easypdf?tab=readme-ov-file#credentials';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			required: true,
			default: '',
			description:
				'Your EasyPDF API key (starts with sk_live_). Create one on https://www.easypdf.fr/api-docs.',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				'X-API-Key': '={{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://www.easypdf.fr/api/v1',
			url: '/usage',
			method: 'GET',
		},
	};
}
