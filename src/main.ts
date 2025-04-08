import { Editor, EditorPosition, MarkdownView, normalizePath, Plugin, TFile } from "obsidian";
import { OneStepWikiLinkPluginSettingTab } from "./setting";
import { Localization } from "./localization";
import { start } from "repl";


interface OneStepWikiLinkPluginSettings {
	showDetails: boolean;
	autoConvert: boolean;
	autoConvertDelay: number;
	NonBoundaryCheckers: string[];
	excludes: string[];
}

const DEFAULT_SETTINGS: OneStepWikiLinkPluginSettings = {
	showDetails: true,
	autoConvert: false,
	autoConvertDelay: 500,
	NonBoundaryCheckers: ["Han", "Hiragana", "Katakana", "Hangul"],
	excludes: []
}

interface LabelDictionary {
	[key: string]: string; // 任意字符串键，对应的值必须是字符串
}

export default class OneStepWikiLinkPlugin extends Plugin {

	settings: OneStepWikiLinkPluginSettings;

	// ----- 私有变量 -----

	fileNameList: string[] = [];

	currentFileName: string = "";

	btnOneStep: HTMLDivElement | undefined;

	divForDetails: HTMLDivElement | undefined;

	openEditor: Editor | undefined;

	matchingFiles: string[] = [];

	labels: Record<string, LabelDictionary> = {
		btnOneStep: {
			"zh": "全部转换为维基链接",
			"en": "Convert All to Wiki Links"
		}
	}

	autoTimer: number;

	async onload() {
		await this.loadSettings();

		this.addSettingTab(new OneStepWikiLinkPluginSettingTab(this.app, this));

		this.app.workspace.onLayoutReady(() => {
			this.init();
		});
	}

	onunload() {
		this.btnOneStep?.remove();
		this.divForDetails?.remove();
	}

	async init() {
		//初始化文件名列表
		this.getAllFileNames();

		//获取当前编辑器
		this.openEditor = this.app.workspace.getActiveViewOfType(MarkdownView)?.editor;

		//初始化按钮
		let outlinkPanel = this.app.workspace.getLeavesOfType("outgoing-link")[0];
		if (outlinkPanel && !this.btnOneStep) {
			this.createButton(outlinkPanel.view.containerEl);
			if (!this.openEditor) {
				this.btnOneStep && (this.btnOneStep as HTMLDivElement).addClass("hide");
				this.divForDetails && (this.divForDetails as HTMLDivElement).addClass("hide");
			}
		}

		this.registerEvent(this.app.workspace.on("active-leaf-change", (leaf) => {

			//监听页面变化，防止出链界面关闭后再打开按钮消失
			let outlinkPanel = this.app.workspace.getLeavesOfType("outgoing-link")[0];

			if (outlinkPanel) {
				if (!this.btnOneStep) {
					this.createButton(outlinkPanel.view.containerEl);
				}
			} else {
				this.btnOneStep = undefined;
			}

			let type = leaf?.view.getViewType();
			if (leaf) {
				//监听当前激活的编辑器
				if (type === "markdown") {
					this.openEditor = leaf.view.app.workspace.activeEditor?.editor;
					// console.log(this.openEditor);
					if (this.openEditor) {
						this.currentFileName = ((leaf.view as MarkdownView).file as TFile).basename;
						// console.log((leaf.view as MarkdownView).file?.basename);
						this.checkContent(this.openEditor.getValue());
					}
				} else if (type == "empty") {
					this.btnOneStep?.addClass("hide");
					this.divForDetails?.addClass("hide");
				}
			}
		}));


		let file = this.app.workspace.getActiveFile();
		this.openEditor = this.app.workspace.getActiveViewOfType(MarkdownView)?.editor;

		if (file && this.openEditor) {
			if (file instanceof TFile) {
				this.currentFileName = file.basename;
				let content = await this.app.vault.read(file);
				this.checkContent(content);
			}
		}

		this.addCommand({
			id: "convert-all-matching-words-to-wiki-links",
			name: "Convert all matching words to wiki links",
			// hotkeys: [{
			// 	modifiers: ['Mod'],
			// 	key: 'r'
			// }],
			editorCallback: (editor) => {
				this.convert2WikiLink();
			}
		});

		this.addCommand({
			id: "convert-all-matching-words-to-wiki-links-zh",
			name: "转换所有匹配的文本为维基链接",
			// hotkeys: [{
			// 	modifiers: ['Mod'],
			// 	key: 'r'
			// }],
			editorCallback: (editor) => {
				this.convert2WikiLink();
			}
		});


		//监听文本变化
		this.registerEvent(this.app.workspace.on("editor-change", async (file, data) => {
			// console.log(file, data);
			if (file && data.file instanceof TFile) {
				this.currentFileName = data.file.basename;
				this.checkContent(file.getValue());
			}
		}));

		this.registerEvent(this.app.vault.on("rename", (file, oldPath) => {
			if (file && file instanceof TFile) {
				let fileName = oldPath.substring(oldPath.lastIndexOf('/') + 1).replace(".md", "");
				this.updateFileNameList(file.basename, true, fileName);
			}
		}));

		this.registerEvent(this.app.vault.on("delete", (file) => {
			if (file && file instanceof TFile) {
				this.updateFileNameList(file.basename, false);
			}
		}));

		this.registerDomEvent(document.body, "input", () => {
			this.autoTimer && window.clearTimeout(this.autoTimer);
			this.autoTimer = window.setTimeout(() => {
				this.autoConvert2WikiLink();
			}, this.settings.autoConvertDelay);
		});
	}

	getAllFileNames() {
		this.fileNameList = [];

		let files = this.app.vault.getMarkdownFiles();
		for (let file of files) {

			let checkFileName = this.settings.excludes.includes(file.basename);
			let checkFilePath;
			for (let exclude of this.settings.excludes) {
				let normalizedPath = normalizePath(file.path);
				let dirname = normalizedPath.substring(0, normalizedPath.lastIndexOf('/'));
				let filePath = dirname + "/";
				if (exclude.endsWith("/") && filePath.startsWith(exclude)) {
					checkFilePath = true;
					break;
				}
			}

			if (checkFileName || checkFilePath) {
				continue;
			}

			this.fileNameList.push(file.basename);
		}

		this.fileNameList.sort((a, b) => a.length > b.length ? -1 : 1);
	}

	updateFileNameList(name: string, add: boolean, extra: string = "") {

		if (add) {
			let index = this.fileNameList.indexOf(extra);
			if (index >= 0) {
				this.fileNameList[index] = name;
			} else {
				this.fileNameList.push(name);
			}
		} else {
			this.fileNameList.splice(this.fileNameList.indexOf(name), 1);
		}
	}

	checkContent(data: string) {

		this.matchingFiles = [];

		if (this.divForDetails) {
			this.divForDetails.empty();
		}

		let contentWithoutLinks = data.replace(/\[\[([^\[\]]+)\]\]/g, "");

		this.fileNameList.forEach(fileName => {

			let regex = new RegExp(`${fileName}\\b`, "g");
			//检测字符串最后一个字符是否为有边界的语言
			if (this.isNonBoundaryChar(fileName.charAt(fileName.length - 1))) {
				regex = new RegExp(`${fileName}`, "g");
			}

			const newContent = contentWithoutLinks.replace(regex, "");
			// 排除当前文件
			if (fileName !== this.currentFileName && newContent !== contentWithoutLinks) {
				this.matchingFiles.push(fileName);

				//添加详情
				if (this.divForDetails) {
					this.divForDetails.createDiv({
						cls: "one-step-wikilink-detail-busyo",
						text: fileName
					});
				}

				contentWithoutLinks = newContent;
			}
		});

		this.matchingFiles.sort((a, b) => a.length > b.length ? -1 : 1);

		if (this.matchingFiles.length > 0) {
			this.btnOneStep?.removeClass("hide");
			this.settings.showDetails && this.divForDetails?.removeClass("hide");
		} else {
			this.btnOneStep?.addClass("hide");
			this.divForDetails?.addClass("hide");
		}
	}

	autoConvert2WikiLink() {
		if (this.settings.autoConvert) {
			this.btnOneStep?.addClass("hide");
			this.divForDetails?.addClass("hide");
			this.convert2WikiLink();
		}
	}

	/** 转换所有匹配项为维基链接 */
	convert2WikiLink() {
		if (this.openEditor) {
			let data = this.openEditor.getValue();

			let rawChanges: { start: number; end: number; change: { from: EditorPosition, to: EditorPosition, text: string } }[] = [];
			let changes = [];

			for (const match of this.matchingFiles) {
				let regex = new RegExp(`(?<!\\[\\[)${match}\\b(?!\\]\\])`, "g");
				//检测字符串最后一个字符是否为有边界的语言
				if (this.isNonBoundaryChar(match.charAt(match.length - 1))) {
					regex = new RegExp(`(?<!\\[\\[)${match}(?!\\]\\])`, "g");
				}

				let res
				while ((res = regex.exec(data)) !== null) {

					let pos = this.openEditor.offsetToPos(res.index);
					let endPos = { ch: pos.ch + match.length, line: pos.line };

					rawChanges.push({
						start: res.index,
						end: res.index + match.length,
						change: {
							from: pos,
							to: endPos,
							text: `[[${match}]]`
						}
					});
				}
			}

			rawChanges.sort((a, b) => a.start - b.start);

			let endIndex = -1;
			for (let raw of rawChanges) {
				if (raw.start >= endIndex) {
					changes.push(raw.change);
					endIndex = raw.end;
				}
			}

			this.openEditor.transaction({ changes: changes });
		}
	}

	// 判断字符是否属于有边界的语言（如英文、法文等）
	isNonBoundaryChar(char: string) {
		if (this.settings.NonBoundaryCheckers.length === 0) return false;

		let checkers = this.settings.NonBoundaryCheckers
			.map(checker => `\\p{Script=${checker}}`)  // 生成 Unicode Script 规则
			.join("|");  // 以 | 分隔

		return new RegExp(checkers, "u").test(char);
	}

	createButton(root: Element) {
		let language = Localization.getLang();

		let container = root.querySelector(".outgoing-link-pane");
		if (container) {
			this.btnOneStep = container.createDiv({
				cls: "one-step-wikilink-container-busyo",
				text: this.labels.btnOneStep[language]
			});
			container.insertBefore(this.btnOneStep, container.firstChild);

			this.btnOneStep.onclick = () => {
				this.convert2WikiLink();
			};

			this.divForDetails = container.createDiv({
				cls: "one-step-wikilink-detail-container-busyo"
			});

			container.insertBefore(this.divForDetails, container.firstChild);

			if (!this.settings.showDetails) {
				this.divForDetails.addClass("hide");
			}
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);

		//保存配置的时候检测是否需要显示目标 Div
		if (this.matchingFiles.length > 0) {
			// !this.settings.showDetails && this.divForDetails?.removeClass("hide");
			if (this.settings.showDetails) {
				this.divForDetails?.removeClass("hide");
			} else {
				this.divForDetails?.addClass("hide");
			}
		} else {
			this.divForDetails?.addClass("hide");
		}

		//更新文件列表
		this.getAllFileNames();
		if (this.openEditor) {
			this.checkContent(this.openEditor.getValue());
		}
	}
}
