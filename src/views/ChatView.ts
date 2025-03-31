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
        
        // 确保有默认选中的角色
        if (!this.selectedRole && this.plugin.settings.roles.length > 0) {
            this.selectedRole = this.plugin.settings.roles[0];
        }
        
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
        
        // 创建输入区域的左侧包装器（包含角色选择器、预设选择器和输入框）
        const inputLeftColumn = this.inputContainer.createDiv({
            cls: "chat-view-plus-input-left-column"
        });
        
        // 创建角色与预设容器（水平排列）
        const rolePresetContainer = inputLeftColumn.createDiv({
            cls: "chat-view-role-preset-container"
        });
        
        // 创建角色选择器容器
        this.roleSelector = rolePresetContainer.createDiv({
            cls: "chat-view-role-selector"
        });
        
        // 创建预设选择器容器
        const presetSelectorContainer = rolePresetContainer.createDiv({
            cls: "chat-view-preset-selector-container"
        });
        
        // 创建预设选择下拉框
        this.createPresetSelector(presetSelectorContainer);
        
        // 创建输入框
        this.inputField = inputLeftColumn.createEl("textarea", {
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
        
        // 初始化角色选择器内容
        this.updateRoleSelector();
        
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
     * 创建预设选择器
     */
    private createPresetSelector(container: HTMLElement): void {
        // 清空容器
        container.empty();
        
        // 创建预设选择下拉列表
        const presetSelect = container.createEl("select", {
            cls: "chat-view-preset-select"
        });
        
        // 添加"无预设"选项
        const noneOption = presetSelect.createEl("option", {
            text: "无预设",
            value: ""
        });
        
        // 如果没有选中的预设，设置"无预设"为选中状态
        if (!this.plugin.settings.currentPreset) {
            noneOption.selected = true;
        }
        
        // 添加预设选项
        this.plugin.settings.presets.forEach(preset => {
            const option = presetSelect.createEl("option", {
                text: preset.name,
                value: preset.name
            });
            
            // 设置当前选中的预设
            if (preset.name === this.plugin.settings.currentPreset) {
                option.selected = true;
            }
        });
        
        // 监听预设选择变化
        presetSelect.addEventListener("change", async () => {
            const selectedPreset = presetSelect.value;
            
            // 保存当前选中的角色名称
            const previousRoleName = this.selectedRole?.name || "";
            const isTemporaryRole = this.isTemporaryRole(previousRoleName);
            
            // 如果选择了预设
            if (selectedPreset) {
                // 查找预设
                const preset = this.plugin.settings.presets.find(p => p.name === selectedPreset);
                if (preset) {
                    // 应用预设
                    this.plugin.settings.currentPreset = preset.name;
                    this.plugin.settings.roles = [...preset.roles];
                    await this.plugin.saveSettings();
                    
                    // 如果预设有角色，确保选中第一个角色
                    if (preset.roles.length > 0 && !this.selectedRole) {
                        this.selectedRole = preset.roles[0];
                    }
                    
                    // 更新角色选择器
                    this.updateRoleSelector();
                    
                    // 处理角色选择
                    this.handleRoleSelectionAfterPresetChange(previousRoleName, isTemporaryRole);
                    
                    new Notice(`已切换到预设: ${preset.name}`);
                }
            } else {
                // 用户选择了"无预设"
                this.plugin.settings.currentPreset = "";
                await this.plugin.saveSettings();
                
                // 更新角色选择器但保留当前角色
                this.updateRoleSelector();
                
                // 处理角色选择
                this.handleRoleSelectionAfterPresetChange(previousRoleName, isTemporaryRole);
            }
        });
    }
    
    /**
     * 检查是否为临时角色
     */
    private isTemporaryRole(roleName: string): boolean {
        // 如果角色不在设置的角色列表中，则视为临时角色
        return !this.plugin.settings.roles.some(r => r.name === roleName) && roleName !== "";
    }
    
    /**
     * 处理预设切换后的角色选择
     */
    private handleRoleSelectionAfterPresetChange(previousRoleName: string, isTemporaryRole: boolean): void {
        const roleSelect = this.roleSelector.querySelector(".chat-view-role-select") as HTMLSelectElement;
        if (!roleSelect) return;
        
        if (isTemporaryRole && this.selectedRole) {
            // 如果之前选择的是临时角色，尝试在角色选择器中添加并选中它
            // 检查是否已存在同名角色选项
            const existingOption = Array.from(roleSelect.options).find(opt => opt.value === previousRoleName);
            
            if (!existingOption) {
                // 在自定义角色选项之前添加临时角色选项
                const customOption = Array.from(roleSelect.options).find(opt => opt.value === "custom");
                const tempOption = document.createElement("option");
                tempOption.value = previousRoleName;
                tempOption.textContent = `${previousRoleName} (临时)`;
                tempOption.className = "chat-view-temporary-role";
                
                if (customOption) {
                    roleSelect.insertBefore(tempOption, customOption);
                } else {
                    roleSelect.appendChild(tempOption);
                }
                
                // 选中新添加的临时角色选项
                tempOption.selected = true;
            } else {
                // 选中已存在的角色选项
                existingOption.selected = true;
            }
        } else {
            // 尝试找到预设中与之前选中的角色名称相同的角色
            const matchingOption = Array.from(roleSelect.options).find(opt => 
                opt.value === previousRoleName && opt.value !== "custom"
            );
            
            if (matchingOption) {
                // 如果找到同名角色，选中它
                matchingOption.selected = true;
                this.selectedRole = this.plugin.settings.roles.find(r => r.name === previousRoleName) || this.plugin.settings.roles[0];
            } else if (this.plugin.settings.roles.length > 0) {
                // 如果没有找到同名角色，默认选择第一个
                roleSelect.selectedIndex = 0;
            this.selectedRole = this.plugin.settings.roles[0];
            }
        }
    }
    
    /**
     * 更新角色选择器的内容
     */
    private updateRoleSelector(): void {
        // 清空角色选择器
        this.roleSelector.empty();
        
        // 获取当前角色列表
        const roles = this.plugin.settings.roles;
        
        // 保存之前选中的临时角色列表（如果有）
        const tempRoles: ChatRole[] = this.getTemporaryRoles();
            
            // 创建角色选择下拉框
            const roleSelect = this.roleSelector.createEl("select", {
                cls: "chat-view-role-select"
            });
            
            // 添加角色选项
        roles.forEach(role => {
                const option = roleSelect.createEl("option", {
                    text: role.name,
                value: role.name,
                attr: {
                    "data-color": role.color
                }
                });
                
                // 设置默认选中项
                if (role.name === this.selectedRole?.name) {
                    option.selected = true;
                    roleSelect.setAttribute('data-selected-color', role.color);
                }
        });
        
        // 添加临时角色选项（如果有）
        tempRoles.forEach(tempRole => {
            // 检查角色名称是否已存在于常规角色中
            const isDuplicate = roles.some(r => r.name === tempRole.name);
            
            if (!isDuplicate) {
                const option = roleSelect.createEl("option", {
                    text: `${tempRole.name} (临时)`,
                    value: tempRole.name,
                    attr: {
                        "data-color": tempRole.color
                    }
                });
                option.classList.add("chat-view-temporary-role");
                
                // 如果这是当前选中的角色，设置为选中状态
                if (tempRole.name === this.selectedRole?.name) {
                    option.selected = true;
                    roleSelect.setAttribute('data-selected-color', tempRole.color);
                    roleSelect.classList.add('has-temp-role');
                }
            }
        });
        
        // 添加自定义角色选项
        const customOption = roleSelect.createEl("option", {
            text: "➕ 自定义角色...",
            value: "custom"
        });

        // 如果没有选中的角色，自动选中第一个角色（如果有）
        if (!this.selectedRole && roles.length > 0) {
            this.selectedRole = roles[0];
            const firstOption = roleSelect.options[0];
            if (firstOption) {
                firstOption.selected = true;
                roleSelect.setAttribute('data-selected-color', this.selectedRole.color);
            }
        }
        
        // 角色选择事件
        roleSelect.addEventListener("change", async (e) => {
            const select = e.target as HTMLSelectElement;
            const selectedValue = select.value;
            
            if (selectedValue === "custom") {
                // 重置选择器到之前的选择
                if (this.selectedRole) {
                    select.value = this.selectedRole.name;
                }
                // 显示自定义角色模态框
                await this.showCustomRoleModal();
        } else {
                // 更新选中的角色
                const selectedRole = [...roles, ...tempRoles].find(r => r.name === selectedValue);
                if (selectedRole) {
                    this.selectedRole = selectedRole;
                    select.setAttribute('data-selected-color', selectedRole.color);
                    
                    // 根据是否是临时角色添加或移除平行四边形效果
                    const isTemp = tempRoles.some(r => r.name === selectedValue);
                    if (isTemp) {
                        select.classList.add('has-temp-role');
                    } else {
                        select.classList.remove('has-temp-role');
                    }
                }
            }
        });
    }
    
    /**
     * 获取当前的临时角色列表
     */
    private getTemporaryRoles(): ChatRole[] {
        const tempRoles: ChatRole[] = [];
        
        // 从sessionStorage中获取所有临时角色
        try {
            for(let i = 0; i < sessionStorage.length; i++) {
                const key = sessionStorage.key(i);
                if (key && key.startsWith('chat-view-temp-role-')) {
                    const roleName = key.replace('chat-view-temp-role-', '');
                    const storedRole = this.getStoredTemporaryRole(roleName);
                    if (storedRole && !tempRoles.some(r => r.name === roleName)) {
                        tempRoles.push(storedRole);
                    }
                }
            }
        } catch (e) {
            console.error("获取临时角色时出错:", e);
        }
        
        // 找到角色选择器中的所有临时角色选项
        const roleSelect = this.roleSelector.querySelector(".chat-view-role-select") as HTMLSelectElement;
        if (roleSelect) {
            const tempOptions = Array.from(roleSelect.options).filter(opt => 
                opt.classList.contains("chat-view-temporary-role") || 
                opt.getAttribute("data-temp") === "true"
            );
            
            // 添加所有临时角色选项对应的角色对象
            tempOptions.forEach(opt => {
                const roleName = opt.value;
                // 确保没有重复添加
                if (!tempRoles.some(r => r.name === roleName)) {
                    // 尝试从会话存储中查找角色定义
                    const storedRole = this.getStoredTemporaryRole(roleName);
                    if (storedRole) {
                        tempRoles.push(storedRole);
                    }
                }
            });
        }
        
        // 如果当前选中的是临时角色，确保添加到列表
        if (this.selectedRole && this.isTemporaryRole(this.selectedRole.name)) {
            const exists = tempRoles.some(r => r.name === this.selectedRole?.name);
            if (!exists) {
                tempRoles.push(this.selectedRole);
                // 确保存储到sessionStorage
                this.storeTemporaryRole(this.selectedRole);
            }
        }
        
        return tempRoles;
    }
    
    /**
     * 获取存储的临时角色
     */
    private getStoredTemporaryRole(name: string): ChatRole | null {
        // 获取会话存储中的临时角色
        const sessionKey = `chat-view-temp-role-${name}`;
        const storedData = sessionStorage.getItem(sessionKey);
        
        if (storedData) {
            try {
                return JSON.parse(storedData) as ChatRole;
            } catch (e) {
                console.error("解析临时角色数据失败:", e);
            }
        }
        
        // 如果当前选中角色名称匹配且是临时角色
        if (this.selectedRole && this.selectedRole.name === name && this.isTemporaryRole(name)) {
            return this.selectedRole;
        }
        
        return null;
    }
    
    /**
     * 存储临时角色到会话存储
     */
    private storeTemporaryRole(role: ChatRole): void {
        try {
            const sessionKey = `chat-view-temp-role-${role.name}`;
            sessionStorage.setItem(sessionKey, JSON.stringify(role));
            console.log(`临时角色已存储: ${role.name}`);
        } catch (e) {
            console.error("存储临时角色失败:", e);
            new Notice("存储临时角色失败，请检查浏览器设置");
        }
    }
    
    /**
     * 删除临时角色
     */
    private async deleteTemporaryRole(roleName: string): Promise<void> {
        try {
            // 删除会话存储中的临时角色
            const sessionKey = `chat-view-temp-role-${roleName}`;
            sessionStorage.removeItem(sessionKey);
            
            // 如果当前选中的是要删除的角色，重置选中状态
            if (this.selectedRole?.name === roleName) {
            this.selectedRole = null;
            }
            
            // 重新加载角色选择器
            this.updateRoleSelector();
            
            // 选择第一个可用角色
            const roleSelect = this.roleSelector.querySelector(".chat-view-role-select") as HTMLSelectElement;
            if (roleSelect && roleSelect.options.length > 0) {
                roleSelect.selectedIndex = 0;
                const newSelectedValue = roleSelect.value;
                if (newSelectedValue && newSelectedValue !== "custom") {
                    const newTempFlag = roleSelect.options[0].getAttribute("data-temp") === "true";
                    if (newTempFlag) {
                        this.selectedRole = this.getStoredTemporaryRole(newSelectedValue);
                    } else {
                        this.selectedRole = this.plugin.settings.roles.find(r => r.name === newSelectedValue) || null;
                    }
                    this.updateRoleActionButtons(newTempFlag);
                }
            }
            
            new Notice(`已删除临时角色: ${roleName}`);
        } catch (e) {
            console.error("删除临时角色失败:", e);
            new Notice("删除临时角色失败");
        }
    }
    
    /**
     * 更新角色操作按钮
     */
    private updateRoleActionButtons(isTemp: boolean, container?: HTMLElement): void {
        // 获取或创建按钮容器
        const actionsContainer = container || this.roleSelector.querySelector(".chat-view-role-actions-container");
        if (!actionsContainer) return;
        
        // 清空容器
        actionsContainer.empty();
        
        if (isTemp && this.selectedRole) {
            // 为临时角色添加编辑和删除按钮
            try {
                // 编辑按钮
                const editButton = actionsContainer.createEl("button", {
                    cls: "chat-view-temp-role-edit",
                    attr: { "aria-label": "编辑临时角色", "title": "编辑角色" }
                });
                editButton.innerHTML = "✏️";
                
                // 删除按钮
                const deleteButton = actionsContainer.createEl("button", {
                    cls: "chat-view-temp-role-delete",
                    attr: { "aria-label": "删除临时角色", "title": "删除角色" }
                });
                deleteButton.innerHTML = "❌";
                
                // 编辑按钮点击事件
                editButton.addEventListener("click", async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    await this.showCustomRoleModal(this.selectedRole);
                });
                
                // 删除按钮点击事件
                deleteButton.addEventListener("click", async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (this.selectedRole) {
                        await this.deleteTemporaryRole(this.selectedRole.name);
                    }
                });
            } catch (e) {
                console.error("创建临时角色按钮失败:", e);
            }
        }
    }
    
    /**
     * 显示自定义角色创建模态框
     */
    private async showCustomRoleModal(editRole?: ChatRole | null): Promise<void> {
        // 创建模态框背景
        const modalOverlay = document.createElement("div");
        modalOverlay.className = "chat-view-modal-overlay";
        document.body.appendChild(modalOverlay);
        
        // 创建模态框容器
        const modalContainer = document.createElement("div");
        modalContainer.className = "chat-view-modal-container";
        modalOverlay.appendChild(modalContainer);
        
        // 创建模态框标题
        const modalTitle = document.createElement("h3");
        modalTitle.textContent = editRole ? "编辑临时角色" : "创建临时角色";
        modalTitle.className = "chat-view-modal-title";
        modalContainer.appendChild(modalTitle);
        
        // 创建表单
        const form = document.createElement("div");
        form.className = "chat-view-modal-form";
        modalContainer.appendChild(form);
        
        // 名称输入
        const nameContainer = document.createElement("div");
        nameContainer.className = "chat-view-modal-input-group";
        form.appendChild(nameContainer);
        
        const nameLabel = document.createElement("label");
        nameLabel.textContent = "角色名称:";
        nameContainer.appendChild(nameLabel);
        
        const nameInput = document.createElement("input");
        nameInput.type = "text";
        nameInput.placeholder = "输入角色名称";
        nameInput.value = editRole ? editRole.name : "临时角色";
        nameContainer.appendChild(nameInput);
        
        // 位置选择
        const positionContainer = document.createElement("div");
        positionContainer.className = "chat-view-modal-input-group";
        form.appendChild(positionContainer);
        
        const positionLabel = document.createElement("label");
        positionLabel.textContent = "位置:";
        positionContainer.appendChild(positionLabel);
        
        const positionSelect = document.createElement("select");
        
        const positions = [
            { value: "left", text: "左侧" },
            { value: "right", text: "右侧" },
            { value: "center", text: "居中" }
        ];
        
        positions.forEach(pos => {
            const option = document.createElement("option");
            option.value = pos.value;
            option.textContent = pos.text;
            positionSelect.appendChild(option);
        });
        
        // 默认选择右侧或已有角色位置
        positionSelect.value = editRole ? editRole.position : "right";
        positionContainer.appendChild(positionSelect);
        
        // 颜色选择
        const colorContainer = document.createElement("div");
        colorContainer.className = "chat-view-modal-input-group";
        form.appendChild(colorContainer);
        
        const colorLabel = document.createElement("label");
        colorLabel.textContent = "颜色:";
        colorContainer.appendChild(colorLabel);
        
        const colorSelect = document.createElement("select");
        
        const colors = [
            { value: "red", text: "红色" },
            { value: "orange", text: "橙色" },
            { value: "yellow", text: "黄色" },
            { value: "green", text: "绿色" },
            { value: "blue", text: "蓝色" },
            { value: "purple", text: "紫色" },
            { value: "grey", text: "灰色" },
            { value: "brown", text: "棕色" },
            { value: "indigo", text: "靛蓝" },
            { value: "teal", text: "青色" },
            { value: "pink", text: "粉色" },
            { value: "slate", text: "石板色" },
            { value: "wood", text: "木色" }
        ];
        
        colors.forEach(color => {
            const option = document.createElement("option");
            option.value = color.value;
            option.textContent = color.text;
            colorSelect.appendChild(option);
            
            // 添加颜色预览
            const colorPreview = document.createElement("span");
            colorPreview.className = `chat-view-color-preview chat-view-${color.value}`;
            option.prepend(colorPreview);
        });
        
        // 默认选择蓝色或已有角色颜色
        colorSelect.value = editRole ? editRole.color : "blue";
        colorContainer.appendChild(colorSelect);
        
        // 保存设置选项
        const saveOptionContainer = document.createElement("div");
        saveOptionContainer.className = "chat-view-modal-checkbox-group";
        form.appendChild(saveOptionContainer);
        
        const saveCheckbox = document.createElement("input");
        saveCheckbox.type = "checkbox";
        saveCheckbox.id = "save-custom-role";
        saveOptionContainer.appendChild(saveCheckbox);
        
        const saveLabel = document.createElement("label");
        saveLabel.htmlFor = "save-custom-role";
        saveLabel.textContent = "同时保存此角色到设置";
        saveOptionContainer.appendChild(saveLabel);
        
        // 按钮区域
        const buttonContainer = document.createElement("div");
        buttonContainer.className = "chat-view-modal-buttons";
        modalContainer.appendChild(buttonContainer);
        
        // 取消按钮
        const cancelButton = document.createElement("button");
        cancelButton.textContent = "取消";
        cancelButton.className = "chat-view-modal-button chat-view-modal-button-secondary";
        buttonContainer.appendChild(cancelButton);
        
        // 创建/保存按钮
        const createButton = document.createElement("button");
        createButton.textContent = editRole ? "保存" : "创建";
        createButton.className = "chat-view-modal-button chat-view-modal-button-primary";
        buttonContainer.appendChild(createButton);
        
        // 取消按钮点击事件
        cancelButton.addEventListener("click", () => {
            modalOverlay.remove();
        });
        
        // 创建/保存按钮点击事件
        createButton.addEventListener("click", async () => {
            const roleName = nameInput.value.trim() || "临时角色";
            const position = positionSelect.value as 'left' | 'right' | 'center';
            const color = colorSelect.value;
            const saveToSettings = saveCheckbox.checked;
            
            // 检查角色名是否重复
            const isDuplicate = this.plugin.settings.roles.some(r => 
                r.name === roleName && (!editRole || r.name !== editRole.name)
            );
            
            if (isDuplicate) {
                new Notice("角色名不能重复");
                return;
            }
            
            // 创建新角色或更新现有角色
            const newRole: ChatRole = {
                name: roleName,
                position: position,
                color: color
            };
            
            // 如果是编辑模式且名称变了，需要删除旧的会话存储数据
            if (editRole) {
                const oldSessionKey = `chat-view-temp-role-${editRole.name}`;
                sessionStorage.removeItem(oldSessionKey);
            }
            
            if (saveToSettings) {
                // 检查是否已存在同名角色
                const existingIndex = this.plugin.settings.roles.findIndex(r => r.name === roleName);
                
                if (existingIndex >= 0) {
                    // 更新已有角色
                    this.plugin.settings.roles[existingIndex] = newRole;
                    new Notice(`已更新角色: ${roleName}`);
                } else {
                    // 添加新角色
                    this.plugin.settings.roles.push(newRole);
                    new Notice(`已添加角色: ${roleName}`);
                }
                
                await this.plugin.saveSettings();
                
                // 如果之前是临时角色，删除会话存储中的数据
                if (editRole) {
                    const sessionKey = `chat-view-temp-role-${editRole.name}`;
                    sessionStorage.removeItem(sessionKey);
                }
                
                // 设置为当前选中角色
                this.selectedRole = newRole;
                
                // 更新角色选择器
                this.updateRoleSelector();
                
                // 选中新添加的角色
                const roleSelect = this.roleSelector.querySelector(".chat-view-role-select") as HTMLSelectElement;
                if (roleSelect) {
                    const option = Array.from(roleSelect.options).find(opt => opt.value === roleName);
                    if (option) {
                        option.selected = true;
                        this.updateRoleActionButtons(false);
                    }
                }
            } else {
                // 临时角色，存储到会话存储中
                this.storeTemporaryRole(newRole);
                
                // 设置为当前选中角色
                this.selectedRole = newRole;
                
                // 更新角色选择器
                this.updateRoleSelector();
                
                // 选中新添加的临时角色
                const roleSelect = this.roleSelector.querySelector(".chat-view-role-select") as HTMLSelectElement;
                if (roleSelect) {
                    const option = Array.from(roleSelect.options).find(opt => 
                        opt.value === roleName && opt.getAttribute("data-temp") === "true"
                    );
                    if (option) {
                        option.selected = true;
                        this.updateRoleActionButtons(true);
                    }
                }
                
                // 如果是编辑模式，添加角色属性到当前聊天块
                if (editRole) {
                    await this.addRoleAttributesToCurrentChat(newRole);
                }
            }
            
            // 关闭模态框
            modalOverlay.remove();
        });
        
        // 自动聚焦到名称输入框
        setTimeout(() => nameInput.focus(), 50);
        
        // 点击背景关闭模态框
        modalOverlay.addEventListener("click", (e) => {
            if (e.target === modalOverlay) {
                modalOverlay.remove();
            }
        });
        
        // ESC键关闭模态框
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                modalOverlay.remove();
                document.removeEventListener("keydown", handleKeyDown);
            }
        };
        
        document.addEventListener("keydown", handleKeyDown);
    }
    
    /**
     * 添加角色属性到当前聊天块
     */
    private async addRoleAttributesToCurrentChat(role: ChatRole): Promise<void> {
        if (!this.targetFile) return;
        
        try {
            const content = await this.app.vault.read(this.targetFile);
            const chatBlocks = content.match(/```chat(?:-md)?\n([\s\S]*?)```/g) || [];
            
            if (chatBlocks.length > 0) {
                const currentIndex = this.plugin.settings.currentChatIndex;
                if (currentIndex >= 0 && currentIndex < chatBlocks.length) {
                    const currentBlock = chatBlocks[currentIndex];
                    const blockMatch = currentBlock.match(/```chat(?:-md)?\n([\s\S]*?)```/);
                    
                    if (!blockMatch) return;
                    const blockContent = blockMatch[1];
                    
                    // 检查是否已有颜色配置行
                    const lines = blockContent.split("\n");
                    const colorConfigIndex = lines.findIndex(line => /^\[.*\]$/.test(line.trim()));
                    
                    // 构建新的颜色配置
                    let newColorConfig = `[${role.name}=${role.color}]`;
                    
                    if (colorConfigIndex >= 0) {
                        // 如果已有配置行，在其中添加新角色
                        const existingConfig = lines[colorConfigIndex].trim();
                        const configContent = existingConfig.slice(1, -1); // 移除方括号
                        const configs = configContent.split(",").map(c => c.trim());
                        
                        // 检查是否已包含该角色的配置
                        const roleConfigIndex = configs.findIndex(c => c.startsWith(`${role.name}=`));
                        if (roleConfigIndex >= 0) {
                            configs[roleConfigIndex] = `${role.name}=${role.color}`;
                        } else {
                            configs.push(`${role.name}=${role.color}`);
                        }
                        
                        newColorConfig = `[${configs.join(", ")}]`;
                        lines[colorConfigIndex] = newColorConfig;
                    } else {
                        // 如果没有配置行，在开头添加
                        lines.unshift(newColorConfig);
                    }
                    
                    // 更新文件内容
                    const newBlockContent = lines.join("\n");
                    const newContent = content.replace(currentBlock, `\`\`\`chat-md\n${newBlockContent}\`\`\``);
                    await this.app.vault.modify(this.targetFile, newContent);
                    
                    // 重新加载内容
                    await this.loadFileContent();
                }
            }
        } catch (error) {
            console.error("添加角色属性到聊天块时出错:", error);
            new Notice("添加角色属性失败");
        }
    }
    
    /**
     * 更新预设信息显示
     */
    private updatePresetInfo(): void {
        const presetInfo = this.contentEl.querySelector(".chat-view-current-preset");
        if (presetInfo) {
            if (this.plugin.settings.currentPreset) {
                presetInfo.setText(`预设: ${this.plugin.settings.currentPreset}`);
            } else {
                presetInfo.setText("无预设");
            }
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
        if (message === "") return; // 允许没有选择角色但有消息内容
        
        // 如果没有选择角色，但有可用角色，自动选中第一个
        if (!this.selectedRole && this.plugin.settings.roles.length > 0) {
            this.selectedRole = this.plugin.settings.roles[0];
            // 更新角色选择器显示
            const roleSelect = this.roleSelector.querySelector(".chat-view-role-select") as HTMLSelectElement;
            if (roleSelect && roleSelect.options.length > 0) {
                roleSelect.selectedIndex = 0;
                roleSelect.setAttribute('data-selected-color', this.selectedRole.color);
            }
        }
        
        // 如果仍然没有选择角色，无法发送
        if (!this.selectedRole) {
            new Notice("请先选择一个角色");
            return;
        }
        
        if (!this.targetFile) {
            // 如果没有绑定文件，显示提示并返回
            new Notice("未能绑定目标文件，请在菜单中配置");
            // 不需要重新加载，避免重复提示
            return;
        }
        
        try {
            // 获取发送前的聊天块数量
            const beforeCount = await this.plugin.fileService.getChatBlocksCount(this.targetFile);
            
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
            
            // 获取发送后的聊天块数量
            const afterCount = await this.plugin.fileService.getChatBlocksCount(this.targetFile);
            
            // 如果聊天块数量增加了，说明创建了新的聊天块，更新下拉列表
            if (afterCount > beforeCount) {
                const chatBlockSelect = this.fileDisplay.querySelector(".chat-view-chatblock-select") as HTMLSelectElement;
                if (chatBlockSelect) {
                    await this.updateChatBlockSelect(chatBlockSelect);
                }
            }
            
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