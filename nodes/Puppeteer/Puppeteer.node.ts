// --- START OF FILE Puppeteer.node.ts (COMPLETE AND UNABRIDGED) ---

import {
	type IDataObject,
	type IExecuteFunctions,
	type ILoadOptionsFunctions,
	type INodeExecutionData,
	type INodePropertyOptions,
	type INodeType,
	type INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';
import { makeResolverFromLegacyOptions, NodeVM } from '@n8n/vm2';

import puppeteer from 'puppeteer-extra';
import {
	type Browser,
	type Device,
	KnownDevices as devices,
	type Page,
	type PaperFormat,
	type PDFOptions,
	type ScreenshotOptions,
} from 'puppeteer';

import { nodeDescription } from './Puppeteer.node.options';

const CONTAINER_LAUNCH_ARGS = [
	'--no-sandbox',
	'--disable-setuid-sandbox',
	'--disable-dev-shm-usage',
	'--disable-gpu'
];

export const vmResolver = makeResolverFromLegacyOptions({});

interface PuppeteerSessionData {
	wsEndpoint: string;
	pageId: string;
	sessionId: string;
	browserManagerUrl: string;
}

async function runAction(this: IExecuteFunctions, itemIndex: number, browser: Browser, session?: PuppeteerSessionData): Promise<INodeExecutionData[]> {
	const operation = this.getNodeParameter('operation', itemIndex) as string;

	let page: Page;

	if (session) {
		const pageId = session.pageId;
		const pages = await browser.pages();
		const foundPage = pages.find(p => (p.target() as any)._targetId === pageId);
		if (!foundPage) {
			throw new NodeOperationError(this.getNode(), `Could not find persistent page with ID '${pageId}'.`);
		}
		page = foundPage;
	} else {
		page = await browser.newPage();
	}

	try {
		if (operation === 'runCustomScript') {
			const scriptCode = this.getNodeParameter('scriptCode', itemIndex) as string;
			const context = {
				...this.getWorkflowDataProxy(itemIndex),
				$browser: browser,
				$page: page,
				helpers: this.helpers,
			};
			const vm = new NodeVM({ console: 'redirect', sandbox: context, require: vmResolver, wasm: false });
			vm.on('console.log', this.getMode() === 'manual' ? this.sendMessageToUI : (...args) => console.log(`[VM]`, ...args));

			let scriptResult = await vm.run(`module.exports = async function() { ${scriptCode}\n}()`);
			if (!Array.isArray(scriptResult)) {
				throw new NodeOperationError(this.getNode(), 'Custom script must return an array of items.');
			}
			if (session) {
				scriptResult = scriptResult.map((item: { json: IDataObject }) => ({
					...item,
					json: { ...item.json, pageId: session.pageId },
				}));
			}
			return this.helpers.normalizeItems(scriptResult);
		}

		const urlString = this.getNodeParameter('url', itemIndex) as string;
		let url: URL;
		try {
			url = new URL(urlString);
			const queryParametersOptions = this.getNodeParameter('queryParameters', itemIndex, {}) as IDataObject;
			const queryParameters = (queryParametersOptions.parameters as {name: string, value: string}[]) || [];
			for (const queryParameter of queryParameters) {
				url.searchParams.append(queryParameter.name, queryParameter.value);
			}
		} catch (error) {
			throw new NodeOperationError(this.getNode(), new Error(`Invalid URL: ${urlString}`), { itemIndex });
		}

		await page.goto(url.toString(), { waitUntil: 'networkidle0' });
		let resultData: INodeExecutionData[] = [];

		if (operation === 'getPageContent') {
			const body = await page.content();
			resultData = [{ json: { body }, pairedItem: { item: itemIndex } }];
		} else if (operation === 'getScreenshot') {
			const dataPropertyName = this.getNodeParameter('dataPropertyName', itemIndex) as string;
			const type = this.getNodeParameter('imageType', itemIndex) as 'jpeg' | 'png' | 'webp';
			const fullPage = this.getNodeParameter('fullPage', itemIndex) as boolean;
			const options = this.getNodeParameter('options', itemIndex, {}) as IDataObject;
			const screenshotOptions: ScreenshotOptions = { type, fullPage };
			if (type !== 'png') {
				screenshotOptions.quality = this.getNodeParameter('quality', itemIndex) as number;
			}
			if (options.fileName) { // @ts-ignore
				screenshotOptions.path = options.fileName as string;
			}
			const screenshot = await page.screenshot(screenshotOptions);
			const mimeType = `image/${type}`;
			const binaryData = await this.helpers.prepareBinaryData(Buffer.from(screenshot), screenshotOptions.path, mimeType);
			resultData = [{ binary: { [dataPropertyName]: binaryData }, json: { url: url.toString() }, pairedItem: { item: itemIndex } }];
		} else if (operation === 'getPDF') {
			const dataPropertyName = this.getNodeParameter('dataPropertyName', itemIndex) as string;
			const options = this.getNodeParameter('options', itemIndex, {}) as IDataObject;
			const pdfOptions: PDFOptions = {
				pageRanges: this.getNodeParameter('pageRanges', itemIndex) as string,
				displayHeaderFooter: this.getNodeParameter('displayHeaderFooter', itemIndex) as boolean,
				omitBackground: this.getNodeParameter('omitBackground', itemIndex) as boolean,
				printBackground: this.getNodeParameter('printBackground', itemIndex) as boolean,
				landscape: this.getNodeParameter('landscape', itemIndex) as boolean,
				preferCSSPageSize: this.getNodeParameter('preferCSSPageSize', itemIndex) as boolean,
				scale: this.getNodeParameter('scale', itemIndex) as number,
				margin: this.getNodeParameter('margin', itemIndex, {}) as IDataObject,
			};
			if (pdfOptions.displayHeaderFooter) {
				pdfOptions.headerTemplate = this.getNodeParameter('headerTemplate', itemIndex) as string;
				pdfOptions.footerTemplate = this.getNodeParameter('footerTemplate', itemIndex) as string;
			}
			if (!pdfOptions.preferCSSPageSize) {
				pdfOptions.height = this.getNodeParameter('height', itemIndex) as string;
				pdfOptions.width = this.getNodeParameter('width', itemIndex) as string;
				if (!pdfOptions.height || !pdfOptions.width) {
					pdfOptions.format = this.getNodeParameter('format', itemIndex) as PaperFormat;
				}
			}
			if (options.fileName) pdfOptions.path = options.fileName as string;
			const pdf = await page.pdf(pdfOptions);
			const binaryData = await this.helpers.prepareBinaryData(Buffer.from(pdf), pdfOptions.path, 'application/pdf');
			resultData = [{ binary: { [dataPropertyName]: binaryData }, json: { url: url.toString() }, pairedItem: { item: itemIndex } }];
		}

		if (session) {
			resultData = resultData.map(item => ({
				...item,
				json: { ...item.json, pageId: session.pageId },
			}));
		}

		return resultData;
	} finally {
		if (!session && page && !page.isClosed()) {
			await page.close();
		}
	}
}

export class Puppeteer implements INodeType {
	description: INodeTypeDescription = nodeDescription;
	methods = {
		loadOptions: {
			async getDevices(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const deviceNames = Object.keys(devices);
				return deviceNames.map(name => {
					const device = devices[name as keyof typeof devices] as Device;
					return { name, value: name, description: `${device.viewport.width}x${device.viewport.height}` };
				});
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const operation = this.getNodeParameter('operation', 0, 'runCustomScript') as string;

		if (operation === 'startPersistentBrowser') {
			const sessionId = this.getNodeParameter('sessionId', 0) as string;
			const browserManagerUrl = this.getNodeParameter('browserManagerUrl', 0) as string;
			try {
				const response = await this.helpers.httpRequest({
					method: 'POST',
					url: browserManagerUrl + '/start',
					headers: { 'Content-Type': 'application/json' },
					body: { sessionId },
					json: true,
				}) as IDataObject;
				const sessionData: PuppeteerSessionData = {
					wsEndpoint: response.wsEndpoint as string,
					pageId: response.pageId as string,
					sessionId: response.sessionId as string,
					browserManagerUrl: browserManagerUrl,
				};
				this.getWorkflowStaticData('global').puppeteerSession = sessionData;
				return [this.helpers.returnJsonArray([sessionData as unknown as IDataObject])];
			} catch (error) {
				throw new NodeOperationError(this.getNode(), error as Error, { description: 'Failed to start browser session from manager.' });
			}
		}

		if (operation === 'stopPersistentBrowser') {
			let session = this.getWorkflowStaticData('global').puppeteerSession as PuppeteerSessionData | undefined;
			let sessionId: string | undefined = session?.sessionId;
			let browserManagerUrl: string | undefined = session?.browserManagerUrl;
			if (!session) {
				sessionId = this.getNodeParameter('stopSessionId', 0) as string;
				browserManagerUrl = this.getNodeParameter('stopBrowserManagerUrl', 0) as string;
			}
			if (!sessionId || !browserManagerUrl) {
				throw new NodeOperationError(this.getNode(), 'Could not find a session to stop. Provide a fallback Session ID or ensure a Start node ran.');
			}
			try {
				await this.helpers.httpRequest({
					method: 'POST',
					url: `${browserManagerUrl}/stop`,
					headers: { 'Content-Type': 'application/json' },
					body: { sessionId },
					json: true,
				});
				if (session) delete this.getWorkflowStaticData('global').puppeteerSession;
				return [this.helpers.returnJsonArray([{ message: 'Session stopped.' }])];
			} catch (error) {
				throw new NodeOperationError(this.getNode(), error as Error, { description: 'Failed to stop browser session.' });
			}
		}

		const items = this.getInputData();
		let browser: Browser;
		let session = this.getWorkflowStaticData('global').puppeteerSession as PuppeteerSessionData | undefined;
		let isManualSession = false;

		const options = this.getNodeParameter('options', 0, {}) as IDataObject;

		if (!session && options.manualSessionOverride === true) {
			isManualSession = true;
			const manualWsEndpoint = options.manualWsEndpoint as string;
			const manualPageId = options.manualPageId as string;
			if(!manualWsEndpoint || !manualPageId) throw new NodeOperationError(this.getNode(), 'For Manual Session Override, both WebSocket Endpoint and Page ID are required.');
			session = { wsEndpoint: manualWsEndpoint, pageId: manualPageId, sessionId: 'manual-override', browserManagerUrl: '' };
		}

		if (session) {
			try {
				browser = await puppeteer.connect({ browserWSEndpoint: session.wsEndpoint });
			} catch (error) {
				throw new NodeOperationError(this.getNode(), error as Error, { description: 'Failed to connect to persistent browser.' });
			}
		} else {
			const launchArgs = (options.launchArguments as { args: { arg: string }[] } | undefined)?.args?.map(a => a.arg) ?? [];
			if(options.addContainerArgs) {
				const missingArgs = CONTAINER_LAUNCH_ARGS.filter(arg => !launchArgs.includes(arg));
				if(missingArgs.length > 0) launchArgs.push(...missingArgs);
			}
			try {
				const headless = options.headless === false ? false : 'new';
				// @ts-ignore
				browser = await puppeteer.launch({ headless, args: launchArgs, executablePath: options.executablePath as string | undefined });
			} catch (error) {
				throw new NodeOperationError(this.getNode(), error as Error, { description: 'Failed to launch temporary browser.' });
			}
		}

		// --- CORRECTED ERROR HANDLING PATTERN ---
		const returnData: INodeExecutionData[] = [];
		try {
			for (let i = 0; i < items.length; i++) {
				try {
					const results = await runAction.call(this, i, browser, session);
					returnData.push(...results);
				} catch (error) {
					if (this.continueOnFail()) {
						returnData.push({
							json: { error: (error as Error).message },
							pairedItem: { item: i },
						});
						continue; // Move to the next item
					}
					// If not continuing on fail, re-throw to stop the node
					throw error;
				}
			}
		} finally {
			if (browser) {
				if (session && !isManualSession) {
					await browser.disconnect();
				} else if (session && isManualSession) {
					await browser.disconnect();
				} else {
					await browser.close();
				}
			}
		}

		return [returnData];
	}
}
