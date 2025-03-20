import { getLanguage } from "obsidian";


export class Localization {
    static language: string = 'zh';

    static pool: string[] = [
        'en',
        'zh'
    ]

    public static getLang() {
        let lang = getLanguage();
        if (this.pool.contains(lang)) {
            return lang;
        }
        return 'en';
    }
}