import { MarkdownRenderer, Platform, Component, App, setIcon, TFile, HoverParent, HoverPopover } from "obsidian";
import { ChatBubbleOptions } from "../models/message";
import { HEADER_TIME_REGEX, TIME_CLEANUP_REGEX, parseHeaderAndTime } from "../constants";

export class ChatBubbleRenderer {
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
     */
    private static processLinks(element: HTMLElement, sourcePath: string, app: App): void {
        // 处理内部链接
        const internalLinks = element.querySelectorAll(".internal-link");
        
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
            link.classList.add("internal-link"); // 确保有正确的类名
            link.removeAttribute("target"); // 删除可能的外部链接属性
            
            // 确保有必要的属性
            if (targetFile) {
                // 设置必要的Obsidian链接属性
                link.dataset.href = href;
                link.dataset.type = "link";
                link.dataset.path = targetFile.path;
                
                // 添加更多Obsidian链接属性以确保预览工作
                const fileName = targetFile.basename;
                link.setAttribute("aria-label", fileName);
                
                // 为链接添加可辨识的标记，确保Obsidian的预览系统能识别它
                link.dataset.filepath = targetFile.path;
                
                // 注册官方的链接预览功能
                this.registerHoverPreview(link, targetFile, app);
            }
            
            // 点击事件处理
            link.addEventListener("click", (event) => {
                event.preventDefault();
                
                if (targetFile) {
                    // 打开文件
                    app.workspace.getLeaf(false).openFile(targetFile);
                } else {
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
                }
            });
        });
    }
    
    /**
     * 注册官方的链接预览功能
     * 这是直接使用Obsidian的页面预览API
     */
    private static registerHoverPreview(linkEl: HTMLElement, targetFile: TFile, app: App): void {
        // 使用事件监听方式让Obsidian的hover功能生效
        linkEl.addEventListener('mouseover', (event) => {
            // 阻止事件冒泡，避免其他处理器干扰
            event.stopPropagation();
            
            // 使用类型断言访问内部API
            const appAny = app as any;
            
            // 方法1: 尝试使用页面预览插件API (适用于大多数Obsidian版本)
            if (appAny.internalPlugins?.plugins['page-preview']?.enabled) {
                try {
                    const previewPlugin = appAny.internalPlugins.plugins['page-preview'].instance;
                    if (previewPlugin && previewPlugin.onLinkHover) {
                        // 当鼠标悬停时触发预览
                        previewPlugin.onLinkHover(event, linkEl, targetFile.path);
                        return; // 如果成功，就不尝试其他方法
                    }
                } catch (e) {
                    console.warn('方法1 - 页面预览插件API调用失败:', e);
                }
            }
            
            // 方法2: 尝试直接使用应用级别的hover功能 (适用于新版本Obsidian)
            try {
                if (appAny.workspace?.trigger) {
                    // 触发全局悬停事件
                    appAny.workspace.trigger('hover-link', {
                        event: event,
                        source: linkEl,
                        targetEl: linkEl,
                        linktext: targetFile.path
                    });
                    return; // 如果成功，就不尝试其他方法
                }
            } catch (e) {
                console.warn('方法2 - 工作区触发器API调用失败:', e);
            }
            
            // 方法3: 最直接的方法，尝试使用全局注册的hoverLinkSource (适用于最新版本)
            try {
                if (appAny.workspace?.iterateLeaves) {
                    // 查找任何激活的页面视图
                    const activeViews: any[] = [];
                    appAny.workspace.iterateLeaves((leaf: any) => {
                        if (leaf.view && !leaf.view.leaf.containerEl.hidden) {
                            activeViews.push(leaf.view);
                        }
                    });
                    
                    // 如果找到活跃视图，尝试使用它们的悬停功能
                    if (activeViews.length > 0) {
                        // 找一个可能具有registerHoverLinkSource功能的视图
                        const view = activeViews.find(v => typeof v.registerHoverLinkSource === 'function');
                        if (view && view.registerHoverLinkSource) {
                            // 使用视图的registerHoverLinkSource来显示预览
                            view.registerHoverLinkSource({
                                display: targetFile.path,
                                targetEl: linkEl,
                                linktext: targetFile.path,
                                sourcePath: targetFile.path
                            });
                        }
                    }
                }
            } catch (e) {
                console.warn('方法3 - HoverLinkSource API调用失败:', e);
            }
        });

        // 为确保预览能够正确显示，还需要设置正确的属性和类
        linkEl.classList.add('data-link-icon'); // 添加官方链接图标类
        linkEl.classList.add('data-link-text'); // 添加官方链接文本类
        
        // 设置额外属性以帮助Obsidian识别这是一个可预览链接
        linkEl.setAttribute('data-link-type', 'internal');
        linkEl.setAttribute('data-link-status', 'exists');
    }
} 