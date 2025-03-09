import OneStepWikiLinkPlugin from "src/main";
import { App, PluginSettingTab, Setting, View, WorkspaceLeaf } from "obsidian";
import { Language } from "src/main";

export class OneStepWikiLinkPluginSettingTab extends PluginSettingTab {
    plugin: OneStepWikiLinkPlugin;

    labels = {
        details: {
            name: {
                [Language.CN]: "详情开关",
                [Language.EN]: "Details Switch"
            },
            desc: {
                [Language.CN]: "是否显示所有匹配的内容",
                [Language.EN]: "Whether to display all matching content"
            }
        },
        autoConvert: {
            name: {
                [Language.CN]: "自动转换开关",
                [Language.EN]: "Auto Convert Switch"
            },
            desc: {
                [Language.CN]: "是否自动转换所有匹配的内容",
                [Language.EN]: "Whether to automatically convert all matching content"
            }
        },
        autoConvertDelay: {
            name: {
                [Language.CN]: "自动转换延迟",
                [Language.EN]: "Auto Convert Delay"
            },
            desc: {
                [Language.CN]: "自动转换延迟，单位为毫秒",
                [Language.EN]: "Auto Convert Delay, in milliseconds"
            }
        },
        NonBoundaryCheckers: {
            name: {
                [Language.CN]: "非边界字符",
                [Language.EN]: "Non-Boundary Characters"
            },
            desc: {
                [Language.CN]: "用于检测没有边界的字符，如汉字，以 `，` 或 `,` 分隔，值为正则表达式的 `Script=Han` 形式中的 Han 部分",
                [Language.EN]: "Used to detect characters without boundaries, such as Chinese characters, separated by `，` or `,` , and the `Script=Han` part of the regular expression"
            }
        },
        excludes: {
            name: {
                [Language.CN]: "排除列表",
                [Language.EN]: "Exclude List"
            },
            desc: {
                [Language.CN]: "不检测排除列表中的文件，以 `，` 或 `,` 分隔，不带后缀，排除文件夹需要输入文件夹的相对路径并以 `/` 结尾",
                [Language.EN]: "Do not check files in the exclude list, separated by `，` or `,`, without suffix, exclude folders need to enter the relative path of the folder and end with `/`"
            }
        }
    };

    settings: {
        key: {
            name: {
                CN: string;
                EN: string;
            };
            desc: {
                CN: string;
                EN: string;
            };
        }; value: Setting;
    }[] = [];

    constructor(app: App, plugin: OneStepWikiLinkPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        let { containerEl } = this;

        this.settings = [];
        containerEl.empty();

        new Setting(containerEl)
            .setName("语言 Language")
            .setDesc("选择语言 Choose language")
            .addDropdown((dropdown) =>
                dropdown
                    .addOption("CN", "CN")
                    .addOption("EN", "EN")
                    .setValue(this.plugin.settings.language)
                    .onChange(async (value) => {
                        this.plugin.settings.language = value as Language;
                        await this.plugin.saveSettings();

                        this.updateLanguage();
                    })
            );

        this.settings.push(
            {
                key: this.labels.details,
                value: new Setting(containerEl)
                    .setName(this.labels.details.name[this.plugin.settings.language])
                    .setDesc(this.labels.details.desc[this.plugin.settings.language])
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
                    .setName(this.labels.autoConvert.name[this.plugin.settings.language])
                    .setDesc(this.labels.autoConvert.desc[this.plugin.settings.language])
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
                    .setName(this.labels.autoConvertDelay.name[this.plugin.settings.language])
                    .setDesc(this.labels.autoConvertDelay.desc[this.plugin.settings.language])
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
                    .setName(this.labels.NonBoundaryCheckers.name[this.plugin.settings.language])
                    .setDesc(this.labels.NonBoundaryCheckers.desc[this.plugin.settings.language])
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
                    .setName(this.labels.excludes.name[this.plugin.settings.language])
                    .setDesc(this.labels.excludes.desc[this.plugin.settings.language])
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
        for (let setting of this.settings) {
            setting.value.setName(setting.key.name[this.plugin.settings.language]);
            setting.value.setDesc(setting.key.desc[this.plugin.settings.language]);
        }
    }
}