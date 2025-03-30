import { COLORS, CONFIGS } from "../constants";

export class ConfigParser {
    // 配置相关正则
    private static readonly formatRegex = /{(.+?)}/;
    private static readonly colorsRegex = /\[(.+?)\]/;
    private static readonly alignRegex = /^>(.+?)(?:,|$)$/;
    
    public static parseFormatConfigs(line: string): Map<string, string> {
        const formats = new Map<string, string>();
        
        if (this.formatRegex.test(line)) {
            const configs = line.replace("{", "").replace("}", "").split(",").map((l) => l.trim());
            for (const config of configs) {
                const [k, v] = config.split("=").map((c) => c.trim());
                if (Object.keys(CONFIGS).includes(k) && CONFIGS[k].includes(v)) {
                    formats.set(k, v);
                }
            }
        }
        
        return formats;
    }
    
    public static parseColorConfigs(line: string): Map<string, string> {
        const colors = new Map<string, string>();
        
        if (this.colorsRegex.test(line)) {
            const configs = line.replace("[", "").replace("]", "").split(",").map((l) => l.trim());
            for (const config of configs) {
                const [k, v] = config.split("=").map((c) => c.trim());
                if (k.length > 0 && COLORS.includes(v)) {
                    colors.set(k, v);
                }
            }
        }
        
        return colors;
    }
    
    public static parseAlignConfigs(line: string): string[] {
        const rightAlignHeaders: string[] = [];
        
        if (this.alignRegex.test(line)) {
            rightAlignHeaders.push(...line.substring(1).split(",").map((val) => val.trim()));
        }
        
        return rightAlignHeaders;
    }
    
    public static parseMetaConfigs(meta: any): Map<string, string> {
        const formatConfigs = new Map<string, string>();
        
        if (meta) {
            const maxWidth = meta["MaxWidth"];
            const headerConfig = meta["Header"];
            const modeConfig = meta["Mode"];
            
            if (CONFIGS["mw"].includes(maxWidth)) {
                formatConfigs.set("mw", maxWidth);
            }
            
            if (CONFIGS["header"].includes(headerConfig)) {
                formatConfigs.set("header", headerConfig);
            }
            
            if (CONFIGS["mode"].includes(modeConfig)) {
                formatConfigs.set("mode", modeConfig);
            }
        }
        
        return formatConfigs;
    }
} 