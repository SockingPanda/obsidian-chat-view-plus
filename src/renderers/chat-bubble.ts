import { MarkdownRenderer, Platform, Component, App, setIcon, TFile, HoverParent, HoverPopover } from "obsidian";
import { ChatBubbleOptions } from "../models/message";
import { HEADER_TIME_REGEX, TIME_CLEANUP_REGEX, parseHeaderAndTime } from "../constants";

/**
 * 聊天气泡渲染器
 * 负责将消息数据渲染为聊天气泡界面组件
 * 支持不同对齐方式、颜色主题和特殊内容格式
 */
export class ChatBubbleRenderer {
    /**
     * 渲染聊天气泡
     * 根据提供的选项创建并样式化聊天气泡组件
     * @param element 用于渲染的父HTML元素
     * @param options 气泡渲染选项，包含内容、样式和元数据
     * @public
     * @static
     */
    public static render(element: HTMLElement, options: ChatBubbleOptions): void {
        const {
            header,
            prevHeader,
            message,
            subtext,
            align,
            continued,
            colorConfigs,
            formatConfigs,
            sourcePath,
            component
        } = options;

        const marginClass = continued ? "chat-view-small-vertical-margin" : "chat-view-default-vertical-margin";
        const colorConfigClass = `chat-view-${colorConfigs.get(continued ? prevHeader : header)}`;
        const widthClass = formatConfigs.has("mw") ?
            `chat-view-max-width-${formatConfigs.get("mw")}`
            : (Platform.isMobile ? "chat-view-mobile-width" : "chat-view-desktop-width");
        const modeClass = `chat-view-bubble-mode-${formatConfigs.has("mode") ? formatConfigs.get("mode") : "default"}`;
        const headerEl: keyof HTMLElementTagNameMap = formatConfigs.has("header") ?
            formatConfigs.get("header") as keyof HTMLElementTagNameMap :
            "h4";
            
        const bubble = element.createDiv({
            cls: ["chat-view-bubble", `chat-view-align-${align}`, marginClass, colorConfigClass, widthClass, modeClass]
        });
        
        if (header.length > 0) {
            bubble.createEl(headerEl, {text: header, cls: ["chat-view-header"]});
        }
        
        if (message.length > 0) {
            const messageContainer = bubble.createDiv({
                cls: ["chat-view-message-container", "markdown-rendered"]
            });
            
            // 使用MarkdownRenderer渲染Markdown内容
            MarkdownRenderer.renderMarkdown(
                message, 
                messageContainer, 
                sourcePath, 
                component
            );
            
            // 检查是否启用链接和嵌入处理
            const enableLinkEmbeds = formatConfigs.has("linkEmbeds") && formatConfigs.get("linkEmbeds") === "true";
            
            // 处理嵌入内容和链接
            if (enableLinkEmbeds && 'app' in component) {
                const app = (component as any).app as App;
                this.processEmbeds(messageContainer, sourcePath, component, app);
                this.processLinks(messageContainer, sourcePath, app);
            }
        }
        
        // 始终显示时间信息，如果没有提供时间则使用当前时间
        let timeToShow = subtext && subtext.length > 0 
            ? subtext 
            : window.moment().format("YYYY-MM-DD HH:mm:ss");
        
        // 确保时间格式正确 - 移除可能存在的括号
        if (timeToShow) {
            timeToShow = timeToShow.replace(TIME_CLEANUP_REGEX, "");
        }
            
        const subtextEl = bubble.createEl("sub", {
            text: timeToShow, 
            cls: ["chat-view-subtext"]
        });
        
        subtextEl.style.display = "block";
        subtextEl.style.marginTop = "4px";
    }
    
    /**
     * 处理嵌入内容
     * 渲染消息中嵌入的图片、笔记等内容
     * @param element 包含嵌入内容的HTML元素
     * @param sourcePath 源文件路径
     * @param component Obsidian组件实例
     * @param app Obsidian应用实例
     * @private
     * @static
     */
    private static processEmbeds(element: HTMLElement, sourcePath: string, component: Component, app: App): void {
        // 处理图片嵌入 ![[image.png]]
        const imageEmbeds = element.querySelectorAll(".internal-embed[src$='.png'], .internal-embed[src$='.jpg'], .internal-embed[src$='.jpeg'], .internal-embed[src$='.gif'], .internal-embed[src$='.svg'], .internal-embed[src$='.webp']");
        
        imageEmbeds.forEach((embed) => {
            const src = embed.getAttribute("src");
            if (src) {
                // 创建图片元素
                const img = document.createElement("img");
                img.classList.add("chat-view-embedded-image");
                
                // 使用Obsidian的路径解析机制获取真实路径
                const linkpath = src.replace(/\.md$/, "");
                const resolvedFile = app.metadataCache.getFirstLinkpathDest(linkpath, sourcePath);
                
                if (resolvedFile) {
                    // 如果找到文件，使用vault适配器获取资源路径
                    img.src = app.vault.adapter.getResourcePath(resolvedFile.path);
                } else {
                    // 尝试直接使用路径（可能是外部链接或相对路径）
                    const basePath = sourcePath.substring(0, sourcePath.lastIndexOf('/') + 1);
                    const imgPath = src.startsWith('/') ? src : basePath + src;
                    img.src = app.vault.adapter.getResourcePath(imgPath);
                }
                
                // 添加加载事件
                img.addEventListener('load', () => {
                    img.classList.add('loaded');
                });
                
                // 添加错误处理
                img.addEventListener('error', () => {
                    img.classList.add('error');
                    img.style.minHeight = '100px';
                    img.setAttribute('alt', '图片加载失败');
                    img.setAttribute('title', '无法加载图片: ' + src);
                });
                
                // 替换嵌入元素
                embed.empty();
                embed.appendChild(img);
            }
        });
        
        // 处理笔记嵌入 ![[note]]
        const noteEmbeds = element.querySelectorAll(".internal-embed:not([src$='.png']):not([src$='.jpg']):not([src$='.jpeg']):not([src$='.gif']):not([src$='.svg']):not([src$='.webp'])");
        
        noteEmbeds.forEach((embed) => {
            const src = embed.getAttribute("src");
            if (src) {
                // 创建笔记预览容器
                const container = document.createElement("div");
                container.classList.add("chat-view-embedded-note");
                
                // 设置标题
                const titleEl = container.createEl("div", {
                    cls: "chat-view-embedded-note-title"
                });
                
                // 添加图标
                const iconEl = titleEl.createSpan({
                    cls: "chat-view-embedded-note-icon"
                });
                setIcon(iconEl, "file-text");
                
                // 使用Obsidian的路径解析机制获取真实路径
                const linkpath = src.replace(/\.md$/, "");
                const resolvedFile = app.metadataCache.getFirstLinkpathDest(linkpath, sourcePath);
                
                // 添加标题文本
                const displayName = resolvedFile ? resolvedFile.basename : src;
                titleEl.createSpan({
                    text: displayName,
                    cls: "chat-view-embedded-note-name"
                });
                
                // 创建笔记内容容器
                const contentEl = container.createDiv({
                    cls: "chat-view-embedded-note-content markdown-rendered"
                });
                
                // 尝试获取文件并渲染
                if (resolvedFile && resolvedFile instanceof TFile && resolvedFile.extension === "md") {
                    // 异步加载文件内容
                    app.vault.read(resolvedFile).then((content: string) => {
                        // 渲染笔记内容
                        MarkdownRenderer.renderMarkdown(
                            content, 
                            contentEl, 
                            resolvedFile.path, 
                            component
                        );
                    }).catch((err: Error) => {
                        contentEl.setText("无法加载嵌入内容: " + err.message);
                    });
                } else {
                    // 尝试通过直接路径获取
                    const file = app.vault.getAbstractFileByPath(src);
                    if (file && file instanceof TFile && file.extension === "md") {
                        // 异步加载文件内容
                        app.vault.read(file).then((content: string) => {
                            // 渲染笔记内容
                            MarkdownRenderer.renderMarkdown(
                                content, 
                                contentEl, 
                                file.path, 
                                component
                            );
                        }).catch((err: Error) => {
                            contentEl.setText("无法加载嵌入内容: " + err.message);
                        });
                    } else {
                        contentEl.setText("找不到嵌入文件");
                    }
                }
                
                // 替换嵌入元素
                embed.empty();
                embed.appendChild(container);
            }
        });
    }
    
    /**
     * 处理链接
     * 为内部链接添加正确的属性和事件处理
     * @param element 包含链接的HTML元素
     * @param sourcePath 源文件路径
     * @param app Obsidian应用实例
     * @private
     * @static
     */
    private static processLinks(element: HTMLElement, sourcePath: string, app: App): void {
        // 处理内部链接
        const internalLinks = element.querySelectorAll("a.internal-link");
        
        internalLinks.forEach((link) => {
            // 确保链接是HTMLElement类型
            if (!(link instanceof HTMLElement)) return;
            
            const href = link.getAttribute("href");
            if (!href) return;
            
            // 解析链接路径
            const linkpath = href.replace(/\.md$/, "");
            
            // 尝试获取链接目标文件
            const targetFile = app.metadataCache.getFirstLinkpathDest(linkpath, sourcePath);
            
            // 设置所有Obsidian需要的数据属性以启用原生预览
            link.classList.add("internal-link");
            link.classList.remove("external-link"); // 删除可能的外部链接类
            link.removeAttribute("target"); // 删除可能的外部链接属性
            
            // 确保有必要的属性
            if (targetFile) {
                // 注册官方的链接预览功能
                this.registerHoverPreview(link, targetFile, app);
            } else {
                // 找不到文件时，设置为创建新文件的链接
                link.classList.add("is-unresolved");
                link.setAttribute("data-link-status", "not-exists");
                
                // 为未解析的链接添加点击事件
                link.addEventListener("click", (event) => {
                    event.preventDefault();
                    
                    // 找不到文件，提示创建
                    const createConfirm = confirm(`文件 "${href}" 不存在。是否创建?`);
                    if (createConfirm) {
                        // 创建新文件 - 确保路径合法
                        let newFilePath;
                        if (href.indexOf('/') === -1) {
                            // 如果是简单文件名，放在当前文件夹下
                            const currentDir = sourcePath.substring(0, sourcePath.lastIndexOf('/') + 1);
                            newFilePath = currentDir + href;
                        } else {
                            newFilePath = href;
                        }
                        
                        // 确保有.md扩展名
                        if (!newFilePath.endsWith('.md')) {
                            newFilePath += '.md';
                        }
                        
                        app.vault.create(newFilePath, "").then(file => {
                            app.workspace.getLeaf(false).openFile(file);
                        });
                    }
                });
            }
        });
    }
    
    /**
     * 注册官方的链接预览功能
     * 这是直接使用Obsidian的页面预览API
     * @param linkEl 链接元素
     * @param targetFile 目标文件
     * @param app Obsidian应用实例
     * @private
     * @static
     */
    private static registerHoverPreview(linkEl: HTMLElement, targetFile: TFile, app: App): void {
        // 首先设置所有必要的属性和类，确保Obsidian能正确识别链接
        linkEl.dataset.href = targetFile.path;
        linkEl.dataset.type = "link";
        linkEl.dataset.path = targetFile.path;
        
        // 使用官方指定的CSS类
        linkEl.classList.add("internal-link");
        linkEl.classList.add("cm-hmd-internal-link");
        
        // 设置额外属性以帮助Obsidian识别这是一个可预览链接
        linkEl.setAttribute("data-link-path", targetFile.path);
        linkEl.setAttribute("data-link-type", "internal");
        linkEl.setAttribute("data-link-status", "exists");
        
        // 使用事件监听方式让Obsidian的hover功能生效
        linkEl.addEventListener('mouseover', (event) => {
            // 阻止事件冒泡，避免其他处理器干扰
            event.stopPropagation();
            
            // 使用类型断言访问内部API
            const appAny = app as any;
            
            // 方法1: 最新的官方API (Obsidian 1.8.x+)
            try {
                if (appAny.workspace?.trigger && typeof appAny.workspace.trigger === 'function') {
                    // 触发全局悬停事件
                    appAny.workspace.trigger('hover-link', {
                        event: event,
                        source: linkEl,
                        hoverParent: linkEl.parentElement,
                        targetEl: linkEl,
                        linktext: targetFile.path,
                        sourcePath: targetFile.path
                    });
                    return; // 如果成功，就不尝试其他方法
                }
            } catch (e) {
                console.warn('最新API调用失败:', e);
            }
            
            // 方法2: 尝试使用页面预览插件API (适用于大多数Obsidian版本)
            try {
                if (appAny.internalPlugins?.plugins['page-preview']?.enabled) {
                    const previewPlugin = appAny.internalPlugins.plugins['page-preview'].instance;
                    if (previewPlugin && previewPlugin.onLinkHover) {
                        // 阻止冒泡非常重要
                        event.stopPropagation();
                        // 当鼠标悬停时触发预览
                        previewPlugin.onLinkHover(event, linkEl, targetFile.path);
                        return; // 如果成功，就不尝试其他方法
                    }
                }
            } catch (e) {
                console.warn('页面预览插件API调用失败:', e);
            }
            
            // 方法3: 使用活跃视图的hover功能 (后备方案)
            try {
                if (appAny.workspace?.getActiveViewOfType) {
                    const markdownView = appAny.workspace.getActiveViewOfType(appAny.MarkdownView);
                    if (markdownView && markdownView.registerHoverLinkSource) {
                        markdownView.registerHoverLinkSource({
                            display: targetFile.path,
                            targetEl: linkEl,
                            linktext: targetFile.path,
                            sourcePath: targetFile.path
                        });
                        return;
                    }
                }
                
                // 如果没有活跃的Markdown视图，尝试查找任何可用视图
                if (appAny.workspace?.iterateLeaves) {
                    let foundValidView = false;
                    
                    // 查找任何激活的页面视图
                    appAny.workspace.iterateLeaves((leaf: any) => {
                        if (foundValidView) return;
                        
                        if (leaf.view && typeof leaf.view.registerHoverLinkSource === 'function') {
                            leaf.view.registerHoverLinkSource({
                                display: targetFile.path,
                                targetEl: linkEl,
                                linktext: targetFile.path,
                                sourcePath: targetFile.path
                            });
                            foundValidView = true;
                        }
                    });
                }
            } catch (e) {
                console.warn('视图API调用失败:', e);
            }
        });

        // 点击事件处理
        linkEl.addEventListener("click", (event) => {
            event.preventDefault();
            app.workspace.getLeaf(false).openFile(targetFile);
        });
    }
} 