/**
 * 定义所有聊天解析相关的正则表达式模式
 * 将它们统一放在一个文件中，确保各个解析器、渲染器使用一致的模式
 */

// 配置相关正则
export const FORMAT_CONFIG_REGEX = /^{(.+?)}$/;
export const COLOR_CONFIG_REGEX = /^\[([^[\]]+?=[^[\]]+?(?:,[^[\]]+?=[^[\]]+?)*)]\s*$/;
export const TITLE_CONFIG_REGEX = /{title=([^}]+)}/;

// 消息相关正则
export const MESSAGE_DIR_REGEX = /^@(left|right|center)\s+(.*)$/i;
export const MESSAGE_END_REGEX = /^___+$/;  // 至少三个下划线

// 带时间的注释正则，匹配 [time] 或 (time) 格式
export const TIME_COMMENT_REGEX = /^\s*(\[.+?\]|\(.+?\))\s+(.+)$/;

// 头部和时间解析正则 - 用于提取时间信息
// 匹配格式：
// 1. "Name [2023-04-01]" - 普通中括号时间格式
// 2. "Name (2023-04-01)" - 普通小括号时间格式
// 3. "Name [2023-04-01 19:22:26]" - 带时间的格式
// 更加宽松的模式，匹配任何可能的时间括号格式
export const HEADER_TIME_REGEX = /^(.*?)(?:\s+\[([\s\S]*?)\]|\s+\(([\s\S]*?)\))$/;

// 时间格式清理正则 - 用于移除时间中的括号
export const TIME_CLEANUP_REGEX = /^\[|\]$|\(|\)$/g;

/**
 * 解析消息头部和时间
 * @param text 包含头部和可能时间的文本
 * @returns 包含解析后的头部和时间的对象
 */
export function parseHeaderAndTime(text: string): { header: string; time: string } {
    if (!text || text.trim() === "") {
        return { header: "", time: "" };
    }
    
    let header = text.trim();
    let time = "";
    
    // 提取最后一个方括号或小括号作为时间
    const bracketMatch = header.match(/^(.*?)(?:\s+(\[\d{4}-\d{2}-\d{2}[\s\d:]*\]|\(\d{4}-\d{2}-\d{2}[\s\d:]*\)))$/);
    if (bracketMatch) {
        header = bracketMatch[1].trim();
        const rawTime = bracketMatch[2];
        
        // 移除括号
        time = rawTime.replace(TIME_CLEANUP_REGEX, "");
        
        return { header, time };
    }
    
    // 尝试匹配最后的中括号或小括号作为时间（通用格式）
    const generalMatch = header.match(/^(.*?)\s+(\[[\s\S]*?\]|\([\s\S]*?\))$/);
    if (generalMatch) {
        header = generalMatch[1].trim();
        const rawTime = generalMatch[2];
        time = rawTime.replace(TIME_CLEANUP_REGEX, "");
        
        return { header, time };
    }
    
    // 作为备用，使用正则表达式提取头部和时间
    const match = header.match(HEADER_TIME_REGEX);
    if (match) {
        header = match[1].trim();
        // 时间可能在[]或()中，分别对应match[2]或match[3]
        time = (match[2] || match[3] || "").trim();
    }
    
    return { header, time };
} 