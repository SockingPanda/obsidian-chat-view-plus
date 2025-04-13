import { Component, MarkdownRenderer, setIcon } from "obsidian";
import { ChatBubbleOptions } from "../models/message";
import { ConfigParser } from "./config-parser";
import { 
    FORMAT_CONFIG_REGEX, 
    COLOR_CONFIG_REGEX, 
    MESSAGE_DIR_REGEX, 
    MESSAGE_END_REGEX, 
    TIME_COMMENT_REGEX,
    TIME_CLEANUP_REGEX,
    TITLE_CONFIG_REGEX,
    FOLDABLE_CONFIG_REGEX,
    parseHeaderAndTime
} from "../constants";

/**
 * Markdown Chat 解析器
 * 新的格式设计:
 * 
 * 1. 配置行仍然保持 {key=value} 和 [name=color] 格式
 * 2. 特殊配置: {title=聊天标题} - 用于在聊天块选择器中显示
 * 3. 聊天消息使用新格式:
 *    @left|@right|@center [name] [time]
 *    消息内容 (支持完整的 Markdown 格式)
 *    ___（三个下划线作为消息结束符）
 * 4. 带时间的注释: [time] 注释内容 - 注释内容居中，时间作为脚注放在右下角
 * 5. 普通注释: 非消息和非时间标记的文本，居中显示
 */
export class MarkdownChatParser {
    /**
     * 解析Markdown格式的聊天内容
     * 将原始文本解析为聊天气泡、注释和时间标记等组件
     * @param source 原始Markdown文本
     * @param element 用于渲染内容的HTML元素
     * @param sourcePath 源文件路径
     * @param renderCallback 渲染回调函数，用于生成聊天气泡
     * @param component Obsidian组件实例，用于Markdown渲染
     * @public
     * @static
     */
    public static parse(
        source: string,
        element: HTMLElement,
        sourcePath: string,
        renderCallback: (element: HTMLElement, options: ChatBubbleOptions) => void,
        component: Component
    ): void {
        // 创建一个包含整个聊天内容的容器
        const chatContainer = element.createDiv({
            cls: ["chat-view-container"]
        });
        
        // 提取标题，先解析配置
        const lines = source.split("\n");
        const formats = new Map<string, string>();
        const colors = new Map<string, string>();
        
        // 第一步：解析全局配置
        for (const line of lines) {
            const trimmedLine = line.trim();
            if (FORMAT_CONFIG_REGEX.test(trimmedLine)) {
                const lineFormats = ConfigParser.parseFormatConfigs(trimmedLine);
                lineFormats.forEach((v, k) => formats.set(k, v));
            } else if (COLOR_CONFIG_REGEX.test(trimmedLine)) {
                const lineColors = ConfigParser.parseColorConfigs(trimmedLine);
                lineColors.forEach((v, k) => colors.set(k, v));
            }
        }
        
        // 提取标题和是否可折叠的配置
        let chatTitle = "聊天";
        let isFoldable = true; // 默认可折叠
        
        for (const line of lines) {
            const trimmedLine = line.trim();
            
            // 检查格式配置行，查找标题和foldable配置
            if (FORMAT_CONFIG_REGEX.test(trimmedLine)) {
                const configContent = trimmedLine.replace(/^{|}$/g, "").trim();
                
                // 查找标题配置
                const titleMatch = configContent.match(TITLE_CONFIG_REGEX);
                if (titleMatch) {
                    chatTitle = titleMatch[1].trim();
                }
                
                // 查找可折叠配置
                const foldableMatch = configContent.match(FOLDABLE_CONFIG_REGEX);
                if (foldableMatch) {
                    isFoldable = foldableMatch[1].toLowerCase() === "true";
                }
            }
        }
        
        // 只有在配置为可折叠时才添加折叠按钮
        if (isFoldable) {
            // 添加折叠/展开按钮到聊天顶部
            const toggleButton = chatContainer.createDiv({
                cls: ["chat-view-toggle-button"]
            });
            
            // 添加展开/折叠图标
            const toggleIcon = toggleButton.createDiv({
                cls: ["chat-view-toggle-icon"]
            });
            
            // 在切换按钮中添加标题
            toggleButton.appendChild(document.createTextNode(` ${chatTitle}`));
            
            // 设置点击事件处理
            toggleButton.addEventListener("click", (e) => {
                // 阻止事件冒泡，避免触发代码块的其他操作
                e.stopPropagation();
                
                chatContainer.classList.toggle("chat-view-collapsed");
                // 更新图标，在展开和收起之间切换
                if (chatContainer.classList.contains("chat-view-collapsed")) {
                    toggleIcon.empty();
                    setIcon(toggleIcon, "chevron-right");
                } else {
                    toggleIcon.empty();
                    setIcon(toggleIcon, "chevron-down");
                }
            });
            
            // 初始状态设置为展开
            toggleIcon.empty();
            setIcon(toggleIcon, "chevron-down");
        } else {
            // 如果不可折叠，添加一个简单的标题栏
            const titleBar = chatContainer.createDiv({
                cls: ["chat-view-title-bar"]
            });
            titleBar.createSpan({
                text: chatTitle,
                cls: ["chat-view-title-text"]
            });
        }
        
        // 创建聊天内容容器，将所有聊天内容放在这个容器里
        const contentContainer = chatContainer.createDiv({
            cls: ["chat-view-content-container"]
        });
        
        // 如果设置为不可折叠，确保内容始终显示
        if (!isFoldable) {
            chatContainer.classList.add("chat-view-non-foldable");
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
            if (FORMAT_CONFIG_REGEX.test(line.trim()) || COLOR_CONFIG_REGEX.test(line.trim())) {
                continue;
            }
            
            // 消息开始行 @left|@right|@center [name] [time]
            if (!inMessage && MESSAGE_DIR_REGEX.test(line.trim())) {
                // 如果有积累的注释，先渲染注释
                if (commentContent.trim()) {
                    // 创建markdown渲染容器
                    const commentEl = contentContainer.createDiv({
                        cls: ["chat-view-comment", "markdown-rendered"]
                    });
                    
                    // 使用Obsidian的MarkdownRenderer渲染注释内容
                    try {
                        MarkdownRenderer.renderMarkdown(
                            commentContent, 
                            commentEl, 
                            sourcePath, 
                            component
                        );
                    } catch (e) {
                        commentEl.setText(commentContent);
                    }
                    
                    commentContent = "";
                }
                
                const match = line.trim().match(MESSAGE_DIR_REGEX);
                if (match) {
                    inMessage = true;
                    messageDir = match[1].toLowerCase();
                    
                    // 使用parseHeaderAndTime函数解析头部和时间
                    const { header, time } = parseHeaderAndTime(match[2].trim());
                    messageHeader = header;
                    messageTime = time;
                    
                    
                    messageContent = "";
                }
                continue;
            }
            
            // 消息结束标记
            if (inMessage && MESSAGE_END_REGEX.test(line.trim())) {
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
                
                
                renderCallback(contentContainer, options);
                
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
                const timeCommentMatch = line.match(TIME_COMMENT_REGEX);
                
                if (timeCommentMatch) {
                    // 如果有积累的普通注释，先渲染
                    if (commentContent.trim()) {
                        // 创建markdown渲染容器
                        const commentEl = contentContainer.createDiv({
                            cls: ["chat-view-comment", "markdown-rendered"]
                        });
                        
                        // 使用Obsidian的MarkdownRenderer渲染注释内容
                        try {
                            MarkdownRenderer.renderMarkdown(
                                commentContent, 
                                commentEl, 
                                sourcePath, 
                                component
                            );
                        } catch (e) {
                            commentEl.setText(commentContent);
                        }
                        
                        commentContent = "";
                    }
                    
                    // 提取时间和注释内容
                    const timeStr = timeCommentMatch[1].replace(TIME_CLEANUP_REGEX, "");
                    const commentText = timeCommentMatch[2];
                    
                    // 创建带时间的注释容器
                    const timeCommentContainer = contentContainer.createDiv({
                        cls: ["chat-view-time-comment-container"]
                    });
                    
                    // 添加注释内容，居中并且使用Markdown渲染
                    const centeredComment = timeCommentContainer.createDiv({
                        cls: ["chat-view-centered-comment", "markdown-rendered"]
                    });
                    
                    // 渲染Markdown内容
                    try {
                        MarkdownRenderer.renderMarkdown(
                            commentText, 
                            centeredComment, 
                            sourcePath, 
                            component
                        );
                    } catch (e) {
                        centeredComment.setText(commentText);
                    }
                    
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
            
            renderCallback(contentContainer, options);
        } else if (commentContent.trim()) {
            // 还有未渲染的注释
            // 创建markdown渲染容器
            const commentEl = contentContainer.createDiv({
                cls: ["chat-view-comment", "markdown-rendered"]
            });
            
            // 使用Obsidian的MarkdownRenderer渲染注释内容
            try {
                MarkdownRenderer.renderMarkdown(
                    commentContent, 
                    commentEl, 
                    sourcePath, 
                    component
                );
            } catch (e) {
                commentEl.setText(commentContent);
            }
        }
    }
} 