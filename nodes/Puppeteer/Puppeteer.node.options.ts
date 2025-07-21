// --- START OF FILE Puppeteer.node.options.ts (COMPLETE AND UNABRIDGED) ---

import { type INodeTypeDescription, NodeConnectionTypes } from 'n8n-workflow';
import { existsSync, readFileSync } from 'node:fs';

function isRunningInContainer(): boolean {
	try {
		if (existsSync('/.dockerenv')) { return true; }
		if (process.platform === 'linux') {
			try {
				const cgroupContent = readFileSync('/proc/1/cgroup', 'utf8');
				if (cgroupContent.includes('docker') || cgroupContent.includes('kubepods')) {
					return true;
				}
			} catch (error) { /* ignore */ }
		}
		if (process.env.KUBERNETES_SERVICE_HOST || process.env.DOCKER_CONTAINER || process.env.DOCKER_HOST) {
			return true;
		}
		return false;
	} catch (error) {
		return false;
	}
}


export const nodeDescription: INodeTypeDescription = {
	displayName: 'Puppeteer',
	name: 'puppeteer',
	group: [],
	version: 1,
	description: 'Automate browser interactions using Puppeteer',
	defaults: {
		name: 'Puppeteer',
		color: '#125580',
	},
	icon: 'file:puppeteer.svg',
	inputs: [NodeConnectionTypes.Main],
	outputs: [NodeConnectionTypes.Main],
	usableAsTool: true,
	properties: [
		{
			displayName: 'Operation',
			name: 'operation',
			type: 'options',
			noDataExpression: true,
			options: [
				{ name: 'Start Persistent Browser', value: 'startPersistentBrowser', description: 'Starts a new persistent browser session' },
				{ name: 'Run Custom Script', value: 'runCustomScript', description: 'Runs custom code on a page' },
				{ name: 'Get Page Content', value: 'getPageContent', description: 'Gets the full HTML contents of a page' },
				{ name: 'Get PDF', value: 'getPDF', description: 'Captures a page as a PDF' },
				{ name: 'Get Screenshot', value: 'getScreenshot', description: 'Captures a page as an image' },
				{ name: 'Stop Persistent Browser', value: 'stopPersistentBrowser', description: 'Stops the current persistent browser session' },
			],
			default: 'runCustomScript',
		},

		// --- START OPERATION PARAMETERS ---
		{
			displayName: 'Session ID',
			name: 'sessionId',
			type: 'string',
			default: 'n8n-session-{{ $execution.id }}',
			description: 'A unique ID for the browser session.',
			displayOptions: { show: { operation: ['startPersistentBrowser'] } },
		},
		{
			displayName: 'Browser Manager URL',
			name: 'browserManagerUrl',
			type: 'string',
			default: 'http://127.0.0.1:3001',
			description: 'The base URL of your browser manager service. Use 127.0.0.1 instead of localhost.',
			displayOptions: { show: { operation: ['startPersistentBrowser'] } },
		},

		// --- STOP OPERATION PARAMETERS (FALLBACKS) ---
		{
			displayName: 'Note',
			name: 'stopNote',
			type: 'notice',
			default: 'This node automatically uses the current persistent session. The options below are only needed for manual testing or if the Stop node is disconnected from the workflow.',
			displayOptions: { show: { operation: ['stopPersistentBrowser'] } },
		},
		{
			displayName: 'Session ID (Fallback)',
			name: 'stopSessionId',
			type: 'string',
			default: '',
			description: 'Only required if this node cannot find an active session from a "Start" node in this workflow.',
			displayOptions: { show: { operation: ['stopPersistentBrowser'] } },
		},
		{
			displayName: 'Browser Manager URL (Fallback)',
			name: 'stopBrowserManagerUrl',
			type: 'string',
			default: 'http://127.0.0.1:3001',
			description: 'Only required if this node cannot find an active session from a "Start" node in this workflow.',
			displayOptions: { show: { operation: ['stopPersistentBrowser'] } },
		},

		// --- ACTION OPERATION PARAMETERS ---
		{
			displayName: 'URL',
			name: 'url',
			type: 'string',
			required: true,
			default: '',
			description: 'The URL to navigate to. This is only used if not in a persistent session.',
			displayOptions: { show: { operation: ['getPageContent', 'getScreenshot', 'getPDF'] } },
		},
		{
			displayName: 'Script Code',
			name: 'scriptCode',
			type: 'string',
			typeOptions: { editor: 'codeNodeEditor', editorLanguage: 'javaScript' },
			required: true,
			default: 'await $page.goto(\'https://www.saucedemo.com/\');\n\nconst pageTitle = await $page.title();\n\nreturn [{ title: pageTitle, ...$json }];',
			description: 'JavaScript code to execute with Puppeteer. You have access to the $browser and $page objects.',
			displayOptions: { show: { operation: ['runCustomScript'] } },
		},
		{
			displayName: 'Property Name',
			name: 'dataPropertyName',
			type: 'string',
			required: true,
			default: 'data',
			description: 'Name of the binary property in which to store the image or PDF data.',
			displayOptions: { show: { operation: ['getScreenshot', 'getPDF'] } },
		},
		// --- The rest of the parameters are unchanged and complete ---
		{
			displayName: 'Page Ranges',
			name: 'pageRanges',
			type: 'string',
			required: false,
			default: '',
			description: 'Paper ranges to print, e.g. 1-5, 8, 11-13.',
			displayOptions: { show: { operation: ['getPDF'] } },
		},
		{
			displayName: 'Scale',
			name: 'scale',
			type: 'number',
			typeOptions: { minValue: 0.1, maxValue: 2 },
			default: 1.0,
			required: true,
			description: 'Scales the rendering of the web page. Amount must be between 0.1 and 2.',
			displayOptions: { show: { operation: ['getPDF'] } },
		},
		{
			displayName: 'Prefer CSS Page Size',
			name: 'preferCSSPageSize',
			type: 'boolean',
			required: true,
			default: true,
			displayOptions: { show: { operation: ['getPDF'] } },
			description: 'Give any CSS @page size declared in the page priority over what is declared in the width or height or format option.',
		},
		{
			displayName: 'Format',
			name: 'format',
			type: 'options',
			options: [
				{ name: 'Letter', value: 'Letter' }, { name: 'Legal', value: 'Legal' }, { name: 'Tabloid', value: 'Tabloid' }, { name: 'Ledger', value: 'Ledger' },
				{ name: 'A0', value: 'A0' }, { name: 'A1', value: 'A1' }, { name: 'A2', value: 'A2' }, { name: 'A3', value: 'A3' }, { name: 'A4', value: 'A4' }, { name: 'A5', value: 'A5' }, { name: 'A6', value: 'A6' },
			],
			default: 'Letter',
			description: 'Valid paper format types when printing a PDF. eg: Letter, A4',
			displayOptions: { show: { operation: ['getPDF'], preferCSSPageSize: [false] } },
		},
		{
			displayName: 'Height',
			name: 'height',
			type: 'string',
			default: '',
			required: false,
			description: 'Sets the height of paper. You can pass in a number or a string with a unit.',
			displayOptions: { show: { operation: ['getPDF'], preferCSSPageSize: [false] } },
		},
		{
			displayName: 'Width',
			name: 'width',
			type: 'string',
			default: '',
			required: false,
			description: 'Sets the width of paper. You can pass in a number or a string with a unit.',
			displayOptions: { show: { operation: ['getPDF'], preferCSSPageSize: [false] } },
		},
		{
			displayName: 'Landscape',
			name: 'landscape',
			type: 'boolean',
			required: true,
			default: true,
			displayOptions: { show: { operation: ['getPDF'] } },
			description: 'Whether to show the header and footer.',
		},
		{
			displayName: 'Margin',
			name: 'margin',
			type: 'collection',
			placeholder: 'Add Margin',
			default: {},
			description: 'Set the PDF margins.',
			displayOptions: { show: { operation: ['getPDF'] } },
			options: [
				{ displayName: 'Top', name: 'top', type: 'string', default: '' }, { displayName: 'Bottom', name: 'bottom', type: 'string', default: '' },
				{ displayName: 'Left', name: 'left', type: 'string', default: '' }, { displayName: 'Right', name: 'right', type: 'string', default: '' },
			],
		},
		{
			displayName: 'Display Header/Footer',
			name: 'displayHeaderFooter',
			type: 'boolean',
			required: true,
			default: false,
			displayOptions: { show: { operation: ['getPDF'] } },
			description: 'Whether to show the header and footer.',
		},
		{
			displayName: 'Header Template',
			name: 'headerTemplate',
			typeOptions: { rows: 5 },
			type: 'string',
			default: '',
			description: 'HTML template for the print header.',
			noDataExpression: true,
			displayOptions: { show: { operation: ['getPDF'], displayHeaderFooter: [true] } },
		},
		{
			displayName: 'Footer Template',
			name: 'footerTemplate',
			typeOptions: { rows: 5 },
			type: 'string',
			default: '',
			description: 'HTML template for the print footer.',
			noDataExpression: true,
			displayOptions: { show: { operation: ['getPDF'], displayHeaderFooter: [true] } },
		},
		{
			displayName: 'Transparent Background',
			name: 'omitBackground',
			type: 'boolean',
			required: true,
			default: false,
			displayOptions: { show: { operation: ['getPDF'] } },
			description: 'Hides default white background and allows generating pdfs with transparency.',
		},
		{
			displayName: 'Background Graphics',
			name: 'printBackground',
			type: 'boolean',
			required: true,
			default: false,
			displayOptions: { show: { operation: ['getPDF'] } },
			description: 'Set to true to include background graphics.',
		},
		{
			displayName: 'Type',
			name: 'imageType',
			type: 'options',
			options: [{ name: 'JPEG', value: 'jpeg' }, { name: 'PNG', value: 'png' }, { name: 'WebP', value: 'webp' }],
			displayOptions: { show: { operation: ['getScreenshot'] } },
			default: 'png',
			description: 'The image type to use. PNG, JPEG, and WebP are supported.',
		},
		{
			displayName: 'Quality',
			name: 'quality',
			type: 'number',
			typeOptions: { minValue: 0, maxValue: 100 },
			default: 100,
			displayOptions: { show: { operation: ['getScreenshot'], imageType: ['jpeg', 'webp'] } },
			description: 'The quality of the image, between 0-100. Not applicable to png images.',
		},
		{
			displayName: 'Full Page',
			name: 'fullPage',
			type: 'boolean',
			required: true,
			default: true,
			displayOptions: { show: { operation: ['getScreenshot'] } },
			description: 'When true, takes a screenshot of the full scrollable page.',
		},
		{
			displayName: 'Query Parameters',
			name: 'queryParameters',
			placeholder: 'Add Parameter',
			type: 'fixedCollection',
			typeOptions: { multipleValues: true },
			displayOptions: { show: { operation: ['getPageContent', 'getScreenshot', 'getPDF'] } },
			description: 'The query parameter to send.',
			default: {},
			options: [
				{ name: 'parameters', displayName: 'Parameters', values: [
					{ displayName: 'Name', name: 'name', type: 'string', default: '' },
					{ displayName: 'Value', name: 'value', type: 'string', default: '' },
				]},
			],
		},
		{
			displayName: 'Options',
			name: 'options',
			type: 'collection',
			placeholder: 'Add Option',
			default: {},
			displayOptions: {
				show: {
					operation: ['runCustomScript', 'getPageContent', 'getScreenshot', 'getPDF'],
				},
			},
			options: [
				{
					displayName: 'Manual Session Override',
					name: 'manualSessionOverride',
					type: 'boolean',
					default: false,
					description: 'Enable to manually provide connection details for an existing session. This is useful for debugging individual nodes.',
				},
				{
					displayName: 'Browser WebSocket Endpoint',
					name: 'manualWsEndpoint',
					type: 'string',
					default: '',
					required: true,
					description: 'The WebSocket URL of an existing browser session.',
					displayOptions: { show: { manualSessionOverride: [true] } },
				},
				{
					displayName: 'Page ID',
					name: 'manualPageId',
					type: 'string',
					default: '',
					required: true,
					description: 'The ID of the specific page to attach to in the existing session.',
					displayOptions: { show: { manualSessionOverride: [true] } },
				},
				{
					displayName: 'Batch Size',
					name: 'batchSize',
					type: 'number',
					typeOptions: { minValue: 1 },
					default: 1,
					description: 'Maximum number of items to process simultaneously.',
				},
				{
					displayName: 'Executable Path (Temporary Browser Only)',
					name: 'executablePath',
					type: 'string',
					default: '',
					description: 'Path to a browser executable to run. Only applies when not using a persistent session.',
				},
				{
					displayName: 'Launch Arguments (Temporary Browser Only)',
					name: 'launchArguments',
					placeholder: 'Add Argument',
					type: 'fixedCollection',
					typeOptions: { multipleValues: true },
					default: {},
					description: 'Additional command line arguments to pass to the browser instance. Only applies when not using a persistent session.',
					options: [
						{ name: 'args', displayName: '', values: [
							{ displayName: 'Argument', name: 'arg', type: 'string', default: '' },
						]},
					],
				},
				{
					displayName: 'Add Container Arguments (Temporary Browser Only)',
					name: 'addContainerArgs',
					type: 'boolean',
					default: isRunningInContainer(),
					description: 'Whether to add recommended arguments for container environments. Only applies when not using a persistent session.',
				},
				{
					displayName: 'Headless Mode (Temporary Browser Only)',
					name: 'headless',
					type: 'boolean',
					default: true,
					description: 'Whether to run temporary browser in headless mode. Defaults to true.',
				},
			],
		},
	],
};
