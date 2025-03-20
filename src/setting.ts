import OneStepWikiLinkPlugin from "src/main";
import { App, PluginSettingTab, Setting } from "obsidian";
import { Localization } from "./localization";

interface LabelDictionary {
    [key: string]: string; // 任意字符串键，对应的值必须是字符串
}

interface LabelEntry {
    name: LabelDictionary;
    desc: LabelDictionary;
}


export class OneStepWikiLinkPluginSettingTab extends PluginSettingTab {
    plugin: OneStepWikiLinkPlugin;

    labels: Record<string, LabelEntry> = {
        details: {
            name: {
                "zh": "详情开关",
                "en": "Details switch"
            },
            desc: {
                "zh": "是否显示所有匹配的内容",
                "en": "Whether to display all matching content"
            }
        },
        autoConvert: {
            name: {
                "zh": "自动转换开关",
                "en": "Auto convert switch"
            },
            desc: {
                "zh": "是否自动转换所有匹配的内容",
                "en": "Whether to automatically convert all matching content"
            }
        },
        autoConvertDelay: {
            name: {
                "zh": "自动转换延迟",
                "en": "Auto convert delay"
            },
            desc: {
                "zh": "自动转换延迟，单位为毫秒",
                "en": "Auto convert delay, in milliseconds"
            }
        },
        NonBoundaryCheckers: {
            name: {
                "zh": "非边界字符",
                "en": "Non-boundary characters"
            },
            desc: {
                "zh": "用于检测没有边界的字符，如汉字，以 `，` 或 `,` 分隔，值为正则表达式的 `Script=Han` 形式中的 Han 部分",
                "en": "Used to detect characters without boundaries, such as chinese characters, separated by `，` or `,` , and the `Script=Han` part of the regular expression"
            }
        },
        excludes: {
            name: {
                "zh": "排除列表",
                "en": "Exclude list"
            },
            desc: {
                "zh": "不检测排除列表中的文件，以 `，` 或 `,` 分隔，不带后缀，排除文件夹需要输入文件夹的相对路径并以 `/` 结尾",
                "en": "Do not check files in the exclude list, separated by `，` or `,`, without suffix, exclude folders need to enter the relative path of the folder and end with `/`"
            }
        }
    };

    settings: {
        key: LabelEntry;
        value: Setting;
    }[] = [];

    constructor(app: App, plugin: OneStepWikiLinkPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        let { containerEl } = this;

        this.settings = [];
        containerEl.empty();

        let language = Localization.getLang();

        this.settings.push(
            {
                key: this.labels.details,
                value: new Setting(containerEl)
                    .setName(this.labels.details.name[language])
                    .setDesc(this.labels.details.desc[language])
                    .addToggle((toggle) =>
                        toggle
                            .setValue(this.plugin.settings.showDetails)
                            .onChange(async (value) => {
                                this.plugin.settings.showDetails = value;
                                await this.plugin.saveSettings();
                            })
                    )
            }
        )

        this.settings.push(
            {
                key: this.labels.autoConvert,
                value: new Setting(containerEl)
                    .setName(this.labels.autoConvert.name[language])
                    .setDesc(this.labels.autoConvert.desc[language])
                    .addToggle((toggle) =>
                        toggle
                            .setValue(this.plugin.settings.autoConvert)
                            .onChange(async (value) => {
                                this.plugin.settings.autoConvert = value;
                                await this.plugin.saveSettings();
                                if (value) {
                                    this.settings[2].value.settingEl.removeClass("setting-hide");
                                } else {
                                    this.settings[2].value.settingEl.addClass("setting-hide");
                                }
                            })
                    )
            }
        )

        this.settings.push(
            {
                key: this.labels.autoConvertDelay,
                value: new Setting(containerEl)
                    .setName(this.labels.autoConvertDelay.name[language])
                    .setDesc(this.labels.autoConvertDelay.desc[language])
                    .addText((text) => {
                        text.inputEl.type = "number";
                        text
                            .setValue(this.plugin.settings.autoConvertDelay.toString())
                            .onChange(async (value) => {
                                this.plugin.settings.autoConvertDelay = Number(value);
                                await this.plugin.saveSettings();
                            })
                    })
            }
        );

        if (this.plugin.settings.autoConvert) {
            this.settings[2].value.settingEl.removeClass("setting-hide");
        } else {
            this.settings[2].value.settingEl.addClass("setting-hide");
        }


        this.settings.push(
            {
                key: this.labels.NonBoundaryCheckers,
                value: new Setting(containerEl)
                    .setName(this.labels.NonBoundaryCheckers.name[language])
                    .setDesc(this.labels.NonBoundaryCheckers.desc[language])
            }
        );

        let boundaryInput = containerEl.createDiv({ cls: "one-step-wikilink-setting-exclude-busyo" });
        boundaryInput.contentEditable = "plaintext-only";
        boundaryInput.textContent = this.plugin.settings.NonBoundaryCheckers.join(",");

        boundaryInput.addEventListener('input', async () => {
            this.plugin.settings.NonBoundaryCheckers = (boundaryInput.textContent as string).replace("，", ",").split(",").filter(keyword => keyword !== "");
            await this.plugin.saveSettings();
        });

        this.settings.push(
            {
                key: this.labels.excludes,
                value: new Setting(containerEl)
                    .setName(this.labels.excludes.name[language])
                    .setDesc(this.labels.excludes.desc[language])
            }
        );

        let excludeInput = containerEl.createDiv({ cls: "one-step-wikilink-setting-exclude-busyo" });
        excludeInput.contentEditable = "plaintext-only";
        excludeInput.textContent = this.plugin.settings.excludes.join(",");

        excludeInput.addEventListener('input', async () => {
            this.plugin.settings.excludes = (excludeInput.textContent as string).replace("，", ",").split(",").filter(keyword => keyword !== "");
            await this.plugin.saveSettings();
        });
    }

    updateLanguage() {
        let language = Localization.getLang();
        for (let setting of this.settings) {
            setting.value.setName(setting.key.name[language]);
            setting.value.setDesc(setting.key.desc[language]);
        }
    }
}