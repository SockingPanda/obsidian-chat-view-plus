import { Component } from "obsidian";
import { ChatBubbleOptions } from "../models/message";
import { ConfigParser } from "./config-parser";

/**
 * Markdown Chat 解析器
 * 新的格式设计:
 * 
 * 1. 配置行仍然保持 {key=value} 和 [name=color] 格式
 * 2. 聊天消息使用新格式:
 *    @left|@right|@center [name] [time]
 *    消息内容 (支持完整的 Markdown 格式)
 *    ___（三个下划线作为消息结束符）
 * 3. 带时间的注释: [time] 注释内容 - 注释内容居中，时间作为脚注放在右下角
 * 4. 普通注释: 非消息和非时间标记的文本，居中显示
 */
export class MarkdownChatParser {
    // 配置相关正则
    private static readonly formatConfigRegex = /^{(.+?)}$/;
    private static readonly colorConfigRegex = /^\[(.+?)]$/;

    // 消息相关正则
    private static readonly messageDirRegex = /^@(left|right|center)\s+(.*)$/i;
    private static readonly messageEndRegex = /^___+$/;  // 至少三个下划线
    
    // 带时间的注释正则，匹配 [time] 或 (time) 格式
    private static readonly timeCommentRegex = /^\s*(\[.+?\]|\(.+?\))\s+(.+)$/;

    public static parse(
        source: string,
        element: HTMLElement,
        sourcePath: string,
        renderCallback: (element: HTMLElement, options: ChatBubbleOptions) => void,
        component: Component
    ): void {
        const lines = source.split("\n");
        const formats = new Map<string, string>();
        const colors = new Map<string, string>();
        
        // 第一步：解析全局配置
        for (const line of lines) {
            const trimmedLine = line.trim();
            if (this.formatConfigRegex.test(trimmedLine)) {
                const lineFormats = ConfigParser.parseFormatConfigs(trimmedLine);
                lineFormats.forEach((v, k) => formats.set(k, v));
            } else if (this.colorConfigRegex.test(trimmedLine)) {
                const lineColors = ConfigParser.parseColorConfigs(trimmedLine);
                lineColors.forEach((v, k) => colors.set(k, v));
            }
        }
        
        // 第二步：处理消息和注释
        let inMessage = false;  // 是否在消息块内
        let messageDir = "";    // 消息方向
        let messageHeader = ""; // 消息头部（发送者）
        let messageTime = "";   // 消息时间
        let messageContent = ""; // 消息内容
        let commentContent = ""; // 注释内容
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trimEnd();  // 只去除行尾空白，保留开头缩进
            
            // 跳过配置行
            if (this.formatConfigRegex.test(line.trim()) || this.colorConfigRegex.test(line.trim())) {
                continue;
            }
            
            // 消息开始行 @left|@right|@center [name] [time]
            if (!inMessage && this.messageDirRegex.test(line.trim())) {
                // 如果有积累的注释，先渲染注释
                if (commentContent.trim()) {
                    element.createEl("div", {
                        text: commentContent, 
                        cls: ["chat-view-comment"]
                    });
                    commentContent = "";
                }
                
                const match = line.trim().match(this.messageDirRegex);
                if (match) {
                    inMessage = true;
                    messageDir = match[1].toLowerCase();
                    
                    // 解析剩余部分为头部和时间
                    const headerTimeParts = match[2].trim().split(/\s+(?=[[\(])/);
                    if (headerTimeParts.length > 0) {
                        messageHeader = headerTimeParts[0].trim();
                        
                        // 提取时间（如果存在）
                        if (headerTimeParts.length > 1) {
                            messageTime = headerTimeParts.slice(1).join(" ").trim();
                            // 移除时间中的中括号
                            messageTime = messageTime.replace(/^\[|\]$/g, "");
                        }
                    }
                    
                    messageContent = "";
                }
                continue;
            }
            
            // 消息结束标记
            if (inMessage && this.messageEndRegex.test(line.trim())) {
                // 渲染消息
                const align = messageDir === "left" ? "left" : 
                              messageDir === "right" ? "right" : "center";
                
                const options: ChatBubbleOptions = {
                    header: messageHeader,
                    prevHeader: "",  // 不使用续发消息功能
                    message: messageContent,
                    subtext: messageTime,
                    align: align,
                    continued: false,
                    colorConfigs: colors,
                    formatConfigs: formats,
                    sourcePath: sourcePath,
                    component: component
                };
                
                renderCallback(element, options);
                
                // 重置状态
                inMessage = false;
                messageDir = "";
                messageHeader = "";
                messageTime = "";
                messageContent = "";
                continue;
            }
            
            // 处理消息内容
            if (inMessage) {
                // 在消息内容中保留行的原始格式，包括缩进
                if (messageContent) {
                    messageContent += "\n" + line;
                } else {
                    messageContent = line;
                }
            } else {
                // 检查是否是带时间的注释行
                const timeCommentMatch = line.match(this.timeCommentRegex);
                
                if (timeCommentMatch) {
                    // 如果有积累的普通注释，先渲染
                    if (commentContent.trim()) {
                        element.createEl("div", {
                            text: commentContent, 
                            cls: ["chat-view-comment"]
                        });
                        commentContent = "";
                    }
                    
                    // 提取时间和注释内容
                    const timeStr = timeCommentMatch[1].replace(/^\[|\]$|\(|\)$/g, "");
                    const commentText = timeCommentMatch[2];
                    
                    // 创建带时间的注释容器
                    const timeCommentContainer = element.createDiv({
                        cls: ["chat-view-time-comment-container"]
                    });
                    
                    // 添加注释内容，居中
                    timeCommentContainer.createDiv({
                        text: commentText,
                        cls: ["chat-view-centered-comment"]
                    });
                    
                    // 添加时间作为脚注，右下角对齐
                    timeCommentContainer.createEl("span", {
                        text: timeStr,
                        cls: ["chat-view-time-footnote"]
                    });
                } else if (line.trim()) {  // 普通非空注释行
                    if (commentContent) {
                        commentContent += "\n" + line;
                    } else {
                        commentContent = line;
                    }
                }
            }
        }
        
        // 处理文档结束时未结束的消息或注释
        if (inMessage && messageContent.trim()) {
            // 还有未完成的消息
            const align = messageDir === "left" ? "left" : 
                          messageDir === "right" ? "right" : "center";
            
            const options: ChatBubbleOptions = {
                header: messageHeader,
                prevHeader: "",
                message: messageContent,
                subtext: messageTime,
                align: align,
                continued: false,
                colorConfigs: colors,
                formatConfigs: formats,
                sourcePath: sourcePath,
                component: component
            };
            
            renderCallback(element, options);
        } else if (commentContent.trim()) {
            // 还有未渲染的注释
            element.createEl("div", {
                text: commentContent, 
                cls: ["chat-view-comment"]
            });
        }
    }
} 