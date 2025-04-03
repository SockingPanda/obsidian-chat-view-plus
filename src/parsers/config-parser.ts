import { COLORS, CONFIGS } from "../constants";

/**
 * 配置解析器类
 * 负责解析聊天视图中的各种配置格式
 * 支持格式配置、颜色配置、对齐配置和元数据配置
 */
export class ConfigParser {
    // 配置相关正则
    private static readonly formatRegex = /{(.+?)}/;
    private static readonly colorsRegex = /\[(.+?)\]/;
    private static readonly alignRegex = /^>(.+?)(?:,|$)$/;
    
    /**
     * 解析格式配置
     * 从文本行中提取{key=value}格式的配置项
     * @param line 包含格式配置的文本行
     * @returns Map<string, string> 解析后的格式配置映射
     * @public
     * @static
     */
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
    
    /**
     * 解析颜色配置
     * 从文本行中提取[name=color]格式的颜色配置
     * @param line 包含颜色配置的文本行
     * @returns Map<string, string> 解析后的颜色配置映射
     * @public
     * @static
     */
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
    
    /**
     * 解析对齐配置
     * 从文本行中提取>name格式的右对齐标头配置
     * @param line 包含对齐配置的文本行
     * @returns string[] 右对齐的标头名称数组
     * @public
     * @static
     */
    public static parseAlignConfigs(line: string): string[] {
        const rightAlignHeaders: string[] = [];
        
        if (this.alignRegex.test(line)) {
            rightAlignHeaders.push(...line.substring(1).split(",").map((val) => val.trim()));
        }
        
        return rightAlignHeaders;
    }
    
    /**
     * 解析元数据配置
     * 从元数据对象中提取最大宽度、标头和模式等配置
     * @param meta 包含配置的元数据对象
     * @returns Map<string, string> 解析后的元数据配置映射
     * @public
     * @static
     */
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