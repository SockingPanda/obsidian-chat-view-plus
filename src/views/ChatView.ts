import { ItemView, WorkspaceLeaf, Menu, Notice, TFile, setIcon } from "obsidian";
import ChatViewPlusPlugin from "../index";
import { ChatBubbleOptions } from "../models/message";
import { ChatBubbleRenderer } from "../renderers/chat-bubble";
import { ChatRole } from "../models/settings";
import { CHAT_VIEW_TYPE } from "../constants/view";

export class ChatView extends ItemView {
    private plugin: ChatViewPlusPlugin;
    private chatContainer: HTMLElement;
    private inputContainer: HTMLElement;
    private inputField: HTMLTextAreaElement;
    private sendButton: HTMLElement;
    private roleSelector: HTMLElement;
    private selectedRole: ChatRole | null = null;
    private fileDisplay: HTMLElement;
    private targetFile: TFile | null = null;
    private dynamicIsland: HTMLElement | null = null;
    private _hasShownUnboundNotice = false;
    
    constructor(leaf: WorkspaceLeaf, plugin: ChatViewPlusPlugin) {
        super(leaf);
        this.plugin = plugin;
    }
    
    override getViewType(): string {
        return CHAT_VIEW_TYPE;
    }
    
    override getDisplayText(): string {
        return "聊天窗口";
    }
    
    override getIcon(): string {
        return "message-square";
    }
    
    override async onOpen(): Promise<void> {
        // 创建基本布局
        this.contentEl.empty();
        this.contentEl.addClass("chat-view-plus-container");
        
        // 创建灵动岛式顶部文件显示
        this.createFileDisplay();
        
        // 创建聊天显示区域（上方）
        this.chatContainer = this.contentEl.createDiv({
            cls: "chat-view-plus-messages"
        });
        
        // 创建输入区域（下方）
        this.inputContainer = this.contentEl.createDiv({
            cls: "chat-view-plus-input-container"
        });
        
        // 创建角色选择器
        this.createRoleSelector();
        
        // 创建输入框
        this.inputField = this.inputContainer.createEl("textarea", {
            cls: "chat-view-plus-input-field",
            attr: {
                placeholder: "在此输入消息..."
            }
        });
        
        // 自动调整高度的事件监听
        this.inputField.addEventListener("input", () => {
            this.inputField.style.height = "auto";
            this.inputField.style.height = `${this.inputField.scrollHeight}px`;
        });
        
        // 创建发送按钮
        this.sendButton = this.inputContainer.createEl("button", {
            text: "发送",
            cls: "chat-view-plus-send-button"
        });
        
        // 发送按钮点击事件
        this.sendButton.addEventListener("click", () => {
            this.sendMessage();
        });
        
        // 输入框回车键发送消息（Shift+Enter 换行）
        this.inputField.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        
        // 加载绑定文件
        await this.loadTargetFile();
        
        // 注册活动文件变更事件，用于自动跟随
        this.registerEvent(
            this.app.workspace.on("active-leaf-change", () => {
                if (this.plugin.settings.bindActiveFile) {
                    this.handleActiveFileChange();
                }
            })
        );
        
        this.registerEvent(
            this.app.workspace.on("file-open", () => {
                if (this.plugin.settings.bindActiveFile) {
                    this.handleActiveFileChange();
                }
            })
        );
    }
    
    /**
     * 创建灵动岛式文件显示
     */
    private createFileDisplay(): void {
        this.fileDisplay = this.contentEl.createDiv({
            cls: "chat-view-dynamic-island"
        });
        
        // 创建文件名显示
        const filenameDisplay = this.fileDisplay.createDiv({
            cls: "chat-view-dynamic-island-filename"
        });
        filenameDisplay.setText("未绑定文件");
        
        // 点击灵动岛跳转到对应文件
        this.fileDisplay.addEventListener("click", (event) => {
            // 如果点击的是菜单按钮或其他控制按钮，不触发跳转
            if (event.target && ((event.target as HTMLElement).closest(".chat-view-dynamic-island-menu") || 
                                (event.target as HTMLElement).closest(".chat-view-chat-controls"))) {
                return;
            }
            
            // 跳转到绑定的文件
            if (this.targetFile) {
                const leaf = this.app.workspace.getMostRecentLeaf();
                if (leaf) {
                    leaf.openFile(this.targetFile);
                }
            } else {
                new Notice("未绑定文件，无法跳转");
            }
        });
        
        // 添加视觉提示，表明可点击
        this.fileDisplay.style.cursor = "pointer";
        
        // 创建聊天控制按钮区域（位于灵动岛内部右侧）
        const chatControls = this.fileDisplay.createDiv({
            cls: "chat-view-chat-controls"
        });
        
        // 创建聊天块选择下拉列表
        const chatBlockSelect = chatControls.createEl("select", {
            cls: "chat-view-chatblock-select"
        });
        
        // 添加默认选项
        chatBlockSelect.createEl("option", {
            text: "加载中...",
            value: "0"
        });
        
        // 下拉列表变更事件
        chatBlockSelect.addEventListener("change", async () => {
            if (this.targetFile) {
                const selectedIndex = parseInt(chatBlockSelect.value);
                if (!isNaN(selectedIndex)) {
                    this.plugin.settings.currentChatIndex = selectedIndex;
                    await this.plugin.saveSettings();
                    await this.loadFileContent();
                }
            }
        });
        
        // 创建新聊天块按钮
        const newChatButton = chatControls.createEl("button", {
            cls: "chat-view-new-chat-button",
            attr: { "aria-label": "创建新聊天块" }
        });
        setIcon(newChatButton, "plus");
        
        // 创建新聊天块事件处理
        newChatButton.addEventListener("click", async () => {
            if (this.targetFile) {
                await this.plugin.fileService.createNewChatBlock(this.targetFile);
                const chatCount = await this.plugin.fileService.getChatBlocksCount(this.targetFile);
                this.plugin.settings.currentChatIndex = chatCount - 1;
                await this.plugin.saveSettings();
                await this.updateChatBlockSelect(chatBlockSelect);
                await this.loadFileContent();
                new Notice("已创建新聊天块");
            } else {
                new Notice("未绑定文件，无法创建聊天块");
            }
        });
        
        // 创建预设菜单按钮（放在灵动岛右侧）
        const menuContainer = this.fileDisplay.createDiv({
            cls: "chat-view-dynamic-island-menu"
        });
        
        const presetButton = menuContainer.createEl("button", {
            cls: "chat-view-preset-button",
            attr: {
                "aria-label": "预设与文件"
            }
        });
        setIcon(presetButton, "list");
        
        // 点击按钮弹出菜单
        presetButton.addEventListener("click", (event) => {
            this.showMenu(event);
        });
    }
    
    /**
     * 更新聊天块选择下拉列表
     */
    private async updateChatBlockSelect(selectElement: HTMLSelectElement): Promise<void> {
        if (!this.targetFile) return;
        
        try {
            // 获取文件内容
            const content = await this.app.vault.read(this.targetFile);
            
            // 提取所有聊天块及其标题
            const chatBlocks: {index: number, title: string}[] = [];
            const chatBlockRegex = /```chat(?:-md)?\n([\s\S]*?)```/g;
            let match;
            let index = 0;
            
            while ((match = chatBlockRegex.exec(content)) !== null) {
                // 尝试提取聊天块的标题或使用序号作为标题
                let title = `聊天 ${index + 1}`;
                
                // 查找第一条消息作为标题
                const firstMessageRegex = /@(?:left|right|center)\s+([^\[]+)/;
                const messageMatch = match[1].match(firstMessageRegex);
                if (messageMatch && messageMatch[1]) {
                    title = `${index + 1}. ${messageMatch[1].trim()}`;
                }
                
                chatBlocks.push({
                    index: index,
                    title: title
                });
                
                index++;
            }
            
            // 更新下拉列表
            selectElement.innerHTML = "";
            
            if (chatBlocks.length === 0) {
                const option = selectElement.createEl("option", {
                    text: "无聊天内容",
                    value: "0"
                });
                option.disabled = true;
                option.selected = true;
            } else {
                chatBlocks.forEach(block => {
                    const option = selectElement.createEl("option", {
                        text: block.title,
                        value: block.index.toString()
                    });
                    
                    if (block.index === this.plugin.settings.currentChatIndex) {
                        option.selected = true;
                    }
                });
            }
        } catch (error) {
            console.error("更新聊天块选择器失败:", error);
        }
    }
    
    /**
     * 显示菜单
     */
    private showMenu(event: MouseEvent): void {
        const menu = new Menu();

        // 添加预设标题
        menu.addItem(item => {
            item.setTitle("角色预设").setDisabled(true);
        });
        
        // 分隔线
        menu.addSeparator();
        
        // 添加预设列表
        if (this.plugin.settings.presets.length > 0) {
            this.plugin.settings.presets.forEach(preset => {
                menu.addItem(item => {
                    item.setTitle(preset.name)
                        .setChecked(this.plugin.settings.currentPreset === preset.name)
                        .onClick(async () => {
                            this.plugin.settings.currentPreset = preset.name;
                            this.plugin.settings.roles = [...preset.roles];
                            await this.plugin.saveSettings();
                            this.createRoleSelector(); // 重新创建角色选择器
                            new Notice(`已切换到预设: ${preset.name}`);
                        });
                });
            });
        } else {
            menu.addItem(item => {
                item.setTitle("暂无预设")
                    .setDisabled(true);
            });
        }
        
        // 分隔线
        menu.addSeparator();
        
        // 添加文件操作标题
        menu.addItem(item => {
            item.setTitle("文件选项").setDisabled(true);
        });

        // 分隔线
        menu.addSeparator();
        
        // 选项1：绑定当前活动文件
        menu.addItem(item => {
            item.setTitle("自动跟随活动文件（动态）")
                .setChecked(this.plugin.settings.bindActiveFile)
                .onClick(async () => {
                    this.plugin.settings.bindActiveFile = !this.plugin.settings.bindActiveFile;
                    if (this.plugin.settings.bindActiveFile) {
                        this.plugin.settings.useDailyNote = false;
                        // 立即跟随当前活动文件
                        await this.handleActiveFileChange();
                    } else {
                        // 如果关闭了自动跟随，重新加载目标文件
                        await this.loadTargetFile();
                    }
                    await this.plugin.saveSettings();
                });
        });
        
        // 选项2：使用当天日记
        menu.addItem(item => {
            item.setTitle("使用当天日记")
                .setChecked(this.plugin.settings.useDailyNote)
                .onClick(async () => {
                    // 反转当前状态
                    const newState = !this.plugin.settings.useDailyNote;
                    console.log(`切换日记模式: ${newState ? "启用" : "禁用"}`);
                    
                    // 更新设置
                    this.plugin.settings.useDailyNote = newState;
                    
                    // 如果启用了日记，则禁用绑定活动文件
                    if (newState) {
                        this.plugin.settings.bindActiveFile = false;
                        console.log("已禁用绑定活动文件设置");
                    }
                    
                    // 保存设置
                    await this.plugin.saveSettings();
                    
                    // 强制清除缓存并重新加载
                    console.log("清除文件缓存并重新加载...");
                    this.plugin.currentTargetFile = null;
                    this._hasShownUnboundNotice = false; // 重置通知状态
                    
                    // 重新加载目标文件
                    await this.loadTargetFile();
                    
                    // 提供视觉反馈
                    if (newState) {
                        if (this.targetFile) {
                            new Notice(`已成功绑定到日记文件: ${this.targetFile.basename}`);
                        } else {
                            new Notice("未能找到或创建日记文件，请检查日记插件设置");
                        }
                    } else {
                        new Notice("已取消使用日记");
                    }
                });
        });
        
        // 选项3：选择文件
        menu.addItem(item => {
            item.setTitle("选择指定文件...")
                .onClick(async () => {
                    // 打开文件选择器
                    const file = await this.selectFile();
                    if (file) {
                        this.plugin.settings.defaultBindFile = file.path;
                        this.plugin.settings.useDailyNote = false;
                        this.plugin.settings.bindActiveFile = false;
                        await this.plugin.saveSettings();
                        await this.loadTargetFile();
                    }
                });
        });
        
        // 选项4：手动同步内容
        menu.addItem(item => {
            item.setTitle("同步内容")
                .setIcon("refresh-cw")
                .onClick(async () => {
                    if (this.targetFile) {
                        await this.loadFileContent();
                        new Notice("已同步内容");
                    } else {
                        new Notice("未绑定文件");
                    }
                });
        });
        
        // 在按钮位置显示菜单
        menu.showAtMouseEvent(event);
    }
    
    /**
     * 弹出文件选择器
     */
    private async selectFile(): Promise<TFile | null> {
        return new Promise((resolve) => {
            const fileMenu = new Menu();
            
            // 获取所有markdown文件
            const files = this.app.vault.getMarkdownFiles();
            
            // 对文件按名称排序
            files.sort((a, b) => a.basename.localeCompare(b.basename));
            
            // 如果文件太多，按字母分组
            if (files.length > 20) {
                // 创建字母分组
                const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
                
                for (let i = 0; i < alphabet.length; i++) {
                    const letter = alphabet[i];
                    const letterFiles = files.filter(file => 
                        file.basename.toUpperCase().startsWith(letter)
                    );
                    
                    if (letterFiles.length > 0) {
                        // 添加字母分组标题
                        fileMenu.addItem(item => {
                            item.setTitle(letter).setDisabled(true);
                        });
                        
                        // 添加该字母开头的文件
                        letterFiles.forEach(file => {
                            fileMenu.addItem(item => {
                                item.setTitle(file.basename)
                                    .onClick(() => resolve(file));
                            });
                        });
                        
                        // 添加分隔线
                        fileMenu.addSeparator();
                    }
                }
                
                // 添加非字母开头的文件
                const otherFiles = files.filter(file => 
                    !alphabet.includes(file.basename.toUpperCase()[0])
                );
                
                if (otherFiles.length > 0) {
                    fileMenu.addItem(item => {
                        item.setTitle("#其他").setDisabled(true);
                    });
                    
                    otherFiles.forEach(file => {
                        fileMenu.addItem(item => {
                            item.setTitle(file.basename)
                                .onClick(() => resolve(file));
                        });
                    });
                }
            } else {
                // 文件不多，直接显示
                files.forEach(file => {
                    fileMenu.addItem(item => {
                        item.setTitle(file.basename)
                            .onClick(() => resolve(file));
                    });
                });
            }
            
            // 如果没有文件，显示提示
            if (files.length === 0) {
                fileMenu.addItem(item => {
                    item.setTitle("没有可用的文件")
                        .setDisabled(true);
                });
            }
            
            // 添加取消选项
            fileMenu.addSeparator();
            fileMenu.addItem(item => {
                item.setTitle("取消")
                    .onClick(() => resolve(null));
            });
            
            fileMenu.showAtMouseEvent({ x: 0, y: 0 } as MouseEvent);
        });
    }
    
    /**
     * 创建角色选择器
     */
    private createRoleSelector(): void {
        // 如果已经有角色选择器，先移除
        if (this.roleSelector) {
            this.roleSelector.remove();
        }
        
        // 创建新的角色选择器
        this.roleSelector = this.inputContainer.createDiv({
            cls: "chat-view-role-selector"
        });
        
        // 默认选择第一个角色
        if (this.plugin.settings.roles.length > 0) {
            this.selectedRole = this.plugin.settings.roles[0];
            
            // 创建角色选择下拉框
            const roleSelect = this.roleSelector.createEl("select", {
                cls: "chat-view-role-select"
            });
            
            // 添加角色选项
            this.plugin.settings.roles.forEach(role => {
                const option = roleSelect.createEl("option", {
                    text: role.name,
                    value: role.name
                });
                
                // 设置默认选中项
                if (role.name === this.selectedRole?.name) {
                    option.selected = true;
                }
            });
            
            // 监听选择变化
            roleSelect.addEventListener("change", () => {
                const selectedName = roleSelect.value;
                this.selectedRole = this.plugin.settings.roles.find(r => r.name === selectedName) || null;
            });
        } else {
            // 如果没有角色，显示提示
            this.roleSelector.setText("请先在设置中添加角色");
            this.selectedRole = null;
        }
    }
    
    /**
     * 加载绑定的目标文件内容
     */
    async loadTargetFile() {
        try {
            console.log("开始加载目标文件...");
            console.log(`当前设置状态 - 使用日记: ${this.plugin.settings.useDailyNote}, 绑定活动文件: ${this.plugin.settings.bindActiveFile}, 默认文件: ${this.plugin.settings.defaultBindFile}`);
            
            // 尝试使用plugin.currentTargetFile（如果已经缓存）
            if (this.plugin.currentTargetFile) {
                console.log(`使用缓存的目标文件: ${this.plugin.currentTargetFile.path}`);
                this.targetFile = this.plugin.currentTargetFile;
            } else {
                console.log("没有缓存的目标文件，重新获取...");
                // 否则重新获取目标文件
                this.targetFile = await this.plugin.fileService.getTargetFile();
                // 更新缓存
                this.plugin.currentTargetFile = this.targetFile;
                
                if (this.targetFile) {
                    console.log(`成功获取新的目标文件: ${this.targetFile.path}`);
                } else {
                    console.log("未能获取到任何目标文件");
                }
            }
            
            if (!this.targetFile) {
                // 如果仍未获取到文件
                this.updateFileDisplay("未绑定文件", "");
                
                if (!this._hasShownUnboundNotice) {
                    new Notice("未绑定到任何文件，请在设置中配置日记或默认文件路径");
                    this._hasShownUnboundNotice = true;
                }
                
                // 显示欢迎消息和帮助信息
                this.showWelcomeMessage();
                return;
            }
            
            // 更新文件显示
            this.updateFileDisplay(this.targetFile.basename, this.targetFile.path);
            
            // 查找聊天块下拉列表
            const selectElement = this.fileDisplay.querySelector(".chat-view-chatblock-select") as HTMLSelectElement;
            if (selectElement) {
                await this.updateChatBlockSelect(selectElement);
            }
            
            // 加载文件内容
            await this.loadFileContent();
            
            // 如果加载后没有聊天块，显示欢迎消息
            if (this.chatContainer.childElementCount === 0) {
                this.showWelcomeMessage();
            }
        } catch (error) {
            console.error("加载目标文件时出错:", error);
            new Notice("加载目标文件失败");
        }
    }
    
    /**
     * 更新文件显示区域
     */
    private updateFileDisplay(filename: string, path: string): void {
        const filenameDisplay = this.fileDisplay.querySelector(".chat-view-dynamic-island-filename");
        if (filenameDisplay) {
            filenameDisplay.setText(filename);
            filenameDisplay.setAttribute("title", path);
        }
        
        // 查找或创建刷新按钮
        let refreshButton = this.fileDisplay.querySelector(".chat-view-refresh-button");
        if (!refreshButton) {
            const chatControls = this.fileDisplay.querySelector(".chat-view-chat-controls");
            if (chatControls) {
                refreshButton = chatControls.createEl("button", {
                    cls: "chat-view-refresh-button",
                    attr: { "aria-label": "刷新绑定文件" }
                });
                setIcon(refreshButton as HTMLElement, "refresh-cw");
                
                // 添加刷新事件
                refreshButton.addEventListener("click", async () => {
                    this.plugin.currentTargetFile = null; // 清除缓存
                    await this.loadTargetFile(); // 重新加载
                    new Notice("已刷新绑定文件");
                });
            }
        }
    }
    
    /**
     * 发送消息到聊天窗口
     */
    async sendMessage() {
        const message = this.inputField.value.trim();
        if (message === "" || !this.selectedRole) return;
        
        if (!this.targetFile) {
            // 如果没有绑定文件，显示提示并返回
            new Notice("未能绑定目标文件，请在菜单中配置");
            // 不需要重新加载，避免重复提示
            return;
        }
        
        try {
            // 将消息写入文件
            await this.plugin.fileService.appendMessageToFile(
                this.targetFile,
                this.selectedRole.name,
                this.selectedRole.position,
                message,
                this.plugin.settings.currentChatIndex
            );
            
            // 清空输入框并重置高度
            this.inputField.value = "";
            this.inputField.style.height = "auto";
            
            // 重新加载文件内容以显示新消息
            await this.loadFileContent();
        } catch (error) {
            console.error("发送消息时出错:", error);
            new Notice("发送消息失败，请检查控制台日志");
        }
    }
    
    /**
     * 从文件中加载并显示聊天内容
     */
    async loadFileContent() {
        if (!this.targetFile) {
            console.warn("未绑定文件，无法加载内容");
            return;
        }
        
        try {
            const content = await this.app.vault.read(this.targetFile);
            
            // 更新聊天块选择下拉列表
            const chatBlockSelect = this.fileDisplay.querySelector(".chat-view-chatblock-select") as HTMLSelectElement;
            if (chatBlockSelect) {
                await this.updateChatBlockSelect(chatBlockSelect);
            }
            
            this.displayChatContent(content);
        } catch (error) {
            console.error("加载文件内容时出错:", error);
            new Notice("读取文件内容失败");
            
            // 清空聊天容器并显示错误信息
            this.chatContainer.empty();
            const errorEl = document.createElement("div");
            errorEl.classList.add("chat-error-message");
            errorEl.textContent = "无法读取文件内容，请检查文件是否存在或权限是否正确";
            this.chatContainer.appendChild(errorEl);
        }
    }
    
    /**
     * 显示聊天内容
     */
    displayChatContent(content: string) {
        // 清空聊天容器
        this.chatContainer.empty();
        
        // 提取聊天块内容
        const chatBlockRegex = /```chat(?:-md)?\n([\s\S]*?)```/g;
        const matches = [];
        let match;
        
        while ((match = chatBlockRegex.exec(content)) !== null) {
            matches.push({
                content: match[1],
                start: match.index,
                end: match.index + match[0].length
            });
        }
        
        if (matches.length > 0) {
            // 确保索引在有效范围内
            const chatIndex = Math.min(this.plugin.settings.currentChatIndex, matches.length - 1);
            
            // 只显示当前选中的聊天块
            const chatContent = matches[chatIndex].content;
            const chatElement = this.chatContainer.createDiv();
            this.renderChatContent(chatElement, chatContent);
        } else {
            // 如果没有找到聊天内容，显示欢迎消息
            console.log("文件中未找到聊天内容，显示欢迎消息");
            this.showWelcomeMessage();
        }
        
        // 滚动到底部
        this.scrollToBottom();
    }
    
    /**
     * 显示欢迎消息
     */
    private showWelcomeMessage(): void {
        const welcomeDiv = this.chatContainer.createDiv({
            cls: "chat-view-welcome"
        });
        
        welcomeDiv.createEl("h3", { text: "欢迎使用聊天视图增强插件" });
        welcomeDiv.createEl("p", { text: "选择一个角色，开始发送消息吧!" });
    }
    
    /**
     * 滚动到底部
     */
    private scrollToBottom(): void {
        if (this.chatContainer) {
            this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
        }
    }

    // 渲染聊天内容
    private renderChatContent(element: HTMLElement, content: string): void {
        // 使用现有的 ChatBubbleRenderer 渲染
        // 但是为了能处理内容，我们需要手动解析内容并添加对象
        const lines = content.split("\n");
         
        // 从内容中提取颜色配置
        const colorConfigRegex = /^\[(.+?)]$/;
        const colorConfigs = new Map<string, string>();
         
        for (const line of lines) {
            const colorMatch = line.trim().match(colorConfigRegex);
            if (colorMatch) {
                const configs = colorMatch[1].split(",").map(c => c.trim());
                for (const config of configs) {
                    const [name, color] = config.split("=").map(p => p.trim());
                    if (name && color) {
                        colorConfigs.set(name, color);
                    }
                }
            }
        }
         
        // 创建消息块
        const messageDirectionRegex = /^@(left|right|center)\s+([^\[]+)(?:\s+\[(.+?)])?/;
        const messageEndRegex = /^___+$/;
         
        let inMessage = false;
        let direction = "";
        let sender = "";
        let time = "";
        let messageContent = "";
         
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
             
            // 跳过空行和配置行
            if (!line || line.match(colorConfigRegex)) continue;
             
            // 消息开始
            const dirMatch = line.match(messageDirectionRegex);
            if (dirMatch && !inMessage) {
                inMessage = true;
                direction = dirMatch[1];
                sender = dirMatch[2].trim();
                time = dirMatch[3] || "";
                messageContent = "";
                continue;
            }
             
            // 消息结束
            if (line.match(messageEndRegex) && inMessage) {
                // 渲染消息
                const options: ChatBubbleOptions = {
                    header: sender,
                    prevHeader: "",
                    message: messageContent,
                    subtext: time,
                    align: direction,
                    continued: false,
                    colorConfigs: colorConfigs,
                    formatConfigs: new Map<string, string>(),
                    sourcePath: this.targetFile?.path || "",
                    component: this.plugin
                };
                 
                ChatBubbleRenderer.render(element, options);
                 
                // 重置
                inMessage = false;
                continue;
            }
             
            // 消息内容
            if (inMessage) {
                if (messageContent) {
                    messageContent += "\n" + lines[i];
                } else {
                    messageContent = lines[i];
                }
            }
        }
         
        // 如果有未结束的消息，渲染它
        if (inMessage) {
            const options: ChatBubbleOptions = {
                header: sender,
                prevHeader: "",
                message: messageContent,
                subtext: time,
                align: direction,
                continued: false,
                colorConfigs: colorConfigs,
                formatConfigs: new Map<string, string>(),
                sourcePath: this.targetFile?.path || "",
                component: this.plugin
            };
             
            ChatBubbleRenderer.render(element, options);
        }
    }

    /**
     * 处理活动文件变更
     */
    private async handleActiveFileChange(): Promise<void> {
        const activeFile = this.app.workspace.getActiveFile();
        if (activeFile && activeFile.extension === "md" && (!this.targetFile || activeFile.path !== this.targetFile.path)) {
            console.log(`自动跟随活动文件变更: ${activeFile.path}`);
            this.targetFile = activeFile;
            
            // 更新标题
            this.leaf.setViewState({
                type: CHAT_VIEW_TYPE,
                state: { title: `聊天: ${this.targetFile.basename}` }
            });
            
            // 更新灵动岛显示
            const fileNameEl = this.fileDisplay.querySelector(".chat-view-dynamic-island-filename");
            if (fileNameEl) {
                fileNameEl.textContent = this.targetFile.basename;
            }
            
            // 重置聊天块索引
            this.plugin.settings.currentChatIndex = 0;
            await this.plugin.saveSettings();
            
            // 加载文件内容
            await this.loadFileContent();
        }
    }
} 